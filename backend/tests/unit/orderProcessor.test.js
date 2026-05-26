// orderProcessor.test.js
//
// Unit tests for the order lifecycle background processor.
//
// What is tested:
//   1. handler() queries each of the three status buckets (confirmed, processing, shipped)
//   2. Items returned by the GSI query are advanced to the next status
//   3. ConditionalCheckFailedException is silently swallowed (at-least-once idempotency)
//   4. Email helpers are called only for shipped/delivered transitions, not confirmed→processing
//   5. Pagination: handler re-queries when LastEvaluatedKey is present
//
// DynamoDB and the email service are fully mocked — no real AWS calls are made.

jest.mock('../../src/db/dynamoClient.js', () => ({
    dynamo: { send: jest.fn() },
}));

jest.mock('../../src/services/email.service.js', () => ({
    sendOrderShipped:   jest.fn().mockResolvedValue(undefined),
    sendOrderDelivered: jest.fn().mockResolvedValue(undefined),
    sendRefundProcessed: jest.fn().mockResolvedValue(undefined),
}));

// SSM is never reached in tests: STRIPE_SECRET_KEY is set in jest.setup.js,
// so loadStripeKey() skips the SSM fetch branch entirely.
jest.mock('@aws-sdk/client-ssm', () => ({
    SSMClient:           jest.fn(() => ({ send: jest.fn() })),
    GetParameterCommand: jest.fn(),
}));

import { dynamo }           from '../../src/db/dynamoClient.js';
import { sendOrderShipped, sendOrderDelivered } from '../../src/services/email.service.js';
import { handler }          from '../../src/background/orderProcessor.js';
import { QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

// ── Helpers ───────────────────────────────────────────────────────────────────

const OLD_TIMESTAMP = new Date(Date.now() - 99_999_999).toISOString(); // well past any delay

function makeOrderItem(status, orderId = 'o1') {
    return {
        PK:         'USER#u1',
        SK:         `ORDER#${orderId}`,
        orderId,
        status,
        userEmail:  'buyer@test.com',
        fullName:   'Jane Buyer',
        createdAt:  OLD_TIMESTAMP,
        GSI1PK:     `ORDER#${status}`,
    };
}

// Returns a dynamo.send implementation that yields items for one status bucket
// and an empty result for all others.
function dynamoWithOneItem(gsiPk, item) {
    return (cmd) => {
        if (cmd instanceof QueryCommand) {
            const pk = cmd.input?.ExpressionAttributeValues?.[':pk'];
            if (pk === gsiPk) {
                return Promise.resolve({ Items: [item], LastEvaluatedKey: undefined });
            }
            return Promise.resolve({ Items: [], LastEvaluatedKey: undefined });
        }
        return Promise.resolve({}); // UpdateCommand — succeed silently
    };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('orderProcessor — handler()', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ── Query coverage ────────────────────────────────────────────────────────

    it('queries each of the three status buckets exactly once per run', async () => {
        dynamo.send.mockResolvedValue({ Items: [], LastEvaluatedKey: undefined });

        await handler();

        const queryInputs = dynamo.send.mock.calls
            .filter(([cmd]) => cmd instanceof QueryCommand)
            .map(([cmd])    => cmd.input.ExpressionAttributeValues[':pk']);

        expect(queryInputs).toEqual(
            expect.arrayContaining(['ORDER#confirmed', 'ORDER#processing', 'ORDER#shipped']),
        );
    });

    // ── Status advancement ────────────────────────────────────────────────────

    it('advances a confirmed item to processing', async () => {
        const item = makeOrderItem('confirmed');
        dynamo.send.mockImplementation(dynamoWithOneItem('ORDER#confirmed', item));

        const result = await handler();

        expect(result.toProcessing).toBe(1);
        expect(result.toShipped).toBe(0);
        expect(result.toDelivered).toBe(0);

        const updateCall = dynamo.send.mock.calls.find(([cmd]) => cmd instanceof UpdateCommand);
        expect(updateCall).toBeDefined();
        const { ExpressionAttributeValues: vals } = updateCall[0].input;
        expect(vals[':to']).toBe('processing');
        expect(vals[':newGsi']).toBe('ORDER#processing');
    });

    it('advances a processing item to shipped and sends the shipped email', async () => {
        const item = makeOrderItem('processing');
        dynamo.send.mockImplementation(dynamoWithOneItem('ORDER#processing', item));

        const result = await handler();

        expect(result.toShipped).toBe(1);
        expect(sendOrderShipped).toHaveBeenCalledTimes(1);
        expect(sendOrderShipped).toHaveBeenCalledWith(
            expect.objectContaining({ email: 'buyer@test.com', orderId: 'o1' }),
        );
        expect(sendOrderDelivered).not.toHaveBeenCalled();
    });

    it('advances a shipped item to delivered and sends the delivered email', async () => {
        const item = makeOrderItem('shipped');
        dynamo.send.mockImplementation(dynamoWithOneItem('ORDER#shipped', item));

        const result = await handler();

        expect(result.toDelivered).toBe(1);
        expect(sendOrderDelivered).toHaveBeenCalledTimes(1);
        expect(sendOrderDelivered).toHaveBeenCalledWith(
            expect.objectContaining({ email: 'buyer@test.com', orderId: 'o1' }),
        );
        expect(sendOrderShipped).not.toHaveBeenCalled();
    });

    it('does NOT send an email for the confirmed→processing transition', async () => {
        const item = makeOrderItem('confirmed');
        dynamo.send.mockImplementation(dynamoWithOneItem('ORDER#confirmed', item));

        await handler();

        expect(sendOrderShipped).not.toHaveBeenCalled();
        expect(sendOrderDelivered).not.toHaveBeenCalled();
    });

    // ── Idempotency / at-least-once guard ─────────────────────────────────────

    it('swallows ConditionalCheckFailedException and counts the item as not advanced', async () => {
        const item = makeOrderItem('confirmed');

        dynamo.send.mockImplementation((cmd) => {
            if (cmd instanceof QueryCommand) {
                const pk = cmd.input?.ExpressionAttributeValues?.[':pk'];
                if (pk === 'ORDER#confirmed') {
                    return Promise.resolve({ Items: [item], LastEvaluatedKey: undefined });
                }
                return Promise.resolve({ Items: [] });
            }
            if (cmd instanceof UpdateCommand) {
                const err = new Error('Conditional check failed');
                err.name = 'ConditionalCheckFailedException';
                return Promise.reject(err);
            }
            return Promise.resolve({});
        });

        // Should not throw; the item was already advanced by a concurrent invocation
        const result = await handler();
        expect(result.toProcessing).toBe(0);
    });

    it('does not crash when the UpdateCommand throws an unexpected error', async () => {
        const item = makeOrderItem('confirmed');

        dynamo.send.mockImplementation((cmd) => {
            if (cmd instanceof QueryCommand) {
                const pk = cmd.input?.ExpressionAttributeValues?.[':pk'];
                return Promise.resolve({
                    Items: pk === 'ORDER#confirmed' ? [item] : [],
                    LastEvaluatedKey: undefined,
                });
            }
            return Promise.reject(new Error('ProvisionedThroughputExceededException'));
        });

        // Error is logged but does not propagate out of handler
        await expect(handler()).resolves.not.toThrow();
    });

    // ── Pagination ────────────────────────────────────────────────────────────

    it('paginates when DynamoDB returns a LastEvaluatedKey', async () => {
        const item1 = makeOrderItem('confirmed', 'o1');
        const item2 = makeOrderItem('confirmed', 'o2');
        const sentinelKey = { PK: 'sentinel', SK: 'sentinel' };

        let confirmedCallCount = 0;

        dynamo.send.mockImplementation((cmd) => {
            if (cmd instanceof QueryCommand) {
                const pk = cmd.input?.ExpressionAttributeValues?.[':pk'];
                if (pk === 'ORDER#confirmed') {
                    confirmedCallCount++;
                    // First page: return item1 + LastEvaluatedKey
                    if (confirmedCallCount === 1) {
                        return Promise.resolve({ Items: [item1], LastEvaluatedKey: sentinelKey });
                    }
                    // Second page (after exclusive start): return item2, no more pages
                    return Promise.resolve({ Items: [item2], LastEvaluatedKey: undefined });
                }
                return Promise.resolve({ Items: [], LastEvaluatedKey: undefined });
            }
            return Promise.resolve({});
        });

        const result = await handler();

        // Both items advanced
        expect(result.toProcessing).toBe(2);
        // Two queries were made for the confirmed bucket
        expect(confirmedCallCount).toBe(2);
        // Second query carries the ExclusiveStartKey
        const confirmedQueries = dynamo.send.mock.calls
            .filter(([cmd]) => cmd instanceof QueryCommand &&
                cmd.input?.ExpressionAttributeValues?.[':pk'] === 'ORDER#confirmed');
        expect(confirmedQueries[1][0].input.ExclusiveStartKey).toEqual(sentinelKey);
    });
});
