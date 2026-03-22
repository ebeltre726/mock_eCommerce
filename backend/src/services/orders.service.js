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

function calculateTotal(items) {
    // Returns amount in cents for Stripe
    return Math.round(
        items.reduce((sum, item) => sum + (item.price * item.quantity), 0) * 100
    );
}

export async function fetchOrders(userId) {
    const result = await dynamo.send(new QueryCommand({
        TableName: 'Orders',
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: { ':uid': userId },
    }));
    return result.Items || [];
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

            const paymentIntent = await stripe.paymentIntents.create({
                amount: calculateTotal(orderData.items),
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