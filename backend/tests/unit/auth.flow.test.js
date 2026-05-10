import { loginUser, signupUser, logoutUser, forgotPassword } from '../../src/services/auth.service.js';
import { fetchOverview } from '../../src/services/account.service.js';
import request from 'supertest';

jest.mock('../../src/middleware/auth.middleware.js', () => ({
  requireAuth: (req, res, next) => {
    req.user = { userId: 'cognito-sub-u1', email: 'a@b.com', firstName: 'A' };
    next();
  },
}));

jest.mock('../../src/services/auth.service.js', () => ({
  loginUser:              jest.fn(),
  signupUser:             jest.fn(),
  logoutUser:             jest.fn(),
  refreshTokens:          jest.fn(),
  forgotPassword:         jest.fn(),
  confirmForgotPassword:  jest.fn(),
}));

jest.mock('../../src/services/account.service.js', () => ({
  fetchOverview:     jest.fn(),
  ensureUserProfile: jest.fn().mockResolvedValue(undefined),
}));

import app from '../../src/app.js';

describe('Auth / User Flow (mocked services)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('signup -> returns 201 and verification message', async () => {
    signupUser.mockResolvedValue({ message: 'Please check your email to verify your account before logging in.' });

    const res = await request(app)
      .post('/api/auth/signup')
      .send({ firstName: 'A', lastName: 'B', email: 'a@b.com', password: 'pw', termsConditions: true });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('message');
    expect(signupUser).toHaveBeenCalled();
  });

  it('login -> sets httpOnly cookies and returns user info (no tokens in body)', async () => {
    loginUser.mockResolvedValue({
      token:        'cognito-id-token',
      accessToken:  'cognito-access-token',
      refreshToken: 'cognito-refresh-token',
      userId:       null,
      email:        'x@y.com',
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'x@y.com', password: 'pw' });

    expect(res.status).toBe(200);

    // Tokens must be in httpOnly cookies, not the response body
    expect(res.body).not.toHaveProperty('token');
    expect(res.body).not.toHaveProperty('accessToken');
    expect(res.body).not.toHaveProperty('refreshToken');
    expect(res.body).toHaveProperty('email', 'x@y.com');

    const cookies = res.headers['set-cookie'] ?? [];
    expect(cookies.some(c => c.startsWith('id_token='))).toBe(true);
    expect(cookies.some(c => c.startsWith('access_token='))).toBe(true);
    expect(cookies.some(c => c.includes('HttpOnly'))).toBe(true);

    expect(loginUser).toHaveBeenCalledWith('x@y.com', 'pw');
  });

  it('GET /api/auth/me -> requires auth and returns user overview', async () => {
    fetchOverview.mockResolvedValue({ userId: 'cognito-sub-u1', email: 'a@b.com', firstName: 'A' });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer cognito-id-token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('email', 'a@b.com');
    expect(fetchOverview).toHaveBeenCalledWith('cognito-sub-u1');
  });

  it('POST /api/auth/forgot-password -> returns 200', async () => {
    forgotPassword.mockResolvedValue({ message: 'If an account with that email exists, a reset code has been sent.' });

    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'a@b.com' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
  });

  it('POST /api/auth/logout -> returns 200', async () => {
    logoutUser.mockResolvedValue();

    const res = await request(app)
      .post('/api/auth/logout')
      .set('x-access-token', 'cognito-access-token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
  });
});
