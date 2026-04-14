// address.service.js
import { GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo } from '../db/dynamoClient.js';
import { v4 as uuidv4 } from 'uuid';

const TABLE = 'Furnituria';

export async function fetchAddresses(userId) {
    const result = await dynamo.send(new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
            ':pk': `USER#${userId}`,
            ':sk': 'ADDRESS#',
        },
    }));

    // Map database fields to frontend-expected fields
    const addresses = (result.Items || []).map(addr => ({
        addressId: addr.addressId,
        label: addr.label || 'Home', // Default label if not set
        line1: addr.street || addr.line1, // Support both old and new field names
        line2: addr.line2 || '',
        city: addr.city,
        state: addr.state,
        zip: addr.postal || addr.zip, // Support both old and new field names
        country: addr.country || 'US',
        isDefault: addr.isDefault || false,
    }));

    return addresses;
}

export async function addAddress(userId, addressData) {
    const addressId = uuidv4();

    // Map frontend fields to database fields
    const dbAddressData = {
        ...addressData,
        street: addressData.line1, // Map line1 to street for database
        postal: addressData.zip,   // Map zip to postal for database
    };

    const item = {
        PK: `USER#${userId}`,
        SK: `ADDRESS#${addressId}`,
        entityType: 'ADDRESS',
        userId,
        addressId,
        ...dbAddressData,
    };
    await dynamo.send(new PutCommand({ TableName: TABLE, Item: item }));

    // Return frontend-expected format
    return {
        addressId,
        label: addressData.label || 'Home',
        line1: addressData.line1,
        line2: addressData.line2 || '',
        city: addressData.city,
        state: addressData.state,
        zip: addressData.zip,
        country: addressData.country || 'US',
        isDefault: addressData.isDefault || false,
    };
}

export async function patchAddress(userId, addressId, fields) {
    // Map frontend field names to database field names
    const dbFields = { ...fields };
    if (fields.line1) dbFields.street = fields.line1;
    if (fields.zip) dbFields.postal = fields.zip;

    const allowed = ['label', 'street', 'line2', 'city', 'state', 'postal', 'country', 'isDefault'];
    const updates = Object.keys(dbFields).filter(k => allowed.includes(k));
    if (updates.length === 0) throw new Error('No valid fields to update');

    const UpdateExpression = 'SET ' + updates.map(k => `#${k} = :${k}`).join(', ');
    const ExpressionAttributeNames = Object.fromEntries(updates.map(k => [`#${k}`, k]));
    const ExpressionAttributeValues = Object.fromEntries(updates.map(k => [`:${k}`, fields[k]]));

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

    // Map back to frontend format
    const updatedItem = result.Attributes;
    return {
        addressId: updatedItem.addressId,
        label: updatedItem.label || 'Home',
        line1: updatedItem.street || updatedItem.line1,
        line2: updatedItem.line2 || '',
        city: updatedItem.city,
        state: updatedItem.state,
        zip: updatedItem.postal || updatedItem.zip,
        country: updatedItem.country || 'US',
        isDefault: updatedItem.isDefault || false,
    };
}

export async function removeAddress(userId, addressId) {
    await dynamo.send(new DeleteCommand({
        TableName: TABLE,
        Key: {
            PK: `USER#${userId}`,
            SK: `ADDRESS#${addressId}`,
        },
    }));
}