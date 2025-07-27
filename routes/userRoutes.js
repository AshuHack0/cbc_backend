import express from 'express';
import { isAuthenticated } from '../middleware/authMiddleware.js';
import { createCheckoutSession, getBookDetailsController, getUserController, verifyPayment } from '../controllers/userController.js';

const router = express.Router();

router.get('/userDetails', isAuthenticated, getUserController); 

router.get('/booked-details', isAuthenticated, getBookDetailsController); 


router.post('/create-checkout-session', createCheckoutSession); 

router.get('/verify-payment', verifyPayment); 

export default router;  