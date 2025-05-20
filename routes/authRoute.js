import express from 'express';
import {  sendOtpController, verifyOtpController } from '../controllers/authController.js';

const router = express.Router();

// Send OTP route
router.post('/send-otp', sendOtpController);

// Verify OTP route
router.post('/verify-otp', verifyOtpController);

 
 


export default router;