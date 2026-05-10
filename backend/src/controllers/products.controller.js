// controllers/products.controller.js
import * as productsService from "../services/products.service.js";
import logger from "../utils/logger.js";

// GET /api/products
export async function getAllProducts(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 24, 100);
    const cursor = req.query.cursor || undefined;
    const data = await productsService.fetchProductsPage({ cursor, limit });
    res.json(data);
  } catch (err) {
    logger.error({ err }, 'getAllProducts error');
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
    logger.error({ err }, 'getProductById error');
    res.status(500).json({ error: "Failed to fetch product" });
  }
}

// GET /api/products/batch?ids=id1,id2,...
export async function getProductsBatch(req, res) {
  try {
    const ids = String(req.query.ids ?? '').split(',').map(s => s.trim()).filter(Boolean);
    if (ids.length === 0) return res.status(400).json({ error: 'ids query param required' });
    const products = await productsService.fetchProductsBatch(ids);
    res.json(products);
  } catch (err) {
    logger.error({ err }, 'getProductsBatch error');
    res.status(500).json({ error: "Failed to fetch products" });
  }
}
