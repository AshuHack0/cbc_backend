import express from 'express';
import { createPaymentIntent, handleWebhook, getPaymentStatus } from '../controllers/paymentController.js';
import { isAuthenticated } from '../middleware/authMiddleware.js';

const router = express.Router();

// Create payment intent (requires authentication)
router.post('/create-payment-intent', isAuthenticated, createPaymentIntent);

// Stripe webhook (no authentication required as it's called by Stripe)
router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);

// Get payment status (requires authentication)
router.get('/status', isAuthenticated, getPaymentStatus);

export default router; 