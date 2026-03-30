// seed.js — Single-table design
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
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';

import bcrypt from 'bcrypt';

const TABLE_NAME = 'Furnituria';
const USER_ID    = 'u001';
const MOCK_EMAIL = 'jane.doe@email.com';
const MOCK_PASSWORD = 'password123';

const client = new DynamoDBClient({
  region: 'us-east-1',
  endpoint: 'http://localhost:8000',
  credentials: { accessKeyId: 'dummy', secretAccessKey: 'dummy' },
});

const docClient = DynamoDBDocumentClient.from(client);

const tableConfig = {
  TableName: TABLE_NAME,
  AttributeDefinitions: [
      { AttributeName: 'PK', AttributeType: 'S' },
      { AttributeName: 'SK', AttributeType: 'S' },
      { AttributeName: 'GSI1PK', AttributeType: 'S' },
      { AttributeName: 'GSI1SK', AttributeType: 'S' },
  ],
  KeySchema: [
      { AttributeName: 'PK', KeyType: 'HASH' },
      { AttributeName: 'SK', KeyType: 'RANGE' },
  ],
  GlobalSecondaryIndexes: [{
      IndexName: 'GSI1',
      KeySchema: [
          { AttributeName: 'GSI1PK', KeyType: 'HASH' },
          { AttributeName: 'GSI1SK', KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: 'ALL' },
  }],
  BillingMode: 'PAY_PER_REQUEST',
};

async function recreateTable() {
  try {
      await client.send(new DeleteTableCommand({ TableName: TABLE_NAME }));
      console.log(`  Deleted ${TABLE_NAME}`);
      await new Promise(r => setTimeout(r, 500)); // wait for deletion
  } catch (err) {
      if (err.name !== 'ResourceNotFoundException') throw err;
  }
  await client.send(new CreateTableCommand(tableConfig));
  console.log(`  Created ${TABLE_NAME}`);
}

// Helper to write any item
async function put(item) {
  await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
}

async function seedUser() {
  const hashedPassword = await bcrypt.hash(MOCK_PASSWORD, 10);

  // User record
  await put({
      PK: `USER#${USER_ID}`,
      SK: `USER#${USER_ID}`,
      GSI1PK: `EMAIL#${MOCK_EMAIL}`,
      GSI1SK: `USER#${USER_ID}`,
      entityType: 'USER',
      userId:    USER_ID,
      email:     MOCK_EMAIL,
      firstName: 'Jane',
      lastName:  'Doe',
      password:  hashedPassword,
      avatar:    '/images/avatar.png',
      dateCreated: '2023-01-15',
      termsConditions: true,
      stats: { orders: 0, wishlist: 0, points: 0, returns: 0 },
  });

  // Settings
  await put({
      PK: `USER#${USER_ID}`,
      SK: 'SETTINGS',
      entityType: 'SETTINGS',
      userId: USER_ID,
      shareData: false,
      emailUpdates: true,
      smsNotifications: false,
  });

  // Newsletter
  await put({
      PK: `USER#${USER_ID}`,
      SK: 'NEWSLETTER',
      entityType: 'NEWSLETTER',
      userId: USER_ID,
      subscribed: true,
      topics: [
          { topicId: 't1', name: 'New Arrivals', selected: true },
          { topicId: 't2', name: 'Sales & Promotions', selected: false },
          { topicId: 't3', name: 'Design Tips & Inspiration', selected: true },
          { topicId: 't4', name: 'Exclusive Member Offers', selected: false },
      ],
  });

  // Rewards
  await put({
      PK: `USER#${USER_ID}`,
      SK: 'REWARDS',
      entityType: 'REWARDS',
      userId: USER_ID,
      points: 1240,
      tier: 'Silver',
      deals: [
          { dealId: 'd1', description: '10% off your next order', discount: 'REWARD10', expiry: '2025-06-01' },
          { dealId: 'd2', description: 'Free standard shipping', discount: 'SHIPFREE', expiry: '2025-04-30' },
      ],
  });

  console.log(`  Inserted user: ${MOCK_EMAIL}`);
}

async function seedProducts() {
  const products = [
      { id: 'chair-1', name: 'Cushioned Blue Fabric Chair', description: 'A comfortable, blue chair with the highest quality fabric, and four sturdy wooden legs.', imageUrl: '/images/comfychair.jpg', price: 39.99 },
      { id: 'chair-2', name: 'Cushioned Black Stool Chair', description: 'A black stool chair with a backrest, padded cushion, and three durable wooden legs that move outwards.', imageUrl: '/images/blackchair.jpg', price: 14.99 },
      { id: 'chair-3', name: 'Dark Blue Leather Chair', description: 'A dark blue chair with premium leather, arm supports, four wooden legs that move outwards, and leg supports.', imageUrl: '/images/blueleatherchair.jpg', price: 29.99 },
      { id: 'chair-4', name: 'Tan Office Chair', description: 'A tan-colored, adjustable fabric office chair, with arm rests and wheels.', imageUrl: '/images/brownofficechair.jpg', price: 39.99 },
      { id: 'chair-5', name: 'Tan Fabric Chair', description: 'A tan-colored fabric chair with three thick and sturdy wooden legs that move outwards.', imageUrl: '/images/chair.jpg', price: 19.99 },
      { id: 'chair-6', name: 'Tan Netted Chair', description: 'A tan-colored netted chair with a metal skeleton and a C-shape design.', imageUrl: '/images/nettedchair.jpg', price: 14.99 },
      { id: 'chair-7', name: 'Cushioned Stool Chair', description: 'A black stool chair with a brown cushion and backrest. Has four legs with supports.', imageUrl: '/images/stoolchair.jpg', price: 14.99 },
      { id: 'chair-8', name: 'Wood Office Chair', description: 'Sturdy, wood office chair. Our cheapest product, but most durable. Encouraged for simple use cases.', imageUrl: '/images/woodofficechair.jpg', price: 9.99 },
      { id: 'chair-9', name: 'Sun-Glazed Chair', description: 'A Furnituria classic. Our sun-glazed chair with high quality polished wood and three curved tripod-like legs adds an aesthetic touch to your setup.', imageUrl: '/images/sunglazedchair.jpg', price: 34.99 },
      { id: 'chair-10', name: 'Plain White Chair', description: 'A sturdy and durable plain all-white chair. One of our most purchased products.', imageUrl: '/images/whitechair.jpg', price: 9.99 },
      { id: 'chair-11', name: 'Old-Fashioned Wood Chair', description: 'A sturdy, old-fashioned wood chair with traditional design and leg supports.', imageUrl: '/images/woodchair.jpg', price: 19.99 },
  ];

  for (const p of products) {
      await put({
          PK: `PRODUCT#${p.id}`,
          SK: `PRODUCT#${p.id}`,
          entityType: 'PRODUCT',
          ...p,
      });
      console.log(`  Inserted product: ${p.name}`);
  }
}

async function seedOrders() {
  const orders = [
      {
          orderId: 'o001',
          orderNumber: '10021',
          orderDate: '2024-11-01',
          orderStatus: 'delivered',
          fullName: 'Jane Doe',
          shippingAddress: { street: '123 Main St', city: 'Brooklyn', state: 'NY', zip: '11201' },
          paymentMethod: 'stripe_test',
          items: [
              { productId: 'chair-1', quantity: 1 },
              { productId: 'chair-2', quantity: 2 },
          ],
      },
      {
          orderId: 'o002',
          orderNumber: '10034',
          orderDate: '2025-01-20',
          orderStatus: 'processing',
          fullName: 'Jane Doe',
          shippingAddress: { street: '123 Main St', city: 'Brooklyn', state: 'NY', zip: '11201' },
          paymentMethod: 'demo',
          items: [
              { productId: 'chair-3', quantity: 1 },
          ],
      },
  ];

  for (const order of orders) {
      await put({
          PK: `USER#${USER_ID}`,
          SK: `ORDER#${order.orderId}`,
          entityType: 'ORDER',
          userId: USER_ID,
          ...order,
      });
  }
  console.log(`  Inserted ${orders.length} orders`);
}

async function seedAddresses() {
  const addresses = [
      { addressId: 'a1', label: 'Home', line1: '123 Main St', line2: '', city: 'Brooklyn', state: 'NY', zip: '11201', country: 'US', isDefault: true },
      { addressId: 'a2', label: 'Work', line1: '456 Office Ave', line2: 'Suite 200', city: 'New York', state: 'NY', zip: '10001', country: 'US', isDefault: false },
  ];

  for (const addr of addresses) {
      await put({
          PK: `USER#${USER_ID}`,
          SK: `ADDRESS#${addr.addressId}`,
          entityType: 'ADDRESS',
          userId: USER_ID,
          ...addr,
      });
  }
  console.log(`  Inserted ${addresses.length} addresses`);
}

async function seedPaymentMethods() {
  const methods = [
      { paymentId: 'pm1', brand: 'Visa', last4: '4242', expiry: '12/26', isDefault: true },
      { paymentId: 'pm2', brand: 'Mastercard', last4: '5555', expiry: '08/25', isDefault: false },
  ];

  for (const method of methods) {
      await put({
          PK: `USER#${USER_ID}`,
          SK: `PAYMENT#${method.paymentId}`,
          entityType: 'PAYMENT',
          userId: USER_ID,
          ...method,
      });
  }
  console.log(`  Inserted ${methods.length} payment methods`);
}

async function seedWishlist() {
  const items = [
      { wishlistId: 'w1', name: 'Marble Coffee Table', price: '349.99', image: '/images/products.png', dateAdded: '2024-09-10' },
      { wishlistId: 'w2', name: 'Linen Armchair', price: '549.00', image: '/images/products.png', dateAdded: '2024-10-22' },
  ];

  for (const item of items) {
      await put({
          PK: `USER#${USER_ID}`,
          SK: `WISHLIST#${item.wishlistId}`,
          entityType: 'WISHLIST',
          userId: USER_ID,
          ...item,
      });
  }
  console.log(`  Inserted ${items.length} wishlist items`);
}

async function seedReturns() {
  const returns = [
      { returnId: 'r1', orderId: 'o001', orderNumber: '10021', item: 'Chair Set', reason: 'Defective', status: 'Refund Issued', refundAmount: '199.00', dateInitiated: '2024-11-15' },
  ];

  for (const ret of returns) {
      await put({
          PK: `USER#${USER_ID}`,
          SK: `RETURN#${ret.returnId}`,
          entityType: 'RETURN',
          userId: USER_ID,
          ...ret,
      });
  }
  console.log(`  Inserted ${returns.length} returns`);
}

async function seedCart() {
  const cartItems = [
      { productId: 'chair-7', quantity: 2 },
      { productId: 'chair-8', quantity: 1 },
      { productId: 'chair-9', quantity: 3 },
  ];

  for (const item of cartItems) {
      await put({
          PK: `USER#${USER_ID}`,
          SK: `CART#${item.productId}`,
          entityType: 'CART',
          userId: USER_ID,
          ...item,
      });
  }
  console.log(`  Inserted ${cartItems.length} cart items`);
}

async function seed() {
  try {
      console.log('\nSetting up single-table...');
      await recreateTable(); // fresh table on every seed in dev

      console.log('\nSeeding data...');
      await seedProducts();
      await seedUser();     // includes settings, newsletter, rewards
      await seedCart();
      await seedOrders();
      await seedAddresses();
      await seedPaymentMethods();
      await seedWishlist();
      await seedReturns();

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