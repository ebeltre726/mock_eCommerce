// returnProcessor.test.js
//
// Unit tests for the return/refund lifecycle background processor.
//
// What is tested:
//   1. Pending returns older than the approval cutoff are moved to Approved
//   2. ConditionalCheckFailedException during approval is silently swallowed
//   3. Approved returns with a valid Stripe payment intent are refunded (Refunded status)
//   4. Non-retryable Stripe errors (charge_already_refunded, charge_disputed, etc.)
//      result in refund_failed status
//   5. Retryable Stripe errors (balance_insufficient) leave the return as Approved
//      so the next scheduled run will attempt it again
//   6. Returns whose parent order has no stripePaymentIntentId are skipped
//   7. Refund email is fired (fire-and-forget) on successful refund
//
// DynamoDB, Stripe, and the email service are fully mocked.

jest.mock('../../src/db/dynamoClient.js', () => ({
    dynamo: { send: jest.fn() },
}));

// Mock the Stripe constructor so we can control refunds.create per test.
// The factory attaches __mockCreate to the constructor for test access.
jest.mock('stripe', () => {
    const mockCreate = jest.fn();
    function MockStripe() {
        this.refunds = { create: mockCreate };
    }
    MockStripe.__mockCreate = mockCreate;
    return MockStripe;
});

jest.mock('../../src/services/email.service.js', () => ({
    sendOrderShipped:    jest.fn().mockResolvedValue(undefined),
    sendOrderDelivered:  jest.fn().mockResolvedValue(undefined),
    sendRefundProcessed: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@aws-sdk/client-ssm', () => ({
    SSMClient:           jest.fn(() => ({ send: jest.fn() })),
    GetParameterCommand: jest.fn(),
}));

import Stripe                      from 'stripe';
import { dynamo }                  from '../../src/db/dynamoClient.js';
import { sendRefundProcessed }     from '../../src/services/email.service.js';
import { handler }                 from '../../src/background/returnProcessor.js';
import { QueryCommand, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

// Stable reference to the shared mock create function
const mockStripeCreate = Stripe.__mockCreate;

// ── Helpers ───────────────────────────────────────────────────────────────────

const OLD_TIMESTAMP = new Date(Date.now() - 99_999_999).toISOString();

function makeReturn(status, returnId = 'r1', orderId = 'o1') {
    return {
        PK:           'USER#u1',
        SK:           `RETURN#${returnId}`,
        returnId,
        orderId,
        status,
        userEmail:    'buyer@test.com',
        userFullName: 'Jane Buyer',
        item:         'Lounge Chair',
        itemId:       'prod-1',
        createdAt:    OLD_TIMESTAMP,
        GSI1PK:       `RETURN#${status}`,
    };
}

function makeOrder(orderId = 'o1') {
    return {
        PK:                    'USER#u1',
        SK:                    `ORDER#${orderId}`,
        orderId,
        stripePaymentIntentId: 'pi_test_123',
        items: [{ productId: 'prod-1', name: 'Lounge Chair', price: 199.99, quantity: 1 }],
    };
}

// dynamo.send implementation for a scenario with one return and its parent order
function dynamoForReturn(returnItem, orderItem) {
    return (cmd) => {
        if (cmd instanceof QueryCommand) {
            // Only yield items for the right status bucket; all others are empty
            const pk = cmd.input?.ExpressionAttributeValues?.[':pk'];
            const expectedPk = `RETURN#${returnItem.status}`;
            return Promise.resolve({
                Items:            pk === expectedPk ? [returnItem] : [],
                LastEvaluatedKey: undefined,
            });
        }
        if (cmd instanceof GetCommand) {
            return Promise.resolve({ Item: orderItem });
        }
        return Promise.resolve({}); // UpdateCommand — succeed silently
    };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('returnProcessor — handler()', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Default: Stripe succeeds with a refund object
        mockStripeCreate.mockResolvedValue({ id: 're_test_success' });
    });

    // ── Phase 1: Pending → Approved ───────────────────────────────────────────

    it('moves a Pending return to Approved', async () => {
        const ret = makeReturn('Pending');
        dynamo.send.mockImplementation(dynamoForReturn(ret, makeOrder()));

        const result = await handler();

        expect(result.newlyApproved).toBe(1);

        const updateCalls = dynamo.send.mock.calls.filter(([cmd]) => cmd instanceof UpdateCommand);
        const approveCall = updateCalls.find(
            ([cmd]) => cmd.input?.ExpressionAttributeValues?.[':to'] === 'Approved',
        );
        expect(approveCall).toBeDefined();

        const vals = approveCall[0].input.ExpressionAttributeValues;
        expect(vals[':from']).toBe('Pending');
        expect(vals[':newGsi']).toBe('RETURN#Approved');
    });

    it('swallows ConditionalCheckFailedException during approval', async () => {
        const ret = makeReturn('Pending');

        dynamo.send.mockImplementation((cmd) => {
            if (cmd instanceof QueryCommand) {
                const pk = cmd.input?.ExpressionAttributeValues?.[':pk'];
                return Promise.resolve({
                    Items:            pk === 'RETURN#Pending' ? [ret] : [],
                    LastEvaluatedKey: undefined,
                });
            }
            if (cmd instanceof UpdateCommand) {
                const err = new Error('Condition check failed');
                err.name = 'ConditionalCheckFailedException';
                return Promise.reject(err);
            }
            return Promise.resolve({});
        });

        const result = await handler();
        expect(result.newlyApproved).toBe(0); // Not counted — already handled
    });

    // ── Phase 2: Approved → Refunded ─────────────────────────────────────────

    it('refunds an Approved return and marks it Refunded', async () => {
        const ret = makeReturn('Approved');
        dynamo.send.mockImplementation(dynamoForReturn(ret, makeOrder()));
        mockStripeCreate.mockResolvedValue({ id: 're_test_abc' });

        const result = await handler();

        expect(result.refunded).toBe(1);
        expect(result.failed).toBe(0);

        // Stripe called with the order's payment intent
        expect(mockStripeCreate).toHaveBeenCalledWith(
            expect.objectContaining({ payment_intent: 'pi_test_123' }),
            expect.objectContaining({ idempotencyKey: 'refund-r1' }),
        );

        // DynamoDB updated to Refunded
        const updateCalls = dynamo.send.mock.calls.filter(([cmd]) => cmd instanceof UpdateCommand);
        const refundedCall = updateCalls.find(
            ([cmd]) => cmd.input?.ExpressionAttributeValues?.[':to'] === 'Refunded',
        );
        expect(refundedCall).toBeDefined();
        const vals = refundedCall[0].input.ExpressionAttributeValues;
        expect(vals[':newGsi']).toBe('RETURN#Refunded');
        expect(vals[':rid']).toBe('re_test_abc');
    });

    it('derives refund amount from the parent order item price', async () => {
        const ret = makeReturn('Approved');
        dynamo.send.mockImplementation(dynamoForReturn(ret, makeOrder()));

        await handler();

        // amount is in cents: 199.99 → 19999
        expect(mockStripeCreate).toHaveBeenCalledWith(
            expect.objectContaining({ amount: 19999 }),
            expect.anything(),
        );
    });

    it('sends the refund email on success', async () => {
        const ret = makeReturn('Approved');
        dynamo.send.mockImplementation(dynamoForReturn(ret, makeOrder()));

        await handler();

        // Allow the fire-and-forget promise to settle
        await Promise.resolve();

        expect(sendRefundProcessed).toHaveBeenCalledWith(
            expect.objectContaining({
                email:     'buyer@test.com',
                firstName: 'Jane', // derived from userFullName
                orderId:   'o1',
            }),
        );
    });

    // ── Non-retryable Stripe errors → refund_failed ───────────────────────────

    it.each([
        'charge_already_refunded',
        'charge_disputed',
        'payment_intent_unexpected_state',
        'payment_intent_incompatible_payment_method',
    ])('marks refund_failed for non-retryable Stripe error: %s', async (code) => {
        const ret = makeReturn('Approved');
        dynamo.send.mockImplementation(dynamoForReturn(ret, makeOrder()));

        const stripeErr = new Error(`Stripe error: ${code}`);
        stripeErr.code = code;
        mockStripeCreate.mockRejectedValue(stripeErr);

        const result = await handler();

        expect(result.failed).toBe(1);
        expect(result.refunded).toBe(0);

        const updateCalls = dynamo.send.mock.calls.filter(([cmd]) => cmd instanceof UpdateCommand);
        const failedCall = updateCalls.find(
            ([cmd]) => cmd.input?.ExpressionAttributeValues?.[':to'] === 'refund_failed',
        );
        expect(failedCall).toBeDefined();

        const vals = failedCall[0].input.ExpressionAttributeValues;
        expect(vals[':reason']).toBe(code);
        expect(vals[':newGsi']).toBe('RETURN#refund_failed');
    });

    // ── Retryable Stripe errors → leave as Approved ───────────────────────────

    it.each(['balance_insufficient', 'insufficient_funds'])(
        'leaves return as Approved for retryable Stripe error: %s',
        async (code) => {
            const ret = makeReturn('Approved');
            dynamo.send.mockImplementation(dynamoForReturn(ret, makeOrder()));

            const stripeErr = new Error(`Stripe error: ${code}`);
            stripeErr.code = code;
            mockStripeCreate.mockRejectedValue(stripeErr);

            const result = await handler();

            // Not counted as failed — will retry next run
            expect(result.failed).toBe(0);
            expect(result.refunded).toBe(0);

            // DynamoDB must NOT have received a refund_failed update
            const updateCalls = dynamo.send.mock.calls.filter(([cmd]) => cmd instanceof UpdateCommand);
            const failedCall = updateCalls.find(
                ([cmd]) => cmd.input?.ExpressionAttributeValues?.[':to'] === 'refund_failed',
            );
            expect(failedCall).toBeUndefined();
        },
    );

    // ── Missing payment intent ────────────────────────────────────────────────

    it('skips refund when the parent order has no stripePaymentIntentId', async () => {
        const ret = makeReturn('Approved');
        const orderWithoutIntent = { ...makeOrder(), stripePaymentIntentId: undefined };
        dynamo.send.mockImplementation(dynamoForReturn(ret, orderWithoutIntent));

        const result = await handler();

        expect(mockStripeCreate).not.toHaveBeenCalled();
        expect(result.refunded).toBe(0);
        expect(result.failed).toBe(0);
    });

    it('skips refund when the GetCommand returns no order', async () => {
        const ret = makeReturn('Approved');

        dynamo.send.mockImplementation((cmd) => {
            if (cmd instanceof QueryCommand) {
                const pk = cmd.input?.ExpressionAttributeValues?.[':pk'];
                return Promise.resolve({
                    Items:            pk === 'RETURN#Approved' ? [ret] : [],
                    LastEvaluatedKey: undefined,
                });
            }
            if (cmd instanceof GetCommand) {
                return Promise.resolve({ Item: undefined }); // order not found
            }
            return Promise.resolve({});
        });

        const result = await handler();

        expect(mockStripeCreate).not.toHaveBeenCalled();
        expect(result.refunded).toBe(0);
    });

    // ── Unknown Stripe errors → refund_failed ─────────────────────────────────

    it('marks refund_failed with reason "stripe_error" for unclassified Stripe errors', async () => {
        const ret = makeReturn('Approved');
        dynamo.send.mockImplementation(dynamoForReturn(ret, makeOrder()));

        const stripeErr = new Error('Something unexpected');
        stripeErr.code = 'api_connection_error'; // not in either code set
        mockStripeCreate.mockRejectedValue(stripeErr);

        const result = await handler();

        expect(result.failed).toBe(1);

        const updateCalls = dynamo.send.mock.calls.filter(([cmd]) => cmd instanceof UpdateCommand);
        const failedCall = updateCalls.find(
            ([cmd]) => cmd.input?.ExpressionAttributeValues?.[':to'] === 'refund_failed',
        );
        expect(failedCall).toBeDefined();
        expect(failedCall[0].input.ExpressionAttributeValues[':reason']).toBe('stripe_error');
    });
});
