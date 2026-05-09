import Joi from 'joi';

/**
 * Account API Contracts
 * Defines request/response schemas for all account endpoints
 */

const addressSchema = Joi.object({
  addressId: Joi.string().optional(),
  label: Joi.string().optional(),
  line1: Joi.string().required(),
  line2: Joi.string().allow('').optional(),
  city: Joi.string().required(),
  state: Joi.string().required(),
  zip: Joi.string().required(),
  country: Joi.string().optional(),
  isDefault: Joi.boolean().optional(),
});

const paymentSchema = Joi.object({
    paymentId:             Joi.string().optional(),
    stripePaymentMethodId: Joi.string().optional(),
    brand:                 Joi.string().optional(),
    last4:                 Joi.string().length(4).optional(),
    expiry:                Joi.string().optional(),
    isDefault:             Joi.boolean().optional(),
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
        avatar: Joi.string().optional(),
        dateCreated: Joi.date().optional(),
        createdAt: Joi.date().optional(),
        stats: Joi.object({
          orders: Joi.number().optional(),
          wishlist: Joi.number().optional(),
          points: Joi.number().optional(),
          returns: Joi.number().optional(),
        }).optional(),
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
      }),
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
  // Only the Stripe payment method ID and optional default flag come from the client.
  // brand/last4/expiry are fetched server-side from Stripe in the controller.
  addPayment: {
      request: {
          body: Joi.object({
              stripePaymentMethodId: Joi.string().required(),
              isDefault:             Joi.boolean().optional(),
          }),
      },
      response: {
          201: Joi.object({
              paymentId:             Joi.string().required(),
              stripePaymentMethodId: Joi.string().required(),
              brand:                 Joi.string().required(),
              last4:                 Joi.string().required(),
              expiry:                Joi.string().required(),
              isDefault:             Joi.boolean().required(),
          }),
          400: Joi.object({ error: Joi.string().required() }).unknown(true),
          401: Joi.object({ error: Joi.string().required() }).unknown(true),
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
      }),
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
      200: Joi.object({
        orders:     Joi.array().items(orderSchema).required(),
        nextCursor: Joi.string().allow(null).required(),
      }),
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
      200: Joi.object({
        addresses:  Joi.array().items(addressSchema).required(),
        nextCursor: Joi.string().allow(null).required(),
      }),
      400: Joi.object({ error: Joi.string().required() }).unknown(true),
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
        line1: Joi.string().optional(),
        line2: Joi.string().allow('').optional(),
        city: Joi.string().optional(),
        state: Joi.string().optional(),
        zip: Joi.string().optional(),
        country: Joi.string().optional(),
        isDefault: Joi.boolean().optional(),
      }),
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
          productName: Joi.string().optional(),
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
      }),
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
          orderNumber: Joi.string().required(),
          status: Joi.string().required(),
          item: Joi.string().required(),
          refundAmount: Joi.number().required(),
          dateInitiated: Joi.date().optional(),
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
              orderId:     Joi.string().required(),
              orderNumber: Joi.string().optional(),
              itemId:      Joi.string().required(),
              item:        Joi.string().required(),
              reason:      Joi.string().required(),
              notes:       Joi.string().allow('').optional(),
          }),
      },
      response: {
          201: Joi.object({
              returnId: Joi.string().required(),
          }),
          400: Joi.object({ error: Joi.string().required() }).unknown(true),
          401: Joi.object({ error: Joi.string().required() }).unknown(true),
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
        topics: Joi.array().items(
          Joi.object({
            topicId:  Joi.string().required(),
            selected: Joi.boolean().required(),
          })
        ).optional(),
      }),
    },
    response: {
      200: Joi.object({
        subscribed: Joi.boolean().optional(),
        topics:     Joi.array().optional(),
        email:      Joi.string().email().optional(),
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
        shareData:        Joi.boolean().optional(),
        emailUpdates:     Joi.boolean().optional(),
        smsNotifications: Joi.boolean().optional(),
      }),
    },
    response: {
      200: Joi.object({
        shareData:        Joi.boolean().optional(),
        emailUpdates:     Joi.boolean().optional(),
        smsNotifications: Joi.boolean().optional(),
      }).unknown(true),
      400: Joi.object({
        error: Joi.string().required(),
      }).unknown(true),
    },
  },

  // POST /api/account/avatar
  uploadAvatar: {
    response: {
      200: Joi.object({
        message: Joi.string().optional(),
        avatar: Joi.string().optional(),
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
        password: Joi.string().required(),
      }),
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
      }),
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
