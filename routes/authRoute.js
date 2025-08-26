import express from 'express';
import {  adminLoginController, CreateAdminUser, DeleteAdminUser, GetAllAdminUsers, loginController, resendOtpController, resetPasswordController, sendOtpController, UpdateAdminUser, verifyOtpController } from '../controllers/authController.js';
import { isAuthenticated } from '../middleware/authMiddleware.js';

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

// create admin user route
router.post('/create-admin-user', isAuthenticated, CreateAdminUser);

// get all admin users route
router.get('/get-all-admin-users', isAuthenticated, GetAllAdminUsers);

// delete admin user route
router.delete('/delete-admin-user/:id', isAuthenticated, DeleteAdminUser);

// update admin user route
router.put('/update-admin-user/:id', isAuthenticated, UpdateAdminUser);

// admin login route
router.post('/admin-login', adminLoginController);

export default router;