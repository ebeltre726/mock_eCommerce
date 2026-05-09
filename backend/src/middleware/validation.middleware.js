/**
 * Validation Middleware
 * Validates requests against API contracts
 */
import logger from '../utils/logger.js';

export function validateRequest(contract) {
  return (req, res, next) => {
    if (req.file || req.files) {
      return next();
    }
    const errors = [];

    const assignValidatedRequestProperty = (key, value) => {
      try {
        req[key] = value;
      } catch (_assignError) {
        Object.defineProperty(req, key, {
          value,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      }
    };

    // Validate body
    if (contract.request?.body) {
      const { error, value } = contract.request.body.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        errors.push({
          field: 'body',
          details: error.details.map((d) => ({
            path: d.path.join('.'),
            message: d.message,
          })),
        });
      } else {
        assignValidatedRequestProperty('body', value);
      }
    }

    if (contract.request?.params) {
      const { error, value } = contract.request.params.validate(req.params, {
        abortEarly: false,
      });

      if (error) {
        errors.push({
          field: 'params',
          details: error.details.map((d) => ({
            path: d.path.join('.'),
            message: d.message,
          })),
        });
      } else {
        assignValidatedRequestProperty('params', value);
      }
    }

    // Validate query
    if (contract.request?.query) {
      const { error, value } = contract.request.query.validate(req.query, {
        abortEarly: false,
      });

      if (error) {
        errors.push({
          field: 'query',
          details: error.details.map((d) => ({
            path: d.path.join('.'),
            message: d.message,
          })),
        });
      } else {
        assignValidatedRequestProperty('query', value);
      }
    }

    if (errors.length > 0) {
      logger.warn({ path: req.path, method: req.method, errors }, 'Request validation failed');
      return res.status(400).json({
        error: 'Validation failed',
        details: errors,
      });
    }

    next();
  };
}

/**
 * Response Validation (optional - for development/testing)
 * Validates responses against API contracts
 */
export function validateResponse(contract) {
  return (req, res, next) => {
    if (process.env.NODE_ENV === 'production') return next();

    const originalJson = res.json.bind(res);

    res.json = function (data) {
      if (contract.response) {
        const statusCode = res.statusCode;
        const responseSchema = contract.response[statusCode];

        if (responseSchema) {
          const { error } = responseSchema.validate(data, {
            abortEarly: false,
          });

          if (error) {
            logger.warn({ statusCode, err: error.message }, 'Response validation failed (contract mismatch)');
          }
        }
      }

      return originalJson(data);
    };

    next();
  };
}
