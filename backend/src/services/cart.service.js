// cart.service.js
import { GetCommand, PutCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo } from '../db/dynamoClient.js';

const TABLE = process.env.DYNAMODB_TABLE ?? 'Furnitria';
const MAX_PER_ITEM = 5;

export async function getCart(userId) {
    const result = await dynamo.send(new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
            ':pk': `USER#${userId}`,
            ':sk': 'CART#',
        },
    }));
    return result.Items || [];
}

export async function addToCart(userId, productId, quantity) {
    const existing = await dynamo.send(new GetCommand({
        TableName: TABLE,
        Key: {
            PK: `USER#${userId}`,
            SK: `CART#${productId}`,
        },
    }));

    const currentQty = existing.Item?.quantity || 0;
    const newQty = Math.min(currentQty + quantity, MAX_PER_ITEM);

    await dynamo.send(new PutCommand({
        TableName: TABLE,
        Item: {
            PK: `USER#${userId}`,
            SK: `CART#${productId}`,
            entityType: 'CART',
            userId,
            productId,
            quantity: newQty,
        },
    }));

    return { productId, quantity: newQty };
}

export async function removeFromCart(userId, productId, quantity) {
    const existing = await dynamo.send(new GetCommand({
        TableName: TABLE,
        Key: {
            PK: `USER#${userId}`,
            SK: `CART#${productId}`,
        },
    }));

    if (!existing.Item) return { productId, quantity: 0 };

    const newQty = existing.Item.quantity - quantity;

    if (newQty <= 0) {
        await dynamo.send(new DeleteCommand({
            TableName: TABLE,
            Key: {
                PK: `USER#${userId}`,
                SK: `CART#${productId}`,
            },
        }));
        return { productId, quantity: 0 };
    }

    await dynamo.send(new PutCommand({
        TableName: TABLE,
        Item: {
            PK: `USER#${userId}`,
            SK: `CART#${productId}`,
            entityType: 'CART',
            userId,
            productId,
            quantity: newQty,
        },
    }));

    return { productId, quantity: newQty };
}

export async function clearCart(userId) {
    const cart = await getCart(userId);

    await Promise.all(cart.map(item =>
        dynamo.send(new DeleteCommand({
            TableName: TABLE,
            Key: {
                PK: `USER#${userId}`,
                SK: `CART#${item.productId}`,
            },
        }))
    ));
}