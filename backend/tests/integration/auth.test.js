/**
 * Auth integration tests.
 *
 * The Cognito SDK is mocked because Cognito is not available in CI.
 * DynamoDB (via local DynamoDB-local) is real — /me still exercises the full
 * database path.  The auth middleware is mocked so protected routes can be
 * tested without a real Cognito token.
 */
import request from 'supertest';
import app from '../../src/app.js';
import { seedUser, recreateTable, seedProducts } from '../../seed.js';

// ── Mock auth.middleware so protected routes inject a known user ──────────────
jest.mock('../../src/middleware/auth.middleware.js', () => ({
  requireAuth: (req, res, next) => {
    req.user = { userId: 'test001', email: 'test@example.com', firstName: 'Test' };
    next();
  },
}));

// ── Mock the Cognito SDK — not available in CI ────────────────────────────────
jest.mock('@aws-sdk/client-cognito-identity-provider', () => {
  const mockSend = jest.fn();

  class MockCognitoClient {
    send = mockSend;
  }

  return {
    CognitoIdentityProviderClient: MockCognitoClient,
    InitiateAuthCommand:            jest.fn(cmd => ({ _cmd: 'InitiateAuth', ...cmd })),
    SignUpCommand:                   jest.fn(cmd => ({ _cmd: 'SignUp', ...cmd })),
    ForgotPasswordCommand:           jest.fn(cmd => ({ _cmd: 'ForgotPassword', ...cmd })),
    ConfirmForgotPasswordCommand:    jest.fn(cmd => ({ _cmd: 'ConfirmForgotPassword', ...cmd })),
    GlobalSignOutCommand:            jest.fn(cmd => ({ _cmd: 'GlobalSignOut', ...cmd })),
    ChangePasswordCommand:           jest.fn(cmd => ({ _cmd: 'ChangePassword', ...cmd })),
    AdminDeleteUserCommand:          jest.fn(cmd => ({ _cmd: 'AdminDeleteUser', ...cmd })),
    NotAuthorizedException:          class NotAuthorizedException extends Error {},
    UserNotConfirmedException:       class UserNotConfirmedException extends Error {},
    UsernameExistsException:         class UsernameExistsException extends Error {},
    CodeMismatchException:           class CodeMismatchException extends Error {},
    ExpiredCodeException:            class ExpiredCodeException extends Error {},
    InvalidPasswordException:        class InvalidPasswordException extends Error {},
    LimitExceededException:          class LimitExceededException extends Error {},
  };
});

// Import after mocks are hoisted
import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';

const mockSend = new CognitoIdentityProviderClient().send;

describe('Auth Flow (integration)', () => {
  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    await recreateTable();
    await seedUser({ userId: 'test001', email: 'test@example.com', firstName: 'Test', lastName: 'User' });
    await seedProducts();
  });

  beforeEach(() => {
    mockSend.mockReset();
  });

  it('POST /api/auth/login -> sets httpOnly cookies and returns user info (no tokens in body)', async () => {
    mockSend.mockResolvedValue({
      AuthenticationResult: {
        IdToken:      'mock-id-token',
        AccessToken:  'mock-access-token',
        RefreshToken: 'mock-refresh-token',
      },
    });

    const res = await request(app).post('/api/auth/login').send({
      email:    'test@example.com',
      password: 'Password1!',
    });

    expect(res.statusCode).toBe(200);

    // Tokens must be in httpOnly cookies, not the response body
    expect(res.body).not.toHaveProperty('token');
    expect(res.body).not.toHaveProperty('accessToken');
    expect(res.body).not.toHaveProperty('refreshToken');
    expect(res.body).toHaveProperty('email', 'test@example.com');

    const cookies = res.headers['set-cookie'] ?? [];
    expect(cookies.some(c => c.startsWith('id_token='))).toBe(true);
    expect(cookies.some(c => c.startsWith('access_token='))).toBe(true);
    expect(cookies.some(c => c.includes('HttpOnly'))).toBe(true);

    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('POST /api/auth/login -> returns 401 on bad credentials', async () => {
    const { NotAuthorizedException } = await import('@aws-sdk/client-cognito-identity-provider');
    mockSend.mockRejectedValue(new NotAuthorizedException('Incorrect credentials'));

    const res = await request(app).post('/api/auth/login').send({
      email:    'test@example.com',
      password: 'wrong-password',
    });

    expect(res.statusCode).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('GET /api/auth/me -> returns user profile from DynamoDB (real DB, mocked middleware)', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer mock-id-token');

    expect(res.statusCode).toBe(200);
    expect(res.body.email).toBe('test@example.com');
  });

  it('POST /api/auth/signup -> calls Cognito SignUp and returns verification message', async () => {
    mockSend.mockResolvedValue({});

    const res = await request(app).post('/api/auth/signup').send({
      firstName:       'New',
      lastName:        'User',
      email:           'new@example.com',
      password:        'Password1!',
      termsConditions: true,
    });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('message');
    expect(res.body.message).toMatch(/email/i);
  });

  it('POST /api/auth/forgot-password -> calls Cognito ForgotPassword', async () => {
    mockSend.mockResolvedValue({});

    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'test@example.com' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('message');
  });
});
