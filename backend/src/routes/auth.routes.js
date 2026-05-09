import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  login,
  signup,
  logout,
  refresh,
  session,
  forgotPasswordHandler,
  confirmForgotPasswordHandler,
  resendConfirmationHandler,
  getMe,
} from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validateRequest, validateResponse } from '../middleware/validation.middleware.js';
import { authContracts } from '../contracts/auth.contracts.js';

const router = express.Router();

// NOTE: This limiter uses in-process MemoryStore. In Lambda each cold start and
// each concurrent instance gets independent counters, so this cannot enforce
// reliable per-client limits across instances. Production throttling is handled
// at the API Gateway stage level (see infrastructure/terraform/modules/api_gateway).
// This limiter still provides a meaningful guard in local/single-instance environments.
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

// POST /api/auth/resend-confirmation
router.post('/resend-confirmation', authLimiter, validateRequest(authContracts.resendConfirmation), validateResponse(authContracts.resendConfirmation), resendConfirmationHandler);

// POST /api/auth/logout
router.post('/logout', authLimiter, validateResponse(authContracts.logout), logout);

// POST /api/auth/refresh
router.post('/refresh', authLimiter, validateResponse(authContracts.refresh), refresh);

// POST /api/auth/forgot-password
router.post('/forgot-password', authLimiter, validateRequest(authContracts.forgotPassword), validateResponse(authContracts.forgotPassword), forgotPasswordHandler);

// POST /api/auth/confirm-forgot-password
router.post('/confirm-forgot-password', authLimiter, validateRequest(authContracts.confirmForgotPassword), validateResponse(authContracts.confirmForgotPassword), confirmForgotPasswordHandler);

// POST /api/auth/tokens — exchange client-side SRP tokens for httpOnly session cookies
router.post('/tokens', authLimiter, validateRequest(authContracts.tokens), validateResponse(authContracts.tokens), session);

// GET /api/auth/me
router.get('/me', requireAuth, validateResponse(authContracts.getMe), getMe);

export default router;
