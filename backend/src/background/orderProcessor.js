// orderProcessor.js
//
// EventBridge-triggered Lambda that advances confirmed orders through the
// fulfilment lifecycle using the GSI1PK-createdAt-index GSI:
//
//   confirmed  → processing  (after ORDER_PROCESSING_DELAY_MS, default 30 min)
//   processing → shipped     (after ORDER_SHIPPED_DELAY_MS,    default 2 h)
//   shipped    → delivered   (after ORDER_DELIVERED_DELAY_MS,  default 6 h)
//
// Each status bucket is its own GSI partition key ("ORDER#confirmed" etc.), so
// a single Query reads exactly the stale items without a full-table scan.
//
// An optimistic ConditionExpression on each UpdateCommand prevents races when
// multiple invocations overlap (EventBridge has at-least-once delivery).
//
// SES emails are fire-and-forget (.catch) so a transient SES failure never
// rolls back a successful status advance.

import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { dynamo } from '../db/dynamoClient.js';
import { sendOrderShipped, sendOrderDelivered } from '../services/email.service.js';
import logger from '../utils/logger.js';

const TABLE   = process.env.DYNAMODB_TABLE;
const GSI     = process.env.DYNAMODB_GSI_NAME ?? 'GSI1PK-createdAt-index';

// Configurable delays — override in Terraform env vars for testing.
const PROCESSING_DELAY = parseInt(process.env.ORDER_PROCESSING_DELAY_MS  ?? String(30 * 60 * 1000));
const SHIPPED_DELAY    = parseInt(process.env.ORDER_SHIPPED_DELAY_MS     ?? String(2 * 3600 * 1000));
const DELIVERED_DELAY  = parseInt(process.env.ORDER_DELIVERED_DELAY_MS   ?? String(6 * 3600 * 1000));

let stripeLoaded = false;

async function loadStripeKey() {
    if (stripeLoaded) return;
    const ssmParam = process.env.STRIPE_SECRET_SSM;
    if (ssmParam && !process.env.STRIPE_SECRET_KEY) {
        const ssm = new SSMClient({ region: process.env.AWS_REGION });
        const { Parameter } = await ssm.send(new GetParameterCommand({ Name: ssmParam, WithDecryption: true }));
        process.env.STRIPE_SECRET_KEY = Parameter.Value;
    }
    stripeLoaded = true;
}

// Query the GSI for all ORDER#<status> items whose createdAt is older than
// `minAgeMs` milliseconds, then advance each one to `toStatus`.
async function advanceOrders(fromStatus, minAgeMs, toStatus, emailFn) {
    const cutoff = new Date(Date.now() - minAgeMs).toISOString();

    // Paginate in case there are more than one page of stale orders.
    let lastKey;
    let advanced = 0;

    do {
        const result = await dynamo.send(new QueryCommand({
            TableName:                 TABLE,
            IndexName:                 GSI,
            KeyConditionExpression:    'GSI1PK = :pk AND createdAt < :cutoff',
            ExpressionAttributeValues: { ':pk': `ORDER#${fromStatus}`, ':cutoff': cutoff },
            ...(lastKey && { ExclusiveStartKey: lastKey }),
        }));

        const items = result.Items ?? [];

        await Promise.all(items.map(async (item) => {
            try {
                await dynamo.send(new UpdateCommand({
                    TableName:                 TABLE,
                    Key:                       { PK: item.PK, SK: item.SK },
                    UpdateExpression:          'SET #st = :to, GSI1PK = :newGsi, updatedAt = :now',
                    // Optimistic lock: skip if another invocation already advanced this item.
                    ConditionExpression:       '#st = :from',
                    ExpressionAttributeNames:  { '#st': 'status' },
                    ExpressionAttributeValues: {
                        ':to':     toStatus,
                        ':from':   fromStatus,
                        ':newGsi': `ORDER#${toStatus}`,
                        ':now':    new Date().toISOString(),
                    },
                }));
                advanced++;
                logger.info({ orderId: item.orderId, from: fromStatus, to: toStatus }, '[orderProcessor] advanced');

                if (emailFn && item.userEmail) {
                    emailFn({ email: item.userEmail, firstName: item.fullName?.split(' ')[0], orderId: item.orderId })
                        .catch(e => logger.warn({ err: e.message, orderId: item.orderId }, '[orderProcessor] email failed'));
                }
            } catch (err) {
                if (err instanceof ConditionalCheckFailedException || err.name === 'ConditionalCheckFailedException') {
                    logger.info({ orderId: item.orderId }, '[orderProcessor] already advanced by concurrent invocation — skipping');
                } else {
                    logger.error({ err: err.message, orderId: item.orderId }, '[orderProcessor] update failed');
                }
            }
        }));

        lastKey = result.LastEvaluatedKey;
    } while (lastKey);

    return advanced;
}

export const handler = async () => {
    await loadStripeKey();

    const [toProcessing, toShipped, toDelivered] = await Promise.all([
        advanceOrders('confirmed',  PROCESSING_DELAY, 'processing', null),
        advanceOrders('processing', SHIPPED_DELAY,    'shipped',    sendOrderShipped),
        advanceOrders('shipped',    DELIVERED_DELAY,  'delivered',  sendOrderDelivered),
    ]);

    logger.info({ toProcessing, toShipped, toDelivered }, '[orderProcessor] run complete');
    return { toProcessing, toShipped, toDelivered };
};
