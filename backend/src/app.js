import express from "express";
import cors from "cors";

import cartRoutes from "./routes/cart.routes.js";
import productRoutes from "./routes/products.routes.js";
import sendContactMessage from "./routes/contact.routes.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/cart", cartRoutes);
app.use("/api/products", productRoutes);
app.use("/api/contact", sendContactMessage);

// Health check (nice touch for AWS later)
app.get("/health", (req, res) => {
  res.json({ status: "OK" });
});

export default app;