import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo as docClient } from '../db/dynamoClient.js';

export async function fetchOverview(userId) {
    const result = await docClient.send(new GetCommand({
        TableName: 'Users',
        Key: { userId },
    }));
    if (!result.Item) throw new Error('User not found');
    const { userId: id, firstName, lastName, email, avatar, dateCreated, stats } = result.Item;
    return { userId: id, firstName, lastName, email, avatar, dateCreated, stats };
}

export async function patchOverview(userId, fields) {
    const allowed = ['firstName', 'lastName', 'avatar'];
    const updates = Object.keys(fields).filter(k => allowed.includes(k));
    if (updates.length === 0) throw new Error('No valid fields to update');

    const UpdateExpression = 'SET ' + updates.map(k => `#${k} = :${k}`).join(', ');
    const ExpressionAttributeNames = Object.fromEntries(updates.map(k => [`#${k}`, k]));
    const ExpressionAttributeValues = Object.fromEntries(updates.map(k => [`:${k}`, fields[k]]));

    const result = await docClient.send(new UpdateCommand({
        TableName: 'Users',
        Key: { userId },
        UpdateExpression,
        ExpressionAttributeNames,
        ExpressionAttributeValues,
        ReturnValues: 'ALL_NEW',
    }));
    return result.Attributes;
}

export async function incrementStat(userId, statName, amount = 1) {
    await docClient.send(new UpdateCommand({
        TableName: 'Users',
        Key: { userId },
        UpdateExpression: 'ADD stats.#stat :amount',
        ExpressionAttributeNames: { '#stat': statName },
        ExpressionAttributeValues: { ':amount': amount },
    }));
}