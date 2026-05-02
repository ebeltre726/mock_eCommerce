// Set all required env vars directly — no file dependency
process.env.NODE_ENV              = 'test';
process.env.JWT_SECRET            = 'test-secret-mockeCommerce';
process.env.AWS_REGION            = 'us-east-1';
process.env.AWS_ACCESS_KEY_ID     = 'minioadmin';
process.env.AWS_SECRET_ACCESS_KEY = 'minioadmin';
process.env.S3_BUCKET_AVATARS     = 'avatars';
process.env.S3_BUCKET_PRODUCTS    = 'products';
process.env.S3_ENDPOINT           = 'http://localhost:9000';
process.env.DYNAMODB_ENDPOINT     = 'http://localhost:8000';
process.env.STRIPE_SECRET_KEY     = 'sk_test_dummy';