// wishlist.service.js
import { PutCommand, DeleteCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo } from '../db/dynamoClient.js';
import { incrementStat } from './account.service.js';
import { v4 as uuidv4 } from 'uuid';
import env from '../config/env.js';

const TABLE = env.DYNAMODB_TABLE;
const WISHLIST_PAGE_SIZE = 100;

/**
 * Returns { items, nextCursor } where nextCursor is a base64-encoded
 * DynamoDB LastEvaluatedKey, or null if there are no more pages.
 */
export async function fetchWishlist(userId, cursor = null) {
    const queryParams = {
        TableName: TABLE,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
            ':pk': `USER#${userId}`,
            ':sk': 'WISHLIST#',
        },
        Limit: WISHLIST_PAGE_SIZE,
    };

    if (cursor) {
        try {
            queryParams.ExclusiveStartKey = JSON.parse(
                Buffer.from(cursor, 'base64').toString('utf8'),
            );
        } catch {
            const err = new Error('Invalid pagination cursor');
            err.statusCode = 400;
            throw err;
        }
    }

    const result = await dynamo.send(new QueryCommand(queryParams));

    const nextCursor = result.LastEvaluatedKey
        ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
        : null;

    return {
        items: (result.Items || []).map(item => ({ ...item, itemId: item.wishlistId })),
        nextCursor,
    };
}

export async function addWishlistItem(userId, itemData) {
    const wishlistId = uuidv4();
    // Explicit field selection prevents arbitrary client-supplied fields from
    // being stored under the user's partition.
    const { productId, name, imageUrl } = itemData;
    await dynamo.send(new PutCommand({
        TableName: TABLE,
        Item: {
            PK:         `USER#${userId}`,
            SK:         `WISHLIST#${wishlistId}`,
            entityType: 'WISHLIST',
            userId,
            wishlistId,
            productId,
            name:       name     ?? '',
            imageUrl:   imageUrl ?? '',
        },
    }));
    await incrementStat(userId, 'wishlist');
    return { itemId: wishlistId, productId };
}

export async function removeWishlistItem(userId, wishlistId) {
    await dynamo.send(new DeleteCommand({
        TableName: TABLE,
        Key: {
            PK: `USER#${userId}`,
            SK: `WISHLIST#${wishlistId}`,
        },
    }));
    // Decrement the wishlist stat only when it is already > 0.
    // Non-fatal — a stat drift does not affect core functionality.
    try {
        await dynamo.send(new UpdateCommand({
            TableName: TABLE,
            Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
            UpdateExpression: 'ADD stats.#stat :neg',
            ConditionExpression: 'stats.#stat > :zero',
            ExpressionAttributeNames: { '#stat': 'wishlist' },
            ExpressionAttributeValues: { ':neg': -1, ':zero': 0 },
        }));
    } catch (err) {
        if (err.name !== 'ConditionalCheckFailedException') throw err;
        // Counter is already 0 — nothing to decrement
    }
}