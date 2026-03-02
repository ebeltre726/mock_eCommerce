import { dynamo } from "../db/dynamoClient.js";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

const TABLE_NAME = "Cart";
const MAX_PER_ITEM = 10;

export async function addToCart(userId, productId, quantity) {
  quantity = Math.min(quantity, MAX_PER_ITEM);

  const existing = await dynamo.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { userId, productId }
  }));

  const newQty = Math.min(
    (existing.Item?.quantity || 0) + quantity,
    MAX_PER_ITEM
  );

  await dynamo.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      userId,
      productId,
      quantity: newQty
    }
  }));

  return { productId, quantity: newQty };
}