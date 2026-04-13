/**
 * Validation Middleware
 * Validates requests against API contracts
 */

export function validateRequest(contract) {
  return (req, res, next) => {
    const errors = [];

    const assignValidatedRequestProperty = (key, value) => {
      try {
        req[key] = value;
      } catch (assignError) {
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
        stripUnknown: false, // Allow unknown fields for flexibility
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
      console.error('❌ [Validation] Request validation failed:', {
        path: req.path,
        method: req.method,
        body: req.body,
        errors: errors,
      });
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
            console.warn(`[API Contract Warning] Response validation failed for status ${statusCode}:`, error.message);
          }
        }
      }

      return originalJson(data);
    };

    next();
  };
}
