// seed.js
// ============================================================
// NOTE ON ARCHITECTURE:
// This local development environment uses a multi-table DynamoDB
// setup for readability and ease of debugging during development.
// The live production deployment uses single-table design for
// cost savings and AWS best practices.
// ============================================================

import {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
  DeleteTableCommand,
} from '@aws-sdk/client-dynamodb';

import {
  DynamoDBDocumentClient,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';

import bcrypt from 'bcrypt';

// ============================================================
// TABLE NAMES
// ============================================================

const PRODUCTS_TABLE   = 'Products';
const USERS_TABLE      = 'Users';
const CART_TABLE       = 'Cart';
const ORDERS_TABLE     = 'Orders';
const ADDRESSES_TABLE  = 'Addresses';
const PAYMENTS_TABLE   = 'PaymentMethods';
const WISHLIST_TABLE   = 'Wishlist';
const RETURNS_TABLE    = 'Returns';
const REWARDS_TABLE    = 'Rewards';
const NEWSLETTER_TABLE = 'Newsletter';
const SETTINGS_TABLE   = 'Settings';

// ============================================================
// CLIENT
// ============================================================

const client = new DynamoDBClient({
  region: 'us-east-1',
  endpoint: 'http://localhost:8000',
  credentials: {
      accessKeyId: 'dummy',
      secretAccessKey: 'dummy',
  },
});

const docClient = DynamoDBDocumentClient.from(client);

// ============================================================
// TABLE CONFIGS
// ============================================================

const productsTableConfig = {
  TableName: PRODUCTS_TABLE,
  AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
  KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
  BillingMode: 'PAY_PER_REQUEST',
};

const cartTableConfig = {
  TableName: CART_TABLE,
  AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'productId', AttributeType: 'S' },
  ],
  KeySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' },
      { AttributeName: 'productId', KeyType: 'RANGE' },
  ],
  BillingMode: 'PAY_PER_REQUEST',
};

const usersTableConfig = {
  TableName: USERS_TABLE,
  AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'email', AttributeType: 'S' },
  ],
  KeySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }],
  BillingMode: 'PAY_PER_REQUEST',
  GlobalSecondaryIndexes: [{
      IndexName: 'EmailIndex',
      KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }],
      Projection: { ProjectionType: 'ALL' },
      ProvisionedThroughput: { ReadCapacityUnits: 1, WriteCapacityUnits: 1 },
  }],
};

const ordersTableConfig = {
  TableName: ORDERS_TABLE,
  AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'orderId', AttributeType: 'S' },
  ],
  KeySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' },
      { AttributeName: 'orderId', KeyType: 'RANGE' },
  ],
  BillingMode: 'PAY_PER_REQUEST',
};

const addressesTableConfig = {
  TableName: ADDRESSES_TABLE,
  AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'addressId', AttributeType: 'S' },
  ],
  KeySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' },
      { AttributeName: 'addressId', KeyType: 'RANGE' },
  ],
  BillingMode: 'PAY_PER_REQUEST',
};

const paymentsTableConfig = {
  TableName: PAYMENTS_TABLE,
  AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'paymentId', AttributeType: 'S' },
  ],
  KeySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' },
      { AttributeName: 'paymentId', KeyType: 'RANGE' },
  ],
  BillingMode: 'PAY_PER_REQUEST',
};

const wishlistTableConfig = {
  TableName: WISHLIST_TABLE,
  AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'wishlistId', AttributeType: 'S' },
  ],
  KeySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' },
      { AttributeName: 'wishlistId', KeyType: 'RANGE' },
  ],
  BillingMode: 'PAY_PER_REQUEST',
};

const returnsTableConfig = {
  TableName: RETURNS_TABLE,
  AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'returnId', AttributeType: 'S' },
  ],
  KeySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' },
      { AttributeName: 'returnId', KeyType: 'RANGE' },
  ],
  BillingMode: 'PAY_PER_REQUEST',
};

const rewardsTableConfig = {
  TableName: REWARDS_TABLE,
  AttributeDefinitions: [{ AttributeName: 'userId', AttributeType: 'S' }],
  KeySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }],
  BillingMode: 'PAY_PER_REQUEST',
};

const newsletterTableConfig = {
  TableName: NEWSLETTER_TABLE,
  AttributeDefinitions: [{ AttributeName: 'userId', AttributeType: 'S' }],
  KeySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }],
  BillingMode: 'PAY_PER_REQUEST',
};

const settingsTableConfig = {
  TableName: SETTINGS_TABLE,
  AttributeDefinitions: [{ AttributeName: 'userId', AttributeType: 'S' }],
  KeySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }],
  BillingMode: 'PAY_PER_REQUEST',
};

// ============================================================
// PRODUCT DATA — paste your existing products array here
// ============================================================

const products = [
  // your existing products here
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
  }
];

// ============================================================
// MOCK USER — shared userId links all tables together
// ============================================================

const USER_ID       = 'u001';
const MOCK_EMAIL    = 'jane.doe@email.com';
const MOCK_PASSWORD = 'password123';

// ============================================================
// TABLE HELPERS
// ensureTableExists — keeps table if already present
// recreateTable     — deletes and recreates (full reset)
// ============================================================

async function ensureTableExists(tableName, config) {
  try {
      await client.send(new DescribeTableCommand({ TableName: tableName }));
      console.log(`  ${tableName} already exists — skipping`);
  } catch (err) {
      if (err.name === 'ResourceNotFoundException') {
          await client.send(new CreateTableCommand(config));
          console.log(`  ${tableName} created`);
      } else {
          throw err;
      }
  }
}

async function recreateTable(tableName, config) {
  try {
      await client.send(new DeleteTableCommand({ TableName: tableName }));
      console.log(`  Deleted ${tableName}`);
  } catch (err) {
      if (err.name !== 'ResourceNotFoundException') throw err;
  }
  await client.send(new CreateTableCommand(config));
  console.log(`  Created ${tableName}`);
}

// ============================================================
// SEED FUNCTIONS
// ============================================================

async function seedProducts() {
  for (const product of products) {
      await docClient.send(new PutCommand({ TableName: PRODUCTS_TABLE, Item: product }));
      console.log(`  Inserted product: ${product.name}`);
  }
}

async function seedUsers() {
  const hashedPassword = await bcrypt.hash(MOCK_PASSWORD, 10);
  await docClient.send(new PutCommand({
      TableName: USERS_TABLE,
      Item: {
          userId: USER_ID,
          firstName: 'Jane',
          lastName: 'Doe',
          email: MOCK_EMAIL,
          password: hashedPassword,
          avatar: 'avatar.png',
          dateCreated: '2023-01-15',
          termsConditions: true,
      },
  }));
  console.log(`  Inserted user: ${MOCK_EMAIL}`);
}

async function seedOrders() {
  const orders = [
      {
          userId: USER_ID,
          orderId: 'o001',
          orderNumber: '10021',
          orderDate: '2024-11-01',
          orderStatus: 'delivered',
          items: [
              { itemId: 'i1', name: 'Oak Dining Table', qty: 1, price: '799.00', image: 'products.png' },
              { itemId: 'i2', name: 'Chair Set', qty: 4, price: '199.00', image: 'products.png' },
          ],
      },
      {
          userId: USER_ID,
          orderId: 'o002',
          orderNumber: '10034',
          orderDate: '2025-01-20',
          orderStatus: 'processing',
          items: [
              { itemId: 'i3', name: 'Velvet Sofa', qty: 1, price: '1299.00', image: 'products.png' },
          ],
      },
  ];
  for (const order of orders) {
      await docClient.send(new PutCommand({ TableName: ORDERS_TABLE, Item: order }));
  }
  console.log(`  Inserted ${orders.length} orders`);
}

async function seedAddresses() {
  const addresses = [
      { userId: USER_ID, addressId: 'a1', label: 'Home', line1: '123 Main St', line2: '', city: 'Brooklyn', state: 'NY', zip: '11201', country: 'US', isDefault: true },
      { userId: USER_ID, addressId: 'a2', label: 'Work', line1: '456 Office Ave', line2: 'Suite 200', city: 'New York', state: 'NY', zip: '10001', country: 'US', isDefault: false },
  ];
  for (const address of addresses) {
      await docClient.send(new PutCommand({ TableName: ADDRESSES_TABLE, Item: address }));
  }
  console.log(`  Inserted ${addresses.length} addresses`);
}

async function seedPaymentMethods() {
  const methods = [
      { userId: USER_ID, paymentId: 'pm1', stripePaymentMethodId: 'pm_1Oq3Rk2Lder5mNp', stripeCustomerId: 'cus_Rk7mNpQx2Lder', brand: 'Visa', last4: '4242', expiry: '12/26', isDefault: true },
      { userId: USER_ID, paymentId: 'pm2', stripePaymentMethodId: 'pm_2Xr4Sk3Mfes6nOq', stripeCustomerId: 'cus_Rk7mNpQx2Lder', brand: 'Mastercard', last4: '5555', expiry: '08/25', isDefault: false },
  ];
  for (const method of methods) {
      await docClient.send(new PutCommand({ TableName: PAYMENTS_TABLE, Item: method }));
  }
  console.log(`  Inserted ${methods.length} payment methods`);
}

async function seedWishlist() {
  const items = [
      { userId: USER_ID, wishlistId: 'w1', name: 'Marble Coffee Table', price: '349.99', image: 'products.png', dateAdded: '2024-09-10' },
      { userId: USER_ID, wishlistId: 'w2', name: 'Linen Armchair', price: '549.00', image: 'products.png', dateAdded: '2024-10-22' },
  ];
  for (const item of items) {
      await docClient.send(new PutCommand({ TableName: WISHLIST_TABLE, Item: item }));
  }
  console.log(`  Inserted ${items.length} wishlist items`);
}

async function seedReturns() {
  const returns = [
      { userId: USER_ID, returnId: 'r1', orderId: 'o001', orderNumber: '10021', item: 'Chair Set', reason: 'Defective', status: 'Refund Issued', refundAmount: '199.00', dateInitiated: '2024-11-15' },
  ];
  for (const ret of returns) {
      await docClient.send(new PutCommand({ TableName: RETURNS_TABLE, Item: ret }));
  }
  console.log(`  Inserted ${returns.length} returns`);
}

async function seedRewards() {
  await docClient.send(new PutCommand({
      TableName: REWARDS_TABLE,
      Item: {
          userId: USER_ID,
          points: 1240,
          tier: 'Silver',
          deals: [
              { dealId: 'd1', description: '10% off your next order', discount: 'REWARD10', expiry: '2025-06-01' },
              { dealId: 'd2', description: 'Free standard shipping', discount: 'SHIPFREE', expiry: '2025-04-30' },
          ],
      },
  }));
  console.log(`  Inserted rewards`);
}

async function seedNewsletter() {
  await docClient.send(new PutCommand({
      TableName: NEWSLETTER_TABLE,
      Item: {
          userId: USER_ID,
          subscribed: true,
          topics: [
              { topicId: 't1', name: 'New Arrivals', selected: true },
              { topicId: 't2', name: 'Sales & Promotions', selected: false },
              { topicId: 't3', name: 'Design Tips & Inspiration', selected: true },
              { topicId: 't4', name: 'Exclusive Member Offers', selected: false },
          ],
      },
  }));
  console.log(`  Inserted newsletter preferences`);
}

async function seedSettings() {
  await docClient.send(new PutCommand({
      TableName: SETTINGS_TABLE,
      Item: {
          userId: USER_ID,
          shareData: false,
          emailUpdates: true,
          smsNotifications: false,
      },
  }));
  console.log(`  Inserted settings`);
}

// ============================================================
// MAIN
// Uses ensureTableExists by default — tables are only created
// if they don't already exist, existing data is preserved.
// To wipe and reset everything, swap ensureTableExists for
// recreateTable on whichever tables you want to reset.
// ============================================================

async function seed() {
  try {
      console.log('\nEnsuring tables exist...');
      await ensureTableExists(PRODUCTS_TABLE,   productsTableConfig);
      await ensureTableExists(CART_TABLE,        cartTableConfig);
      await ensureTableExists(USERS_TABLE,       usersTableConfig);
      await ensureTableExists(ORDERS_TABLE,      ordersTableConfig);
      await ensureTableExists(ADDRESSES_TABLE,   addressesTableConfig);
      await ensureTableExists(PAYMENTS_TABLE,    paymentsTableConfig);
      await ensureTableExists(WISHLIST_TABLE,    wishlistTableConfig);
      await ensureTableExists(RETURNS_TABLE,     returnsTableConfig);
      await ensureTableExists(REWARDS_TABLE,     rewardsTableConfig);
      await ensureTableExists(NEWSLETTER_TABLE,  newsletterTableConfig);
      await ensureTableExists(SETTINGS_TABLE,    settingsTableConfig);

      console.log('\nSeeding data...');
      await seedProducts();
      await seedUsers();
      await seedOrders();
      await seedAddresses();
      await seedPaymentMethods();
      await seedWishlist();
      await seedReturns();
      await seedRewards();
      await seedNewsletter();
      await seedSettings();

      console.log('\n✓ Seed complete!');
      console.log('─────────────────────────────');
      console.log('  Dev login credentials:');
      console.log(`  Email:    ${MOCK_EMAIL}`);
      console.log(`  Password: ${MOCK_PASSWORD}`);
      console.log('─────────────────────────────\n');

  } catch (err) {
      console.error('Seed failed:', err);
  } finally {
      process.exit(0);
  }
}

seed();