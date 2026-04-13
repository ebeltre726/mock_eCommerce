export const env = (() => {
  const {
    JWT_SECRET,
    AWS_REGION,
    DYNAMODB_ENDPOINT,
    NODE_ENV,
    STRIPE_SECRET_KEY,
  } = process.env;

  // Validate required vars
  if (!JWT_SECRET) {
    throw new Error('FATAL: JWT_SECRET is not set');
  }
  if (!AWS_REGION) {
    throw new Error('FATAL: AWS_REGION is not set');
  }
  if (!STRIPE_SECRET_KEY) {
    throw new Error('FATAL: STRIPE_SECRET_KEY is not set');
  }

  return {
    JWT_SECRET,
    AWS_REGION,
    DYNAMODB_ENDPOINT,
    NODE_ENV,
    STRIPE_SECRET_KEY,
  };
})();

export default env;