import express from 'express';
import { isAuthenticated } from '../middleware/authMiddleware.js';
import { createCheckoutSession, createCheckoutSessionCorporate, getAllBookings, getAllFacilites, getAllUsers, getBookDetailsController, getUserController, sendOtp, verifyOtp, verifyPayment, verifyPaymentCorporate } from '../controllers/userController.js';

const router = express.Router();

router.get('/userDetails', isAuthenticated, getUserController); 

router.get('/booked-details', isAuthenticated, getBookDetailsController); 

router.post('/create-checkout-session', createCheckoutSession);  

router.post('/create-checkout-session-corporate', createCheckoutSessionCorporate);  

router.get('/verify-payment', verifyPayment);   

router.get('/verify-payment-corporate', verifyPaymentCorporate);  

router.post('/send-verification-otp', sendOtp);

router.post('/verify-verification-otp', verifyOtp);

router.get('/get-all-users', getAllUsers); 

router.get('/get-all-bookings', getAllBookings);


router.get('/get-all-facilites', getAllFacilites)


export default router;  