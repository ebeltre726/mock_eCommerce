// seed.js
import { DynamoDBClient, CreateTableCommand, DescribeTableCommand, DeleteTableCommand } 
  from "@aws-sdk/client-dynamodb";

import { DynamoDBDocumentClient, PutCommand, ScanCommand } 
  from "@aws-sdk/lib-dynamodb";

const TABLE_NAME = "Products";

// Connect to DynamoDB Local
const client = new DynamoDBClient({
  region: "us-east-1",
  endpoint: "http://localhost:8000",
});

const docClient = DynamoDBDocumentClient.from(client);

// 🔹 Your Custom Product Data
const products = [
  {
    id: "chair-1",
    name: "Cushioned Blue Fabric Chair",
    description: "A comfortable, blue chair with the highest quality fabric, and four sturdy wooden legs.",
    imageUrl: "/images/comfychair.jpg",
    price: 39.99,
  },
  {
    id: "chair-2",
    name: "Cushioned Black Stool Chair",
    description: "A black stool chair with a backrest, padded cushion, and three durable wooden legs that move outwards.",
    imageUrl: "/images/blackchair.jpg",
    price: 14.99,
  },
  {
    id: "chair-3",
    name: "Dark Blue Leather Chair",
    description: "A dark blue chair with premium leather, arm supports, four wooden legs that move outwards, and leg supports.",
    imageUrl: "/images/blueleatherchair.jpg",
    price: 29.99,
  },
  {
    id: "chair-4",
    name: "Tan Office Chair",
    description: "A tan-colored, adjustable fabric office chair, with arm rests and wheels.",
    imageUrl: "/images/brownofficechair.jpg",
    price: 39.99,
  },
  {
    id: "chair-5",
    name: "Tan Fabric Chair",
    description: "A tan-colored fabric chair with three thick and sturdy wooden legs that move outwards.",
    imageUrl: "/images/chair.jpg",
    price: 19.99,
  },
  {
    id: "chair-6",
    name: "Tan Netted Chair",
    description: "A tan-colored netted chair with a metal skeleton and a C-shape design.",
    imageUrl: "/images/nettedchair.jpg",
    price: 14.99,
  },
  {
    id: "chair-7",
    name: "Cushioned Stool Chair",
    description: "A black stool chair with a brown cushion and backrest. Has four legs with supports.",
    imageUrl: "/images/stoolchair.jpg",
    price: 14.99,
  },
  {
    id: "chair-8",
    name: "Wood Office Chair",
    description: "Sturdy, wood office chair. Our cheapest product, but most durable. Encouraged for simple use cases.",
    imageUrl: "/images/woodofficechair.jpg",
    price: 9.99,
  },
  {
    id: "chair-9",
    name: "Sun-Glazed Chair",
    description: "A Furnituria classic. Our sun-glazed chair with high quality polished wood and three curved tripod-like legs adds an aesthetic touch to your setup.",
    imageUrl: "/images/sunglazedchair.jpg",
    price: 34.99,
  },
  {
    id: "chair-10",
    name: "Plain White Chair",
    description: "A sturdy and durable plain all-white chair. One of our most purchased products.",
    imageUrl: "/images/whitechair.jpg",
    price: 9.99,
  },
  {
    id: "chair-11",
    name: "Old-Fashioned Wood Chair",
    description: "A sturdy, old-fashioned wood chair with traditional design and leg supports.",
    imageUrl: "/images/woodchair.jpg",
    price: 19.99,
  },
  {
    id: "chair-12",
    name: "Wood Stool",
    description: "A plain wood stool with leg supports. Great for businesses or simple home use. One of our very first products.",
    imageUrl: "/images/woodstool.jpg",
    price: 9.99,
  }
];

// 🔹 Create table if it doesn't exist
async function ensureTableExists() {
  try {
    await client.send(new DescribeTableCommand({ TableName: TABLE_NAME }));
    console.log("Table already exists.");
  } catch (err) {
    if (err.name === "ResourceNotFoundException") {
      console.log("Creating Products table...");

      await client.send(
        new CreateTableCommand({
          TableName: TABLE_NAME,
          AttributeDefinitions: [
            { AttributeName: "id", AttributeType: "S" }
          ],
          KeySchema: [
            { AttributeName: "id", KeyType: "HASH" }
          ],
          BillingMode: "PAY_PER_REQUEST"
        })
      );

      console.log("Table created.");
    } else {
      throw err;
    }
  }
}

// 🔹 Clear existing items (dev convenience)
async function clearTable() {
  const data = await docClient.send(
    new ScanCommand({ TableName: TABLE_NAME })
  );

  if (!data.Items || data.Items.length === 0) {
    return;
  }

  console.log("Clearing existing products...");

  for (const item of data.Items) {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: item,
        ConditionExpression: "attribute_not_exists(id)"
      })
    );
  }
}

// 🔹 Insert products
async function insertProducts() {
  for (const product of products) {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: product
      })
    );
    console.log(`Inserted: ${product.name}`);
  }
}

// 🔹 Run Seeder
async function seed() {
  try {
    await ensureTableExists();
    await insertProducts();
    console.log("Seeding complete.");
  } catch (err) {
    console.error("Error seeding:", err);
  } finally {
    process.exit(0);
  }
}

seed();