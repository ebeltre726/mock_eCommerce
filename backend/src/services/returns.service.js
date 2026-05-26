// returns.service.js
import { QueryCommand, GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo } from '../db/dynamoClient.js';
import { incrementStat } from './account.service.js';
import env from '../config/env.js';

const TABLE = env.DYNAMODB_TABLE;

function returnGsiPk(status) { return `RETURN#${status}`; }

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

    return (result.Items || []).map(ret => ({
        returnId:      ret.returnId,
        orderNumber:   ret.orderNumber || ret.orderId,
        orderId:       ret.orderId,
        status:        ret.status,
        item:          ret.item,
        refundAmount:  parseFloat(ret.refundAmount || '0.00'),
        refundFailReason: ret.refundFailReason ?? null,
        dateInitiated: ret.dateInitiated || ret.dateRequested,
        dateApproved:  ret.dateApproved  ?? null,
        dateRefunded:  ret.dateRefunded  ?? null,
    }));
}

export async function createReturn(userId, userEmail, returnData, userFullName = '') {
    // Verify the order exists and the submitted item belongs to it.
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

    // Deterministic SK: RETURN#<orderId>#<itemId>
    // The ConditionExpression inside the transaction makes the Put idempotent and
    // race-proof — a second concurrent request for the same item will get
    // ConditionalCheckFailed on the Put (Reason[0]) rather than silently writing a
    // duplicate. No separate pre-query is needed.
    const returnSK = `RETURN#${returnData.orderId}#${returnData.itemId}`;
    const now = new Date().toISOString();

    try {
        await dynamo.send(new TransactWriteCommand({
            TransactItems: [
                {
                    Put: {
                        TableName: TABLE,
                        Item: {
                            PK:            `USER#${userId}`,
                            SK:            returnSK,
                            entityType:    'RETURN',
                            // GSI1PK starts as RETURN#Pending so the background processor
                            // can query all pending returns without a scan.
                            GSI1PK:        returnGsiPk('Pending'),
                            userId,
                            userEmail,
                            userFullName,
                            // returnId kept for external reference / display; not used as a key
                            returnId:      `${returnData.orderId}-${returnData.itemId}`,
                            orderId:       returnData.orderId,
                            orderNumber:   returnData.orderNumber,
                            itemId:        returnData.itemId,
                            item:          returnData.item,
                            reason:        returnData.reason,
                            notes:         returnData.notes,
                            status:        'Pending',
                            createdAt:     now, // GSI sort key
                            dateInitiated: now,
                            refundAmount:  '0.00',
                        },
                        // Prevents duplicate returns for the same order+item pair,
                        // even under concurrent requests.
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
        if (err.name === 'TransactionCanceledException') {
            const reasons = err.CancellationReasons ?? [];
            // Reason[0] = Put on RETURN# item — duplicate return for this order+item
            if (reasons[0]?.Code === 'ConditionalCheckFailed') {
                throw new Error('A return already exists for this item', { cause: err });
            }
            // Reason[1] = Update on ORDER# — order deleted between our GetItem and the tx
            if (reasons[1]?.Code === 'ConditionalCheckFailed') {
                throw new Error('Order not found', { cause: err });
            }
        }
        throw err;
    }

    await incrementStat(userId, 'returns');

    return { returnId: `${returnData.orderId}-${returnData.itemId}` };
}
