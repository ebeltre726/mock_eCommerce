import sharp from "sharp";
import { storage } from "../storage/index.js";
import { dynamo } from "../db/dynamoClient.js";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { validateFile } from "../utils/validateFile.js";

const TABLE_NAME = process.env.DYNAMODB_TABLE ?? 'Furnitria';

export async function uploadAvatar(userId, file) {
  validateFile(file);

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

  return storage.getDownloadUrl(key);
}