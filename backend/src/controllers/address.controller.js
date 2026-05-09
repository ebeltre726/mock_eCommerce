import { fetchAddresses, addAddress, patchAddress, removeAddress } from '../services/address.service.js';
import logger from '../utils/logger.js';

export async function getAddresses(req, res) {
    try {
        const data = await fetchAddresses(req.user.userId, req.query.cursor ?? null);
        res.json(data);
    } catch (err) {
        logger.error({ err }, 'getAddresses error');
        const status = err.statusCode === 400 ? 400 : 500;
        res.status(status).json({ error: err.message || 'Failed to retrieve addresses' });
    }
}

export async function createAddress(req, res) {
    try {
        const item = await addAddress(req.user.userId, req.body);
        res.status(201).json(item);
    } catch (err) {
        logger.error({ err }, 'createAddress error');
        res.status(500).json({ error: 'Failed to add address' });
    }
}

export async function updateAddress(req, res) {
    try {
        const updated = await patchAddress(req.user.userId, req.params.addressId, req.body);
        res.json(updated);
    } catch (err) {
        logger.error({ err }, 'updateAddress error');
        res.status(400).json({ error: err.message || 'Failed to update address' });
    }
}

export async function deleteAddress(req, res) {
    try {
        await removeAddress(req.user.userId, req.params.addressId);
        res.status(204).send();
    } catch (err) {
        logger.error({ err }, 'deleteAddress error');
        res.status(500).json({ error: 'Failed to remove address' });
    }
}
