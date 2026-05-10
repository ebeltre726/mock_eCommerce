// settings.service.js
import { GetCommand, UpdateCommand, QueryCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
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

const TABLE = env.DYNAMODB_TABLE;
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
    // Paginate through all items for this user and delete in BatchWriteItem
    // chunks of 25 (DynamoDB limit). This avoids Lambda timeout on heavy accounts
    // and avoids the per-item DeleteCommand fan-out of the old implementation.
    let lastKey;
    do {
        const result = await dynamo.send(new QueryCommand({
            TableName: TABLE,
            KeyConditionExpression: 'PK = :pk',
            ExpressionAttributeValues: { ':pk': `USER#${userId}` },
            ProjectionExpression: 'PK, SK',
            Limit: 100,
            ...(lastKey && { ExclusiveStartKey: lastKey }),
        }));

        const items = result.Items ?? [];
        lastKey = result.LastEvaluatedKey;

        // Delete in BatchWriteItem chunks of 25
        for (let i = 0; i < items.length; i += 25) {
            let unprocessed = items.slice(i, i + 25).map(item => ({
                DeleteRequest: { Key: { PK: item.PK, SK: item.SK } },
            }));

            for (let attempt = 0; attempt < 3 && unprocessed.length; attempt++) {
                const batchResult = await dynamo.send(new BatchWriteCommand({
                    RequestItems: { [TABLE]: unprocessed },
                }));
                unprocessed = batchResult.UnprocessedItems?.[TABLE] ?? [];
            }
        }
    } while (lastKey);
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