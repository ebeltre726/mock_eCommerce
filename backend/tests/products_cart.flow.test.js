import request from 'supertest';

// Mock services before importing app
jest.mock('../src/services/products.service.js', () => ({
  fetchAllProducts: jest.fn(),
  fetchProductById: jest.fn(),
}));

jest.mock('../src/services/cart.service.js', () => ({
  getCart: jest.fn(),
  addToCart: jest.fn(),
  removeFromCart: jest.fn(),
  clearCart: jest.fn(),
}));

jest.mock('../src/services/auth.service.js', () => ({
  verifyToken: jest.fn(),
}));

import app from '../src/app.js';
import { fetchAllProducts, fetchProductById } from '../src/services/products.service.js';
import { getCart, addToCart, removeFromCart, clearCart } from '../src/services/cart.service.js';
import { verifyToken } from '../src/services/auth.service.js';

describe('Products + Cart Flow (mocked services)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('GET /api/products -> returns product list', async () => {
    const products = [{ id: 'p1', name: 'Chair' }];
    fetchAllProducts.mockResolvedValue(products);

    const res = await request(app).get('/api/products');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(products);
    expect(fetchAllProducts).toHaveBeenCalled();
  });

  it('GET /api/products/:id -> returns single product or 404', async () => {
    fetchProductById.mockResolvedValue({ id: 'p1', name: 'Chair' });

    const res = await request(app).get('/api/products/p1');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', 'p1');
  });

  it('Cart endpoints require auth and operate correctly', async () => {
    // authorize as user
    verifyToken.mockReturnValue({ userId: 'u1' });

    getCart.mockResolvedValue([{ productId: 'p1', quantity: 2 }]);
    addToCart.mockResolvedValue({ productId: 'p1', quantity: 2 });
    removeFromCart.mockResolvedValue({ productId: 'p1', quantity: 1 });
    clearCart.mockResolvedValue(undefined);

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
