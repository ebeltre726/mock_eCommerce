import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import serverlessExpress from '@vendia/serverless-express';
import app from './src/app.js';
import { verifier } from './src/middleware/auth.middleware.js';

// Resolved once per cold start; reused across warm invocations.
let _handler;

async function getHandler() {
  if (_handler) return _handler;

  if (process.env.STRIPE_SECRET_SSM) {
    const ssm = new SSMClient({ region: process.env.AWS_REGION });
    const { Parameter } = await ssm.send(
      new GetParameterCommand({ Name: process.env.STRIPE_SECRET_SSM, WithDecryption: true })
    );
    process.env.STRIPE_SECRET_KEY = Parameter.Value;
  }

  // Pre-warm the Cognito JWKS cache during cold start so the first
  // authenticated request doesn't pay the ~100ms JWKS fetch latency.
  // The dummy token will fail verification — that's expected and ignored.
  await verifier.verify('warmup').catch(() => {});

  _handler = serverlessExpress({ app });
  return _handler;
}

export const handler = async (event, context) => {
  const h = await getHandler();
  return h(event, context);
};
