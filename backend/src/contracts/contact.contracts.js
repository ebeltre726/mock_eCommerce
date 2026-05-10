import Joi from 'joi';

export const contactContracts = {
  // POST /api/contact
  sendMessage: {
    request: {
      body: Joi.object({
        firstName:    Joi.string().max(64).required(),
        lastName:     Joi.string().max(64).required(),
        email:        Joi.string().email().required(),
        emailMessage: Joi.string().max(2000).required(),
      }),
    },
    response: {
      200: Joi.object({ success: Joi.boolean().required(), message: Joi.string().required() }),
      400: Joi.object({ error: Joi.string().required() }).unknown(true),
    },
  },
};
