import express from "express";
import * as cartController from "../controllers/cart.controller.js";

const router = express.Router();

router.post("/add", cartController.addItem);

export default router;