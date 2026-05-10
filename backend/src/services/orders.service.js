import { dynamo } from '../db/dynamoClient.js';
import { PutCommand, QueryCommand, GetCommand, UpdateCommand, DeleteCommand, BatchGetCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { stripe } from '../config/stripe.js';
import { fetchAddresses, toPublicAddress } from './address.service.js';
import { getOrCreateCustomer, addPaymentMethod, fetchPayments } from './payment.service.js';
import logger from '../utils/logger.js';
import env from '../config/env.js';

const TABLE = env.DYNAMODB_TABLE;

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
 * Fetch server-side prices from DynamoDB; rejects if any productId is invalid.
 */
async function fetchPricedItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Order must contain at least one item');
  }
  return Promise.all(
    items.map(async (item) => {
      if (!item.productId) throw new Error('Each order item must have a productId');
      const result = await dynamo.send(new GetCommand({
        TableName: TABLE,
        Key: { PK: `PRODUCT#${item.productId}`, SK: `PRODUCT#${item.productId}` },
      }));
      if (!result.Item) throw new Error(`Invalid productId: ${item.productId}`);
      return {
        productId: item.productId,
        quantity:  item.quantity ?? 1,
        price:     result.Item.price,
        name:      result.Item.name     ?? '',
        imageUrl:  result.Item.imageUrl ?? '',
      };
    })
  );
}

/**
 * Utility: calculate total from server-fetched items
 */
function calculateTotal(items) {
    return Math.round(
        items.reduce((sum, item) => sum + item.price * (item.quantity ?? 1), 0) * 100
    );
}

/**
 * Fetch a page of orders for a user.
 * Returns { orders, nextCursor } where nextCursor is a base64-encoded
 * DynamoDB LastEvaluatedKey, or null if there are no more pages.
 */
export async function fetchOrders(userId, cursor = null) {
  const queryParams = {
    TableName: TABLE,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `USER#${userId}`,
      ':sk': 'ORDER#',
    },
    Limit: 50,
    ScanIndexForward: false,
  };

  if (cursor) {
    try {
      queryParams.ExclusiveStartKey = JSON.parse(
        Buffer.from(cursor, 'base64').toString('utf8'),
      );
    } catch {
      const cursorErr = new Error('Invalid pagination cursor');
      cursorErr.statusCode = 400;
      throw cursorErr;
    }
  }

  const result = await dynamo.send(new QueryCommand(queryParams));

  const orders = result.Items || [];

  // Fetch addresses for the user (first page only — users realistically have < 20)
  const { addresses } = await fetchAddresses(userId);
  const addressMap = new Map(addresses.map(addr => [addr.addressId, addr]));

  // Collect unique productIds that require fallback enrichment (legacy orders without snapshot).
  // Items that already have item.name were created after the snapshot migration and need no lookup.
  const legacyProductIds = new Set();
  for (const order of orders) {
    for (const item of (order.items || [])) {
      if (item.productId && !item.name) legacyProductIds.add(item.productId);
    }
  }

  // Batch-fetch all legacy products in chunks of 100 (DynamoDB BatchGetItem limit).
  const productMap = new Map();
  if (legacyProductIds.size > 0) {
    const keys = [...legacyProductIds].map(id => ({ PK: `PRODUCT#${id}`, SK: `PRODUCT#${id}` }));
    const chunks = [];
    for (let i = 0; i < keys.length; i += 100) chunks.push(keys.slice(i, i + 100));

    const results = await Promise.all(
      chunks.map(chunk =>
        dynamo.send(new BatchGetCommand({ RequestItems: { [TABLE]: { Keys: chunk } } }))
              .then(r => r.Responses?.[TABLE] ?? [])
      )
    );
    for (const p of results.flat()) {
      productMap.set(p.PK.replace('PRODUCT#', ''), p);
    }
  }

  // Enrich items synchronously using the pre-fetched product map
  const enriched = orders.map((order) => {
      const enrichedItems = (order.items || []).map((item) => {
          if (!item.productId) {
            return {
              productId: null,
              name:      item.name  || 'Unknown',
              image:     item.imageUrl || item.image || '',
              quantity:  item.quantity ?? 1,
              price:     item.price    ?? 0,
            };
          }

          // Orders created after the snapshot migration store name and imageUrl directly.
          if (item.name) {
            return {
              productId: item.productId,
              name:      item.name,
              image:     item.imageUrl || item.image || '',
              quantity:  item.quantity ?? 1,
              price:     item.price    ?? 0,
            };
          }

          // Fallback for pre-migration orders — product was batch-fetched above.
          const p = productMap.get(item.productId);

          return {
            productId: item.productId,
            name:      p?.name     || 'Unknown',
            image:     p?.imageUrl || '',
            quantity:  item.quantity ?? 1,
            price:     p?.price ?? item.price ?? 0,
          };
        });

      // Build shippingAddress from saved record or inline data stored at order-time.
      // toPublicAddress normalises both DB field names (street/postal) and frontend
      // field names (line1/zip) to the canonical public shape { line1, zip, ... }.
      const address = order.addressId ? addressMap.get(order.addressId) : null;
      const shippingAddress = address
        ? toPublicAddress(address)
        : order.inlineAddress
          ? toPublicAddress(order.inlineAddress)
          : {};

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
    });

  const nextCursor = result.LastEvaluatedKey
    ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
    : null;

  return { orders: enriched, nextCursor };
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
    } catch (_err) {
      logger.warn({ orderId }, 'Address not found for order');
    }
  }

  // Build shippingAddress using the canonical normaliser from address.service.js.
  const shippingAddress = address
    ? toPublicAddress(address)
    : order.inlineAddress
      ? toPublicAddress(order.inlineAddress)
      : {};

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
 *
 * Safety ordering:
 *   1. Write ORDER record with status='pending_payment' BEFORE charging Stripe.
 *   2. Charge Stripe (idempotencyKey = orderId).
 *   3. On success: flip status → 'confirmed'.
 *   4. On Stripe failure: best-effort delete the pending record so the user
 *      can retry cleanly (they were never charged).
 *
 * If step 3 fails after a successful charge the pending record remains in
 * DynamoDB with stripePaymentIntentId set — enough to reconcile without a
 * phantom charge.
 */
export async function createOrder(userId, userEmail, orderData) {
  const orderId = uuidv4();
  const now = new Date().toISOString();

  // Fetch server-side prices and compute total — never trust client-supplied price
  const pricedItems = await fetchPricedItems(orderData.items);
  const totalAmountCents = calculateTotal(pricedItems);
  const totalAmount = totalAmountCents / 100;

  // 1. Persist order before any money moves.
  await dynamo.send(new PutCommand({
    TableName: TABLE,
    Item: {
      PK:                    `USER#${userId}`,
      SK:                    `ORDER#${orderId}`,
      entityType:            'ORDER',
      orderId,
      userId,
      fullName:              orderData.fullName,
      ...(orderData.addressId
        ? { addressId: orderData.addressId }
        : { inlineAddress: orderData.shippingAddress }),
      items:                 pricedItems,
      totalAmount,
      status:                'pending_payment',
      paymentMethod:         'pending',
      stripePaymentIntentId: null,
      createdAt:             now,
      updatedAt:             now,
    },
    ConditionExpression: 'attribute_not_exists(PK)',
  }));

  // 2. Stripe payment (optional).
  let stripePaymentIntentId = null;
  let paymentMethod = 'pending';
  let stripeCustomerId = null;

  if (orderData.paymentMethodId) {
    try {
      stripeCustomerId = await getOrCreateCustomer(userId, userEmail);

      try {
        await stripe.paymentMethods.attach(orderData.paymentMethodId, { customer: stripeCustomerId });
      } catch (attachErr) {
        if (!attachErr.message?.includes('already been attached')) throw attachErr;
      }

      const paymentIntent = await stripe.paymentIntents.create(
        {
          amount:         Math.max(totalAmountCents, 50),
          currency:       'usd',
          customer:       stripeCustomerId,
          payment_method: orderData.paymentMethodId,
          confirm:        true,
          automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
        },
        { idempotencyKey: orderId },
      );

      stripePaymentIntentId = paymentIntent.id;
      paymentMethod         = 'stripe';

    } catch (err) {
      // Payment failed — pending record serves no purpose; remove it so the
      // user isn't left with a ghost order on retry.
      await dynamo.send(new DeleteCommand({
        TableName: TABLE,
        Key: { PK: `USER#${userId}`, SK: `ORDER#${orderId}` },
      })).catch(delErr => logger.error({ err: delErr.message }, '[order] failed to clean up pending record'));

      if (err.type === 'StripeCardError' || err.type === 'StripeInvalidRequestError') {
        const cardErr = new Error(err.message, { cause: err });
        cardErr.statusCode = 402;
        throw cardErr;
      }
      if (err.type === 'StripeConnectionError' || err.type === 'StripeAPIError') {
        logger.error({ err: err.message }, '[order] Stripe infrastructure error');
        const serviceErr = new Error('payment service unavailable, try again', { cause: err });
        serviceErr.statusCode = 502;
        throw serviceErr;
      }
      throw new Error(err.message ?? 'Payment processing failed', { cause: err });
    }
  }

  // 3. Charge succeeded (or no payment required) — confirm the order.
  //    If this write fails, the pending_payment record + stripePaymentIntentId
  //    is the reconciliation anchor; no phantom charge exists.
  await dynamo.send(new UpdateCommand({
    TableName: TABLE,
    Key: { PK: `USER#${userId}`, SK: `ORDER#${orderId}` },
    UpdateExpression: 'SET #status = :status, paymentMethod = :pm, stripePaymentIntentId = :piid, updatedAt = :now',
    ExpressionAttributeNames:  { '#status': 'status' },
    ExpressionAttributeValues: {
      ':status': 'confirmed',
      ':pm':     paymentMethod,
      ':piid':   stripePaymentIntentId,
      ':now':    new Date().toISOString(),
    },
  }));

  // 4. Optionally persist the payment method to the user's account.
  //    Non-fatal — a save failure must not roll back a successful order.
  //    Card display fields (brand, last4, expiry) are fetched from Stripe
  //    server-side rather than trusting client-supplied values.
  if (orderData.saveCard && stripeCustomerId) {
    try {
      const existing = await fetchPayments(userId);
      const alreadySaved = existing.some(m => m.stripePaymentMethodId === orderData.paymentMethodId);
      if (!alreadySaved) {
        const pm = await stripe.paymentMethods.retrieve(orderData.paymentMethodId);
        await addPaymentMethod(userId, {
          stripePaymentMethodId: orderData.paymentMethodId,
          stripeCustomerId,
          brand:     pm.card?.brand  ?? 'unknown',
          last4:     pm.card?.last4  ?? '',
          expiry:    pm.card
            ? `${String(pm.card.exp_month).padStart(2, '0')}/${String(pm.card.exp_year).slice(-2)}`
            : '',
          isDefault: false,
        });
      }
    } catch (err) {
      logger.warn({ err: err.message }, '[order] failed to save card to account');
    }
  }

  return { orderId, status: 'confirmed', totalAmount };
}