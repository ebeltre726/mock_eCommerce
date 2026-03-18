import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo as docClient } from '../db/dynamoClient.js';

export async function fetchNewsletter(userId) {
    const result = await docClient.send(new GetCommand({
        TableName: 'Newsletter',
        Key: { userId },
    }));
    if (!result.Item) throw new Error('Newsletter preferences not found');
    return result.Item;
}

export async function patchNewsletter(userId, { subscribed, topics }) {
    const result = await docClient.send(new UpdateCommand({
        TableName: 'Newsletter',
        Key: { userId },
        UpdateExpression: 'SET #subscribed = :subscribed, #topics = :topics',
        ExpressionAttributeNames: {
            '#subscribed': 'subscribed',
            '#topics': 'topics',
        },
        ExpressionAttributeValues: {
            ':subscribed': subscribed,
            ':topics': topics,
        },
        ReturnValues: 'ALL_NEW',
    }));
    return result.Attributes;
}