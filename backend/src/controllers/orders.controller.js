import { fetchOrders, fetchOrder } from '../services/orders.service.js';

export async function getOrders(req, res) {
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