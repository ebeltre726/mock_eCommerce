// seed.js

import {
DynamoDBClient,
CreateTableCommand,
DescribeTableCommand
} from "@aws-sdk/client-dynamodb";

import {
DynamoDBDocumentClient,
PutCommand
} from "@aws-sdk/lib-dynamodb";

const PRODUCTS_TABLE = "Products";
const USERS_TABLE = "Users";
const CART_TABLE = "Cart";

// Connect to DynamoDB Local
const client = new DynamoDBClient({
  region: "us-east-1",
  endpoint: "http://localhost:8000",
  credentials: {
    accessKeyId: "dummy",
    secretAccessKey: "dummy"
  }
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

async function ensureTableExists(tableName, params) {
  try {
    await client.send(
      new DescribeTableCommand({ TableName: tableName })
    );

    console.log(`${tableName} table already exists`);

  } catch (err) {

    if (err.name === "ResourceNotFoundException") {

      console.log(`Creating ${tableName} table...`);

      await client.send(
        new CreateTableCommand(params)
      );

      console.log(`${tableName} table created`);

    } else {
      throw err;
    }
  }
}

const productsTableConfig = {
  TableName: PRODUCTS_TABLE,
  AttributeDefinitions: [
    { AttributeName: "id", AttributeType: "S" }
  ],
  KeySchema: [
    { AttributeName: "id", KeyType: "HASH" }
  ],
  BillingMode: "PAY_PER_REQUEST"
};

const cartTableConfig = {
  TableName: CART_TABLE,
  AttributeDefinitions: [
    { AttributeName: "userId", AttributeType: "S" },
    { AttributeName: "productId", AttributeType: "S" }
  ],
  KeySchema: [
    { AttributeName: "userId", KeyType: "HASH" },
    { AttributeName: "productId", KeyType: "RANGE" }
  ],
  BillingMode: "PAY_PER_REQUEST"
};

const usersTableConfig = {
  TableName: USERS_TABLE,
  AttributeDefinitions: [
    { AttributeName: "userId", AttributeType: "S" },
    { AttributeName: "email", AttributeType: "S" }
  ],
  KeySchema: [
    { AttributeName: "userId", KeyType: "HASH" }
  ],
  BillingMode: "PAY_PER_REQUEST",
  GlobalSecondaryIndexes: [
    {
      IndexName: "EmailIndex",
      KeySchema: [{ AttributeName: "email", KeyType: "HASH" }],
      Projection: { ProjectionType: "ALL" },
      ProvisionedThroughput: { ReadCapacityUnits: 1, WriteCapacityUnits: 1 }
    }
  ]
};

async function insertProducts() {

  for (const product of products) {

    await docClient.send(
      new PutCommand({
        TableName: PRODUCTS_TABLE,
        Item: product
      })
    );

    console.log(`Inserted: ${product.name}`);
  }
}

async function seed() {

  try {

    await ensureTableExists(
      PRODUCTS_TABLE,
      productsTableConfig
    );

    await ensureTableExists(
      CART_TABLE,
      cartTableConfig
    );

    await ensureTableExists(
      USERS_TABLE,
      usersTableConfig
    );

    await insertProducts();

    console.log("Seeding complete");

  } catch (err) {

    console.error("Error seeding:", err);

  } finally {

    process.exit(0);

  }
}

seed();