import { GetCommand, PutCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo } from '../db/dynamoClient.js';
import { storage } from '../storage/index.js';

const TABLE_NAME = process.env.DYNAMODB_TABLE ?? 'Furnitria';

// ======================
// ENSURE USER PROFILE
// ======================
// Idempotently creates the four DynamoDB rows for a user if they don't already
// exist. Mirrors exactly what the PostConfirmation Lambda creates.
//
// Why this exists: in local dev the PostConfirmation Lambda fires in AWS against
// the real DynamoDB table, not DynamoDB Local. Without this, login would succeed
// (Cognito is real) but every subsequent read would 404 (no profile in DynamoDB
// Local). In production this is a safety net: if the Lambda fails transiently,
// the first successful login self-heals rather than leaving the user in a broken
// state.
export async function ensureUserProfile({ userId, email, firstName, lastName }) {
    const now = new Date().toISOString();

    const writes = [
        dynamo.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: {
                PK:          `USER#${userId}`,
                SK:          'PROFILE',
                GSI1PK:      `EMAIL#${email}`,
                GSI1SK:      `USER#${userId}`,
                userId,
                email,
                firstName:   firstName ?? '',
                lastName:    lastName  ?? '',
                termsConditions: true,
                dateCreated: now,
                avatar:      null,
                stats: { orders: 0, wishlist: 0, points: 0, returns: 0 },
            },
            ConditionExpression: 'attribute_not_exists(PK)',
        })).catch(err => {
            if (err.name !== 'ConditionalCheckFailedException') throw err;
            // Profile already exists — normal on every login after the first
        }),
        dynamo.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: {
                PK: `USER#${userId}`,
                SK: 'SETTINGS',
                shareData: false,
                emailUpdates: false,
                smsNotifications: false,
            },
            ConditionExpression: 'attribute_not_exists(PK)',
        })).catch(err => { if (err.name !== 'ConditionalCheckFailedException') throw err; }),
        dynamo.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: {
                PK: `USER#${userId}`,
                SK: 'REWARDS',
                points: 0,
                tier:   'Bronze',
                deals:  [],
            },
            ConditionExpression: 'attribute_not_exists(PK)',
        })).catch(err => { if (err.name !== 'ConditionalCheckFailedException') throw err; }),
        dynamo.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: {
                PK: `USER#${userId}`,
                SK: 'NEWSLETTER',
                subscribed: false,
                topics:     [],
            },
            ConditionExpression: 'attribute_not_exists(PK)',
        })).catch(err => { if (err.name !== 'ConditionalCheckFailedException') throw err; }),
    ];

    await Promise.all(writes);
}

export async function fetchOverview(userId) {
    const [profile, orders, returns, wishlist] = await Promise.all([
        dynamo.send(new GetCommand({
            TableName: TABLE_NAME,
            Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
        })),
        dynamo.send(new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
            ExpressionAttributeValues: { ':pk': `USER#${userId}`, ':sk': 'ORDER#' },
            Select: 'COUNT',
        })),
        dynamo.send(new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
            ExpressionAttributeValues: { ':pk': `USER#${userId}`, ':sk': 'RETURN#' },
            Select: 'COUNT',
        })),
        dynamo.send(new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
            ExpressionAttributeValues: { ':pk': `USER#${userId}`, ':sk': 'WISHLIST#' },
            Select: 'COUNT',
        })),
    ]);

    const rewards = await dynamo.send(new GetCommand({
    TableName: TABLE_NAME,
      Key: {
          PK: `USER#${userId}`,
          SK: 'REWARDS',
      },
    }));

    const item = profile.Item ?? {};
    if (item.avatar && !item.avatar.startsWith('http')) {
        item.avatar = await storage.getDownloadUrl(item.avatar);
    }

    return {
        ...item,
        stats: {
            orders:   orders.Count          ?? 0,
            returns:  returns.Count         ?? 0,
            wishlist: wishlist.Count        ?? 0,
            points:   rewards.Item?.points  ?? 0, // ← single source of truth
        },
    };
}

export async function patchOverview(userId, fields) {
    const allowed = ['firstName', 'lastName', 'avatar'];
    const updates = Object.keys(fields).filter(k => allowed.includes(k));
    if (updates.length === 0) throw new Error('No valid fields to update');

    const UpdateExpression = 'SET ' + updates.map(k => `#${k} = :${k}`).join(', ');
    const ExpressionAttributeNames = Object.fromEntries(updates.map(k => [`#${k}`, k]));
    const ExpressionAttributeValues = Object.fromEntries(updates.map(k => [`:${k}`, fields[k]]));

    const result = await dynamo.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
            PK: `USER#${userId}`,
            SK: 'PROFILE',
        },
        UpdateExpression,
        ExpressionAttributeNames,
        ExpressionAttributeValues,
        ReturnValues: 'ALL_NEW',
    }));
    return result.Attributes;
}

export async function incrementStat(userId, statName, amount = 1) {
    await dynamo.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
            PK: `USER#${userId}`,
            SK: 'PROFILE',
        },
        UpdateExpression: 'ADD stats.#stat :amount',
        ExpressionAttributeNames: { '#stat': statName },
        ExpressionAttributeValues: { ':amount': amount },
    }));
}