import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// Read directly from process.env rather than through env.js so that the background
// processor Lambdas (orderProcessor, returnProcessor) can import this module without
// triggering env.js's strict startup guards for vars they don't need (S3, Cognito, etc.).
// AWS_REGION is always present in a Lambda execution environment.
const client = new DynamoDBClient({
    region: process.env.AWS_REGION,
    ...(process.env.DYNAMODB_ENDPOINT && {
        endpoint: process.env.DYNAMODB_ENDPOINT,
        // DynamoDB Local requires non-empty credentials but doesn't validate them.
        // Do not use real keys here — SSO/IAM handles production auth via the SDK provider chain.
        credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
    }),
});

export const dynamo = DynamoDBDocumentClient.from(client);

const RETRYABLE = new Set([
    'ProvisionedThroughputExceededException',
    'RequestLimitExceeded',
    'ThrottlingException',
]);

export async function sendWithRetry(command, maxRetries = 3) {
    let lastErr;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await dynamo.send(command);
        } catch (err) {
            if (RETRYABLE.has(err.name)) {
                const delay = Math.pow(2, i) * 100; // 100ms, 200ms, 400ms
                await new Promise(r => setTimeout(r, delay));
                lastErr = err;
            } else {
                throw err;
            }
        }
    }
    throw lastErr;
}