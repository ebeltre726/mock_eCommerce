export const env = (() => {
  const {
    JWT_SECRET,
    AWS_REGION,
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
    S3_BUCKET_AVATARS,
    S3_BUCKET_PRODUCTS,
    S3_ENDPOINT,          // set locally for MinIO; leave unset in production
    DYNAMODB_ENDPOINT,
    NODE_ENV,
    STRIPE_SECRET_KEY,
  } = process.env;

  if (!JWT_SECRET)            throw new Error("FATAL: JWT_SECRET is not set");
  if (!AWS_REGION)            throw new Error("FATAL: AWS_REGION is not set");
  if (!AWS_ACCESS_KEY_ID)     throw new Error("FATAL: AWS_ACCESS_KEY_ID is not set");
  if (!AWS_SECRET_ACCESS_KEY) throw new Error("FATAL: AWS_SECRET_ACCESS_KEY is not set");
  if (!S3_BUCKET_AVATARS)     throw new Error("FATAL: S3_BUCKET_AVATARS is not set");
  if (!S3_BUCKET_PRODUCTS)    throw new Error("FATAL: S3_BUCKET_PRODUCTS is not set");
  if (!STRIPE_SECRET_KEY)     throw new Error("FATAL: STRIPE_SECRET_KEY is not set");

  return {
    JWT_SECRET,
    AWS_REGION,
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
    S3_BUCKET_AVATARS,
    S3_BUCKET_PRODUCTS,
    S3_ENDPOINT,
    DYNAMODB_ENDPOINT,
    NODE_ENV,
    STRIPE_SECRET_KEY,
  };
})();

export default env;