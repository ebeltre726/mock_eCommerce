import { fetchPayments, addPaymentMethod, patchPaymentMethod, removePaymentMethod, getOrCreateCustomer } from '../services/payment.service.js';
import { stripe } from '../config/stripe.js';
import logger from '../utils/logger.js';

export async function getPayments(req, res) {
    try {
        const data = await fetchPayments(req.user.userId);
        res.json(data);
    } catch (err) {
        logger.error({ err }, 'getPayments error');
        res.status(500).json({ error: 'Failed to retrieve payment methods' });
    }
}

// Card display metadata (brand, last4, expiry) is fetched from Stripe server-side
// so that clients cannot store arbitrary values in their payment records.
export async function addPayment(req, res) {
    const { stripePaymentMethodId, isDefault = false } = req.body;
    try {
        const pm = await stripe.paymentMethods.retrieve(stripePaymentMethodId);
        if (!pm || pm.type !== 'card') {
            return res.status(400).json({ error: 'Invalid payment method: must be a card' });
        }

        const stripeCustomerId = await getOrCreateCustomer(req.user.userId, req.user.email);

        try {
            await stripe.paymentMethods.attach(stripePaymentMethodId, { customer: stripeCustomerId });
        } catch (attachErr) {
            if (!attachErr.message?.includes('already been attached')) throw attachErr;
        }

        const item = await addPaymentMethod(req.user.userId, {
            stripePaymentMethodId,
            stripeCustomerId,
            brand:   pm.card?.brand ?? 'unknown',
            last4:   pm.card?.last4 ?? '',
            expiry:  pm.card
                ? `${String(pm.card.exp_month).padStart(2, '0')}/${String(pm.card.exp_year).slice(-2)}`
                : '',
            isDefault,
        });
        res.status(201).json(item);
    } catch (err) {
        logger.error({ err }, 'addPayment error');
        if (err.type === 'StripeInvalidRequestError') {
            return res.status(400).json({ error: 'Invalid payment method' });
        }
        res.status(500).json({ error: 'Failed to add payment method' });
    }
}

export async function updatePayment(req, res) {
    try {
        const updated = await patchPaymentMethod(req.user.userId, req.params.paymentId, req.body);
        res.json(updated);
    } catch (err) {
        logger.error({ err }, 'updatePayment error');
        res.status(400).json({ error: err.message || 'Failed to update payment method' });
    }
}

export async function deletePayment(req, res) {
    try {
        await removePaymentMethod(req.user.userId, req.params.paymentId);
        res.status(204).send();
    } catch (err) {
        logger.error({ err }, 'deletePayment error');
        res.status(500).json({ error: 'Failed to remove payment method' });
    }
}
