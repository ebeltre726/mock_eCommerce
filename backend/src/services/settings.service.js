// settings.service.js
import { GetCommand, UpdateCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import {
  CognitoIdentityProviderClient,
  ChangePasswordCommand,
  AdminDeleteUserCommand,
  NotAuthorizedException,
  InvalidPasswordException,
} from '@aws-sdk/client-cognito-identity-provider';
import { dynamo } from '../db/dynamoClient.js';
import env from '../config/env.js';
import logger from '../utils/logger.js';

const TABLE = process.env.DYNAMODB_TABLE ?? 'Furnitria';
const cognito = new CognitoIdentityProviderClient({ region: env.AWS_REGION });

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

// accessToken is the Cognito access token from the authenticated session —
// ChangePassword requires it (not the ID token).
export async function updatePassword(userId, currentPassword, newPassword, accessToken) {
    if (!accessToken) throw new Error('Authentication token required.');

    try {
        await cognito.send(
            new ChangePasswordCommand({
                AccessToken:      accessToken,
                PreviousPassword: currentPassword,
                ProposedPassword: newPassword,
            })
        );
    } catch (err) {
        if (err instanceof NotAuthorizedException) {
            throw new Error('Current password is incorrect.', { cause: err });
        }
        if (err instanceof InvalidPasswordException) {
            throw new Error('New password does not meet requirements.', { cause: err });
        }
        throw err;
    }
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

// email is needed because Cognito's AdminDeleteUser identifies users by username (= email).
export async function removeAccount(userId, email) {
    await Promise.all([
        removeAllUserData(userId),
        // Remove the user from the Cognito User Pool so they cannot log in again.
        cognito.send(
            new AdminDeleteUserCommand({
                UserPoolId: env.COGNITO_USER_POOL_ID,
                Username:   email,
            })
        ).catch(err => {
            // Log but don't block — DynamoDB data should still be deleted
            logger.warn({ err: err.message }, 'AdminDeleteUser error (non-fatal)');
        }),
    ]);
}