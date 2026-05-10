import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { dynamo } from './db/dynamoClient.js';
import env from './config/env.js';
import logger from './utils/logger.js';
import { tracingMiddleware } from './middleware/tracing.middleware.js';

import cartRoutes from "./routes/cart.routes.js";
import ordersRouter from "./routes/orders.routes.js";
import productRoutes from "./routes/products.routes.js";
import contactRouter from "./routes/contact.routes.js";
import accountRouter from "./routes/account.routes.js";
import authRouter from './routes/auth.routes.js';

const app = express();

// env.ALLOWED_ORIGINS is validated at startup by config/env.js — using it here
// ensures the CORS allowlist and the startup check are always in sync.
const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean);
const corsOptions = {
    origin: (origin, cb) => {
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
        cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Access-Token'],
};
app.use(tracingMiddleware);
app.use(cors(corsOptions));
app.options('/*splat', cors(corsOptions));
app.use(cookieParser());
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
            TableName: env.DYNAMODB_TABLE || 'Furnitria',
        }));
        res.json({ status: 'OK' });
    } catch {
        res.status(503).json({ status: 'degraded' });
    }
});

// Global error handler — prevents stack traces from leaking to clients
app.use((err, req, res, next) => {
    logger.error({ err, path: req.path, method: req.method }, 'Unhandled request error');
    res.status(err.status ?? 500).json({ error: 'Internal server error' });
});

export default app;