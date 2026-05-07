import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  login,
  signup,
  logout,
  refresh,
  forgotPasswordHandler,
  confirmForgotPasswordHandler,
  getMe,
} from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validateRequest, validateResponse } from '../middleware/validation.middleware.js';
import { authContracts } from '../contracts/auth.contracts.js';

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// POST /api/auth/login
router.post('/login', authLimiter, validateRequest(authContracts.login), validateResponse(authContracts.login), login);

// POST /api/auth/signup
router.post('/signup', authLimiter, validateRequest(authContracts.signup), validateResponse(authContracts.signup), signup);

// POST /api/auth/logout
router.post('/logout', authLimiter, validateResponse(authContracts.logout), logout);

// POST /api/auth/refresh
router.post('/refresh', authLimiter, validateResponse(authContracts.refresh), refresh);

// POST /api/auth/forgot-password
router.post('/forgot-password', authLimiter, validateResponse(authContracts.forgotPassword), forgotPasswordHandler);

// POST /api/auth/confirm-forgot-password
router.post('/confirm-forgot-password', authLimiter, validateResponse(authContracts.confirmForgotPassword), confirmForgotPasswordHandler);

// GET /api/auth/me
router.get('/me', requireAuth, validateResponse(authContracts.getMe), getMe);

export default router;
