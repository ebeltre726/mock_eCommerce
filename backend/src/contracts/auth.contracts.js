import Joi from 'joi';

export const authContracts = {
  // POST /api/auth/login
  login: {
    request: {
      body: Joi.object({
        email:    Joi.string().email().required(),
        password: Joi.string().required(),
      }).unknown(true),
    },
    response: {
      200: Joi.object({
        token:        Joi.string().required(),
        accessToken:  Joi.string().optional(),
        refreshToken: Joi.string().optional(),
        userId:       Joi.string().allow(null).optional(),
        email:        Joi.string().optional(),
        firstName:    Joi.string().allow('').optional(),
        lastName:     Joi.string().allow('').optional(),
      }).unknown(true),
      401: Joi.object({ error: Joi.string().required() }).unknown(true),
    },
  },

  // POST /api/auth/signup
  signup: {
    request: {
      body: Joi.object({
        email:           Joi.string().email().required(),
        password:        Joi.string().required(),
        firstName:       Joi.string().optional(),
        lastName:        Joi.string().optional(),
        termsConditions: Joi.boolean().optional(),
      }).unknown(true),
    },
    response: {
      201: Joi.object({
        message: Joi.string().required(), // "Please check your email..."
      }).unknown(true),
      400: Joi.object({ error: Joi.string().required() }).unknown(true),
    },
  },

  // POST /api/auth/resend-confirmation
  resendConfirmation: {
    request: {
      body: Joi.object({
        email: Joi.string().email().required(),
      }).unknown(true),
    },
    response: {
      200: Joi.object({ message: Joi.string().required() }).unknown(true),
      429: Joi.object({ error: Joi.string().required() }).unknown(true),
    },
  },

  // POST /api/auth/logout
  logout: {
    response: {
      200: Joi.object({
        success: Joi.boolean().optional(),
        message: Joi.string().optional(),
      }).unknown(true),
    },
  },

  // POST /api/auth/refresh
  refresh: {
    response: {
      200: Joi.object({
        token:       Joi.string().required(),
        accessToken: Joi.string().optional(),
      }).unknown(true),
      401: Joi.object({ error: Joi.string().required() }).unknown(true),
    },
  },

  // POST /api/auth/forgot-password
  forgotPassword: {
    response: {
      200: Joi.object({ message: Joi.string().required() }).unknown(true),
      429: Joi.object({ error: Joi.string().required() }).unknown(true),
    },
  },

  // POST /api/auth/confirm-forgot-password
  confirmForgotPassword: {
    response: {
      200: Joi.object({ message: Joi.string().required() }).unknown(true),
      400: Joi.object({ error: Joi.string().required() }).unknown(true),
    },
  },

  // GET /api/auth/me
  getMe: {
    response: {
      200: Joi.object({
        userId:    Joi.string().optional(),
        email:     Joi.string().email().optional(),
        firstName: Joi.string().optional(),
        lastName:  Joi.string().optional(),
      }).unknown(true),
      401: Joi.object({ error: Joi.string().required() }).unknown(true),
    },
  },
};
