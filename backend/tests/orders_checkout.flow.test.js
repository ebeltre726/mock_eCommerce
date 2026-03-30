import request from 'supertest';

// Mock orders and auth services before importing app
jest.mock('../src/services/orders.service.js', () => ({
  fetchOrders: jest.fn(),
  fetchOrder: jest.fn(),
  createOrder: jest.fn(),
}));

jest.mock('../src/services/auth.service.js', () => ({
  verifyToken: jest.fn(),
}));

import app from '../src/app.js';
import { fetchOrders, fetchOrder, createOrder } from '../src/services/orders.service.js';
import { verifyToken } from '../src/services/auth.service.js';

describe('Orders / Checkout Flow (mocked services)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('GET /api/orders -> returns list of orders', async () => {
    verifyToken.mockReturnValue({ userId: 'u1' });
    fetchOrders.mockResolvedValue([{ orderId: 'o1', items: [] }]);

    const res = await request(app).get('/api/orders').set('Authorization', 'Bearer tok');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ orderId: 'o1', items: [] }]);
  });

  it('GET /api/orders/:orderId -> returns single order or 404', async () => {
    verifyToken.mockReturnValue({ userId: 'u1' });
    fetchOrder.mockResolvedValue({ orderId: 'o1', items: [] });

    const res = await request(app).get('/api/orders/o1').set('Authorization', 'Bearer tok');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('orderId', 'o1');
  });

  it('POST /api/orders -> creates order and returns 201', async () => {
    verifyToken.mockReturnValue({ userId: 'u1' });

    const mockOrder = { orderId: 'o123', items: [{ productId: 'p1', quantity: 1 }], paymentMethod: 'demo' };
    createOrder.mockResolvedValue(mockOrder);

    const payload = {
      fullName: 'Jane Doe',
      shippingAddress: { street: '1 Main', city: 'X', state: 'S', postal: '12345' },
      items: [{ productId: 'p1', quantity: 1 }],
    };

    const res = await request(app).post('/api/orders').set('Authorization', 'Bearer tok').send(payload);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('orderId', 'o123');
    expect(createOrder).toHaveBeenCalled();
  });

  it('POST /api/orders -> returns 400 when required fields missing', async () => {
    verifyToken.mockReturnValue({ userId: 'u1' });

    const res = await request(app).post('/api/orders').set('Authorization', 'Bearer tok').send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});
