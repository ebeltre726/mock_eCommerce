import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo } from '../db/dynamoClient.js';

const TABLE_NAME = 'Furnituria';

export async function fetchOverview(userId) {
  console.log('fetchOverview userId:', userId);
  console.log('PK used:', `USER#${userId}`);

  const result = await dynamo.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: `USER#${userId}`,  // ✅ THIS IS THE FIX
      SK: 'PROFILE',         // ✅ REQUIRED
    },
  }));

  if (!result.Item) {
    throw new Error('User not found');
  }

  return result.Item;
}
export async function patchOverview(userId, fields) {
    const allowed = ['firstName', 'lastName', 'avatar'];
    const updates = Object.keys(fields).filter(k => allowed.includes(k));
    if (updates.length === 0) throw new Error('No valid fields to update');

    const UpdateExpression = 'SET ' + updates.map(k => `#${k} = :${k}`).join(', ');
    const ExpressionAttributeNames = Object.fromEntries(updates.map(k => [`#${k}`, k]));
    const ExpressionAttributeValues = Object.fromEntries(updates.map(k => [`:${k}`, fields[k]]));

    const result = await dynamo.send(new UpdateCommand({
        TableName: 'Users',
        Key: { userId },
        UpdateExpression,
        ExpressionAttributeNames,
        ExpressionAttributeValues,
        ReturnValues: 'ALL_NEW',
    }));
    return result.Attributes;
}

export async function incrementStat(userId, statName, amount = 1) {
    await dynamo.send(new UpdateCommand({
        TableName: 'Users',
        Key: { userId },
        UpdateExpression: 'ADD stats.#stat :amount',
        ExpressionAttributeNames: { '#stat': statName },
        ExpressionAttributeValues: { ':amount': amount },
    }));
}