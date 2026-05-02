import sharp from "sharp";
import { storage } from "../storage/index.js";
import { dynamo } from "../db/dynamoClient.js";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { validateFile } from "../utils/validateFile.js";

const TABLE_NAME = 'Furnituria';

export async function uploadAvatar(userId, file) {
  console.log('Starting avatar upload for user:', userId);
  validateFile(file);
  console.log('File validation passed');

  const buffer = await sharp(file.buffer)
    .resize(300, 300, { fit: "cover" })
    .toFormat("webp")
    .toBuffer();
  console.log('Image processing completed, buffer size:', buffer.length);

  const key = `avatars/${userId}-${Date.now()}.webp`;
  console.log('Generated key:', key);

  const imageUrl = await storage.uploadImage(buffer, key);
  console.log('Storage upload completed, URL:', imageUrl);

  await dynamo.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: `USER#${userId}`,
      SK: "PROFILE",
    },
    UpdateExpression: "SET avatar = :a",
    ExpressionAttributeValues: {
      ":a": imageUrl,
    },
  }));
  console.log('Database update completed');

  return imageUrl;
}