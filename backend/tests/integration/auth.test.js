// tests/auth.test.js
import request from "supertest";
import app from "../../src/app.js"; // your Express app
import { dynamo } from "../../src/db/dynamoClient.js";
import { seedUser, recreateTable, seedProducts } from "../../seed.js";

describe("Auth Flow", () => {
  const testUser = { userId: "test001", email: "test@example.com", password: "pass123" };

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    await recreateTable();
    await seedUser(); // seed default user
    await seedProducts();
    await seedUser(testUser); // seed test user
  });

  it("should login successfully", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: testUser.email,
      password: testUser.password,
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("token");
  });

  it("should get /me with token", async () => {
    const loginRes = await request(app).post("/api/auth/login").send(testUser);
    const token = loginRes.body.token;

    const meRes = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(meRes.statusCode).toBe(200);
    expect(meRes.body.email).toBe(testUser.email);
  });

  it("should change password", async () => {
    const loginRes = await request(app).post("/api/auth/login").send(testUser);
    const token = loginRes.body.token;

    const res = await request(app)
      .patch("/api/account/password")
      .set("Authorization", `Bearer ${token}`)
      .send({ current: testUser.password, password: "newPass123" });

    expect(res.statusCode).toBe(200);

    // Login with new password
    const loginNew = await request(app)
      .post("/api/auth/login")
      .send({ email: testUser.email, password: "newPass123" });

    expect(loginNew.statusCode).toBe(200);
  });
});
