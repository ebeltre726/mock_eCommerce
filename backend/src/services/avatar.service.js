import { storage } from "../storage/index.js";
import { dynamo } from "../db/dynamoClient.js";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { validateFile } from "../utils/validateFile.js";
import logger from "../utils/logger.js";
import env from "../config/env.js";

const TABLE_NAME = env.DYNAMODB_TABLE;

export async function uploadAvatar(userId, file) {
  await validateFile(file);

  const existing = await dynamo.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
    ProjectionExpression: 'avatar',
  }));
  const oldKey = existing.Item?.avatar ?? null;

  // Dynamic import: sharp is a native addon that must not be loaded at module
  // initialisation time — doing so crashes the Lambda process before any logs
  // can be written. Loading it here confines the native binding to the call site.
  const { default: sharp } = await import('sharp');
  const buffer = await sharp(file.buffer)
    .resize(300, 300, { fit: "cover" })
    .toFormat("webp")
    .toBuffer();

  const key = `avatars/${userId}-${Date.now()}.webp`;

  await storage.uploadImage(buffer, key);

  await dynamo.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: `USER#${userId}`,
      SK: "PROFILE",
    },
    UpdateExpression: "SET avatar = :a",
    ExpressionAttributeValues: {
      ":a": key,
    },
  }));

  // Best-effort: delete the previous avatar so stale objects don't accumulate.
  if (oldKey && oldKey !== key) {
    storage.deleteObject(oldKey).catch(err =>
      logger.warn({ oldKey, err: err.message }, '[avatar] failed to delete old object')
    );
  }

  // Always return a presigned URL (not the plain objectUrl from uploadImage) because
  // the avatars bucket is private — the plain S3 URL returns 403 for unauthenticated requests.
  return storage.getDownloadUrl(key);
}