// Local dev mock — in production these calls go to AWS Cognito User Pools.
// Cognito SDK calls would replace this entire file.

import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import docClient from '../db/dynamoClient.js';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const JWT_SECRET = process.env.JWT_SECRET || 'local-dev-secret';

export async function loginUser(email, password) {
    const result = await docClient.send(new GetCommand({
        TableName: 'Users',
        Key: { email },
    }));

    const user = result.Item;
    if (!user) {
        throw new Error('Invalid credentials');
    }

    // Compare password with hash
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
    const existing = await docClient.send(new GetCommand({
        TableName: 'Users',
        Key: { email },
    }));

    if (existing.Item) {
        throw new Error('Email already in use');
    }

    const userId = uuidv4();

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
    };

    await docClient.send(new PutCommand({ TableName: 'Users', Item: newUser }));

    const token = jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '7d' });
    return { token, userId, email, firstName };
}
export function verifyToken(token) {
    return jwt.verify(token, JWT_SECRET);
}