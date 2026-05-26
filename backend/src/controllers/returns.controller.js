import { fetchReturns, createReturn } from '../services/returns.service.js';
import { fetchOrders } from '../services/orders.service.js';
import logger from '../utils/logger.js';

export async function getReturns(req, res) {
    try {
        const [returns, { orders }] = await Promise.all([
            fetchReturns(req.user.userId),
            fetchOrders(req.user.userId),
        ]);
        res.json({ returns, orders });
    } catch (err) {
        logger.error({ err }, 'getReturns error');
        res.status(500).json({ error: 'Failed to retrieve returns' });
    }
}

export async function initiateReturn(req, res) {
    try {
        const { orderId, orderNumber, itemId, item, reason, notes } = req.body;
        if (!orderId || !item || !reason) {
            return res.status(400).json({ error: 'orderId, item, and reason are required' });
        }
        const newReturn = await createReturn(req.user.userId, req.user.email, { orderId, orderNumber, itemId, item, reason, notes }, req.user.firstName ?? '');
        res.status(201).json(newReturn);
    } catch (err) {
        if (err.message === 'Order not found') {
            return res.status(404).json({ error: 'Order not found' });
        }
        logger.error({ err }, 'initiateReturn error');
        res.status(500).json({ error: 'Failed to initiate return' });
    }
}
