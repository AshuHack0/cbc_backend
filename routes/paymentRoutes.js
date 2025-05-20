import express from 'express';
import { createPaymentIntent, handleWebhook, getPaymentStatus } from '../controllers/paymentController.js';
import { isAuthenticated } from '../middleware/authMiddleware.js';
import { executeQuery } from '../utils/db.js';
import { SQL_QUERIES } from '../queries/queries.js';

const router = express.Router();

// Create payment intent (requires authentication)
router.post('/create-payment-intent', isAuthenticated, async (req, res) => {
    try {
        // First create the payment record in pending state
        const { amount, user_id } = req.body;
        const paymentIntent = await createPaymentIntent(req, res);
        
        // Insert initial payment record
        await executeQuery(SQL_QUERIES.CREATE_PAYMENT_RECORD, [
            user_id,
            'pending',
            amount,
            new Date(),
            paymentIntent.id // Using payment intent ID as order ID
        ]);

        res.json(paymentIntent);
    } catch (error) {
        console.error('Error creating payment intent:', error);
        res.status(500).json({ error: 'Failed to create payment intent' });
    }
});

// Stripe webhook (no authentication required as it's called by Stripe)
router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);

// Get payment status (requires authentication)
router.get('/status', isAuthenticated, getPaymentStatus);

export default router; 