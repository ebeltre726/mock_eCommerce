// address.service.js
import { GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo } from '../db/dynamoClient.js';
import { v4 as uuidv4 } from 'uuid';

const TABLE = 'Furnituria';

export async function fetchAddresses(userId) {
    const result = await dynamo.send(new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
            ':pk': `USER#${userId}`,
            ':sk': 'ADDRESS#',
        },
    }));
    return result.Items || [];
}

export async function addAddress(userId, addressData) {
    const addressId = uuidv4();
    const item = {
        PK: `USER#${userId}`,
        SK: `ADDRESS#${addressId}`,
        entityType: 'ADDRESS',
        userId,
        addressId,
        ...addressData,
    };
    await dynamo.send(new PutCommand({ TableName: TABLE, Item: item }));
    return item;
}

export async function patchAddress(userId, addressId, fields) {
    const allowed = ['label', 'line1', 'line2', 'city', 'state', 'zip', 'country', 'isDefault'];
    const updates = Object.keys(fields).filter(k => allowed.includes(k));
    if (updates.length === 0) throw new Error('No valid fields to update');

    const UpdateExpression = 'SET ' + updates.map(k => `#${k} = :${k}`).join(', ');
    const ExpressionAttributeNames = Object.fromEntries(updates.map(k => [`#${k}`, k]));
    const ExpressionAttributeValues = Object.fromEntries(updates.map(k => [`:${k}`, fields[k]]));

    const result = await dynamo.send(new UpdateCommand({
        TableName: TABLE,
        Key: {
            PK: `USER#${userId}`,
            SK: `ADDRESS#${addressId}`,
        },
        UpdateExpression,
        ExpressionAttributeNames,
        ExpressionAttributeValues,
        ReturnValues: 'ALL_NEW',
    }));
    return result.Attributes;
}

export async function removeAddress(userId, addressId) {
    await dynamo.send(new DeleteCommand({
        TableName: TABLE,
        Key: {
            PK: `USER#${userId}`,
            SK: `ADDRESS#${addressId}`,
        },
    }));
}