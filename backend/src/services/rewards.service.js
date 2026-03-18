import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo as docClient } from '../db/dynamoClient.js';

export async function fetchRewards(userId) {
    const result = await docClient.send(new GetCommand({
        TableName: 'Rewards',
        Key: { userId },
    }));
    if (!result.Item) throw new Error('Rewards not found');
    return result.Item;
}