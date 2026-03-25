// settings.service.js
import { GetCommand, UpdateCommand, DeleteCommand, QueryCommand} from '@aws-sdk/lib-dynamodb';
import { dynamo } from '../db/dynamoClient.js';
import bcrypt from 'bcrypt';

export async function fetchSettings(userId) {
    const result = await dynamo.send(new GetCommand({
        TableName: 'Settings',
        Key: { userId },
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
        TableName: 'Settings',
        Key: { userId },
        UpdateExpression,
        ExpressionAttributeNames,
        ExpressionAttributeValues,
        ReturnValues: 'ALL_NEW',
    }));
    return result.Attributes;
}

export async function updatePassword(userId, currentPassword, newPassword) {
    // Fetch current user to verify existing password
    const result = await dynamo.send(new GetCommand({
        TableName: 'Users',
        Key: { userId },
    }));

    if (!result.Item) throw new Error('User not found');

    const passwordMatches = await bcrypt.compare(currentPassword, result.Item.password);
    if (!passwordMatches) throw new Error('Invalid current password');

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await dynamo.send(new UpdateCommand({
        TableName: 'Users',
        Key: { userId },
        UpdateExpression: 'SET password = :password',
        ExpressionAttributeValues: { ':password': hashedPassword },
    }));
}

export async function removeAccount(userId) {
    await dynamo.send(new DeleteCommand({
        TableName: 'Users',
        Key: { userId },
    }));
}

export async function removeAllUserData(userId) {
    // Tables with userId as partition key — single DeleteCommand each
    const singleKeyTables = [
        'Users',
        'Rewards',
        'Newsletter',
        'Settings',
    ];

    await Promise.all(
        singleKeyTables.map(table =>
            dynamo.send(new DeleteCommand({
                TableName: table,
                Key: { userId },
            }))
        )
    );

    // Tables with userId + sort key — need to query first then delete each item
    const compositeKeyTables = [
        { table: 'Cart',           sortKey: 'productId' },
        { table: 'Orders',         sortKey: 'orderId' },
        { table: 'Addresses',      sortKey: 'addressId' },
        { table: 'PaymentMethods', sortKey: 'paymentId' },
        { table: 'Wishlist',       sortKey: 'wishlistId' },
        { table: 'Returns',        sortKey: 'returnId' },
    ];

    await Promise.all(
        compositeKeyTables.map(async ({ table, sortKey }) => {
            const result = await dynamo.send(new QueryCommand({
                TableName: table,
                KeyConditionExpression: 'userId = :uid',
                ExpressionAttributeValues: { ':uid': userId },
            }));

            if (!result.Items?.length) return;

            await Promise.all(
                result.Items.map(item =>
                    dynamo.send(new DeleteCommand({
                        TableName: table,
                        Key: { userId, [sortKey]: item[sortKey] },
                    }))
                )
            );
        })
    );
}