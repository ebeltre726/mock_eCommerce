// rewards.service.js
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo } from '../db/dynamoClient.js';

const TABLE = process.env.DYNAMODB_TABLE ?? 'Furnitria';

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