import express from 'express';
import { createBannerController, deleteBannerController, getBannersController, updateBannerController } from '../controllers/BannerController.js';
import { createEventController, getEventsController, updateEventController, deleteEventController } from '../controllers/sportsController.js';
import upload from '../middleware/uploadMiddleware.js';

const router = express.Router();

// event routes 
router.post('/create-event', upload.single('featuredImage'), createEventController);
router.get('/get-events', getEventsController);
router.put('/update-event/:id', upload.single('featuredImage'), updateEventController);
router.delete('/delete-event/:id', deleteEventController);

// now for the banner 
router.post('/create-banner', upload.single('image'), createBannerController);
router.get('/get-banners', getBannersController);
router.delete('/delete-banner/:id', deleteBannerController); 
router.put('/update-banner/:id', upload.single('image'), updateBannerController);


export default router;