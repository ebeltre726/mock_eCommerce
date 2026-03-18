import { fetchWishlist, addWishlistItem, removeWishlistItem } from '../services/wishlist.service.js';

export async function getWishlist(req, res) {
    try {
        const data = await fetchWishlist(req.user.userId);
        res.json(data);
    } catch (err) {
        console.error('getWishlist error:', err);
        res.status(500).json({ error: 'Failed to retrieve wishlist' });
    }
}

export async function addToWishlist(req, res) {
    try {
        const item = await addWishlistItem(req.user.userId, req.body);
        res.status(201).json(item);
    } catch (err) {
        console.error('addToWishlist error:', err);
        res.status(500).json({ error: 'Failed to add wishlist item' });
    }
}

export async function deleteWishlistItem(req, res) {
    try {
        await removeWishlistItem(req.user.userId, req.params.itemId);
        res.status(204).send();
    } catch (err) {
        console.error('deleteWishlistItem error:', err);
        res.status(500).json({ error: 'Failed to remove wishlist item' });
    }
}