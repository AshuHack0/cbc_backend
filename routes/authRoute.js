import express from 'express';
import {  resendOtpController, sendOtpController, verifyOtpController } from '../controllers/authController.js';

const router = express.Router();



// Send OTP route
router.post('/send-otp', sendOtpController);

// Verify OTP route
router.post('/verify-otp', verifyOtpController);

 // resend otp route
 router.post('/resend-otp', resendOtpController);
 


export default router;