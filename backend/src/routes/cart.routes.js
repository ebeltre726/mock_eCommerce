// cart.routes.js
import express from 'express';
import * as cartController from '../controllers/cart.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validateRequest, validateResponse } from '../middleware/validation.middleware.js';
import { cartContracts } from '../contracts/cart.contracts.js';

const router = express.Router();

router.get('/', requireAuth, validateResponse(cartContracts.getCart), cartController.getCart);
router.post('/add', requireAuth, validateRequest(cartContracts.addItem), validateResponse(cartContracts.addItem), cartController.addItem);
router.post('/remove', requireAuth, validateRequest(cartContracts.removeItem), validateResponse(cartContracts.removeItem), cartController.removeItem);
router.delete('/clear', requireAuth, validateResponse(cartContracts.clearCart), cartController.clearCart);

export default router;