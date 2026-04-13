import express from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validateRequest, validateResponse } from '../middleware/validation.middleware.js';
import { accountContracts } from '../contracts/account.contracts.js';

import { getOverview, updateOverview } from '../controllers/account.controller.js';
import { getPayments, addPayment, updatePayment, deletePayment } from '../controllers/payment.controller.js';
import { getOrders, getOrder } from '../controllers/orders.controller.js';
import { getAddresses, createAddress, updateAddress, deleteAddress } from '../controllers/address.controller.js';
import { getWishlist, addToWishlist, deleteWishlistItem } from '../controllers/wishlist.controller.js';
import { getReturns, initiateReturn } from '../controllers/returns.controller.js';
import { getRewards } from '../controllers/rewards.controller.js';
import { getNewsletter, updateNewsletter } from '../controllers/newsletter.controller.js';
import { getSettings, updateSettings, changePassword, deleteAccount } from '../controllers/settings.controller.js';

const router = express.Router();

// All account routes require authentication
router.use(requireAuth);

// GET  /api/account/overview
// PATCH /api/account/overview
router.get('/overview', validateResponse(accountContracts.getOverview), getOverview);
router.patch('/overview', validateRequest(accountContracts.updateOverview), validateResponse(accountContracts.updateOverview), updateOverview);

// GET    /api/account/payment
// POST   /api/account/payment
// PATCH  /api/account/payment/:paymentId
// DELETE /api/account/payment/:paymentId
router.get('/payment', validateResponse(accountContracts.getPayments), getPayments);
router.post('/payment', validateRequest(accountContracts.addPayment), validateResponse(accountContracts.addPayment), addPayment);
router.patch('/payment/:paymentId', validateRequest(accountContracts.updatePayment), validateResponse(accountContracts.updatePayment), updatePayment);
router.delete('/payment/:paymentId', validateRequest(accountContracts.deletePayment), validateResponse(accountContracts.deletePayment), deletePayment);

// GET /api/account/orders
// GET /api/account/orders/:orderId
router.get('/orders', validateResponse(accountContracts.getOrders), getOrders);
router.get('/orders/:orderId', validateRequest(accountContracts.getOrder), validateResponse(accountContracts.getOrder), getOrder);

// GET    /api/account/address
// POST   /api/account/address
// PATCH  /api/account/address/:addressId
// DELETE /api/account/address/:addressId
router.get('/address', validateResponse(accountContracts.getAddresses), getAddresses);
router.post('/address', validateRequest(accountContracts.createAddress), validateResponse(accountContracts.createAddress), createAddress);
router.patch('/address/:addressId', validateRequest(accountContracts.updateAddress), validateResponse(accountContracts.updateAddress), updateAddress);
router.delete('/address/:addressId', validateRequest(accountContracts.deleteAddress), validateResponse(accountContracts.deleteAddress), deleteAddress);

// GET    /api/account/wishlist
// POST   /api/account/wishlist
// DELETE /api/account/wishlist/:itemId
router.get('/wishlist', validateResponse(accountContracts.getWishlist), getWishlist);
router.post('/wishlist', validateRequest(accountContracts.addToWishlist), validateResponse(accountContracts.addToWishlist), addToWishlist);
router.delete('/wishlist/:itemId', validateRequest(accountContracts.deleteWishlistItem), validateResponse(accountContracts.deleteWishlistItem), deleteWishlistItem);

// GET  /api/account/returns
// POST /api/account/returns
router.get('/returns', validateResponse(accountContracts.getReturns), getReturns);
router.post('/returns', validateRequest(accountContracts.initiateReturn), validateResponse(accountContracts.initiateReturn), initiateReturn);

// GET /api/account/rewards
router.get('/rewards', validateResponse(accountContracts.getRewards), getRewards);

// GET   /api/account/newsletter
// PATCH /api/account/newsletter
router.get('/newsletter', validateResponse(accountContracts.getNewsletter), getNewsletter);
router.patch('/newsletter', validateRequest(accountContracts.updateNewsletter), validateResponse(accountContracts.updateNewsletter), updateNewsletter);

// GET   /api/account/settings
// PATCH /api/account/settings
router.get('/settings', validateResponse(accountContracts.getSettings), getSettings);
router.patch('/settings', validateRequest(accountContracts.updateSettings), validateResponse(accountContracts.updateSettings), updateSettings);

// PATCH /api/account/password
// DELETE /api/account
router.patch('/password', validateRequest(accountContracts.changePassword), validateResponse(accountContracts.changePassword), changePassword);
router.delete('/', validateRequest(accountContracts.deleteAccount), validateResponse(accountContracts.deleteAccount), deleteAccount);

export default router;