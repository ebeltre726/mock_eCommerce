import Joi from 'joi';

const orderItemSchema = Joi.object({
    productId: Joi.string().required(),
    quantity:  Joi.number().integer().min(1).required(),
    price:     Joi.number().min(0).optional(),
    lineTotal: Joi.number().min(0).optional(),
    name:      Joi.string().optional(),  // cartModule likely sends this
    image:     Joi.string().optional(),
}).unknown(true);

const shippingAddressSchema = Joi.object({
    street:  Joi.string().optional(),
    city:    Joi.string().optional(),
    state:   Joi.string().optional(),
    postal:  Joi.string().optional(),
    country: Joi.string().optional(),
}).unknown(true);

const orderSchema = Joi.object({
    orderId:         Joi.string().required(),
    userId:          Joi.string().optional(),
    fullName:        Joi.string().optional(),
    shippingAddress: shippingAddressSchema.optional(),
    items:           Joi.array().items(orderItemSchema).optional(),
    paymentMethodId: Joi.string().optional(),
    status:          Joi.string().optional(),
    totalAmount:     Joi.number().optional(),
    createdAt:       Joi.alternatives().try(Joi.date(), Joi.string().isoDate()).optional(),
    updatedAt:       Joi.alternatives().try(Joi.date(), Joi.string().isoDate()).optional(),
}).unknown(true);

export const ordersContracts = {
    // GET /api/orders
    getOrders: {
        response: {
            200: Joi.array().items(orderSchema),
            401: Joi.object({ error: Joi.string().required() }).unknown(true),
        },
    },

    // GET /api/orders/:orderId
    getOrder: {
        request: {
            params: Joi.object({ orderId: Joi.string().required() }),
        },
        response: {
            200:  orderSchema,
            401:  Joi.object({ error: Joi.string().required() }).unknown(true),
            404:  Joi.object({ error: Joi.string().required() }).unknown(true),
        },
    },

    // POST /api/orders
    createOrder: {
        request: {
            body: Joi.object({
                // Required
                fullName:  Joi.string().required(),
                addressId: Joi.string().required(),
                items:     Joi.array().items(orderItemSchema).min(1).required(),

                // Payment — optional because demo mode skips it
                paymentMethodId: Joi.string().optional(),

                // Card saving — sent by frontend only when saveCard is true
                saveCard:   Joi.boolean().optional(),
                cardBrand:  Joi.string().optional(),
                cardLast4:  Joi.string().length(4).optional(),
                cardExpiry: Joi.string().optional(),
            }),
            // No .unknown(true) here — explicit is better for a write endpoint
            // so unexpected fields cause a loud error rather than silent passthrough
        },
        response: {
            201: Joi.object({
                orderId:               Joi.string().required(),
                status:                Joi.string().required(),
                totalAmount:           Joi.number().required(),
                paymentMethod:         Joi.string().optional(),
                stripePaymentIntentId: Joi.string().allow(null).optional(),
            }),
            400: Joi.object({ error: Joi.string().required() }).unknown(true),
            401: Joi.object({ error: Joi.string().required() }).unknown(true),
        },
    },
};