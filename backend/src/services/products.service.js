// products.service.js
import { QueryCommand, GetCommand, BatchGetCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo } from '../db/dynamoClient.js';
import env from '../config/env.js';

const TABLE = env.DYNAMODB_TABLE;

export async function fetchProductsPage({ cursor, limit = 24 } = {}) {
    const exclusiveStartKey = cursor
        ? JSON.parse(Buffer.from(cursor, 'base64url').toString('utf-8'))
        : undefined;

    const result = await dynamo.send(new QueryCommand({
        TableName: TABLE,
        IndexName: 'EntityTypeIndex',
        KeyConditionExpression: 'entityType = :type',
        ExpressionAttributeValues: { ':type': 'PRODUCT' },
        Limit: limit,
        ...(exclusiveStartKey && { ExclusiveStartKey: exclusiveStartKey }),
    }));

    const nextCursor = result.LastEvaluatedKey
        ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64url')
        : null;

    return { items: result.Items ?? [], nextCursor };
}

export async function fetchProductById(id) {
    const result = await dynamo.send(new GetCommand({
        TableName: TABLE,
        Key: {
            PK: `PRODUCT#${id}`,
            SK: `PRODUCT#${id}`,
        },
    }));
    return result.Item || null;
}

// Fetches up to 100 products by ID in a single BatchGetItem call.
// Returns a map of { [productId]: product } so callers can look up by key.
export async function fetchProductsBatch(ids) {
    if (!ids || ids.length === 0) return {};

    // DynamoDB BatchGetItem limit is 100 keys per call
    const capped = ids.slice(0, 100);
    const keys = capped.map(id => ({ PK: `PRODUCT#${id}`, SK: `PRODUCT#${id}` }));

    const result = await dynamo.send(new BatchGetCommand({
        RequestItems: { [TABLE]: { Keys: keys } },
    }));

    const map = {};
    for (const item of (result.Responses?.[TABLE] ?? [])) {
        const id = item.PK.replace('PRODUCT#', '');
        map[id] = item;
    }
    return map;
}