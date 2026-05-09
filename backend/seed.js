import {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
  DeleteTableCommand,
} from '@aws-sdk/client-dynamodb';

import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';

import 'dotenv/config'; // must be first — loads .env before env.js validates
import { dynamo }       from './src/db/dynamoClient.js';
import { storage }      from './src/storage/index.js';
import { v4 as uuidv4 } from 'uuid';
import fs               from 'fs/promises';
import path             from 'path';
const TABLE_NAME = 'Furnitria';
const USER_ID = 'u001';
const MOCK_EMAIL = 'jane.doe@email.com';
const MOCK_PASSWORD = 'N/A — managed by Cognito';

const client = new DynamoDBClient({
  region: 'us-east-1',
  endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000',
  credentials: { accessKeyId: 'dummy', secretAccessKey: 'dummy' },
});

const docClient = DynamoDBDocumentClient.from(client);

const tableConfig = {
  TableName: TABLE_NAME,
  AttributeDefinitions: [
    { AttributeName: 'PK',         AttributeType: 'S' },
    { AttributeName: 'SK',         AttributeType: 'S' },
    { AttributeName: 'GSI1PK',     AttributeType: 'S' },
    { AttributeName: 'GSI1SK',     AttributeType: 'S' },
    { AttributeName: 'entityType', AttributeType: 'S' },
  ],
  KeySchema: [
    { AttributeName: 'PK', KeyType: 'HASH' },
    { AttributeName: 'SK', KeyType: 'RANGE' },
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: 'GSI1',
      KeySchema: [
        { AttributeName: 'GSI1PK', KeyType: 'HASH' },
        { AttributeName: 'GSI1SK', KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: 'ALL' },
    },
    {
      IndexName: 'EntityTypeIndex',
      KeySchema: [
        { AttributeName: 'entityType', KeyType: 'HASH' },
      ],
      Projection: { ProjectionType: 'ALL' },
    },
  ],
  BillingMode: 'PAY_PER_REQUEST',
};

// run with: RUN_SEED=true node seed.js

//imageURLs

export async function seedProducts() {
    console.log('\n📦 Seeding products...');

    const existing = await dynamo.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
            ':pk': 'PRODUCT#chair-1',
        },
        Limit: 1,
    }));

    if (existing.Items?.length) {
        console.log('⏭️  Products already seeded — skipping');
        return;
    }

    const productData = [
        { id: 'chair-1',  name: 'Cushioned Blue Fabric Chair',   description: 'A comfortable, blue chair with the highest quality fabric, and four sturdy wooden legs.',                                                                          filename: 'comfychair.jpg',       price: 39.99 },
        { id: 'chair-2',  name: 'Cushioned Black Stool Chair',    description: 'A black stool chair with a backrest, padded cushion, and three durable wooden legs that move outwards.',                                                           filename: 'blackchair.jpg',       price: 14.99 },
        { id: 'chair-3',  name: 'Dark Blue Leather Chair',        description: 'A dark blue chair with premium leather, arm supports, four wooden legs that move outwards, and leg supports.',                                                     filename: 'blueleatherchair.jpg', price: 29.99 },
        { id: 'chair-4',  name: 'Tan Office Chair',               description: 'A tan-colored, adjustable fabric office chair, with arm rests and wheels.',                                                                                       filename: 'brownofficechair.jpg', price: 39.99 },
        { id: 'chair-5',  name: 'Tan Fabric Chair',               description: 'A tan-colored fabric chair with three thick and sturdy wooden legs that move outwards.',                                                                          filename: 'chair.jpg',            price: 19.99 },
        { id: 'chair-6',  name: 'Tan Netted Chair',               description: 'A tan-colored netted chair with a metal skeleton and a C-shape design.',                                                                                         filename: 'nettedchair.jpg',      price: 14.99 },
        { id: 'chair-7',  name: 'Cushioned Stool Chair',          description: 'A black stool chair with a brown cushion and backrest. Has four legs with supports.',                                                                             filename: 'stoolchair.jpg',       price: 14.99 },
        { id: 'chair-8',  name: 'Wood Office Chair',              description: 'Sturdy, wood office chair. Our cheapest product, but most durable. Encouraged for simple use cases.',                                                             filename: 'woodofficechair.jpg',  price:  9.99 },
        { id: 'chair-9',  name: 'Sun-Glazed Chair',               description: 'A Furnitria classic. Our sun-glazed chair with high quality polished wood and three curved tripod-like legs adds an aesthetic touch to your setup.',            filename: 'sunglazedchair.jpg',   price: 34.99 },
        { id: 'chair-10', name: 'Plain White Chair',              description: 'A sturdy and durable plain all-white chair. One of our most purchased products.',                                                                                 filename: 'whitechair.jpg',       price:  9.99 },
        { id: 'chair-11', name: 'Old-Fashioned Wood Chair',       description: 'A sturdy, old-fashioned wood chair with traditional design and leg supports.',                                                                                    filename: 'woodchair.jpg',        price: 19.99 },
    ];

    // Upload all images in parallel first
    const imageUrls = await Promise.all(
        productData.map(p => uploadSeedImage(p.filename))
    );

    // Build product records with real Minio/S3 URLs
    const products = productData.map((p, i) => ({
        PK:          `PRODUCT#${p.id}`,
        SK:          `PRODUCT#${p.id}`,
        entityType:  'PRODUCT',
        id:          p.id,
        name:        p.name,
        description: p.description,
        imageUrl:    imageUrls[i],
        price:       p.price,
    }));

    // Write to DynamoDB
    await Promise.all(products.map(product =>
        dynamo.send(new PutCommand({
            TableName: TABLE_NAME,
            Item:      product,
        }))
    ));

    console.log(`✅ Seeded ${products.length} products`);
}

async function waitForTableDeletion() {
  let exists = true;
  while (exists) {
    try {
      await client.send(new DescribeTableCommand({ TableName: TABLE_NAME }));
      console.log('⏳ Waiting for table deletion...');
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      if (err.name === 'ResourceNotFoundException') {
        exists = false;
      } else {
        throw err;
      }
    }
  }
}

async function uploadSeedImage(filename) {
    const localPath   = path.resolve('seed-images', filename);
    const key         = `products/${filename}`;
    const contentType = filename.endsWith('.png') ? 'image/png' : 'image/jpeg';
    const url         = await storage.uploadImage(
        await fs.readFile(localPath),
        key,
        contentType,
        process.env.S3_BUCKET_PRODUCTS,
    );
    console.log(`[seed] uploaded ${filename} → ${url}`);
    return url;
}

export async function recreateTable() {
  try {
    await client.send(new DeleteTableCommand({ TableName: TABLE_NAME }));
    console.log(`🗑 Deleted ${TABLE_NAME}`);
    await waitForTableDeletion();
  } catch (err) {
    if (err.name !== 'ResourceNotFoundException') throw err;
  }

  await client.send(new CreateTableCommand(tableConfig));
  console.log(`✅ Created ${TABLE_NAME}`);
}

async function put(item) {
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: item,
  }));
}

export async function seedAddress(userId, address = {}) {
  console.log('\n🏠 Seeding ADDRESS...');

  const addressId = address.addressId || 'addr001';
  const street = address.street || '123 Main St';
  const city = address.city || 'Anytown';
  const state = address.state || 'NY';
  const postal = address.postal || '10001';
  const isDefault = address.isDefault || false;

  const addressItem = {
    PK: `USER#${userId}`,
    SK: `ADDRESS#${addressId}`,

    GSI1PK: `USER#${userId}`,
    GSI1SK: `ADDRESS#${addressId}`,

    addressId,
    street,
    city,
    state,
    postal,
    isDefault,
    dateCreated: new Date().toISOString(),
  };

  console.log('➡️ Writing address item:', addressItem.PK, addressItem.SK);

  await put(addressItem);

  console.log('✅ Address inserted');
}

export async function seedUser(user = {}) {
  console.log('\n🔧 Seeding USER (PROFILE)...');

  const userId    = user.userId    || USER_ID;
  const email     = user.email     || MOCK_EMAIL;
  const firstName = user.firstName || 'Jane';
  const lastName  = user.lastName  || 'Doe';

  // Passwords are managed by Cognito — no password field in DynamoDB
  const userItem = {
    PK: `USER#${userId}`,
    SK: 'PROFILE',

    GSI1PK: `EMAIL#${email}`,
    GSI1SK: `USER#${userId}`,

    userId,
    email,
    firstName,
    lastName,
    termsConditions: true,
    dateCreated: new Date().toISOString(),
    avatar: 'http://localhost:3000/images/avatar.png',

    stats: {
      orders: 0,
      wishlist: 0,
      points: 0,
      returns: 0,
    },
  };

  console.log('➡️ Writing user item:', userItem);

  await put(userItem);

  // Create default address for user
  await seedAddress(userId, {
    addressId: 'default',
    street: '123 Main St',
    city: 'Anytown',
    state: 'NY',
    postal: '10001',
    isDefault: true,
  });

  await put({
    PK: `USER#${userId}`,
    SK: 'SETTINGS',
    shareData: false,
    emailUpdates: true,
    smsNotifications: false,
  });

  await put({
    PK: `USER#${userId}`,
    SK: 'REWARDS',
    points: 1240,
    tier: 'Silver',
    deals: [],
  });

  await put({
    PK: `USER#${userId}`,
    SK: 'NEWSLETTER',
    subscribed: true,
    topics: [],
  });

  console.log('✅ User + address + related items inserted');

  // 🔍 VERIFY
  const check = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: {
      ':pk': `USER#${userId}`,
    },
  }));

  console.log('\n🔎 DB STATE AFTER SEED:');
  console.dir(check.Items, { depth: null });
}

export async function seedReturns() {
  console.log('\n🔄 Seeding returns...');

  const returns = [
    {
      returnId: 'r1',
      orderId: 'o001',
      orderNumber: '10021',
      item: 'Cushioned Blue Fabric Chair',
      reason: 'Defective',
      status: 'Refund Issued',
      refundAmount: 39.99,
      dateInitiated: '2024-11-15T10:00:00.000Z'
    },
  ];

  for (const ret of returns) {
    try {
      const item = {
        PK: `USER#${USER_ID}`,
        SK: `RETURN#${ret.returnId}`,
        entityType: 'RETURN',
        userId: USER_ID,
        ...ret,
      };

      console.log('➡️ Writing return item:', item.SK);
      await put(item);
    } catch (err) {
      console.error('❌ Failed to insert return:', ret.returnId, err);
    }
  }

  console.log(`✅ Inserted ${returns.length} returns`);
}

async function seed() {
  try {
    console.log('\n🚀 Starting seed...');

    await recreateTable();
    await seedUser();

    console.log('Seeding products...');
    await seedProducts();

    console.log('Seeding returns...');
    await seedReturns();
    console.log('Returns seeded.');

    console.log('\n🎉 Seed complete!');
    console.log('─────────────────────────────');
    console.log(`Email:    ${MOCK_EMAIL}`);
    console.log(`Password: ${MOCK_PASSWORD}`);
    console.log('─────────────────────────────\n');

  } catch (err) {
    console.error('❌ Seed failed:', err);
  } finally {
    // When imported by tests we don't want to exit the process — leave cleanup to caller
  }
}

// By default do NOT auto-run when this file is imported (avoids Jest parse/runtime issues).
// To run seeding manually set the environment variable RUN_SEED=true and execute the file:
//   On *nix: RUN_SEED=true node seed.js
//   On Windows (PowerShell): $env:RUN_SEED='true'; node seed.js
if (process.env.RUN_SEED === 'true') {
  // run only when explicitly requested via env var
  seed();
}