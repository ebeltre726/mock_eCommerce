// orders.service.js
import { QueryCommand, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo } from '../db/dynamoClient.js';
import { v4 as uuidv4 } from 'uuid';
import Stripe from 'stripe';

function getStripeKey() {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY environment variable is not set');
    return key;
}

async function getProductPrice(productId) {
    const result = await dynamo.send(new GetCommand({
        TableName: 'Products',
        Key: { id: productId },
    }));
    return result.Item?.price || 0;
}

async function calculateTotal(items) {
    const prices = await Promise.all(
        items.map(item => getProductPrice(item.productId))
    );
    const total = items.reduce((sum, item, i) => {
        return sum + (prices[i] * item.quantity);
    }, 0);
    // Convert to cents for Stripe
    return Math.round(total * 100);
}

export async function fetchOrders(userId) {
    const result = await dynamo.send(new QueryCommand({
        TableName: 'Orders',
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: { ':uid': userId },
    }));

    const orders = result.Items || [];

    const enriched = await Promise.all(orders.map(async order => {
        const enrichedItems = await Promise.all(
            (order.items || []).map(async item => {
                const product = await dynamo.send(new GetCommand({
                    TableName: 'Products',
                    Key: { id: item.productId },
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
        TableName: 'Orders',
        Key: { userId, orderId },
    }));
    if (!result.Item) throw new Error('Order not found');
    return result.Item;
}

export async function createOrder(userId, orderData) {
    const orderId = uuidv4();
    let stripePaymentIntentId = null;
    let paymentMethod = 'demo';

    // Attempt Stripe payment if paymentMethodId provided
    if (orderData.paymentMethodId) {
        try {
            const stripeKey = getStripeKey();
            const stripe = new Stripe(stripeKey);
            
            console.log('Attempting Stripe charge with paymentMethodId:', orderData.paymentMethodId);

            const paymentIntent = await stripe.paymentIntents.create({
                amount: await calculateTotal(orderData.items), // ← await now
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

            console.log('Stripe paymentIntent status:', paymentIntent.status);

            stripePaymentIntentId = paymentIntent.id;
            paymentMethod = 'stripe_test';

        } catch (err) {
            console.log('Stripe declined, processing as demo payment:', err.message);
            paymentMethod = 'demo';
        }
    }

    const order = {
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

    await dynamo.send(new PutCommand({
        TableName: 'Orders',
        Item: order,
    }));

    return order;
}