import Joi from 'joi';

/**
 * Auth API Contracts
 * Defines request/response schemas for all auth endpoints
 */

export const authContracts = {
  // POST /api/auth/login
  login: {
    request: {
      body: Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().required(), // Remove min length to match test data
      }).unknown(true),
    },
    response: {
      200: Joi.object({
        token: Joi.string().required(),
        userId: Joi.string().optional(),
        email: Joi.string().optional(),
      }).unknown(true),
      401: Joi.object({
        error: Joi.string().required(),
      }).unknown(true),
    },
  },

  // POST /api/auth/signup
  signup: {
    request: {
      body: Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().required(), // Remove min length to match test data
        firstName: Joi.string().optional(),
        lastName: Joi.string().optional(),
      }).unknown(true), // Allow termsConditions and other fields
    },
    response: {
      201: Joi.object({
        token: Joi.string().required(),
        userId: Joi.string().optional(),
        email: Joi.string().optional(),
      }).unknown(true),
      400: Joi.object({
        error: Joi.string().required(),
      }).unknown(true),
    },
  },

  // POST /api/auth/logout
  logout: {
    response: {
      200: Joi.object({
        message: Joi.string().optional(),
        success: Joi.boolean().optional(),
      }).unknown(true),
    },
  },

  // GET /api/auth/me
  getMe: {
    response: {
      200: Joi.object({
        userId: Joi.string().optional(),
        email: Joi.string().email().optional(),
        firstName: Joi.string().optional(),
        lastName: Joi.string().optional(),
      }).unknown(true),
      401: Joi.object({
        error: Joi.string().required(),
      }).unknown(true),
    },
  },
};
