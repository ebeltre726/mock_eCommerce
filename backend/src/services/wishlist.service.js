// wishlist.service.js
import { PutCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo } from '../db/dynamoClient.js';
import { incrementStat } from './account.service.js';
import { v4 as uuidv4 } from 'uuid';

const TABLE = process.env.DYNAMODB_TABLE ?? 'Furnitria';

export async function fetchWishlist(userId) {
    const result = await dynamo.send(new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
            ':pk': `USER#${userId}`,
            ':sk': 'WISHLIST#',
        },
    }));
    return (result.Items || []).map(item => ({
        ...item,
        itemId: item.wishlistId,
    }));
}

export async function addWishlistItem(userId, itemData) {
    const wishlistId = uuidv4();
    await dynamo.send(new PutCommand({
        TableName: TABLE,
        Item: {
            PK: `USER#${userId}`,
            SK: `WISHLIST#${wishlistId}`,
            entityType: 'WISHLIST',
            userId,
            wishlistId,
            ...itemData,
        },
    }));
    await incrementStat(userId, 'wishlist');
    return { itemId: wishlistId, productId: itemData.productId };
}

export async function removeWishlistItem(userId, wishlistId) {
    await dynamo.send(new DeleteCommand({
        TableName: TABLE,
        Key: {
            PK: `USER#${userId}`,
            SK: `WISHLIST#${wishlistId}`,
        },
    }));
    await incrementStat(userId, 'wishlist', -1);
}