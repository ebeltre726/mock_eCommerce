import { GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo } from '../db/dynamoClient.js';
import { v4 as uuidv4 } from 'uuid';

const TABLE = 'Furnituria';

// ─── Shape helper ─────────────────────────────────────────────────────────────
// Returns only the fields the frontend and order.service.js need.
// Raw DynamoDB internals (PK, SK, entityType) are never exposed.

function toPublicMethod(item) {
    return {
        paymentId:             item.paymentId,
        stripePaymentMethodId: item.stripePaymentMethodId,
        brand:                 item.brand   ?? 'unknown',
        last4:                 item.last4   ?? '••••',
        expiry:                item.expiry  ?? '',
        isDefault:             item.isDefault ?? false,
    };
}

// ─── Fetch all payment methods for a user ─────────────────────────────────────

export async function fetchPayments(userId) {
    const result = await dynamo.send(new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
            ':pk': `USER#${userId}`,
            ':sk': 'PAYMENT#',
        },
    }));

    return (result.Items || []).map(toPublicMethod);
}

// ─── Add a payment method ─────────────────────────────────────────────────────

export async function addPaymentMethod(
    userId,
    { stripePaymentMethodId, stripeCustomerId, brand, last4, expiry, isDefault = false },
) {
    const paymentId = uuidv4();

    const item = {
        PK:                    `USER#${userId}`,
        SK:                    `PAYMENT#${paymentId}`,
        entityType:            'PAYMENT',
        paymentId,
        userId,
        stripePaymentMethodId,
        stripeCustomerId,
        brand,
        last4,
        expiry,
        isDefault,
    };

    await dynamo.send(new PutCommand({ TableName: TABLE, Item: item }));

    return toPublicMethod(item);
}

// ─── Patch a payment method ───────────────────────────────────────────────────

export async function patchPaymentMethod(userId, paymentId, fields) {
    const allowed = ['isDefault', 'expiry'];
    const updates = Object.keys(fields).filter(k => allowed.includes(k));
    if (updates.length === 0) throw new Error('No valid fields to update');

    const UpdateExpression        = 'SET ' + updates.map(k => `#${k} = :${k}`).join(', ');
    const ExpressionAttributeNames  = Object.fromEntries(updates.map(k => [`#${k}`, k]));
    const ExpressionAttributeValues = Object.fromEntries(updates.map(k => [`:${k}`, fields[k]]));

    const result = await dynamo.send(new UpdateCommand({
        TableName: TABLE,
        Key: {
            PK: `USER#${userId}`,
            SK: `PAYMENT#${paymentId}`,
        },
        UpdateExpression,
        ExpressionAttributeNames,
        ExpressionAttributeValues,
        ReturnValues: 'ALL_NEW',
    }));

    return toPublicMethod(result.Attributes);
}

// ─── Remove a payment method ──────────────────────────────────────────────────

export async function removePaymentMethod(userId, paymentId) {
    await dynamo.send(new DeleteCommand({
        TableName: TABLE,
        Key: {
            PK: `USER#${userId}`,
            SK: `PAYMENT#${paymentId}`,
        },
    }));
}