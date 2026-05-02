import { loginUser, signupUser } from '../../src/services/auth.service.js';
import { fetchOverview } from '../../src/services/account.service.js';
import request from 'supertest';

jest.mock('../../src/middleware/auth.middleware.js', () => ({
  requireAuth: (req, res, next) => {
    req.user = { userId: 'u1', email: 'a@b.com' };
    next();
  },
}));

// Mock services before importing the app so controllers see the mocks
jest.mock('../../src/services/auth.service.js', () => ({
  loginUser: jest.fn(),
  signupUser: jest.fn(),
}));

jest.mock('../../src/services/account.service.js', () => ({
  fetchOverview: jest.fn(),
}));

import app from '../../src/app.js';


describe('Auth / User Flow (mocked services)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('signup -> returns 201 and token', async () => {
    signupUser.mockResolvedValue({ token: 'tok-sign', userId: 'u1', email: 'a@b.com', firstName: 'A' });

    const res = await request(app)
      .post('/api/auth/signup')
      .send({ firstName: 'A', lastName: 'B', email: 'a@b.com', password: 'pw', termsConditions: true });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token', 'tok-sign');
    expect(signupUser).toHaveBeenCalled();
  });

  it('login -> returns 200 and token', async () => {
    loginUser.mockResolvedValue({ token: 'tok-login', userId: 'u2', email: 'x@y.com', firstName: 'X' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'x@y.com', password: 'pw' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token', 'tok-login');
    expect(loginUser).toHaveBeenCalledWith('x@y.com', 'pw');
  });

  it('GET /api/auth/me -> requires auth and returns user overview', async () => {
    fetchOverview.mockResolvedValue({ userId: 'u1', email: 'a@b.com', firstName: 'A' });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer sometok');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('email', 'a@b.com');
    expect(fetchOverview).toHaveBeenCalledWith('u1');
  });
});
