import serverlessExpress from '@vendia/serverless-express';
import app from './src/app.js';

// Cached across warm Lambda invocations
export const handler = serverlessExpress({ app });
