import express from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';

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
router.get('/overview', getOverview);
router.patch('/overview', updateOverview);

// GET    /api/account/payment
// POST   /api/account/payment
// PATCH  /api/account/payment/:paymentId
// DELETE /api/account/payment/:paymentId
router.get('/payment', getPayments);
router.post('/payment', addPayment);
router.patch('/payment/:paymentId', updatePayment);
router.delete('/payment/:paymentId', deletePayment);

// GET /api/account/orders
// GET /api/account/orders/:orderId
router.get('/orders', getOrders);
router.get('/orders/:orderId', getOrder);

// GET    /api/account/address
// POST   /api/account/address
// PATCH  /api/account/address/:addressId
// DELETE /api/account/address/:addressId
router.get('/address', getAddresses);
router.post('/address', createAddress);
router.patch('/address/:addressId', updateAddress);
router.delete('/address/:addressId', deleteAddress);

// GET    /api/account/wishlist
// POST   /api/account/wishlist
// DELETE /api/account/wishlist/:itemId
router.get('/wishlist', getWishlist);
router.post('/wishlist', addToWishlist);
router.delete('/wishlist/:itemId', deleteWishlistItem);

// GET  /api/account/returns
// POST /api/account/returns
router.get('/returns', getReturns);
router.post('/returns', initiateReturn);

// GET /api/account/rewards
router.get('/rewards', getRewards);

// GET   /api/account/newsletter
// PATCH /api/account/newsletter
router.get('/newsletter', getNewsletter);
router.patch('/newsletter', updateNewsletter);

// GET   /api/account/settings
// PATCH /api/account/settings
router.get('/settings', getSettings);
router.patch('/settings', updateSettings);

// PATCH /api/account/password
// DELETE /api/account
router.patch('/password', changePassword);
router.delete('/', deleteAccount);

export default router;