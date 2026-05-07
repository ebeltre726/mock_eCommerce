import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import serverlessExpress from '@vendia/serverless-express';
import app from './src/app.js';

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

  _handler = serverlessExpress({ app });
  return _handler;
}

export const handler = async (event, context) => {
  const h = await getHandler();
  return h(event, context);
};
