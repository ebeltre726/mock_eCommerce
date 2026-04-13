import { dynamo } from '../db/dynamoClient.js';
import { PutCommand, QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { stripe } from '../config/stripe.js';
import { fetchAddresses } from './address.service.js';

const TABLE = 'Furnituria';

/**
 * Utility: fetch address by ID
 */
async function fetchAddress(userId, addressId) {
  const result = await dynamo.send(new GetCommand({
    TableName: TABLE,
    Key: {
      PK: `USER#${userId}`,
      SK: `ADDRESS#${addressId}`,
    },
  }));

  if (!result.Item) throw new Error('Address not found');
  return result.Item;
}

/**
 * Utility: calculate total from items
 */
async function calculateTotal(items) {
  return Math.round(
    items.reduce((sum, item) => {
      const price = item.price ?? 0;
      const qty = item.quantity ?? 1;
      return sum + price * qty;
    }, 0) * 100 // convert to cents
  );
}

/**
 * Fetch all orders for a user
 */
export async function fetchOrders(userId) {
  const result = await dynamo.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `USER#${userId}`,
      ':sk': 'ORDER#',
    },
  }));

  const orders = result.Items || [];

  // Fetch all addresses for the user once
  const addresses = await fetchAddresses(userId);
  const addressMap = new Map(addresses.map(addr => [addr.addressId, addr]));

  // Enrich items with product details
  const enriched = await Promise.all(
    orders.map(async (order) => {
      const enrichedItems = await Promise.all(
        (order.items || []).map(async (item) => {
          if (!item.productId) {
            return {
              productId: null,
              name: item.name || 'Unknown',
              image: item.image || '',
              quantity: item.quantity ?? 1,
              price: item.price ?? 0,
            };
          }

          const product = await dynamo.send(new GetCommand({
            TableName: TABLE,
            Key: {
              PK: `PRODUCT#${item.productId}`,
              SK: `PRODUCT#${item.productId}`,
            },
          }));

          const p = product.Item;

          return {
            productId: item.productId,
            name: p?.name || item.name || 'Unknown',
            image: p?.imageUrl || item.image || '',
            quantity: item.quantity ?? 1,
            price: p?.price ?? item.price ?? 0,
          };
        })
      );

      // Get address from addressMap
      const address = order.addressId ? addressMap.get(order.addressId) : null;

      // Build shippingAddress only with fields that have actual values
      const shippingAddress = address ? {
        ...(address.street && { street: address.street }),
        ...(address.city && { city: address.city }),
        ...(address.state && { state: address.state }),
        ...(address.postal && { postal: address.postal }),
        ...(address.country && { country: address.country }),
      } : {};

      // Return clean order object with only the fields expected by the contract
      return {
        orderId: order.orderId,
        userId: order.userId,
        fullName: order.fullName,
        shippingAddress,
        items: enrichedItems,
        paymentMethodId: order.paymentMethodId,
        status: order.status,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      };
    })
  );

  return enriched;
}

/**
 * Fetch a single order
 */
export async function fetchOrder(userId, orderId) {
  const result = await dynamo.send(new GetCommand({
    TableName: TABLE,
    Key: {
      PK: `USER#${userId}`,
      SK: `ORDER#${orderId}`,
    },
  }));

  if (!result.Item) throw new Error('Order not found');

  const order = result.Item;

  // Fetch address if addressId exists
  let address = null;
  if (order.addressId) {
    try {
      address = await fetchAddress(userId, order.addressId);
    } catch (err) {
      console.warn('Address not found for order:', orderId);
    }
  }

  // Build shippingAddress only with fields that have actual values
  const shippingAddress = address ? {
    ...(address.street && { street: address.street }),
    ...(address.city && { city: address.city }),
    ...(address.state && { state: address.state }),
    ...(address.postal && { postal: address.postal }),
    ...(address.country && { country: address.country }),
  } : {};

  // Return clean order object with only the fields expected by the contract
  return {
    orderId: order.orderId,
    userId: order.userId,
    fullName: order.fullName,
    shippingAddress,
    items: order.items || [],
    paymentMethodId: order.paymentMethodId,
    status: order.status,
    totalAmount: order.totalAmount,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

/**
 * Create a new order
 */
export async function createOrder(userId, orderData) {
  const orderId = uuidv4();
  let stripePaymentIntentId = null;
  let paymentMethod = 'demo';

  // ✅ Always calculate total once
  const totalAmountCents = await calculateTotal(orderData.items);
  const totalAmount = totalAmountCents / 100;

  // 💳 Stripe payment (optional)
  if (orderData.paymentMethodId) {
    try {
      // Ensure minimum charge amount (Stripe requires minimum $0.50 for most currencies)
      const minimumAmount = 50; // $0.50 in cents
      const chargeAmount = Math.max(totalAmountCents, minimumAmount);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: chargeAmount,
        currency: 'usd',
        payment_method: orderData.paymentMethodId,
        confirm: true,
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never',
        },
      }, {
        idempotencyKey: orderId,
      });

      stripePaymentIntentId = paymentIntent.id;
      paymentMethod = 'stripe_test';

    } catch (err) {
      console.log('Stripe failed, falling back to demo:', err.message);
      paymentMethod = 'demo';
    }
  }

  const orderItem = {
    PK: `USER#${userId}`,
    SK: `ORDER#${orderId}`,
    entityType: 'ORDER',

    orderId,
    userId,

    fullName: orderData.fullName,
    addressId: orderData.addressId,

    items: orderData.items.map(item => ({
      productId: item.productId,
      quantity: item.quantity, // ✅ standardized
      price: item.price ?? 0,
    })),

    totalAmount, // ✅ stored (important)

    status: 'confirmed',
    paymentMethod,
    stripePaymentIntentId,

    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await dynamo.send(new PutCommand({
    TableName: TABLE,
    Item: orderItem,
  }));

  return {
    orderId,
    status: orderItem.status,
    totalAmount,
  };
}