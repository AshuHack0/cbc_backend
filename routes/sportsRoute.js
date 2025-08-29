import express from 'express';
import { isAuthenticated } from '../middleware/authMiddleware.js';
import { createDayTypeController, createFacilityController, createOperationHoursController, createPricingRule, deleteDayTypeController, eachFacilityWiseSportsDetailsController, getAllFacilitiesController, getDayTypesController, getOperatingHoursController, getOperationHours, getPricingRules, getSportDetailsFacilityWiseController, getSportsController, getSportsDetailsDayWiseAndFacilityWiseController, pricingRulesController } from '../controllers/sportsController.js';

const router = express.Router(); 

router.post('/sports-details-by-date-and-time-and-sport-id', isAuthenticated, getSportsController);
router.get('/sports-details-facility-wise', isAuthenticated, getSportDetailsFacilityWiseController);
router.get('/sports-details-day-wise-and-facility-wise', isAuthenticated, getSportsDetailsDayWiseAndFacilityWiseController); 
router.get('/each-facility-wise-sports-details', isAuthenticated, eachFacilityWiseSportsDetailsController); 
router.get('/get-all-facilities', isAuthenticated, getAllFacilitiesController);
router.post('/create-facility', isAuthenticated, createFacilityController); 

router.post('/create-operation-hours', isAuthenticated, createOperationHoursController
    
); 

router.post('/create-pricing-rules', isAuthenticated, pricingRulesController);

router.get('/get-operating-hours', isAuthenticated, getOperatingHoursController);

router.get('/get-day-types', isAuthenticated, getDayTypesController);

router.post('/create-day-type', isAuthenticated, createDayTypeController
);

router.delete('/delete-day-type/:id', isAuthenticated, deleteDayTypeController);

router.get('/get-operation-hours', isAuthenticated, getOperationHours); 

router.get('/get-pricing-rules', isAuthenticated, getPricingRules); 

router.post('/create-pricing-rule', isAuthenticated, createPricingRule);

export default router;