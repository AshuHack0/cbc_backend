import express from 'express';
import { isAuthenticated } from '../middleware/authMiddleware.js';
import { getAllRoomsController } from '../controllers/roomController.js';

const router = express.Router(); 

router.get('/get-all-rooms', getAllRoomsController);  




export default router;