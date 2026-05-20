import Joi from 'joi';

/**
 * Orders API Contracts
 * Defines request/response schemas for all order endpoints
 */

const orderItemSchema = Joi.object({
  productId: Joi.string().required(),
  quantity: Joi.number().integer().min(1).required(),
  price: Joi.number().optional(),
  lineTotal: Joi.number().optional(),
});

const shippingAddressSchema = Joi.object({
  street: Joi.string().optional(),
  city: Joi.string().optional(),
  state: Joi.string().optional(),
  postal: Joi.string().optional(),
  country: Joi.string().optional(),
});

const orderSchema = Joi.object({
  orderId: Joi.string().required(),
  userId: Joi.string().optional(),
  fullName: Joi.string().optional(),
  shippingAddress: shippingAddressSchema.optional(),
  items: Joi.array().items(orderItemSchema).optional(),
  paymentMethodId: Joi.string().optional(),
  status: Joi.string().optional(),
  totalAmount: Joi.number().optional(),
  createdAt: Joi.date().optional(),
  updatedAt: Joi.date().optional(),
});

export const ordersContracts = {
  // GET /api/orders
  getOrders: {
    response: {
      200: Joi.object({
        orders:     Joi.array().items(orderSchema).required(),
        nextCursor: Joi.string().allow(null).required(),
      }),
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
        addressId: Joi.string().optional(),
        shippingAddress: Joi.object({
          line1:   Joi.string().required(),
          line2:   Joi.string().optional().allow(''),
          city:    Joi.string().required(),
          state:   Joi.string().required(),
          zip:     Joi.string().required(),
          country: Joi.string().optional(),
        }).optional(),
        guestEmail: Joi.string().email().optional(),
        paymentMethodId: Joi.string().optional(),
        saveCard:   Joi.boolean().optional(),
        items: Joi.array()
          .items(
            Joi.object({
              productId: Joi.string().required(),
              quantity: Joi.number().integer().min(1).max(99).required(),
            })
          )
          .min(1)
          .required(),
      }).or('addressId', 'shippingAddress'),
    },
    response: {
      201: Joi.object({
        orderId: Joi.string().optional(),
        status: Joi.string().optional(),
        totalAmount: Joi.number().optional(),
        paymentMethod: Joi.string().optional(),
        stripePaymentIntentId: Joi.string().optional(),
      }),
      400: Joi.object({
        error: Joi.string().required(),
      }).unknown(true),
      401: Joi.object({
        error: Joi.string().required(),
      }).unknown(true),
    },
  },
};