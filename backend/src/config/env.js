const env = (() => {
  const {
    JWT_SECRET,
    AWS_REGION,
    DYNAMODB_ENDPOINT,
    NODE_ENV,
  } = process.env;

  // Validate required vars
  if (!JWT_SECRET) {
    throw new Error('FATAL: JWT_SECRET is not set');
  }
  if (!AWS_REGION) {
    throw new Error('FATAL: AWS_REGION is not set');
  }

  return {
    JWT_SECRET,
    AWS_REGION,
    DYNAMODB_ENDPOINT,
    NODE_ENV,
  };
})();

export default env;