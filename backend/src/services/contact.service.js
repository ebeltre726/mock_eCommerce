import { dynamo } from '../db/dynamoClient.js';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const TABLE = process.env.DYNAMODB_TABLE ?? 'Furnituria';

export async function sendMessage({ firstName, lastName, email, emailMessage }) {
    if (!firstName || !lastName || !email || !emailMessage) {
        throw new Error('All fields are required');
    }

    const messageId = uuidv4();
    const now = new Date().toISOString();

    await dynamo.send(new PutCommand({
        TableName: TABLE,
        Item: {
            PK: `CONTACT#${messageId}`,
            SK: `CONTACT#${messageId}`,
            entityType: 'CONTACT',
            messageId,
            firstName,
            lastName,
            email,
            emailMessage,
            createdAt: now,
        },
    }));
}
