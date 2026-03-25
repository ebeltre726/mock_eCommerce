// Local dev mock — in production these calls go to AWS Cognito User Pools.
// Cognito SDK calls would replace this entire file.

import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo } from '../db/dynamoClient.js';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const JWT_SECRET = process.env.JWT_SECRET || 'local-dev-secret';

export async function loginUser(email, password) {
    // Use the GSI to look up by email, same as signupUser does
    const result = await dynamo.send(new QueryCommand({
        TableName: 'Users',
        IndexName: 'EmailIndex',
        KeyConditionExpression: 'email = :email',
        ExpressionAttributeValues: { ':email': email },
    }));

    const user = result.Items?.[0];
    if (!user) {
        throw new Error('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
        throw new Error('Invalid credentials');
    }

    const token = jwt.sign(
        { userId: user.userId, email: user.email },
        JWT_SECRET,
        { expiresIn: '7d' }
    );

    return { token, userId: user.userId, email: user.email, firstName: user.firstName };
}


export async function signupUser({ firstName, lastName, email, password, termsConditions }) {
    const existing = await dynamo.send(new QueryCommand({
        TableName: 'Users',
        IndexName: 'EmailIndex', // matches seed.js
        KeyConditionExpression: 'email = :email',
        ExpressionAttributeValues: { ':email': email },
    }));

    if (existing.Items && existing.Items.length > 0) {
        throw new Error('Email already in use');
    }

    const userId = uuidv4();
    console.log('generated userId:', userId);

    // HASH the password
    const hashedPassword = await bcrypt.hash(password, 10); // 10 = salt rounds

    const newUser = {
        userId,
        email,
        firstName,
        lastName,
        password: hashedPassword, // store hash, not plain text
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

    await Promise.all([
        dynamo.send(new PutCommand({ TableName: 'Users', Item: newUser })),
        dynamo.send(new PutCommand({ TableName: 'Settings', Item: {
            userId,
            shareData: false,
            emailUpdates: false,
            smsNotifications: false,
        }})),
        dynamo.send(new PutCommand({ TableName: 'Rewards', Item: {
            userId,
            points: 0,
            tier: 'Bronze',
            deals: [],
        }})),
        dynamo.send(new PutCommand({ TableName: 'Newsletter', Item: {
            userId,
            subscribed: false,
            topics: [],
        }})),
    ]);

    const token = jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '7d' });
    return { token, userId, email, firstName };
}
export function verifyToken(token) {
    return jwt.verify(token, JWT_SECRET);
}