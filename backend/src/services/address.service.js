import { QueryCommand, PutCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo as docClient } from '../db/dynamoClient.js';
import { v4 as uuidv4 } from 'uuid';

export async function fetchAddresses(userId) {
    const result = await docClient.send(new QueryCommand({
        TableName: 'Addresses',
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: { ':uid': userId },
    }));
    return result.Items || [];
}

export async function addAddress(userId, fields) {
    const addressId = uuidv4();
    const item = { userId, addressId, ...fields };
    await docClient.send(new PutCommand({ TableName: 'Addresses', Item: item }));
    return item;
}

export async function patchAddress(userId, addressId, fields) {
    const allowed = ['label', 'line1', 'line2', 'city', 'state', 'zip', 'country', 'isDefault'];
    const updates = Object.keys(fields).filter(k => allowed.includes(k));
    if (updates.length === 0) throw new Error('No valid fields to update');

    const UpdateExpression = 'SET ' + updates.map(k => `#${k} = :${k}`).join(', ');
    const ExpressionAttributeNames = Object.fromEntries(updates.map(k => [`#${k}`, k]));
    const ExpressionAttributeValues = Object.fromEntries(updates.map(k => [`:${k}`, fields[k]]));

    const result = await docClient.send(new UpdateCommand({
        TableName: 'Addresses',
        Key: { userId, addressId },
        UpdateExpression,
        ExpressionAttributeNames,
        ExpressionAttributeValues,
        ReturnValues: 'ALL_NEW',
    }));
    return result.Attributes;
}

export async function removeAddress(userId, addressId) {
    await docClient.send(new DeleteCommand({
        TableName: 'Addresses',
        Key: { userId, addressId },
    }));
}