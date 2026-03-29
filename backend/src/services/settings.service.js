// settings.service.js
import { GetCommand, UpdateCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo } from '../db/dynamoClient.js';
import bcrypt from 'bcrypt';

const TABLE = 'Furnituria';

export async function fetchSettings(userId) {
    const result = await dynamo.send(new GetCommand({
        TableName: TABLE,
        Key: {
            PK: `USER#${userId}`,
            SK: 'SETTINGS',
        },
    }));
    return result.Item ?? {
        userId,
        shareData: false,
        emailUpdates: false,
        smsNotifications: false,
    };
}

export async function patchSettings(userId, fields) {
    const allowed = ['shareData', 'emailUpdates', 'smsNotifications'];
    const updates = Object.keys(fields).filter(k => allowed.includes(k));
    if (updates.length === 0) throw new Error('No valid fields to update');

    const UpdateExpression = 'SET ' + updates.map(k => `#${k} = :${k}`).join(', ');
    const ExpressionAttributeNames = Object.fromEntries(updates.map(k => [`#${k}`, k]));
    const ExpressionAttributeValues = Object.fromEntries(updates.map(k => [`:${k}`, fields[k]]));

    const result = await dynamo.send(new UpdateCommand({
        TableName: TABLE,
        Key: {
            PK: `USER#${userId}`,
            SK: 'SETTINGS',
        },
        UpdateExpression,
        ExpressionAttributeNames,
        ExpressionAttributeValues,
        ReturnValues: 'ALL_NEW',
    }));
    return result.Attributes;
}

export async function updatePassword(userId, currentPassword, newPassword) {
    const result = await dynamo.send(new GetCommand({
        TableName: TABLE,
        Key: {
            PK: `USER#${userId}`,
            SK: `USER#${userId}`,
        },
    }));

    if (!result.Item) throw new Error('User not found');

    const passwordMatches = await bcrypt.compare(currentPassword, result.Item.password);
    if (!passwordMatches) throw new Error('Invalid current password');

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await dynamo.send(new UpdateCommand({
        TableName: TABLE,
        Key: {
            PK: `USER#${userId}`,
            SK: `USER#${userId}`,
        },
        UpdateExpression: 'SET password = :password',
        ExpressionAttributeValues: { ':password': hashedPassword },
    }));
}

export async function removeAllUserData(userId) {
    // Query all items for this user
    const result = await dynamo.send(new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: { ':pk': `USER#${userId}` },
    }));

    // Delete all user items in parallel
    await Promise.all(
        (result.Items || []).map(item =>
            dynamo.send(new DeleteCommand({
                TableName: TABLE,
                Key: { PK: item.PK, SK: item.SK },
            }))
        )
    );
}

export async function removeAccount(userId) {
    // TODO: In production also revoke Stripe customer, cancel subscriptions etc.
    await removeAllUserData(userId);
}