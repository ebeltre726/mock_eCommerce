import { fetchWishlist, addWishlistItem, removeWishlistItem } from '../services/wishlist.service.js';
import logger from '../utils/logger.js';

export async function getWishlist(req, res) {
    try {
        const cursor = req.query.cursor ?? null;
        const { items, nextCursor } = await fetchWishlist(req.user.userId, cursor);
        res.json({ items, nextCursor });
    } catch (err) {
        if (err.statusCode === 400) return res.status(400).json({ error: err.message });
        logger.error({ err }, 'getWishlist error');
        res.status(500).json({ error: 'Failed to retrieve wishlist' });
    }
}

export async function addToWishlist(req, res) {
    try {
        const item = await addWishlistItem(req.user.userId, req.body);
        res.status(201).json(item);
    } catch (err) {
        logger.error({ err }, 'addToWishlist error');
        res.status(500).json({ error: 'Failed to add wishlist item' });
    }
}

export async function deleteWishlistItem(req, res) {
    try {
        await removeWishlistItem(req.user.userId, req.params.itemId);
        res.status(204).send();
    } catch (err) {
        logger.error({ err }, 'deleteWishlistItem error');
        res.status(500).json({ error: 'Failed to remove wishlist item' });
    }
}
