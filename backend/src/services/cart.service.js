// cart.service.js
import { GetCommand, PutCommand, DeleteCommand, QueryCommand, UpdateCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo } from '../db/dynamoClient.js';

const OCC_RETRIES = 3;

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
        Limit: 100,
    }));
    return (result.Items || []).map(({ productId, quantity }) => ({ productId, quantity }));
}

export async function addToCart(userId, productId, quantity) {
    for (let attempt = 0; attempt < OCC_RETRIES; attempt++) {
        const { Item } = await dynamo.send(new GetCommand({
            TableName: TABLE,
            Key: { PK: `USER#${userId}`, SK: `CART#${productId}` },
        }));

        const currentQty = Item?.quantity ?? 0;
        const newQty = Math.min(currentQty + quantity, MAX_PER_ITEM);

        try {
            if (Item) {
                await dynamo.send(new UpdateCommand({
                    TableName: TABLE,
                    Key: { PK: `USER#${userId}`, SK: `CART#${productId}` },
                    UpdateExpression: 'SET quantity = :newQty',
                    ConditionExpression: 'quantity = :expected',
                    ExpressionAttributeValues: { ':newQty': newQty, ':expected': currentQty },
                }));
            } else {
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
                    ConditionExpression: 'attribute_not_exists(PK)',
                }));
            }
            return { productId, quantity: newQty };
        } catch (err) {
            if (err.name !== 'ConditionalCheckFailedException' || attempt === OCC_RETRIES - 1) throw err;
        }
    }
}

export async function removeFromCart(userId, productId, quantity) {
    for (let attempt = 0; attempt < OCC_RETRIES; attempt++) {
        const { Item } = await dynamo.send(new GetCommand({
            TableName: TABLE,
            Key: { PK: `USER#${userId}`, SK: `CART#${productId}` },
        }));

        if (!Item) return { productId, quantity: 0 };

        const newQty = Item.quantity - quantity;

        try {
            if (newQty <= 0) {
                await dynamo.send(new DeleteCommand({
                    TableName: TABLE,
                    Key: { PK: `USER#${userId}`, SK: `CART#${productId}` },
                    ConditionExpression: 'quantity = :expected',
                    ExpressionAttributeValues: { ':expected': Item.quantity },
                }));
                return { productId, quantity: 0 };
            }

            await dynamo.send(new UpdateCommand({
                TableName: TABLE,
                Key: { PK: `USER#${userId}`, SK: `CART#${productId}` },
                UpdateExpression: 'SET quantity = :newQty',
                ConditionExpression: 'quantity = :expected',
                ExpressionAttributeValues: { ':newQty': newQty, ':expected': Item.quantity },
            }));
            return { productId, quantity: newQty };
        } catch (err) {
            if (err.name !== 'ConditionalCheckFailedException' || attempt === OCC_RETRIES - 1) throw err;
        }
    }
}

export async function clearCart(userId) {
    const cart = await getCart(userId);
    if (!cart.length) return;

    // Build delete requests and chunk into batches of 25 (DynamoDB limit).
    const requests = cart.map(item => ({
        DeleteRequest: { Key: { PK: `USER#${userId}`, SK: `CART#${item.productId}` } },
    }));

    for (let i = 0; i < requests.length; i += 25) {
        let unprocessed = requests.slice(i, i + 25);

        // Retry loop for UnprocessedItems (DynamoDB partial-batch failures).
        for (let attempt = 0; attempt < 3 && unprocessed.length; attempt++) {
            const result = await dynamo.send(new BatchWriteCommand({
                RequestItems: { [TABLE]: unprocessed },
            }));
            unprocessed = result.UnprocessedItems?.[TABLE] ?? [];
        }
    }
}