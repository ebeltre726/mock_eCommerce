// tests/orders.test.js
import request from "supertest";
import app from "../../src/app.js";
import { dynamo } from "../../src/db/dynamoClient.js";
import { seedUser, recreateTable, seedProducts } from "../../seed.js";

// Cognito not available in CI — bypass token validation and inject user directly
jest.mock("../../src/middleware/auth.middleware.js", () => ({
  requireAuth: (req, _res, next) => {
    req.user = { userId: "u002", email: "order@example.com", firstName: "Order" };
    next();
  },
}));

describe("Orders Flow", () => {
  const testUser = { userId: "u002", email: "order@example.com" };
  let token, orderId;

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    await recreateTable();
    await seedUser();
    await seedProducts();
    await seedUser(testUser);
    token = "test-token"; // middleware is mocked — any string passes
  });

  it("should create an order", async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ fullName: 'Test User', addressId: 'default', items: [{ productId: "chair-1", quantity: 2, price: 39.99 }] });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("orderId");
    orderId = res.body.orderId;
  });

  it("should get the order by ID", async () => {
    const res = await request(app)
      .get(`/api/orders/${orderId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.orderId).toBe(orderId);
  });

  it("should list all orders", async () => {
    const res = await request(app)
      .get("/api/orders")
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.orders).toEqual(expect.arrayContaining([expect.objectContaining({ orderId })]));
  });
});
