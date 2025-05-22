import express from 'express';
import { isAuthenticated } from '../middleware/authMiddleware.js';
import { getBookDetailsController, getUserController } from '../controllers/userController.js';

const router = express.Router();

router.get('/userDetails', isAuthenticated, getUserController); 

router.get('/booked-details', isAuthenticated, getBookDetailsController);

export default router;  