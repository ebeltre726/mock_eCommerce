import Joi from 'joi';

/**
 * Cart API Contracts
 * Defines request/response schemas for all cart endpoints
 */

const cartItemSchema = Joi.object({
  productId: Joi.string().required(),
  quantity: Joi.number().integer().min(1).required(),
});

export const cartContracts = {
  // GET /api/cart
  getCart: {
    response: {
      200: Joi.array().items(cartItemSchema),
      401: Joi.object({
        error: Joi.string().required(),
      }).unknown(true),
    },
  },

  // POST /api/cart/add
  addItem: {
    request: {
      body: Joi.object({
        productId: Joi.string().required(),
        quantity: Joi.number().integer().min(1).required(),
      }),
    },
    response: {
      200: cartItemSchema,
      400: Joi.object({
        error: Joi.string().required(),
      }).unknown(true),
      401: Joi.object({
        error: Joi.string().required(),
      }).unknown(true),
    },
  },

  // POST /api/cart/remove
  removeItem: {
    request: {
      body: Joi.object({
        productId: Joi.string().required(),
        quantity: Joi.number().integer().min(1).required(),
      }),
    },
    response: {
      200: cartItemSchema,
      400: Joi.object({
        error: Joi.string().required(),
      }).unknown(true),
      401: Joi.object({
        error: Joi.string().required(),
      }).unknown(true),
    },
  },

  // DELETE /api/cart/clear
  clearCart: {
    response: {
      200: Joi.object({
        success: Joi.boolean().optional(),
        message: Joi.string().optional(),
      }).unknown(true),
      401: Joi.object({
        error: Joi.string().required(),
      }).unknown(true),
    },
  },
};
