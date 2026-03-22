import express from 'express';
import * as ordersController from '../controllers/orders.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/',           requireAuth, ordersController.getOrders);
router.get('/:orderId',   requireAuth, ordersController.getOrder);
router.post('/',          requireAuth, ordersController.createOrder);

export default router;