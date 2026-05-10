import express from 'express';
import rateLimit from 'express-rate-limit';
import { sendContactMessage } from '../controllers/contact.controller.js';
import { validateRequest, validateResponse } from '../middleware/validation.middleware.js';
import { contactContracts } from '../contracts/contact.contracts.js';

const router = express.Router();

// NOTE: Same per-instance limitation as authLimiter — see auth.routes.js.
// Production throttling is enforced at the API Gateway stage level.
const contactLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// POST /api/contact
router.post('/', contactLimiter, validateRequest(contactContracts.sendMessage), validateResponse(contactContracts.sendMessage), sendContactMessage);

export default router;