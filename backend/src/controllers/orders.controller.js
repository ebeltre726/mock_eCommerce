// orders.controller.js
import { fetchOrders, fetchOrder, createOrder as createOrderService } from '../services/orders.service.js';
import { clearCart } from '../services/cart.service.js';

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
    console.log('createOrder req.body:', req.body);
    console.log('createOrder req.user:', req.user);
    try {
        const order = await createOrderService(req.user.userId, req.user.email, req.body);

        // Clear server cart after successful order — non-fatal if it fails
        try {
            await clearCart(req.user.userId);
        } catch (err) {
            console.warn('[order] Failed to clear cart:', err.message);
        }

        res.status(201).json(order);
    } catch (err) {
        // Any thrown error from the Stripe block is a payment failure
        if (err.message?.toLowerCase().includes('card') ||
            err.message?.toLowerCase().includes('declined') ||
            err.message?.toLowerCase().includes('insufficient') ||
            err.message?.toLowerCase().includes('payment') ||
            err.message?.toLowerCase().includes('paymentmethod')) {
            return res.status(402).json({ error: err.message });
        }
        console.error('createOrder error:', err);
        res.status(500).json({ error: 'Failed to create order' });
    }
}