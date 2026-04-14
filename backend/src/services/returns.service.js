// returns.service.js
import { QueryCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo } from '../db/dynamoClient.js';
import { incrementStat } from './account.service.js';
import { v4 as uuidv4 } from 'uuid';

const TABLE = 'Furnituria';

export async function fetchReturns(userId) {
    const result = await dynamo.send(new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
            ':pk': `USER#${userId}`,
            ':sk': 'RETURN#',
        },
    }));

    // Map database fields to frontend-expected fields
    const returns = (result.Items || []).map(ret => ({
        returnId: ret.returnId,
        orderNumber: ret.orderNumber || ret.orderId, // Use orderNumber if available, fallback to orderId
        status: ret.status,
        item: ret.item,
        refundAmount: parseFloat(ret.refundAmount || '0.00'),
        dateInitiated: ret.dateInitiated || ret.dateRequested,
    }));

    return returns;
}

export async function createReturn(userId, returnData) {
    const returnId = uuidv4();

    await dynamo.send(new PutCommand({
        TableName: TABLE,
        Item: {
            PK: `USER#${userId}`,
            SK: `RETURN#${returnId}`,
            entityType: 'RETURN',
            userId,
            returnId,
            orderId:       returnData.orderId,
            orderNumber:   returnData.orderNumber,
            itemId:        returnData.itemId,
            item:          returnData.item,
            reason:        returnData.reason,
            notes:         returnData.notes,
            status:        'Pending',
            dateInitiated: new Date().toISOString(),
            refundAmount:  '0.00',
        },
    }));

    // Update order status
    await dynamo.send(new UpdateCommand({
        TableName: TABLE,
        Key: {
            PK: `USER#${userId}`,
            SK: `ORDER#${returnData.orderId}`,
        },
        UpdateExpression: 'SET orderStatus = :status',
        ExpressionAttributeValues: { ':status': 'return_initiated' },
    }));

    await incrementStat(userId, 'returns');

    return { returnId };
}