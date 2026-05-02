import express from "express";
import cors from "cors";
import { DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { dynamo } from './db/dynamoClient.js';

import cartRoutes from "./routes/cart.routes.js";
import ordersRouter from "./routes/orders.routes.js";
import productRoutes from "./routes/products.routes.js";
import contactRouter from "./routes/contact.routes.js";
import accountRouter from "./routes/account.routes.js";
import authRouter from './routes/auth.routes.js';

const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) ?? [];
app.use(cors({
    origin: (origin, cb) => {
        // allow server-to-server (no origin) and configured origins
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
        cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/cart", cartRoutes);
app.use("/api/products", productRoutes);
app.use("/api/contact", contactRouter);
app.use('/api/auth', authRouter);
app.use('/api/account', accountRouter);
app.use('/api/orders', ordersRouter);

// Health check — verifies DynamoDB connectivity for ALB/Lambda health routing
app.get("/health", async (req, res) => {
    try {
        await dynamo.send(new DescribeTableCommand({
            TableName: process.env.DYNAMODB_TABLE ?? 'Furnituria',
        }));
        res.json({ status: 'OK' });
    } catch {
        res.status(503).json({ status: 'degraded' });
    }
});

// Global error handler — prevents stack traces from leaking to clients
app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status ?? 500).json({ error: 'Internal server error' });
});

export default app;