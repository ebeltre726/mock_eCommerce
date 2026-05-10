import Joi from 'joi';

export const authContracts = {
  // POST /api/auth/login
  login: {
    request: {
      body: Joi.object({
        email:    Joi.string().email().required(),
        password: Joi.string().required(),
      }),
    },
    response: {
      200: Joi.object({
        userId:    Joi.string().allow(null).optional(),
        email:     Joi.string().optional(),
        firstName: Joi.string().allow('').optional(),
        lastName:  Joi.string().allow('').optional(),
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
        firstName:       Joi.string().min(1).required(),
        lastName:        Joi.string().min(1).required(),
        termsConditions: Joi.boolean().valid(true).required()
          .messages({ 'any.only': 'You must accept the terms and conditions' }),
      }),
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
      }),
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
  // Refresh token is read from the httpOnly cookie; body fallback for API clients.
  refresh: {
    response: {
      200: Joi.object({ success: Joi.boolean().optional() }).unknown(true),
      401: Joi.object({ error: Joi.string().required() }).unknown(true),
    },
  },

  // POST /api/auth/forgot-password
  forgotPassword: {
    request: {
      body: Joi.object({
        email: Joi.string().email().required(),
      }),
    },
    response: {
      200: Joi.object({ message: Joi.string().required() }).unknown(true),
      429: Joi.object({ error: Joi.string().required() }).unknown(true),
    },
  },

  // POST /api/auth/confirm-forgot-password
  confirmForgotPassword: {
    request: {
      body: Joi.object({
        email:    Joi.string().email().required(),
        code:     Joi.string().required(),
        password: Joi.string().required(),
      }),
    },
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

  // POST /api/auth/tokens
  // Accepts tokens from a successful client-side SRP auth and sets httpOnly cookies.
  tokens: {
    request: {
      body: Joi.object({
        idToken:      Joi.string().required(),
        accessToken:  Joi.string().optional(),
        refreshToken: Joi.string().optional(),
      }),
    },
    response: {
      200: Joi.object({
        userId:    Joi.string().allow(null).optional(),
        email:     Joi.string().optional(),
        firstName: Joi.string().allow('').optional(),
        lastName:  Joi.string().allow('').optional(),
      }).unknown(true),
      401: Joi.object({ error: Joi.string().required() }).unknown(true),
    },
  },
};
