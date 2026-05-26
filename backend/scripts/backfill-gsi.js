// scripts/backfill-gsi.js
import { ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo } from '../src/db/dynamoClient.js';

const TABLE = process.env.DYNAMODB_TABLE;
let lastKey;

do {
  const { Items, LastEvaluatedKey } = await dynamo.send(new ScanCommand({
    TableName: TABLE,
    FilterExpression: 'attribute_not_exists(GSI1PK) AND (entityType = :o OR entityType = :r)',
    ExpressionAttributeValues: { ':o': 'ORDER', ':r': 'RETURN' },
    ...(lastKey && { ExclusiveStartKey: lastKey }),
  }));

  for (const item of Items ?? []) {
    const gsiPk = `${item.entityType}#${item.status}`;
    console.log('attempting', item.PK, item.SK, '→', gsiPk);
    try {
      await dynamo.send(new UpdateCommand({
        TableName: TABLE,
        Key:       { PK: item.PK, SK: item.SK },
        UpdateExpression: 'SET GSI1PK = :gsi, createdAt = if_not_exists(createdAt, :ca)',
        ExpressionAttributeValues: { ':gsi': gsiPk, ':ca': item.updatedAt ?? new Date().toISOString() },
      }));
      console.log('backfilled', gsiPk, item.SK);
    } catch (err) {
      console.error('FAILED', item.PK, item.SK, gsiPk, err.message);
    }
  }
  lastKey = LastEvaluatedKey;
} while (lastKey);