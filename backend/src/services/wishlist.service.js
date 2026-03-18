import { QueryCommand, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo as docClient } from '../db/dynamoClient.js';
import { v4 as uuidv4 } from 'uuid';

export async function fetchWishlist(userId) {
    const result = await docClient.send(new QueryCommand({
        TableName: 'Wishlist',
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: { ':uid': userId },
    }));
    return result.Items || [];
}

export async function addWishlistItem(userId, itemId) {
    await docClient.send(new PutCommand({
        TableName: 'Wishlist',
        Item: { userId, itemId },
    }));

    await incrementStat(userId, 'wishlist');
}

// When an item is removed, decrement by passing -1
export async function removeWishlistItem(userId, itemId) {
    await docClient.send(new DeleteCommand({
        TableName: 'Wishlist',
        Key: { userId, itemId },
    }));

    await incrementStat(userId, 'wishlist', -1);
}