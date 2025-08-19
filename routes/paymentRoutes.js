import express from 'express';
import { createPaymentIntent, handleWebhook, handleRoomWebhook, getPaymentStatus, createFreeBooking, createCashPayment, createPaymentIntentForRoom, getPaymentStatusRooms } from '../controllers/paymentController.js';
import { isAuthenticated } from '../middleware/authMiddleware.js';

const router = express.Router();

// Create payment intent (requires authentication)
router.post('/create-payment-intent', isAuthenticated, createPaymentIntent); 


router.post('/create-payment-intent-for-room', isAuthenticated, createPaymentIntentForRoom);


// Stripe webhook (no authentication required as it's called by Stripe)
router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);

// Room webhook (no authentication required as it's called by Stripe)
router.post('/room-webhook', express.raw({ type: 'application/json' }), handleRoomWebhook);

router.post('/freebooking',isAuthenticated , createFreeBooking)  


router.post('/cashPayment',isAuthenticated , createCashPayment) 

// Get payment status (requires authentication)
router.get('/status', isAuthenticated, getPaymentStatus); 

router.get('/status-rooms', isAuthenticated, getPaymentStatusRooms);

export default router; 