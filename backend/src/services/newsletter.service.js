// newsletter.service.js
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo } from '../db/dynamoClient.js';

const TABLE = process.env.DYNAMODB_TABLE ?? 'Furnituria';

export async function fetchNewsletter(userId) {
    const result = await dynamo.send(new GetCommand({
        TableName: TABLE,
        Key: {
            PK: `USER#${userId}`,
            SK: 'NEWSLETTER',
        },
    }));
    return result.Item ?? {
        userId,
        subscribed: false,
        topics: [],
    };
}

export async function patchNewsletter(userId, { subscribed, topics }) {
    const result = await dynamo.send(new UpdateCommand({
        TableName: TABLE,
        Key: {
            PK: `USER#${userId}`,
            SK: 'NEWSLETTER',
        },
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