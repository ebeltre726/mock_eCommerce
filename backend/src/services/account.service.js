import { GetCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo } from '../db/dynamoClient.js';

const TABLE_NAME = 'Furnituria';

export async function fetchOverview(userId) {
    const [profile, orders, returns, wishlist] = await Promise.all([
        dynamo.send(new GetCommand({
            TableName: TABLE_NAME,
            Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
        })),
        dynamo.send(new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
            ExpressionAttributeValues: { ':pk': `USER#${userId}`, ':sk': 'ORDER#' },
            Select: 'COUNT',
        })),
        dynamo.send(new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
            ExpressionAttributeValues: { ':pk': `USER#${userId}`, ':sk': 'RETURN#' },
            Select: 'COUNT',
        })),
        dynamo.send(new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
            ExpressionAttributeValues: { ':pk': `USER#${userId}`, ':sk': 'WISHLIST#' },
            Select: 'COUNT',
        })),
    ]);

    const rewards = await dynamo.send(new GetCommand({
    TableName: TABLE_NAME,
      Key: {
          PK: `USER#${userId}`,
          SK: 'REWARDS',
      },
    }));

    return {
        ...profile.Item,
        stats: {
            orders:   orders.Count          ?? 0,
            returns:  returns.Count         ?? 0,
            wishlist: wishlist.Count        ?? 0,
            points:   rewards.Item?.points  ?? 0, // ← single source of truth
        },
    };
}

export async function patchOverview(userId, fields) {
    const allowed = ['firstName', 'lastName', 'avatar'];
    const updates = Object.keys(fields).filter(k => allowed.includes(k));
    if (updates.length === 0) throw new Error('No valid fields to update');

    const UpdateExpression = 'SET ' + updates.map(k => `#${k} = :${k}`).join(', ');
    const ExpressionAttributeNames = Object.fromEntries(updates.map(k => [`#${k}`, k]));
    const ExpressionAttributeValues = Object.fromEntries(updates.map(k => [`:${k}`, fields[k]]));

    const result = await dynamo.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
            PK: `USER#${userId}`,
            SK: 'PROFILE',
        },
        UpdateExpression,
        ExpressionAttributeNames,
        ExpressionAttributeValues,
        ReturnValues: 'ALL_NEW',
    }));
    return result.Attributes;
}

export async function incrementStat(userId, statName, amount = 1) {
    await dynamo.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
            PK: `USER#${userId}`,
            SK: 'PROFILE',
        },
        UpdateExpression: 'ADD stats.#stat :amount',
        ExpressionAttributeNames: { '#stat': statName },
        ExpressionAttributeValues: { ':amount': amount },
    }));
}