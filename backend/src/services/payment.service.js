import { QueryCommand, PutCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo as docClient } from '../db/dynamoClient.js';
import { v4 as uuidv4 } from 'uuid';

export async function fetchPayments(userId) {
    const result = await docClient.send(new QueryCommand({
        TableName: 'PaymentMethods',
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: { ':uid': userId },
    }));
    return result.Items || [];
}

export async function addPaymentMethod(userId, { stripePaymentMethodId, stripeCustomerId, brand, last4, expiry, isDefault = false }) {
    const paymentId = uuidv4();
    const item = { paymentId, userId, stripePaymentMethodId, stripeCustomerId, brand, last4, expiry, isDefault };
    await docClient.send(new PutCommand({ TableName: 'PaymentMethods', Item: item }));
    return item;
}

export async function patchPaymentMethod(userId, paymentId, fields) {
    const allowed = ['isDefault', 'expiry'];
    const updates = Object.keys(fields).filter(k => allowed.includes(k));
    if (updates.length === 0) throw new Error('No valid fields to update');

    const UpdateExpression = 'SET ' + updates.map(k => `#${k} = :${k}`).join(', ');
    const ExpressionAttributeNames = Object.fromEntries(updates.map(k => [`#${k}`, k]));
    const ExpressionAttributeValues = Object.fromEntries(updates.map(k => [`:${k}`, fields[k]]));

    const result = await docClient.send(new UpdateCommand({
        TableName: 'PaymentMethods',
        Key: { userId, paymentId },
        UpdateExpression,
        ExpressionAttributeNames,
        ExpressionAttributeValues,
        ReturnValues: 'ALL_NEW',
    }));
    return result.Attributes;
}

export async function removePaymentMethod(userId, paymentId) {
    await docClient.send(new DeleteCommand({
        TableName: 'PaymentMethods',
        Key: { userId, paymentId },
    }));
}