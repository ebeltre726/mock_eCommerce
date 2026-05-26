// returnProcessor.js
//
// EventBridge-triggered Lambda that drives the return/refund lifecycle:
//
//   Pending  → Approved  (auto-approval after RETURN_APPROVAL_DELAY_MS, default 24 h)
//   Approved → Refunded  (immediately: call Stripe Refunds API, then update DynamoDB)
//   Approved → refund_failed  (if Stripe returns a non-retryable error)
//
// Stripe error mapping:
//   charge_already_refunded       → refund_failed (already_refunded)
//   charge_disputed               → refund_failed (disputed) — manual review needed
//   payment_intent_unexpected_state → refund_failed (unexpected_state)
//   insufficient_funds / balance_insufficient → retry-eligible, left Approved
//   All other Stripe errors        → refund_failed (stripe_error)
//
// Design notes:
//   - GSI1PK is updated atomically with the status so the next run never
//     re-processes an already-advanced return.
//   - ConditionalCheckFailedException is swallowed — it means a concurrent
//     invocation already handled this record (at-least-once EventBridge delivery).
//   - Stripe calls use the PaymentIntent ID stored on the parent order record.
//   - refundAmount is populated from the matching item price in the order, not
//     the client-submitted value, to prevent over-refunds.

import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { QueryCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import Stripe from 'stripe';
import { dynamo } from '../db/dynamoClient.js';
import { sendRefundProcessed } from '../services/email.service.js';
import logger from '../utils/logger.js';

const TABLE  = process.env.DYNAMODB_TABLE;
const GSI    = process.env.DYNAMODB_GSI_NAME ?? 'GSI1PK-createdAt-index';

const APPROVAL_DELAY = parseInt(process.env.RETURN_APPROVAL_DELAY_MS ?? String(24 * 3600 * 1000));

// Stripe errors that will never succeed on retry — fail the return immediately.
const NON_RETRYABLE_CODES = new Set([
    'charge_already_refunded',
    'charge_disputed',
    'payment_intent_unexpected_state',
    'payment_intent_incompatible_payment_method',
]);

// Errors that may resolve on the next run — leave the return as Approved.
const RETRYABLE_CODES = new Set([
    'balance_insufficient',
    'insufficient_funds',
]);

let stripe;

async function loadStripeKey() {
    if (stripe) return;
    const ssmParam = process.env.STRIPE_SECRET_SSM;
    if (ssmParam && !process.env.STRIPE_SECRET_KEY) {
        const ssm = new SSMClient({ region: process.env.AWS_REGION });
        const { Parameter } = await ssm.send(new GetParameterCommand({ Name: ssmParam, WithDecryption: true }));
        process.env.STRIPE_SECRET_KEY = Parameter.Value;
    }
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-11-20.acacia' });
}

// ── Phase 1: Pending → Approved ──────────────────────────────────────────────

async function approvePendingReturns() {
    const cutoff = new Date(Date.now() - APPROVAL_DELAY).toISOString();
    let lastKey;
    let approved = 0;

    do {
        const result = await dynamo.send(new QueryCommand({
            TableName:                 TABLE,
            IndexName:                 GSI,
            KeyConditionExpression:    'GSI1PK = :pk AND createdAt < :cutoff',
            ExpressionAttributeValues: { ':pk': 'RETURN#Pending', ':cutoff': cutoff },
            ...(lastKey && { ExclusiveStartKey: lastKey }),
        }));

        await Promise.all((result.Items ?? []).map(async (ret) => {
            try {
                const now = new Date().toISOString();
                await dynamo.send(new UpdateCommand({
                    TableName:                 TABLE,
                    Key:                       { PK: ret.PK, SK: ret.SK },
                    UpdateExpression:          'SET #st = :to, GSI1PK = :newGsi, dateApproved = :now, updatedAt = :now',
                    ConditionExpression:       '#st = :from',
                    ExpressionAttributeNames:  { '#st': 'status' },
                    ExpressionAttributeValues: {
                        ':to':     'Approved',
                        ':from':   'Pending',
                        ':newGsi': 'RETURN#Approved',
                        ':now':    now,
                    },
                }));
                approved++;
                logger.info({ returnId: ret.returnId }, '[returnProcessor] approved');
            } catch (err) {
                if (err instanceof ConditionalCheckFailedException || err.name === 'ConditionalCheckFailedException') {
                    logger.info({ returnId: ret.returnId }, '[returnProcessor] already advanced — skipping');
                } else {
                    logger.error({ err: err.message, returnId: ret.returnId }, '[returnProcessor] approve failed');
                }
            }
        }));

        lastKey = result.LastEvaluatedKey;
    } while (lastKey);

    return approved;
}

// ── Phase 2: Approved → Refunded | refund_failed ─────────────────────────────

async function processApprovedReturns() {
    let lastKey;
    let refunded = 0;
    let failed   = 0;

    do {
        const result = await dynamo.send(new QueryCommand({
            TableName:                 TABLE,
            IndexName:                 GSI,
            // No age filter: process all Approved returns immediately.
            KeyConditionExpression:    'GSI1PK = :pk',
            ExpressionAttributeValues: { ':pk': 'RETURN#Approved' },
            ...(lastKey && { ExclusiveStartKey: lastKey }),
        }));

        await Promise.all((result.Items ?? []).map(async (ret) => {
            const outcome = await processOneRefund(ret);
            if (outcome === 'refunded') refunded++;
            if (outcome === 'failed')   failed++;
        }));

        lastKey = result.LastEvaluatedKey;
    } while (lastKey);

    return { refunded, failed };
}

async function processOneRefund(ret) {
    // Fetch the parent order to get stripePaymentIntentId and the item price.
    const orderResult = await dynamo.send(new GetCommand({
        TableName: TABLE,
        Key: { PK: ret.PK, SK: `ORDER#${ret.orderId}` },
    }));

    const order = orderResult.Item;
    if (!order?.stripePaymentIntentId) {
        logger.warn({ returnId: ret.returnId }, '[returnProcessor] order has no payment intent — skipping refund');
        return 'skipped';
    }

    // Derive refund amount from the item price stored on the order.
    // Never trust the value on the return record (it starts at 0.00).
    const matchedItem = (order.items ?? []).find(
        i => i.productId === ret.itemId || i.name === ret.item,
    );
    const refundAmountDollars = matchedItem?.price ?? 0;
    const refundAmountCents   = Math.round(refundAmountDollars * 100);

    if (refundAmountCents <= 0) {
        logger.warn({ returnId: ret.returnId }, '[returnProcessor] item price is zero — skipping refund');
        return 'skipped';
    }

    try {
        const refund = await stripe.refunds.create(
            {
                payment_intent: order.stripePaymentIntentId,
                amount:         refundAmountCents,
                metadata:       { returnId: ret.returnId, orderId: ret.orderId },
            },
            { idempotencyKey: `refund-${ret.returnId}` },
        );

        const now = new Date().toISOString();
        await markRefunded(ret, refundAmountDollars, refund.id, now);

        if (ret.userEmail) {
            sendRefundProcessed({
                email:        ret.userEmail,
                firstName:    ret.userFullName?.split(' ')[0] ?? 'there',
                orderId:      ret.orderId,
                refundAmount: refundAmountDollars,
            }).catch(e => logger.warn({ err: e.message }, '[returnProcessor] refund email failed'));
        }

        logger.info({ returnId: ret.returnId, refundId: refund.id, amount: refundAmountDollars }, '[returnProcessor] refunded');
        return 'refunded';

    } catch (err) {
        const code = err.code ?? err.raw?.code ?? 'unknown';
        logger.error({ err: err.message, code, returnId: ret.returnId }, '[returnProcessor] Stripe refund error');

        if (RETRYABLE_CODES.has(code)) {
            // Leave as Approved — will retry on next invocation.
            logger.info({ code, returnId: ret.returnId }, '[returnProcessor] retryable error — leaving Approved');
            return 'retry';
        }

        // Non-retryable or unknown error — mark failed with the Stripe error code
        // so an operator can inspect it without diving into logs.
        const reason = NON_RETRYABLE_CODES.has(code) ? code : 'stripe_error';
        await markRefundFailed(ret, reason).catch(
            e => logger.error({ err: e.message }, '[returnProcessor] failed to write refund_failed status'),
        );
        return 'failed';
    }
}

async function markRefunded(ret, refundAmount, stripeRefundId, now) {
    await dynamo.send(new UpdateCommand({
        TableName:                 TABLE,
        Key:                       { PK: ret.PK, SK: ret.SK },
        UpdateExpression:          'SET #st = :to, GSI1PK = :newGsi, refundAmount = :amt, stripeRefundId = :rid, dateRefunded = :now, updatedAt = :now',
        ConditionExpression:       '#st = :from',
        ExpressionAttributeNames:  { '#st': 'status' },
        ExpressionAttributeValues: {
            ':to':     'Refunded',
            ':from':   'Approved',
            ':newGsi': 'RETURN#Refunded',
            ':amt':    String(refundAmount.toFixed(2)),
            ':rid':    stripeRefundId,
            ':now':    now,
        },
    }));
}

async function markRefundFailed(ret, reason) {
    const now = new Date().toISOString();
    await dynamo.send(new UpdateCommand({
        TableName:                 TABLE,
        Key:                       { PK: ret.PK, SK: ret.SK },
        UpdateExpression:          'SET #st = :to, GSI1PK = :newGsi, refundFailReason = :reason, updatedAt = :now',
        ConditionExpression:       '#st = :from',
        ExpressionAttributeNames:  { '#st': 'status' },
        ExpressionAttributeValues: {
            ':to':     'refund_failed',
            ':from':   'Approved',
            ':newGsi': 'RETURN#refund_failed',
            ':reason': reason,
            ':now':    now,
        },
    }));
}

// ── Lambda entry point ────────────────────────────────────────────────────────

export const handler = async () => {
    await loadStripeKey();

    // Phase 1 first so any just-approved returns are visible in the GSI before
    // phase 2 runs (pagination could otherwise miss them this tick, which is fine
    // for production but makes the demo feel more responsive).
    const newlyApproved = await approvePendingReturns();
    const { refunded, failed } = await processApprovedReturns();

    logger.info({ newlyApproved, refunded, failed }, '[returnProcessor] run complete');
    return { newlyApproved, refunded, failed };
};
