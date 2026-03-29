// Local dev mock — in production these calls go to AWS Cognito User Pools.
// Cognito SDK would replace most of this file.

import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo } from '../db/dynamoClient.js';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const TABLE_NAME = 'Furnituria';
const JWT_SECRET = process.env.JWT_SECRET || 'local-dev-secret';

// ======================
// LOGIN USER
// ======================
export async function loginUser(email, password) {
  if (!email || !password) {
    throw new Error('Email and password are required');
  }

  const result = await dynamo.send(new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :email',
    ExpressionAttributeValues: {
      ':email': `EMAIL#${email}`,
    },
  }));

  const user = result.Items?.find(item => item.SK === 'PROFILE');

  if (!user) {
    throw new Error('Invalid credentials');
  }

  const passwordMatches = await bcrypt.compare(password, user.password);

  if (!passwordMatches) {
    throw new Error('Invalid credentials');
  }

  const token = jwt.sign(
    {
      userId: user.userId,
      email: user.email,
      firstName: user.firstName,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  return {
    token,
    userId: user.userId,
    email: user.email,
    firstName: user.firstName,
  };
}

// ======================
// SIGNUP USER
// ======================
export async function signupUser({
  firstName,
  lastName,
  email,
  password,
  termsConditions,
}) {
  if (!email || !password || !firstName || !lastName) {
    throw new Error('Missing required fields');
  }

  // Check if email already exists via GSI
  const existing = await dynamo.send(new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :email',
    ExpressionAttributeValues: {
      ':email': `EMAIL#${email}`,
    },
  }));

  if (existing.Items?.length > 0) {
    throw new Error('Email already in use');
  }

  const userId = uuidv4();
  console.log('Generated userId:', userId);

  const hashedPassword = await bcrypt.hash(password, 10);

  // Main user profile item
  const userItem = {
    PK: `USER#${userId}`,
    SK: 'PROFILE',

    GSI1PK: `EMAIL#${email}`,
    GSI1SK: `USER#${userId}`,

    userId,
    email,
    firstName,
    lastName,
    password: hashedPassword,
    termsConditions,
    dateCreated: new Date().toISOString(),
    avatar: null,

    stats: {
      orders: 0,
      wishlist: 0,
      points: 0,
      returns: 0,
    },
  };

  // Related items (same PK, different SK)
  const settingsItem = {
    PK: `USER#${userId}`,
    SK: 'SETTINGS',
    shareData: false,
    emailUpdates: false,
    smsNotifications: false,
  };

  const rewardsItem = {
    PK: `USER#${userId}`,
    SK: 'REWARDS',
    points: 0,
    tier: 'Bronze',
    deals: [],
  };

  const newsletterItem = {
    PK: `USER#${userId}`,
    SK: 'NEWSLETTER',
    subscribed: false,
    topics: [],
  };

  try {
    await Promise.all([
      dynamo.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: userItem,
        ConditionExpression: 'attribute_not_exists(PK)', // prevents overwrite
      })),
      dynamo.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: settingsItem,
      })),
      dynamo.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: rewardsItem,
      })),
      dynamo.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: newsletterItem,
      })),
    ]);
  } catch (err) {
    console.error('Signup DynamoDB error:', err);
    throw new Error('Failed to create user');
  }

  const token = jwt.sign(
    { userId, email, firstName },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  return {
    token,
    userId,
    email,
    firstName,
  };
}

// ======================
// VERIFY TOKEN
// ======================
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    throw new Error('Invalid or expired token');
  }
}