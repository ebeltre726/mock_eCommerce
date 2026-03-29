// orders.service.js
import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo } from '../db/dynamoClient.js';
import { v4 as uuidv4 } from 'uuid';
import Stripe from 'stripe';

const TABLE = 'Furnituria';

function getStripeKey() {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY environment variable is not set');
    return key;
}

async function getProductPrice(productId) {
    const result = await dynamo.send(new GetCommand({
        TableName: TABLE,
        Key: {
            PK: `PRODUCT#${productId}`,
            SK: `PRODUCT#${productId}`,
        },
    }));
    return result.Item?.price || 0;
}

async function calculateTotal(items) {
    const prices = await Promise.all(
        items.map(item => getProductPrice(item.productId))
    );
    const total = items.reduce((sum, item, i) => sum + (prices[i] * item.quantity), 0);
    return Math.round(total * 100);
}

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

    // Enrich items with product details
    const enriched = await Promise.all(orders.map(async order => {
        const enrichedItems = await Promise.all(
            (order.items || []).map(async item => {
                if (!item.productId) {
                    return {
                        productId: null,
                        name:  item.name  || 'Unknown',
                        image: item.image || '',
                        qty:   item.qty   || item.quantity || 1,
                        price: item.price || 0,
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
                    name:      p?.name     || item.name  || 'Unknown',
                    image:     p?.imageUrl || item.image || '',
                    qty:       item.quantity ?? item.qty ?? 1,
                    price:     p?.price    || item.price || 0,
                };
            })
        );
        return { ...order, items: enrichedItems };
    }));

    return enriched;
}

export async function fetchOrder(userId, orderId) {
    const result = await dynamo.send(new GetCommand({
        TableName: TABLE,
        Key: {
            PK: `USER#${userId}`,
            SK: `ORDER#${orderId}`,
        },
    }));
    if (!result.Item) throw new Error('Order not found');
    return result.Item;
}

export async function createOrder(userId, orderData) {
    const orderId = uuidv4();
    let stripePaymentIntentId = null;
    let paymentMethod = 'demo';

    if (orderData.paymentMethodId) {
        try {
            const stripe = new Stripe(getStripeKey());

            const paymentIntent = await stripe.paymentIntents.create({
                amount: await calculateTotal(orderData.items),
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
            // NOTE: Demo fallback — remove in production
            console.log('Stripe declined, processing as demo payment:', err.message);
            paymentMethod = 'demo';
        }
    }

    const order = {
        PK: `USER#${userId}`,
        SK: `ORDER#${orderId}`,
        entityType: 'ORDER',
        userId,
        orderId,
        orderNumber:           String(Date.now()).slice(-6),
        orderDate:             new Date().toISOString(),
        orderStatus:           'processing',
        fullName:              orderData.fullName,
        shippingAddress:       orderData.shippingAddress,
        cardLast4:             orderData.cardLast4,
        items:                 orderData.items,
        paymentMethod,
        stripePaymentIntentId,
    };

    await dynamo.send(new PutCommand({ TableName: TABLE, Item: order }));

    return order;
}