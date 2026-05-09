import { PutCommand, UpdateCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo } from '../db/dynamoClient.js';
import { v4 as uuidv4 } from 'uuid';

const TABLE = process.env.DYNAMODB_TABLE ?? 'Furnitria';

// ─── Shape helpers ────────────────────────────────────────────────────────────
// DB stores: street, postal (legacy field names)
// Frontend expects: line1, zip
// These two functions are the single source of truth for that mapping.

function toDbFields(data) {
    return {
        label:     data.label     ?? 'Home',
        street:    data.line1,           // frontend line1 → db street
        line2:     data.line2     ?? '',
        city:      data.city,
        state:     data.state,
        postal:    data.zip,             // frontend zip → db postal
        country:   data.country   ?? 'US',
        isDefault: data.isDefault ?? false,
    };
}

export function toPublicAddress(item) {
    return {
        addressId: item.addressId,
        label:     item.label     || 'Home',
        line1:     item.street    || item.line1 || '', // handle both legacy + new
        line2:     item.line2     || '',
        city:      item.city      || '',
        state:     item.state     || '',
        zip:       item.postal    || item.zip   || '', // handle both legacy + new
        country:   item.country   || 'US',
        isDefault: item.isDefault || false,
    };
}

// ─── Fetch all ────────────────────────────────────────────────────────────────

const ADDRESS_PAGE_SIZE = 20;

/**
 * Returns { addresses, nextCursor } where nextCursor is a base64-encoded
 * DynamoDB LastEvaluatedKey, or null if there are no more pages.
 */
export async function fetchAddresses(userId, cursor = null) {
    const queryParams = {
        TableName: TABLE,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
            ':pk': `USER#${userId}`,
            ':sk': 'ADDRESS#',
        },
        Limit: ADDRESS_PAGE_SIZE,
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

    return { addresses: (result.Items || []).map(toPublicAddress), nextCursor };
}

// ─── Add ──────────────────────────────────────────────────────────────────────

export async function addAddress(userId, addressData) {
    const addressId  = uuidv4();
    const dbFields   = toDbFields(addressData);

    const item = {
        PK:         `USER#${userId}`,
        SK:         `ADDRESS#${addressId}`,
        entityType: 'ADDRESS',
        userId,
        addressId,
        ...dbFields,
    };

    await dynamo.send(new PutCommand({ TableName: TABLE, Item: item }));

    return toPublicAddress(item);
}

// ─── Patch ────────────────────────────────────────────────────────────────────

export async function patchAddress(userId, addressId, fields) {
    // Map any frontend field names to DB field names before building the update
    const dbFields = toDbFields({ ...fields });

    const allowed = ['label', 'street', 'line2', 'city', 'state', 'postal', 'country', 'isDefault'];
    const updates  = Object.keys(dbFields).filter(k => allowed.includes(k) && dbFields[k] !== undefined);

    if (updates.length === 0) throw new Error('No valid fields to update');

    const UpdateExpression         = 'SET ' + updates.map(k => `#${k} = :${k}`).join(', ');
    const ExpressionAttributeNames  = Object.fromEntries(updates.map(k => [`#${k}`, k]));
    // Use dbFields here — this was the bug in the original (was using fields[k])
    const ExpressionAttributeValues = Object.fromEntries(updates.map(k => [`:${k}`, dbFields[k]]));

    try {
        const result = await dynamo.send(new UpdateCommand({
            TableName: TABLE,
            Key: {
                PK: `USER#${userId}`,
                SK: `ADDRESS#${addressId}`,
            },
            UpdateExpression,
            ExpressionAttributeNames,
            ExpressionAttributeValues,
            ConditionExpression: 'attribute_exists(PK)',
            ReturnValues: 'ALL_NEW',
        }));

        return toPublicAddress(result.Attributes);
    } catch (err) {
        if (err.name === 'ConditionalCheckFailedException') {
            throw new Error('Address not found', { cause: err });
        }
        throw err;
    }
}

// ─── Remove ───────────────────────────────────────────────────────────────────

export async function removeAddress(userId, addressId) {
    await dynamo.send(new DeleteCommand({
        TableName: TABLE,
        Key: {
            PK: `USER#${userId}`,
            SK: `ADDRESS#${addressId}`,
        },
    }));
}