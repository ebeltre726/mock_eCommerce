import * as cartService from "../services/cart.service.js";

export async function addItem(req, res) {
  try {
    const { productId, quantity } = req.body;
    const userId = req.user.id; // from auth middleware

    const result = await cartService.addToCart(userId, productId, quantity);

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to update cart" });
  }
}