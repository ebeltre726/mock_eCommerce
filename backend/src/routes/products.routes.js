// routes/products.routes.js
import express from "express";
import * as productsController from "../controllers/products.controller.js";

const router = express.Router();

// GET all products
router.get("/", productsController.getAllProducts);

// GET single product by ID
router.get("/:productId", productsController.getProductById);

export default router;