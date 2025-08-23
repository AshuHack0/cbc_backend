import express from 'express';
import { isAuthenticated } from '../middleware/authMiddleware.js';
import { getAllRoomsController, getAllRoomsPaymentController } from '../controllers/roomController.js';

const router = express.Router(); 

router.get('/get-all-rooms', getAllRoomsController);  


router.get('/get-all-rooms-payment', getAllRoomsPaymentController);



export default router;