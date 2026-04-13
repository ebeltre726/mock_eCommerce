import request from 'supertest';

jest.mock('../../src/middleware/auth.middleware.js', () => ({
  requireAuth: (req, res, next) => {
    req.user = { userId: 'u1', email: 'test@example.com' };
    next();
  },
}));

import app from '../../src/app.js';
import * as ordersService from '../../src/services/orders.service.js';

describe('Orders / Checkout Flow (mocked services)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('GET /api/orders -> returns list of orders', async () => {
    jest.spyOn(ordersService, 'fetchOrders').mockResolvedValue([{ orderId: 'o1', items: [] }]);

    const res = await request(app).get('/api/orders').set('Authorization', 'Bearer tok');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ orderId: 'o1', items: [] }]);
  });

  it('GET /api/orders/:orderId -> returns single order or 404', async () => {
    jest.spyOn(ordersService, 'fetchOrder').mockResolvedValue({ orderId: 'o1', items: [] });

    const res = await request(app).get('/api/orders/o1').set('Authorization', 'Bearer tok');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('orderId', 'o1');
  });

  it('POST /api/orders -> creates order and returns 201', async () => {
    const mockOrder = { orderId: 'o123', fullName: 'Jane Doe', addressId: 'addr1', items: [{ productId: 'p1', quantity: 1 }], paymentMethodId: 'demo' };
    jest.spyOn(ordersService, 'createOrder').mockResolvedValue(mockOrder);

    const payload = {
      fullName: 'Jane Doe',
      addressId: 'addr1',
      items: [{ productId: 'p1', quantity: 1 }],
    };

    const res = await request(app).post('/api/orders').set('Authorization', 'Bearer tok').send(payload);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('orderId', 'o123');
    expect(ordersService.createOrder).toHaveBeenCalled();
  });

  it('POST /api/orders -> returns 400 when required fields missing', async () => {
    const res = await request(app).post('/api/orders').set('Authorization', 'Bearer tok').send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});
