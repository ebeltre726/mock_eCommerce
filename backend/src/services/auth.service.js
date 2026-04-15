// Local dev mock — in production these calls go to AWS Cognito User Pools.
// Cognito SDK would replace most of this file.
 
import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo } from '../db/dynamoClient.js';
import { v4 as uuidv4 } from 'uuid';
import env from '../config/env.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
 
const TABLE_NAME = 'Furnituria';
const JWT_SECRET = env.JWT_SECRET;
const BCRYPT_ROUNDS = 12;
 
// Fail fast at startup if JWT_SECRET is missing — never fall back to a hardcoded string in any env.
export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET is missing');
  }

  return secret;
}
 
// ======================
// VALIDATION HELPERS
// ======================
 
/**
 * RFC 5322-inspired email regex. Rejects obvious non-emails while staying
 * practical (no false positives on valid-but-exotic addresses).
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
 
/**
 * Password must be 8–128 chars and contain at least:
 * one uppercase, one lowercase, one digit, one special character.
 */
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]).{8,128}$/;
 
const NAME_REGEX = /^[a-zA-ZÀ-ÖØ-öø-ÿ' -]{1,64}$/;
 
function validateEmail(email) {
  if (typeof email !== 'string') {
    throw new Error('Email must be a string.');
  }
 
  const trimmed = email.trim().toLowerCase();
 
  if (!trimmed) {
    throw new Error('Email is required.');
  }
 
  if (!trimmed.includes('@')) {
    throw new Error('Email must contain an @ symbol.');
  }
 
  if (!EMAIL_REGEX.test(trimmed)) {
    throw new Error('Email address is invalid.');
  }
 
  if (trimmed.length > 254) { // RFC 5321 max length
    throw new Error('Email address is too long.');
  }
 
  return trimmed; // always return the normalized form
}
 
function validatePassword(password) {
  if (typeof password !== 'string') {
    throw new Error('Password must be a string.');
  }
 
  if (!password) {
    throw new Error('Password is required.');
  }
 
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters.');
  }
 
  if (password.length > 128) {
    throw new Error('Password must not exceed 128 characters.');
  }
 
  if (!PASSWORD_REGEX.test(password)) {
    throw new Error(
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.'
    );
  }
}
 
function validateName(value, fieldName) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${fieldName} is required.`);
  }
 
  if (!NAME_REGEX.test(value.trim())) {
    throw new Error(`${fieldName} contains invalid characters.`);
  }
}
 
// ======================
// LOGIN USER
// ======================
export async function loginUser(email, password) {
  // --- Input validation ---
  if (!email || !password) {
    throw new Error('Email and password are required.');
  }
 
  const normalizedEmail = validateEmail(email);
 
  if (typeof password !== 'string' || !password) {
    throw new Error('Password is required.');
  }
 
  // --- Lookup ---
  const result = await dynamo.send(new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :email',
    ExpressionAttributeValues: {
      ':email': `EMAIL#${normalizedEmail}`,
    },
  }));
 
  const user = result.Items?.[0];
 
  // Always run bcrypt.compare even when no user is found to prevent
  // timing-based user enumeration attacks.
  const DUMMY_HASH = '$2b$12$invalidhashpaddingtomakethisexactly60charslong123456789';
  const passwordMatches = await bcrypt.compare(
    password,
    user?.password ?? DUMMY_HASH
  );
 
  if (!user || !passwordMatches) {
    // Use one generic message regardless of which check failed — never
    // reveal whether the email exists in the database.
    throw new Error('Invalid credentials.');
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
  // --- Input validation ---
  validateName(firstName, 'First name');
  validateName(lastName, 'Last name');
 
  const normalizedEmail = validateEmail(email);
 
  validatePassword(password);
 
  if (termsConditions !== true) {
    throw new Error('You must accept the terms and conditions.');
  }
 
  // --- Duplicate email check ---
  const existing = await dynamo.send(new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :email',
    ExpressionAttributeValues: {
      ':email': `EMAIL#${normalizedEmail}`,
    },
  }));
 
  if (existing.Items?.length > 0) {
    throw new Error('Email already in use.');
  }
 
  const userId = uuidv4();
  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
 
  // Main user profile item
  const userItem = {
    PK: `USER#${userId}`,
    SK: 'PROFILE',
 
    GSI1PK: `EMAIL#${normalizedEmail}`,
    GSI1SK: `USER#${userId}`,
 
    userId,
    email: normalizedEmail, // persist the normalized (lowercase) form
    firstName: firstName.trim(),
    lastName: lastName.trim(),
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
        ConditionExpression: 'attribute_not_exists(PK)',
      })),
      dynamo.send(new PutCommand({ TableName: TABLE_NAME, Item: settingsItem })),
      dynamo.send(new PutCommand({ TableName: TABLE_NAME, Item: rewardsItem })),
      dynamo.send(new PutCommand({ TableName: TABLE_NAME, Item: newsletterItem })),
    ]);
  } catch (err) {
    // Log the real error server-side but never leak DynamoDB internals to the client.
    console.error('Signup DynamoDB error:', err);
    throw new Error('Failed to create account. Please try again.', { cause: err });
  }
 
  const token = jwt.sign(
    { userId, email: normalizedEmail, firstName: firstName.trim() },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
 
  return {
    token,
    userId,
    email: normalizedEmail,
    firstName: firstName.trim(),
  };
}
 
// ======================
// VERIFY TOKEN
// ======================
export function verifyToken(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('Token is required.');
  }
 
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    // Mask the specific JWT error (expired vs. malformed vs. wrong secret)
    // to avoid leaking implementation details.
    throw new Error('Invalid or expired token.', { cause: err });
  }
}