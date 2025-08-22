import express from 'express'; // Import Express using ES6 syntax
import cors from 'cors'; // Import CORS
import dotenv from 'dotenv'; // Import dotenv to load environment variables
import authRoute from './routes/authRoute.js'; 
import userRoute from './routes/userRoutes.js';
import sportsRoute from './routes/sportsRoute.js';
import paymentRoute from './routes/paymentRoutes.js';
import roomRoute from './routes/roomRoute.js';
import marketingRoute from './routes/MarketingRoutes.js';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
 
import logger from './utils/logger.js';
import { handleWebhook, handleRoomWebhook } from './controllers/paymentController.js'; 

dotenv.config(); // Load environment variables from .env file

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 8085;

const app = express(); // Create an Express application

app.use(cors()); // Enable CORS
app.post("/api/payment/webhook", express.raw({ type: 'application/json' }), handleWebhook); 
app.post("/api/payment/room-webhook", express.raw({ type: 'application/json' }), handleRoomWebhook);
app.use(express.json()); // Middleware to parse JSON requests
app.use(morgan("dev")); // Log requests

// Serve static files from public directory
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use("/api/auth", authRoute); 
app.use("/api/user", userRoute);
app.use("/api/sports", sportsRoute);
app.use("/api/payment", paymentRoute); 
app.use("/api/room", roomRoute);
app.use("/api/marketing", marketingRoute);

// Start the server
app.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT}`);
    logger.info(`Webhook endpoint: ${process.env.BASE_URL}/api/payment/webhook`);
});