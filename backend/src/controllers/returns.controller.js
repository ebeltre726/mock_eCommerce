import { fetchReturns, createReturn } from '../services/returns.service.js';
import { fetchOrders } from '../services/orders.service.js';
import { dynamo } from '../db/dynamoClient.js';

export async function getReturns(req, res) {
    try {
        const [returns, orders] = await Promise.all([
            fetchReturns(req.user.userId),
            fetchOrders(req.user.userId),
        ]);
        res.json({ returns, orders });
    } catch (err) {
        console.error('getReturns error:', err);
        res.status(500).json({ error: 'Failed to retrieve returns' });
    }
}

export async function initiateReturn(req, res) {
    try {
        const { orderId, orderNumber, itemId, item, reason, notes } = req.body;
        if (!orderId || !item || !reason) {
            return res.status(400).json({ error: 'orderId, item, and reason are required' });
        }
        const newReturn = await createReturn(req.user.userId, { orderId, orderNumber, itemId, item, reason, notes });
        res.status(201).json(newReturn);
    } catch (err) {
        console.error('initiateReturn error:', err);
        res.status(500).json({ error: 'Failed to initiate return' });
    }
}