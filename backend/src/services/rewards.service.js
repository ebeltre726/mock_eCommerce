import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo } from '../db/dynamoClient.js';

export async function fetchRewards(userId) {
    const result = await dynamo.send(new GetCommand({
        TableName: 'Rewards',
        Key: { userId },
    }));
    // Return defaults instead of throwing
    return result.Item ?? {
        userId,
        points: 0,
        tier: 'Bronze',
        deals: [],
    };
}