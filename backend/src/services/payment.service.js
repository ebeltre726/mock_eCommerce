// payment.service.js
import { GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo } from '../db/dynamoClient.js';
import { v4 as uuidv4 } from 'uuid';

const TABLE = 'Furnituria';

export async function fetchPayments(userId) {
    const result = await dynamo.send(new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
            ':pk': `USER#${userId}`,
            ':sk': 'PAYMENT#',
        },
    }));
    return result.Items || [];
}

export async function addPaymentMethod(userId, { stripePaymentMethodId, stripeCustomerId, brand, last4, expiry, isDefault = false }) {
    const paymentId = uuidv4();
    const item = {
        PK: `USER#${userId}`,
        SK: `PAYMENT#${paymentId}`,
        entityType: 'PAYMENT',
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
    return item;
}

export async function patchPaymentMethod(userId, paymentId, fields) {
    const allowed = ['isDefault', 'expiry'];
    const updates = Object.keys(fields).filter(k => allowed.includes(k));
    if (updates.length === 0) throw new Error('No valid fields to update');

    const UpdateExpression = 'SET ' + updates.map(k => `#${k} = :${k}`).join(', ');
    const ExpressionAttributeNames = Object.fromEntries(updates.map(k => [`#${k}`, k]));
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
    return result.Attributes;
}

export async function removePaymentMethod(userId, paymentId) {
    await dynamo.send(new DeleteCommand({
        TableName: TABLE,
        Key: {
            PK: `USER#${userId}`,
            SK: `PAYMENT#${paymentId}`,
        },
    }));
}