import express from "express";
import cors from "cors";

import cartRoutes from "./routes/cart.routes.js";
import productRoutes from "./routes/products.routes.js";

const app = express();

app.use(cors());
app.use(express.json());

function doWork() {
  console.log("Oh so we're going to take it there?");
}

// Routes
app.use("/api/cart", cartRoutes);
app.use("/api/products", productRoutes);
app.use("/api/users", doWork)

// Health check (nice touch for AWS later)
app.get("/health", (req, res) => {
  res.json({ status: "OK" });
});

export default app;