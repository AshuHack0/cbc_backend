import express from 'express';
import { isAuthenticated } from '../middleware/authMiddleware.js';
import { createCheckoutSession, createCheckoutSessionCorporate, createUserManually, updatePaymentStatus, getManualUsers, getAllBookings, getAllFacilites, getAllUsers, getBookDetailsController, getUserController, sendOtp, verifyOtp, verifyPayment, verifyPaymentCorporate } from '../controllers/userController.js';
import { updateUserDetailsController } from '../controllers/authController.js';
import { profileUpload } from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.get('/userDetails', isAuthenticated, getUserController); 

router.post('/create-user-manually', isAuthenticated, createUserManually); 

router.get('/get-manual-users', isAuthenticated, getManualUsers); 

router.put('/update-payment-status/:userId', updatePaymentStatus);

router.put('/update-user-details', isAuthenticated, profileUpload.single('profilePicture'), updateUserDetailsController);

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