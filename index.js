import express from 'express'; // Import Express using ES6 syntax
import cors from 'cors'; // Import CORS
import dotenv from 'dotenv'; // Import dotenv to load environment variables
import authRoute from './routes/authRoute.js'; 
import userRoute from './routes/userRoutes.js';
import sportsRoute from './routes/sportsRoute.js';
import paymentRoute from './routes/paymentRoutes.js';
import morgan from 'morgan';
 
import logger from './utils/logger.js';
import { handleWebhook } from './controllers/paymentController.js';

dotenv.config(); // Load environment variables from .env file

const PORT = process.env.PORT || 8085;

const app = express(); // Create an Express application

app.use(cors()); // Enable CORS
app.use("/api/payment/webhook", express.raw({ type: 'application/json' }), handleWebhook);
app.use(express.json()); // Middleware to parse JSON requests
app.use(morgan("dev")); // Log requests

app.use("/api/auth", authRoute); 
app.use("/api/user", userRoute);
app.use("/api/sports", sportsRoute);
app.use("/api/payment", paymentRoute); 



// Start the server
app.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT}`);
    logger.info(`Webhook endpoint: ${process.env.BASE_URL}/api/payment/webhook`);
});