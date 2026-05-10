import { randomUUID } from 'crypto';
import { traceStore } from '../utils/logger.js';

// Extracts the Lambda/API Gateway trace ID from the X-Amzn-Trace-Id header
// and stores it in AsyncLocalStorage for the duration of the request.
// Falls back to a generated UUID in local dev where the header is absent.
export function tracingMiddleware(req, res, next) {
    const awsTrace = req.headers['x-amzn-trace-id'];
    // Lambda sets "Root=1-...;Parent=...;Sampled=1" — the Root segment is the
    // stable per-request identifier we want in logs.
    const traceId = awsTrace
        ? (awsTrace.match(/Root=([^;]+)/)?.[1] ?? awsTrace)
        : randomUUID();

    res.setHeader('X-Trace-Id', traceId);
    traceStore.run({ traceId }, next);
}
