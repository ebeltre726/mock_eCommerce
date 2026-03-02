// controllers/products.controller.js
import * as productsService from "../services/products.service.js";

// GET /api/products
export async function getAllProducts(req, res) {
  try {
    const products = await productsService.fetchAllProducts();
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
}

// GET /api/products/:productId
export async function getProductById(req, res) {
  try {
    const { productId } = req.params;
    const product = await productsService.fetchProductById(productId);
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch product" });
  }
}