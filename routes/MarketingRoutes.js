import express from 'express';
import { createBannerController, deleteBannerController, getBannersController } from '../controllers/BannerController.js';
import upload from '../middleware/uploadMiddleware.js';

const router = express.Router();

// event routes 
// router.post('/create-event', createEvent);
// router.get('/get-events', getEvents);
// router.put('/update-event/:id', updateEvent);
// router.delete('/delete-event/:id', deleteEvent);

// now for the banner 
router.post('/create-banner', upload.single('image'), createBannerController);
router.get('/get-banners', getBannersController);
router.delete('/delete-banner/:id', deleteBannerController);

export default router;