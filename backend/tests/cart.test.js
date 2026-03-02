import { addToCart } from "../src/services/cart.service.js";

describe("Cart Service", () => {
  it("should not exceed max per item", async () => {
    const result = await addToCart("user1", "chair-1", 50);

    expect(result.quantity).toBe(10);
  });
});