// orders.controller.js
import { fetchOrders, fetchOrder, createOrder as createOrderService } from '../services/orders.service.js';
import { clearCart } from '../services/cart.service.js';
import logger from '../utils/logger.js';

export async function getOrders(req, res) {
    try {
        const data = await fetchOrders(req.user.userId, req.query.cursor ?? null);
        res.json(data);
    } catch (err) {
        if (err.statusCode === 400) {
            return res.status(400).json({ error: err.message });
        }
        logger.error({ err }, 'getOrders error');
        res.status(500).json({ error: 'Failed to retrieve orders' });
    }
}

export async function getOrder(req, res) {
    try {
        const data = await fetchOrder(req.user.userId, req.params.orderId);
        res.json(data);
    } catch (err) {
        if (err.message === 'Order not found') {
            return res.status(404).json({ error: 'Order not found' });
        }
        logger.error({ err }, 'getOrder error');
        res.status(500).json({ error: 'Failed to retrieve order' });
    }
}

export async function createOrder(req, res) {
    try {
        const order = await createOrderService(req.user.userId, req.user.email, req.body);

        // Clear server cart after successful order — non-fatal if it fails
        try {
            await clearCart(req.user.userId);
        } catch (err) {
            logger.warn({ err: err.message }, '[order] Failed to clear cart after checkout');
        }

        res.status(201).json(order);
    } catch (err) {
        if (err.statusCode === 402) {
            return res.status(402).json({ error: 'Your payment could not be processed. Please check your card details and try again.' });
        }
        if (err.statusCode === 502) {
            return res.status(502).json({ error: err.message });
        }
        logger.error({ err }, 'createOrder error');
        res.status(500).json({ error: 'Failed to create order' });
    }
}