import express from 'express';
import { login, signup, logout, getMe } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validateRequest, validateResponse } from '../middleware/validation.middleware.js';
import { authContracts } from '../contracts/auth.contracts.js';

const router = express.Router();

// POST /api/auth/login
router.post('/login', validateRequest(authContracts.login), validateResponse(authContracts.login), login);

// POST /api/auth/signup
router.post('/signup', validateRequest(authContracts.signup), validateResponse(authContracts.signup), signup);

// POST /api/auth/logout
router.post('/logout', validateResponse(authContracts.logout), logout);

// GET  /api/auth/me
router.get('/me', requireAuth, validateResponse(authContracts.getMe), getMe);

export default router;