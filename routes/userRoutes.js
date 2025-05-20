import express from 'express';
import { isAuthenticated } from '../middleware/authMiddleware.js';
import { getUserController } from '../controllers/userController.js';

const router = express.Router();

router.get('/userDetails', isAuthenticated, getUserController);

export default router;