import express from 'express';
import { isAuthenticated } from '../middleware/authMiddleware.js';
import { eachFacilityWiseSportsDetailsController, getAllFacilitiesController, getSportDetailsFacilityWiseController, getSportsController, getSportsDetailsDayWiseAndFacilityWiseController } from '../controllers/sportsController.js';

const router = express.Router(); 

router.post('/sports-details-by-date-and-time-and-sport-id', isAuthenticated, getSportsController);
router.get('/sports-details-facility-wise', isAuthenticated, getSportDetailsFacilityWiseController);
router.get('/sports-details-day-wise-and-facility-wise', isAuthenticated, getSportsDetailsDayWiseAndFacilityWiseController); 
router.get('/each-facility-wise-sports-details', isAuthenticated, eachFacilityWiseSportsDetailsController); 
router.get('/get-all-facilities', isAuthenticated, getAllFacilitiesController);
export default router;