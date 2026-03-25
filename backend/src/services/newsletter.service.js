import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo } from '../db/dynamoClient.js';

export async function fetchNewsletter(userId) {
    const result = await dynamo.send(new GetCommand({
        TableName: 'Newsletter',
        Key: { userId },
    }));
    return result.Item ?? {
        userId,
        subscribed: false,
        topics: [],
    };
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