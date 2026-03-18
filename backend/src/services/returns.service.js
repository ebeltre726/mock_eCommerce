import { QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo as docClient } from '../db/dynamoClient.js';
import { incrementStat } from './account.service.js';
import { v4 as uuidv4 } from 'uuid';

export async function fetchReturns(userId) {
    const result = await docClient.send(new QueryCommand({
        TableName: 'Returns',
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: { ':uid': userId },
    }));
    return result.Items || [];
}

export async function createReturn(userId, returnData) {
    await docClient.send(new PutCommand({
        TableName: 'Returns',
        Item: { returnId: uuidv4(), userId, ...returnData },
    }));

    await incrementStat(userId, 'returns');
}