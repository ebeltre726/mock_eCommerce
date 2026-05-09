// cart.controller.js
import * as cartService from '../services/cart.service.js';
import logger from '../utils/logger.js';

export async function getCart(req, res) {
    try {
        const result = await cartService.getCart(req.user.userId);
        res.json(result);
    } catch (err) {
        logger.error({ err }, 'getCart error');
        res.status(500).json({ error: 'Failed to retrieve cart' });
    }
}

export async function addItem(req, res) {
    try {
        const { productId, quantity } = req.body;
        if (!productId || !quantity || quantity < 1) {
            return res.status(400).json({ error: 'productId and a valid quantity are required' });
        }
        const result = await cartService.addToCart(req.user.userId, productId, quantity);
        res.json(result);
    } catch (err) {
        logger.error({ err }, 'addItem error');
        res.status(500).json({ error: 'Failed to add item to cart' });
    }
}

export async function removeItem(req, res) {
    try {
        const { productId, quantity } = req.body;
        if (!productId || !quantity || quantity < 1) {
            return res.status(400).json({ error: 'productId and a valid quantity are required' });
        }
        const result = await cartService.removeFromCart(req.user.userId, productId, quantity);
        res.json(result);
    } catch (err) {
        logger.error({ err }, 'removeItem error');
        res.status(500).json({ error: 'Failed to remove item from cart' });
    }
}

export async function clearCart(req, res) {
  try {
      await cartService.clearCart(req.user.userId);
      res.json({ success: true });
  } catch (err) {
      logger.error({ err }, 'clearCart error');
      res.status(500).json({ error: 'Failed to clear cart' });
  }
}
