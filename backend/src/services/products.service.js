// products.service.js
import { ScanCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo } from '../db/dynamoClient.js';

const TABLE = process.env.DYNAMODB_TABLE ?? 'Furnitria';

export async function fetchAllProducts() {
    const result = await dynamo.send(new ScanCommand({
        TableName: TABLE,
        FilterExpression: 'entityType = :type',
        ExpressionAttributeValues: { ':type': 'PRODUCT' },
    }));
    return result.Items || [];
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