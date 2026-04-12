// routes/products.routes.js
import express from "express";
import * as productsController from "../controllers/products.controller.js";
import { validateRequest, validateResponse } from '../middleware/validation.middleware.js';
import { productsContracts } from '../contracts/products.contracts.js';

const router = express.Router();

// GET all products
router.get("/", validateRequest(productsContracts.getProducts), validateResponse(productsContracts.getProducts), productsController.getAllProducts);

// GET single product by ID
router.get("/:productId", validateRequest(productsContracts.getProduct), validateResponse(productsContracts.getProduct), productsController.getProductById);

export default router;