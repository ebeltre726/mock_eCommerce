import express from 'express';
import rateLimit from 'express-rate-limit';
import { sendContactMessage } from '../controllers/contact.controller.js';

const router = express.Router();

const contactLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// POST /api/contact
router.post('/', contactLimiter, sendContactMessage);

export default router;