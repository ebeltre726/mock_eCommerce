import request from 'supertest';

jest.mock('../../src/middleware/auth.middleware.js', () => ({
  requireAuth: (req, res, next) => {
    req.user = { userId: 'u1', email: 'test@example.com' };
    next();
  },
  optionalAuth: (req, res, next) => {
    req.user = { userId: 'u1', email: 'test@example.com' };
    next();
  },
}));

import app from '../../src/app.js';
import * as productsService from '../../src/services/products.service.js';
import * as cartService from '../../src/services/cart.service.js';

describe('Products + Cart Flow (mocked services)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('GET /api/products -> returns paginated product list', async () => {
    const items = [{ id: 'p1', name: 'Chair' }];
    jest.spyOn(productsService, 'fetchProductsPage').mockResolvedValue({ items, nextCursor: null });

    const res = await request(app).get('/api/products');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items, nextCursor: null });
    expect(productsService.fetchProductsPage).toHaveBeenCalled();
  });

  it('GET /api/products/:id -> returns single product or 404', async () => {
    jest.spyOn(productsService, 'fetchProductById').mockResolvedValue({ id: 'p1', name: 'Chair' });

    const res = await request(app).get('/api/products/p1');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', 'p1');
  });

  it('Cart endpoints require auth and operate correctly', async () => {
    jest.spyOn(cartService, 'getCart').mockResolvedValue([{ productId: 'p1', quantity: 2 }]);
    jest.spyOn(cartService, 'addToCart').mockResolvedValue({ productId: 'p1', quantity: 2 });
    jest.spyOn(cartService, 'removeFromCart').mockResolvedValue({ productId: 'p1', quantity: 1 });
    jest.spyOn(cartService, 'clearCart').mockResolvedValue(undefined);

    const tokenHeader = { Authorization: 'Bearer tok' };

    const getRes = await request(app).get('/api/cart').set(tokenHeader);
    expect(getRes.status).toBe(200);
    expect(getRes.body).toEqual([{ productId: 'p1', quantity: 2 }]);

    const addRes = await request(app).post('/api/cart/add').set(tokenHeader).send({ productId: 'p1', quantity: 2 });
    expect(addRes.status).toBe(200);
    expect(addRes.body).toHaveProperty('productId', 'p1');

    const remRes = await request(app).post('/api/cart/remove').set(tokenHeader).send({ productId: 'p1', quantity: 1 });
    expect(remRes.status).toBe(200);
    expect(remRes.body).toHaveProperty('quantity', 1);

    const clrRes = await request(app).delete('/api/cart/clear').set(tokenHeader);
    expect(clrRes.status).toBe(200);
    expect(clrRes.body).toHaveProperty('success', true);
  });
});
