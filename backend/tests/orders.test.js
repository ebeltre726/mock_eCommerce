// tests/orders.test.js
import request from "supertest";
import app from "../src/app.js";
import { dynamo } from "../src/db/dynamoClient.js";
import { seedUser, recreateTable, seedProducts } from "../seed.js";

describe("Orders Flow", () => {
  const testUser = { userId: "u002", email: "order@example.com", password: "pass123" };
  let token, orderId;

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    await recreateTable();
    await seedUser(); // seed default user
    await seedProducts();
    await seedUser(testUser);
    const loginRes = await request(app).post("/api/auth/login").send(testUser);
    token = loginRes.body.token;
  });

  it("should create an order", async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ fullName: 'Test User', shippingAddress: { street: '1 Test St', city: 'Testville', state: 'TS', postal: '00000' }, items: [{ productId: "chair-1", quantity: 2 }] });

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
    expect(res.body).toEqual(expect.arrayContaining([expect.objectContaining({ orderId })]));
  });
});