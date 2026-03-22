// cart.routes.js
import express from 'express';
import * as cartController from '../controllers/cart.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/', requireAuth, cartController.getCart);
router.post('/add', requireAuth, cartController.addItem);
router.post('/remove', requireAuth, cartController.removeItem);
router.delete('/clear', requireAuth, cartController.clearCart);

export default router;