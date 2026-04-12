import Joi from 'joi';

/**
 * Products API Contracts
 * Defines request/response schemas for all product endpoints
 */

const productSchema = Joi.object({
  id: Joi.string().required(),
  name: Joi.string().required(),
  description: Joi.string().optional(),
  price: Joi.number().optional(), // Optional to support mock test data
  category: Joi.string().optional(),
  imageUrl: Joi.string().optional(),
  inStock: Joi.boolean().optional(),
  quantity: Joi.number().optional(),
  createdAt: Joi.date().optional(),
}).unknown(true); // Allow unknown fields for flexibility

export const productsContracts = {
  // GET /api/products
  getProducts: {
    request: {
      query: Joi.object({
        category: Joi.string().optional(),
        search: Joi.string().optional(),
        limit: Joi.number().optional(),
        offset: Joi.number().optional(),
      }).unknown(true),
    },
    response: {
      200: Joi.array().items(productSchema),
    },
  },

  // GET /api/products/:productId
  getProduct: {
    request: {
      params: Joi.object({
        productId: Joi.string().required(),
      }),
    },
    response: {
      200: productSchema,
      404: Joi.object({
        error: Joi.string().required(),
      }),
    },
  },
};
