import express from 'express';
import * as ordersController from '../controllers/orders.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validateRequest, validateResponse } from '../middleware/validation.middleware.js';
import { ordersContracts } from '../contracts/orders.contracts.js';

const router = express.Router();

router.get('/',           requireAuth, validateResponse(ordersContracts.getOrders), ordersController.getOrders);
router.get('/:orderId',   requireAuth, validateRequest(ordersContracts.getOrder), validateResponse(ordersContracts.getOrder), ordersController.getOrder);
router.post('/',          requireAuth, validateRequest(ordersContracts.createOrder), validateResponse(ordersContracts.createOrder), ordersController.createOrder);

export default router;