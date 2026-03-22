import express from "express";
import cors from "cors";
import 'dotenv/config';

import cartRoutes from "./routes/cart.routes.js";
import ordersRouter from "./routes/orders.routes.js";
import productRoutes from "./routes/products.routes.js";
import contactRouter from "./routes/contact.routes.js";
import accountRouter from "./routes/account.routes.js";
import authRouter from './routes/auth.routes.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/cart", cartRoutes);
app.use("/api/products", productRoutes);
app.use("/api/contact", contactRouter);
app.use('/api/auth', authRouter);
app.use('/api/account', accountRouter);
app.use('/api/orders', ordersRouter);

// Health check (nice touch for AWS later)
app.get("/health", (req, res) => {
  res.json({ status: "OK" });
});

export default app;