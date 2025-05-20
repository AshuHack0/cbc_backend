import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import morgan from 'morgan';
import authRoute from './routes/authRoute.js';
import userRoute from './routes/userRoutes.js';
import sportsRoute from './routes/sportsRoute.js';
import paymentRoute from './routes/paymentRoutes.js';

const app = express();

// Enable CORS
app.use(cors());

// Log requests
app.use(morgan("dev"));

// Conditional body parsing - skip for webhook endpoint
app.use((req, res, next) => {
    if (req.originalUrl === '/api/payment/webhook') {
        next();
    } else {
        bodyParser.json()(req, res, next);
    }
});

// Routes
app.use("/api/auth", authRoute);
app.use("/api/user", userRoute);
app.use("/api/sports", sportsRoute);
app.use("/api/payment", paymentRoute);

export default app; 