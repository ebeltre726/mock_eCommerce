import { QueryCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo } from '../db/dynamoClient.js';
import { incrementStat } from './account.service.js';
import { v4 as uuidv4 } from 'uuid';

export async function fetchReturns(userId) {
    const result = await dynamo.send(new QueryCommand({
        TableName: 'Returns',
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: { ':uid': userId },
    }));
    return result.Items || [];
}

// returns.service.js
export async function createReturn(userId, returnData) {
    const returnId = uuidv4();

    // Write the return
    await dynamo.send(new PutCommand({
        TableName: 'Returns',
        Item: {
            userId,
            returnId,
            orderId:       returnData.orderId,
            itemId:        returnData.itemId,
            item:          returnData.item,
            reason:        returnData.reason,
            notes:         returnData.notes,
            status:        'Pending',
            dateInitiated: new Date().toISOString(),
            refundAmount:  '0.00', // set when approved
        },
    }));

    // Update order status to reflect return initiated
    await dynamo.send(new UpdateCommand({
        TableName: 'Orders',
        Key: { userId, orderId: returnData.orderId },
        UpdateExpression: 'SET orderStatus = :status',
        ExpressionAttributeValues: { ':status': 'return_initiated' },
    }));

    // Increment user's return stat
    await incrementStat(userId, 'returns');

    return { returnId };
}