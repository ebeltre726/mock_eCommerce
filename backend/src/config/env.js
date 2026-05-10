// STRIPE_SECRET_KEY is loaded from SSM by the Lambda handler before cold-start
// completes (see lambda.js). env.js reads only from process.env so it stays
// synchronous and Babel/Jest-compatible.

export const env = (() => {
  const {
    AWS_REGION,
    DYNAMODB_TABLE,
    S3_BUCKET_AVATARS,
    S3_BUCKET_PRODUCTS,
    S3_ENDPOINT,
    DYNAMODB_ENDPOINT,
    NODE_ENV,
    STRIPE_SECRET_KEY,
    STRIPE_SECRET_SSM,
    COGNITO_USER_POOL_ID,
    COGNITO_CLIENT_ID,
    ALLOWED_ORIGINS,
  } = process.env;

  const isTest = NODE_ENV === 'test';

  if (!AWS_REGION)        throw new Error('FATAL: AWS_REGION is not set');
  if (!S3_BUCKET_AVATARS) throw new Error('FATAL: S3_BUCKET_AVATARS is not set');
  if (!S3_BUCKET_PRODUCTS) throw new Error('FATAL: S3_BUCKET_PRODUCTS is not set');
  if (!STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_SSM)
    throw new Error('FATAL: STRIPE_SECRET_KEY is not set');
  if (!isTest && !DYNAMODB_TABLE) throw new Error('FATAL: DYNAMODB_TABLE is not set');

  // Cognito vars are real identifiers required outside of test runs (where the
  // auth middleware is always mocked and the SDK is never called).
  if (!isTest && !COGNITO_USER_POOL_ID) throw new Error('FATAL: COGNITO_USER_POOL_ID is not set');
  if (!isTest && !COGNITO_CLIENT_ID)    throw new Error('FATAL: COGNITO_CLIENT_ID is not set');

  // ALLOWED_ORIGINS drives the CORS allowlist in app.js. A missing value in
  // production silently defaults to [] and blocks all browser cross-origin
  // requests — surface it as a startup error rather than a runtime mystery.
  if (!isTest && !ALLOWED_ORIGINS) throw new Error('FATAL: ALLOWED_ORIGINS is not set');

  return {
    AWS_REGION,
    DYNAMODB_TABLE:       DYNAMODB_TABLE       ?? '',
    S3_BUCKET_AVATARS,
    S3_BUCKET_PRODUCTS,
    S3_ENDPOINT,
    DYNAMODB_ENDPOINT,
    NODE_ENV,
    STRIPE_SECRET_KEY:    STRIPE_SECRET_KEY    ?? '',
    COGNITO_USER_POOL_ID: COGNITO_USER_POOL_ID ?? '',
    COGNITO_CLIENT_ID:    COGNITO_CLIENT_ID    ?? '',
    ALLOWED_ORIGINS:      ALLOWED_ORIGINS      ?? '',
  };
})();

export default env;
