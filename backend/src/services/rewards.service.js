// rewards.service.js
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo } from '../db/dynamoClient.js';
import env from '../config/env.js';

const TABLE = env.DYNAMODB_TABLE;

export async function fetchRewards(userId) {
    const result = await dynamo.send(new GetCommand({
        TableName: TABLE,
        Key: {
            PK: `USER#${userId}`,
            SK: 'REWARDS',
        },
    }));
    return result.Item ?? {
        userId,
        points: 0,
        tier: 'Bronze',
        deals: [],
    };
}