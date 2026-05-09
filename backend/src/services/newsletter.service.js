// newsletter.service.js
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo } from '../db/dynamoClient.js';

const TABLE = process.env.DYNAMODB_TABLE ?? 'Furnitria';

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
    const hasTopics = Array.isArray(topics);

    const result = await dynamo.send(new UpdateCommand({
        TableName: TABLE,
        Key: {
            PK: `USER#${userId}`,
            SK: 'NEWSLETTER',
        },
        UpdateExpression: hasTopics
            ? 'SET entityType = if_not_exists(entityType, :entityType), userId = if_not_exists(userId, :userId), #subscribed = :subscribed, #topics = :topics'
            : 'SET entityType = if_not_exists(entityType, :entityType), userId = if_not_exists(userId, :userId), #subscribed = :subscribed',
        ExpressionAttributeNames: {
            '#subscribed': 'subscribed',
            ...(hasTopics && { '#topics': 'topics' }),
        },
        ExpressionAttributeValues: {
            ':entityType': 'NEWSLETTER',
            ':userId': userId,
            ':subscribed': subscribed,
            ...(hasTopics && { ':topics': topics }),
        },
        ReturnValues: 'ALL_NEW',
    }));
    return result.Attributes;
}