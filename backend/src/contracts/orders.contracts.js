import Joi from 'joi';

/**
 * Orders API Contracts
 * Defines request/response schemas for all order endpoints
 */

const orderItemSchema = Joi.object({
  productId: Joi.string().required(),
  quantity: Joi.number().min(1).required(),
  price: Joi.number().optional(),
  lineTotal: Joi.number().optional(),
}).unknown(true);

const shippingAddressSchema = Joi.object({
  street: Joi.string().required(),
  city: Joi.string().required(),
  state: Joi.string().required(),
  postal: Joi.string().required(),
  country: Joi.string().optional(),
}).unknown(true);

const orderSchema = Joi.object({
  orderId: Joi.string().required(),
  userId: Joi.string().optional(),
  fullName: Joi.string().required(),
  shippingAddress: shippingAddressSchema.required(),
  items: Joi.array().items(orderItemSchema).required(),
  paymentMethodId: Joi.string().optional(),
  status: Joi.string().optional(),
  totalAmount: Joi.number().optional(),
  createdAt: Joi.date().optional(),
  updatedAt: Joi.date().optional(),
}).unknown(true);

export const ordersContracts = {
  // GET /api/orders
  getOrders: {
    response: {
      200: Joi.array().items(orderSchema),
      401: Joi.object({
        error: Joi.string().required(),
      }).unknown(true),
    },
  },

  // GET /api/orders/:orderId
  getOrder: {
    request: {
      params: Joi.object({
        orderId: Joi.string().required(),
      }),
    },
    response: {
      200: orderSchema,
      401: Joi.object({
        error: Joi.string().required(),
      }).unknown(true),
      404: Joi.object({
        error: Joi.string().required(),
      }).unknown(true),
    },
  },

  // POST /api/orders
  createOrder: {
    request: {
      body: Joi.object({
        fullName: Joi.string().required(),
        shippingAddress: shippingAddressSchema.required(),
        paymentMethodId: Joi.string().optional(),
        items: Joi.array()
          .items(
            Joi.object({
              productId: Joi.string().required(),
              quantity: Joi.number().min(1).required(),
            }).unknown(true)
          )
          .min(1)
          .required(),
      }).unknown(true),
    },
    response: {
      201: orderSchema,
      400: Joi.object({
        error: Joi.string().required(),
      }).unknown(true),
      401: Joi.object({
        error: Joi.string().required(),
      }).unknown(true),
    },
  },
};
