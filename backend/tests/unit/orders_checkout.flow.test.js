import request from 'supertest';

jest.mock('../../src/middleware/auth.middleware.js', () => ({
  requireAuth: (req, res, next) => {
    req.user = { userId: 'u1', email: 'test@example.com' };
    next();
  },
  optionalAuth: jest.fn((req, res, next) => {
    req.user = { userId: 'u1', email: 'test@example.com' };
    next();
  }),
}));

import app from '../../src/app.js';
import * as ordersService from '../../src/services/orders.service.js';
import { optionalAuth } from '../../src/middleware/auth.middleware.js';

describe('Orders / Checkout Flow (mocked services)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('GET /api/orders -> returns paginated orders envelope', async () => {
    jest.spyOn(ordersService, 'fetchOrders').mockResolvedValue({
      orders: [{ orderId: 'o1', items: [] }],
      nextCursor: null,
    });

    const res = await request(app).get('/api/orders').set('Authorization', 'Bearer tok');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('orders');
    expect(res.body.orders[0]).toHaveProperty('orderId', 'o1');
    expect(res.body.nextCursor).toBeNull();
  });

  it('GET /api/orders -> forwards cursor query param to service', async () => {
    jest.spyOn(ordersService, 'fetchOrders').mockResolvedValue({
      orders: [],
      nextCursor: null,
    });

    await request(app).get('/api/orders?cursor=abc123').set('Authorization', 'Bearer tok');
    expect(ordersService.fetchOrders).toHaveBeenCalledWith('u1', 'abc123');
  });

  it('GET /api/orders/:orderId -> returns single order or 404', async () => {
    jest.spyOn(ordersService, 'fetchOrder').mockResolvedValue({ orderId: 'o1', items: [] });

    const res = await request(app).get('/api/orders/o1').set('Authorization', 'Bearer tok');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('orderId', 'o1');
  });

  it('POST /api/orders -> creates order and returns 201', async () => {
    const mockOrder = { orderId: 'o123', status: 'confirmed', totalAmount: 99.99 };
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

  it('POST /api/orders -> guest checkout with guestEmail creates order', async () => {
    optionalAuth.mockImplementationOnce((req, _res, next) => {
      req.user = null;
      next();
    });

    const mockOrder = { orderId: 'g001', status: 'confirmed', totalAmount: 39.99 };
    jest.spyOn(ordersService, 'createOrder').mockResolvedValue(mockOrder);

    const res = await request(app).post('/api/orders').send({
      fullName:     'Guest User',
      guestEmail:   'guest@example.com',
      shippingAddress: { line1: '1 Main St', city: 'NY', state: 'NY', zip: '10001' },
      items: [{ productId: 'p1', quantity: 1 }],
    });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('orderId', 'g001');
    expect(ordersService.createOrder).toHaveBeenCalledWith(
      expect.stringMatching(/^guest-/),
      'guest@example.com',
      expect.objectContaining({ fullName: 'Guest User' }),
    );
  });

  it('POST /api/orders -> guest checkout without guestEmail returns 400', async () => {
    optionalAuth.mockImplementationOnce((req, _res, next) => {
      req.user = null;
      next();
    });

    const res = await request(app).post('/api/orders').send({
      fullName: 'Guest User',
      shippingAddress: { line1: '1 Main St', city: 'NY', state: 'NY', zip: '10001' },
      items: [{ productId: 'p1', quantity: 1 }],
    });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});
