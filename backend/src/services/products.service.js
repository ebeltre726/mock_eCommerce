// services/products.service.js
import { dynamo } from "../db/dynamoClient.js";
import { ScanCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

const TABLE_NAME = "Products";

export async function fetchAllProducts() {
  const data = await dynamo.send(new ScanCommand({ TableName: TABLE_NAME }));
  return data.Items || [];
}

export async function fetchProductById(id) {
  const data = await dynamo.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { id } })
  );
  return data.Item || null;
}