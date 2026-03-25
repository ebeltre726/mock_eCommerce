// orders.controller.js
import { fetchOrders, fetchOrder, createOrder as createOrderService } from '../services/orders.service.js';

export async function getOrders(req, res) {
    console.log('req.user:', req.user);
    try {
        const data = await fetchOrders(req.user.userId);
        res.json(data);
    } catch (err) {
        console.error('getOrders error:', err);
        res.status(500).json({ error: 'Failed to retrieve orders' });
    }
}

export async function getOrder(req, res) {
    try {
        const data = await fetchOrder(req.user.userId, req.params.orderId);
        res.json(data);
    } catch (err) {
        console.error('getOrder error:', err);
        res.status(404).json({ error: err.message || 'Order not found' });
    }
}

export async function createOrder(req, res) {
    console.log('createOrder body:', JSON.stringify(req.body, null, 2));
    try {
        const { fullName, shippingAddress, paymentMethodId, items } = req.body;

        if (!fullName || !shippingAddress?.street || !shippingAddress?.city 
            || !shippingAddress?.state || !items?.length) {
            return res.status(400).json({ error: 'Missing required order fields' });
        }

        const order = await createOrderService(req.user.userId, {
            fullName,
            shippingAddress, // now an object
            paymentMethodId,
            items,
        });

        res.status(201).json(order);
    } catch (err) {
        console.error('createOrder error:', err);
        res.status(500).json({ error: 'Failed to create order' });
    }
}