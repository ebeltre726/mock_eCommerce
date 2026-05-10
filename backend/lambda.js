import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import serverlessExpress from '@vendia/serverless-express';
import app from './src/app.js';
import { verifier } from './src/middleware/auth.middleware.js';

// Resolved once per cold start; reused across warm invocations.
let _handler;

async function fetchSSMParameter(ssm, name) {
  const { Parameter } = await ssm.send(
    new GetParameterCommand({ Name: name, WithDecryption: true }),
  );
  return Parameter.Value;
}

async function getHandler() {
  if (_handler) return _handler;

  // Load all SSM-backed secrets in parallel at cold start so no plaintext
  // secrets are ever stored in Lambda environment variables.
  const ssm = new SSMClient({ region: process.env.AWS_REGION });
  await Promise.all([
    process.env.STRIPE_SECRET_SSM &&
      fetchSSMParameter(ssm, process.env.STRIPE_SECRET_SSM)
        .then(v => { process.env.STRIPE_SECRET_KEY = v; }),

    process.env.EMAILJS_PRIVATE_KEY_SSM &&
      fetchSSMParameter(ssm, process.env.EMAILJS_PRIVATE_KEY_SSM)
        .then(v => { process.env.EMAILJS_PRIVATE_KEY = v; }),
  ]);

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
