import { fetchAddresses, addAddress, patchAddress, removeAddress } from '../services/address.service.js';

export async function getAddresses(req, res) {
    try {
        const data = await fetchAddresses(req.user.userId);
        res.json(data);
    } catch (err) {
        console.error('getAddresses error:', err);
        res.status(500).json({ error: 'Failed to retrieve addresses' });
    }
}

export async function createAddress(req, res) {
    try {
        const item = await addAddress(req.user.userId, req.body);
        res.status(201).json(item);
    } catch (err) {
        console.error('createAddress error:', err);
        res.status(500).json({ error: 'Failed to add address' });
    }
}

export async function updateAddress(req, res) {
    try {
        const updated = await patchAddress(req.user.userId, req.params.addressId, req.body);
        res.json(updated);
    } catch (err) {
        console.error('updateAddress error:', err);
        res.status(400).json({ error: err.message || 'Failed to update address' });
    }
}

export async function deleteAddress(req, res) {
    console.log('deleteAddress params:', req.params);
    console.log('deleteAddress userId:', req.user.userId);
    try {
        await removeAddress(req.user.userId, req.params.addressId);
        res.status(204).send();
    } catch (err) {
        console.error('deleteAddress error:', err);
        res.status(500).json({ error: 'Failed to remove address' });
    }
}