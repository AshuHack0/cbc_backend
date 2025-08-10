import express from 'express';
import {  loginController, resendOtpController, resetPasswordController, sendOtpController, verifyOtpController } from '../controllers/authController.js';

const router = express.Router();




router.post('/login', loginController);

// Send OTP route
router.post('/send-otp', sendOtpController);

// Verify OTP route
router.post('/verify-otp', verifyOtpController);

 // resend otp route
 router.post('/resend-otp', resendOtpController);

 // reset password route
 router.post('/reset-password', resetPasswordController);


export default router;