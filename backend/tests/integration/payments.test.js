// tests/payments.test.js
import request from "supertest";
import app from "../../src/app.js";
import { dynamo } from "../../src/db/dynamoClient.js";
import { seedUser, recreateTable, seedProducts } from "../../seed.js";

describe("Payments Flow", () => {
  const testUser = { userId: "u003", email: "pay@example.com", password: "pass123" };
  let token, paymentId;

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

  it("should add a payment method", async () => {
    const res = await request(app)
      .post("/api/account/payment")
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "card", cardNumber: "424242424242" });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("paymentId");
    paymentId = res.body.paymentId;
  });

  it("should update payment method", async () => {
    const res = await request(app)
      .patch(`/api/account/payment/${paymentId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ expiry: '12/30' });

    expect(res.statusCode).toBe(200);
  });

  it("should delete payment method", async () => {
    const res = await request(app)
      .delete(`/api/account/payment/${paymentId}`)
      .set("Authorization", `Bearer ${token}`);
    // controller returns 204 on successful delete
    expect(res.statusCode).toBe(204);
  });
});
