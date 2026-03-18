import { fetchPayments, addPaymentMethod, patchPaymentMethod, removePaymentMethod } from '../services/payment.service.js';

export async function getPayments(req, res) {
    try {
        const data = await fetchPayments(req.user.userId);
        res.json(data);
    } catch (err) {
        console.error('getPayments error:', err);
        res.status(500).json({ error: 'Failed to retrieve payment methods' });
    }
}

export async function addPayment(req, res) {
    try {
        const item = await addPaymentMethod(req.user.userId, req.body);
        res.status(201).json(item);
    } catch (err) {
        console.error('addPayment error:', err);
        res.status(500).json({ error: 'Failed to add payment method' });
    }
}

export async function updatePayment(req, res) {
    try {
        const updated = await patchPaymentMethod(req.user.userId, req.params.paymentId, req.body);
        res.json(updated);
    } catch (err) {
        console.error('updatePayment error:', err);
        res.status(400).json({ error: err.message || 'Failed to update payment method' });
    }
}

export async function deletePayment(req, res) {
    try {
        await removePaymentMethod(req.user.userId, req.params.paymentId);
        res.status(204).send();
    } catch (err) {
        console.error('deletePayment error:', err);
        res.status(500).json({ error: 'Failed to remove payment method' });
    }
}