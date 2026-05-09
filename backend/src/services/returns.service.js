// returns.service.js
import { QueryCommand, GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo } from '../db/dynamoClient.js';
import { incrementStat } from './account.service.js';
import { v4 as uuidv4 } from 'uuid';

const TABLE = process.env.DYNAMODB_TABLE ?? 'Furnitria';

export async function fetchReturns(userId) {
    const result = await dynamo.send(new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
            ':pk': `USER#${userId}`,
            ':sk': 'RETURN#',
        },
        Limit: 100,
        ScanIndexForward: false,
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
    // Verify the order exists in this user's partition and that the
    // submitted item actually belongs to it before writing anything.
    const orderResult = await dynamo.send(new GetCommand({
        TableName: TABLE,
        Key: {
            PK: `USER#${userId}`,
            SK: `ORDER#${returnData.orderId}`,
        },
    }));

    if (!orderResult.Item) throw new Error('Order not found');

    const orderItems = orderResult.Item.items ?? [];
    const itemMatch = orderItems.some(
        i => i.productId === returnData.itemId || i.name === returnData.item,
    );
    if (!itemMatch) throw new Error('Item not found in order');

    const existingReturns = await dynamo.send(new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        FilterExpression: 'orderId = :orderId AND itemId = :itemId',
        ExpressionAttributeValues: {
            ':pk':      `USER#${userId}`,
            ':sk':      'RETURN#',
            ':orderId': returnData.orderId,
            ':itemId':  returnData.itemId,
        },
        Limit: 1,
    }));
    if (existingReturns.Items?.length) throw new Error('A return already exists for this item');

    const returnId = uuidv4();
    const now = new Date().toISOString();

    // Atomic write: create the return record and mark the order in a single
    // transaction so there are never orphaned RETURN# items if either write fails.
    try {
        await dynamo.send(new TransactWriteCommand({
            TransactItems: [
                {
                    Put: {
                        TableName: TABLE,
                        Item: {
                            PK:            `USER#${userId}`,
                            SK:            `RETURN#${returnId}`,
                            entityType:    'RETURN',
                            userId,
                            returnId,
                            orderId:       returnData.orderId,
                            orderNumber:   returnData.orderNumber,
                            itemId:        returnData.itemId,
                            item:          returnData.item,
                            reason:        returnData.reason,
                            notes:         returnData.notes,
                            status:        'Pending',
                            dateInitiated: now,
                            refundAmount:  '0.00',
                        },
                        ConditionExpression: 'attribute_not_exists(PK)',
                    },
                },
                {
                    Update: {
                        TableName: TABLE,
                        Key: {
                            PK: `USER#${userId}`,
                            SK: `ORDER#${returnData.orderId}`,
                        },
                        UpdateExpression: 'SET orderStatus = :status, updatedAt = :now',
                        ConditionExpression: 'attribute_exists(PK)',
                        ExpressionAttributeValues: {
                            ':status': 'return_initiated',
                            ':now':    now,
                        },
                    },
                },
            ],
        }));
    } catch (err) {
        // TransactionCanceledException carries per-item cancellation reasons.
        // Reason[1] failing means the order was deleted between our GetItem check
        // and the transaction — treat it as a 404.
        if (err.name === 'TransactionCanceledException') {
            const reasons = err.CancellationReasons ?? [];
            if (reasons[1]?.Code === 'ConditionalCheckFailed') {
                throw new Error('Order not found', { cause: err });
            }
        }
        throw err;
    }

    await incrementStat(userId, 'returns');

    return { returnId };
}