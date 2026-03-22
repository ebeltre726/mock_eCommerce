// cart.service.js
import { dynamo } from '../db/dynamoClient.js';
import { GetCommand, PutCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const TABLE_NAME = 'Cart';
const MAX_PER_ITEM = 5; // matches frontend

export async function getCart(userId) {
    const result = await dynamo.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: { ':userId': userId },
    }));
    return result.Items || [];
}

export async function addToCart(userId, productId, quantity) {
    const existing = await dynamo.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { userId, productId },
    }));

    const currentQty = existing.Item?.quantity || 0;
    const newQty = Math.min(currentQty + quantity, MAX_PER_ITEM);

    await dynamo.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: { userId, productId, quantity: newQty },
    }));

    return { productId, quantity: newQty };
}

export async function removeFromCart(userId, productId, quantity) {
    const existing = await dynamo.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { userId, productId },
    }));

    if (!existing.Item) return { productId, quantity: 0 };

    const newQty = existing.Item.quantity - quantity;

    if (newQty <= 0) {
        await dynamo.send(new DeleteCommand({
            TableName: TABLE_NAME,
            Key: { userId, productId },
        }));
        return { productId, quantity: 0 };
    }

    await dynamo.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: { userId, productId, quantity: newQty },
    }));

    return { productId, quantity: newQty };
}

export async function clearCart(userId) {
  const cart = await getCart(userId);
  
  await Promise.all(cart.map(item =>
      dynamo.send(new DeleteCommand({
          TableName: TABLE_NAME,
          Key: { userId, productId: item.productId },
      }))
  ));
}