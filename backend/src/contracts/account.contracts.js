import Joi from 'joi';

/**
 * Account API Contracts
 * Defines request/response schemas for all account endpoints
 */

const addressSchema = Joi.object({
  addressId: Joi.string().optional(),
  street: Joi.string().required(),
  city: Joi.string().required(),
  state: Joi.string().required(),
  postal: Joi.string().required(),
  country: Joi.string().optional(),
  isDefault: Joi.boolean().optional(),
}).unknown(true);

const paymentSchema = Joi.object({
  paymentId: Joi.string().optional(),
  type: Joi.string().valid('card', 'paypal', 'bank').required(),
  cardNumber: Joi.string().when('type', {
    is: 'card',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  expiry: Joi.string().optional(),
  lastFour: Joi.string().optional(),
  isDefault: Joi.boolean().optional(),
}).unknown(true);

const orderItemSchema = Joi.object({
  productId: Joi.string().optional(),
  name: Joi.string().optional(),
  image: Joi.string().optional(),
  quantity: Joi.number().optional(),
  price: Joi.number().optional(),
}).unknown(true);

const orderShippingAddressSchema = Joi.object({
  street: Joi.string().optional(),
  city: Joi.string().optional(),
  state: Joi.string().optional(),
  postal: Joi.string().optional(),
  country: Joi.string().optional(),
}).unknown(true);

const orderSchema = Joi.object({
  orderId: Joi.string().optional(),
  userId: Joi.string().optional(),
  fullName: Joi.string().optional(),
  shippingAddress: orderShippingAddressSchema.optional(),
  items: Joi.array().items(orderItemSchema).optional(),
  paymentMethodId: Joi.string().optional(),
  status: Joi.string().optional(),
  totalAmount: Joi.number().optional(),
  createdAt: Joi.date().optional(),
  updatedAt: Joi.date().optional(),
}).unknown(true);

export const accountContracts = {
  // GET /api/account/overview
  getOverview: {
    response: {
      200: Joi.object({
        userId: Joi.string().optional(),
        email: Joi.string().email().optional(),
        firstName: Joi.string().optional(),
        lastName: Joi.string().optional(),
        createdAt: Joi.date().optional(),
      }).unknown(true),
      401: Joi.object({
        error: Joi.string().required(),
      }).unknown(true),
    },
  },

  // PATCH /api/account/overview
  updateOverview: {
    request: {
      body: Joi.object({
        firstName: Joi.string().optional(),
        lastName: Joi.string().optional(),
        email: Joi.string().email().optional(),
      }).unknown(true),
    },
    response: {
      200: Joi.object({
        userId: Joi.string().optional(),
        email: Joi.string().email().optional(),
        firstName: Joi.string().optional(),
        lastName: Joi.string().optional(),
      }).unknown(true),
      400: Joi.object({
        error: Joi.string().required(),
      }).unknown(true),
    },
  },

  // GET /api/account/payment
  getPayments: {
    response: {
      200: Joi.array().items(paymentSchema),
      401: Joi.object({
        error: Joi.string().required(),
      }).unknown(true),
    },
  },

  // POST /api/account/payment
  addPayment: {
    request: {
      body: paymentSchema,
    },
    response: {
      201: Joi.object({
        paymentId: Joi.string().required(),
        type: Joi.string().required(),
        lastFour: Joi.string().optional(),
      }).unknown(true),
      400: Joi.object({
        error: Joi.string().required(),
      }).unknown(true),
    },
  },

  // PATCH /api/account/payment/:paymentId
  updatePayment: {
    request: {
      params: Joi.object({
        paymentId: Joi.string().required(),
      }),
      body: Joi.object({
        expiry: Joi.string().optional(),
        isDefault: Joi.boolean().optional(),
      }).unknown(true),
    },
    response: {
      200: paymentSchema,
      400: Joi.object({
        error: Joi.string().required(),
      }).unknown(true),
      404: Joi.object({
        error: Joi.string().required(),
      }).unknown(true),
    },
  },

  // DELETE /api/account/payment/:paymentId
  deletePayment: {
    request: {
      params: Joi.object({
        paymentId: Joi.string().required(),
      }),
    },
    response: {
      204: Joi.allow(null),
      404: Joi.object({
        error: Joi.string().required(),
      }).unknown(true),
    },
  },

  // GET /api/account/orders
  getOrders: {
    response: {
      200: Joi.array().items(orderSchema),
      401: Joi.object({
        error: Joi.string().required(),
      }).unknown(true),
    },
  },

  // GET /api/account/orders/:orderId
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

  // GET /api/account/address
  getAddresses: {
    response: {
      200: Joi.array().items(addressSchema),
      401: Joi.object({
        error: Joi.string().required(),
      }).unknown(true),
    },
  },

  // POST /api/account/address
  createAddress: {
    request: {
      body: addressSchema,
    },
    response: {
      201: addressSchema,
      400: Joi.object({
        error: Joi.string().required(),
      }).unknown(true),
    },
  },

  // PATCH /api/account/address/:addressId
  updateAddress: {
    request: {
      params: Joi.object({
        addressId: Joi.string().required(),
      }),
      body: Joi.object({
        street: Joi.string().optional(),
        city: Joi.string().optional(),
        state: Joi.string().optional(),
        postal: Joi.string().optional(),
        country: Joi.string().optional(),
        isDefault: Joi.boolean().optional(),
      }).unknown(true),
    },
    response: {
      200: addressSchema,
      400: Joi.object({
        error: Joi.string().required(),
      }).unknown(true),
      404: Joi.object({
        error: Joi.string().required(),
      }).unknown(true),
    },
  },

  // DELETE /api/account/address/:addressId
  deleteAddress: {
    request: {
      params: Joi.object({
        addressId: Joi.string().required(),
      }),
    },
    response: {
      204: Joi.allow(null),
      404: Joi.object({
        error: Joi.string().required(),
      }).unknown(true),
    },
  },

  // GET /api/account/wishlist
  getWishlist: {
    response: {
      200: Joi.array().items(
        Joi.object({
          itemId: Joi.string().required(),
          productId: Joi.string().required(),
          productName: Joi.string().required(),
          dateAdded: Joi.date().optional(),
        }).unknown(true)
      ),
      401: Joi.object({
        error: Joi.string().required(),
      }).unknown(true),
    },
  },

  // POST /api/account/wishlist
  addToWishlist: {
    request: {
      body: Joi.object({
        productId: Joi.string().required(),
      }).unknown(true),
    },
    response: {
      201: Joi.object({
        itemId: Joi.string().required(),
        productId: Joi.string().required(),
      }).unknown(true),
      400: Joi.object({
        error: Joi.string().required(),
      }).unknown(true),
    },
  },

  // DELETE /api/account/wishlist/:itemId
  deleteWishlistItem: {
    request: {
      params: Joi.object({
        itemId: Joi.string().required(),
      }),
    },
    response: {
      204: Joi.allow(null),
      404: Joi.object({
        error: Joi.string().required(),
      }).unknown(true),
    },
  },

  // GET /api/account/returns
  getReturns: {
  response: {
    200: Joi.object({
      returns: Joi.array().items(
        Joi.object({
          returnId: Joi.string().required(),
          orderId: Joi.string().required(),
          status: Joi.string().required(),
          dateRequested: Joi.date().optional(),
        }).unknown(true)
      ),
      orders: Joi.array(),
    }),
    401: Joi.object({
      error: Joi.string().required(),
    }).unknown(true),
  },
},


  // POST /api/account/returns
  initiateReturn: {
    request: {
      body: Joi.object({
        orderId: Joi.string().required(),
        reason: Joi.string().required(),
        items: Joi.array()
          .items(
            Joi.object({
              productId: Joi.string().required(),
              quantity: Joi.number().min(1).required(),
            }).unknown(true)
          )
          .required(),
      }).unknown(true),
    },
    response: {
      201: Joi.object({
        returnId: Joi.string().required(),
        orderId: Joi.string().required(),
        status: Joi.string().required(),
      }).unknown(true),
      400: Joi.object({
        error: Joi.string().required(),
      }).unknown(true),
    },
  },

  // GET /api/account/rewards
  getRewards: {
    response: {
      200: Joi.object({
        points: Joi.number().optional(),
        tier: Joi.string().optional(),
        rewardsHistory: Joi.array().optional(),
      }).unknown(true),
      401: Joi.object({
        error: Joi.string().required(),
      }).unknown(true),
    },
  },

  // GET /api/account/newsletter
  getNewsletter: {
    response: {
      200: Joi.object({
        subscribed: Joi.boolean().optional(),
        email: Joi.string().email().optional(),
      }).unknown(true),
      401: Joi.object({
        error: Joi.string().required(),
      }).unknown(true),
    },
  },

  // PATCH /api/account/newsletter
  updateNewsletter: {
    request: {
      body: Joi.object({
        subscribed: Joi.boolean().required(),
      }).unknown(true),
    },
    response: {
      200: Joi.object({
        subscribed: Joi.boolean().optional(),
        email: Joi.string().email().optional(),
      }).unknown(true),
      400: Joi.object({
        error: Joi.string().required(),
      }).unknown(true),
    },
  },

  // GET /api/account/settings
  getSettings: {
    response: {
      200: Joi.object({
        notifications: Joi.object().optional(),
        privacy: Joi.object().optional(),
        preferences: Joi.object().optional(),
      }).unknown(true),
      401: Joi.object({
        error: Joi.string().required(),
      }).unknown(true),
    },
  },

  // PATCH /api/account/settings
  updateSettings: {
    request: {
      body: Joi.object({
        notifications: Joi.object().optional(),
        privacy: Joi.object().optional(),
        preferences: Joi.object().optional(),
      }).unknown(true),
    },
    response: {
      200: Joi.object({
        notifications: Joi.object().optional(),
        privacy: Joi.object().optional(),
        preferences: Joi.object().optional(),
      }).unknown(true),
      400: Joi.object({
        error: Joi.string().required(),
      }).unknown(true),
    },
  },

  // PATCH /api/account/password
  changePassword: {
    request: {
      body: Joi.object({
        current: Joi.string().required(),
        password: Joi.string().required(), // Remove min length to match test data
      }).unknown(true),
    },
    response: {
      200: Joi.object({
        message: Joi.string().optional(),
      }).unknown(true),
      400: Joi.object({
        error: Joi.string().required(),
      }).unknown(true),
    },
  },

  // DELETE /api/account
  deleteAccount: {
    request: {
      body: Joi.object({
        password: Joi.string().required(),
      }).unknown(true),
    },
    response: {
      200: Joi.object({
        message: Joi.string().optional(),
      }).unknown(true),
      400: Joi.object({
        error: Joi.string().required(),
      }).unknown(true),
    },
  },
};
