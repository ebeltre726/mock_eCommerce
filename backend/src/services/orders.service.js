import { QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo as docClient } from '../db/dynamoClient.js';
import { incrementStat } from './account.service.js';

export async function fetchOrders(userId) {
    const result = await docClient.send(new QueryCommand({
        TableName: 'Orders',
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: { ':uid': userId },
    }));
    return result.Items || [];
}

export async function fetchOrder(userId, orderId) {
    const result = await docClient.send(new GetCommand({
        TableName: 'Orders',
        Key: { userId, orderId },
    }));
    if (!result.Item) throw new Error('Order not found');
    return result.Item;
}

export async function createOrder(userId, orderData) {
    await docClient.send(new PutCommand({
        TableName: 'Orders',
        Item: { orderId: uuidv4(), userId, ...orderData },
    }));

    // Increment the user's order count atomically
    await incrementStat(userId, 'orders');
}