/**
 * Cognito PostConfirmation Lambda trigger.
 *
 * Fires after a user successfully verifies their email address.
 * Creates the four DynamoDB items that the rest of the app reads:
 *   USER#{sub} / PROFILE, SETTINGS, REWARDS, NEWSLETTER
 *
 * This handler runs in the same Docker image as the main Express app
 * (different CMD entry point: ["post_confirmation.handler"]).
 *
 * Permissions required (defined in infrastructure/terraform/modules/cognito/main.tf):
 *   dynamodb:PutItem on the app table
 *   logs:CreateLogGroup / CreateLogStream / PutLogEvents
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const TABLE = process.env.DYNAMODB_TABLE ?? 'Furnitria';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION_OVERRIDE ?? process.env.AWS_REGION ?? 'us-east-1',
});
const dynamo = DynamoDBDocumentClient.from(client);

export async function handler(event) {
  const attrs = event.request?.userAttributes ?? {};

  const userId    = attrs.sub;
  const email     = attrs.email;
  const firstName = attrs.given_name  ?? '';
  const lastName  = attrs.family_name ?? '';

  if (!userId || !email) {
    console.error('PostConfirmation: missing sub or email in userAttributes', attrs);
    // Return event to Cognito even on error — prevents blocking the confirmation
    return event;
  }

  const now = new Date().toISOString();

  const profileItem = {
    PK: `USER#${userId}`,
    SK: 'PROFILE',

    // GSI for email-based lookups (e.g. account service queries)
    GSI1PK: `EMAIL#${email}`,
    GSI1SK: `USER#${userId}`,

    userId,
    email,
    firstName,
    lastName,
    termsConditions: true, // user accepted terms during sign-up
    dateCreated: now,
    avatar: null,

    stats: {
      orders:   0,
      wishlist: 0,
      points:   0,
      returns:  0,
    },
  };

  try {
    await Promise.all([
      dynamo.send(new PutCommand({
        TableName: TABLE,
        Item: profileItem,
        // Idempotent — Cognito may retry the trigger on transient errors
        ConditionExpression: 'attribute_not_exists(PK)',
      })).catch(err => {
        // ConditionalCheckFailed = profile already exists (retry scenario) — safe to ignore
        if (err.name !== 'ConditionalCheckFailedException') throw err;
      }),
      dynamo.send(new PutCommand({
        TableName: TABLE,
        Item: {
          PK: `USER#${userId}`,
          SK: 'SETTINGS',
          shareData: false,
          emailUpdates: false,
          smsNotifications: false,
        },
        // Idempotent — Cognito may retry; must not overwrite user-changed settings
        ConditionExpression: 'attribute_not_exists(PK)',
      })).catch(err => {
        if (err.name !== 'ConditionalCheckFailedException') throw err;
      }),
      dynamo.send(new PutCommand({
        TableName: TABLE,
        Item: {
          PK: `USER#${userId}`,
          SK: 'REWARDS',
          points: 0,
          tier: 'Bronze',
          deals: [],
        },
        ConditionExpression: 'attribute_not_exists(PK)',
      })).catch(err => {
        if (err.name !== 'ConditionalCheckFailedException') throw err;
      }),
      dynamo.send(new PutCommand({
        TableName: TABLE,
        Item: {
          PK: `USER#${userId}`,
          SK: 'NEWSLETTER',
          subscribed: false,
          topics: [],
        },
        ConditionExpression: 'attribute_not_exists(PK)',
      })).catch(err => {
        if (err.name !== 'ConditionalCheckFailedException') throw err;
      }),
    ]);

    console.log(`PostConfirmation: created DynamoDB profile for user ${userId}`);
  } catch (err) {
    // Log but always return the event — a DynamoDB failure must not block
    // the user from being confirmed in Cognito. The profile can be re-created
    // via a support flow or idempotent repair job.
    console.error('PostConfirmation: DynamoDB write failed', err);
  }

  return event;
}
