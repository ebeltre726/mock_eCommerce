import { PutCommand, UpdateCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo } from '../db/dynamoClient.js';
import { v4 as uuidv4 } from 'uuid';

const TABLE = process.env.DYNAMODB_TABLE ?? 'Furnituria';

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

function toPublicAddress(item) {
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

export async function fetchAddresses(userId) {
    const result = await dynamo.send(new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
            ':pk': `USER#${userId}`,
            ':sk': 'ADDRESS#',
        },
    }));

    return (result.Items || []).map(toPublicAddress);
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

    const result = await dynamo.send(new UpdateCommand({
        TableName: TABLE,
        Key: {
            PK: `USER#${userId}`,
            SK: `ADDRESS#${addressId}`,
        },
        UpdateExpression,
        ExpressionAttributeNames,
        ExpressionAttributeValues,
        ReturnValues: 'ALL_NEW',
    }));

    return toPublicAddress(result.Attributes);
}

// ─── Remove ───────────────────────────────────────────────────────────────────

export async function removeAddress(userId, addressId) {
    console.log('removeAddress key:', `USER#${userId}`, `ADDRESS#${addressId}`);
    await dynamo.send(new DeleteCommand({
        TableName: TABLE,
        Key: {
            PK: `USER#${userId}`,
            SK: `ADDRESS#${addressId}`,
        },
    }));
}