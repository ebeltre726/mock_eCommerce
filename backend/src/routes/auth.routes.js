import express from 'express';
import { login, signup, logout, getSession } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = express.Router();

// POST /api/auth/login
router.post('/login', login);

// POST /api/auth/signup
router.post('/signup', signup);

// POST /api/auth/logout
router.post('/logout', logout);

// GET  /api/auth/me
router.get('/me', requireAuth, getSession);

export default router;