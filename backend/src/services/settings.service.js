import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo as docClient } from '../db/dynamoClient.js';

export async function fetchSettings(userId) {
    const result = await docClient.send(new GetCommand({
        TableName: 'Settings',
        Key: { userId },
    }));
    if (!result.Item) throw new Error('Settings not found');
    return result.Item;
}

export async function patchSettings(userId, fields) {
    const allowed = ['shareData', 'emailUpdates', 'smsNotifications'];
    const updates = Object.keys(fields).filter(k => allowed.includes(k));
    if (updates.length === 0) throw new Error('No valid fields to update');

    const UpdateExpression = 'SET ' + updates.map(k => `#${k} = :${k}`).join(', ');
    const ExpressionAttributeNames = Object.fromEntries(updates.map(k => [`#${k}`, k]));
    const ExpressionAttributeValues = Object.fromEntries(updates.map(k => [`:${k}`, fields[k]]));

    const result = await docClient.send(new UpdateCommand({
        TableName: 'Settings',
        Key: { userId },
        UpdateExpression,
        ExpressionAttributeNames,
        ExpressionAttributeValues,
        ReturnValues: 'ALL_NEW',
    }));
    return result.Attributes;
}