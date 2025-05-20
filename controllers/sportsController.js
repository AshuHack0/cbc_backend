import { executeQuery2 } from "../config/db.js";
import { SPORTS_QUERIES } from "../queries/queries.js";
import { RESPONSE_MESSAGES, LOG_MESSAGES } from "../constants/constants.js";
import logger from "../utils/logger.js";
export const getSportsController = async (req, res) => {
  try {
    const sports = await executeQuery2(SPORTS_QUERIES.SELECT_SPORTS_DETAILS);
    if (sports && sports.length > 0) {
      res.status(200).json({
        success: true,
        message: RESPONSE_MESSAGES.SPORTS_RETRIEVED_SUCCESSFULLY,
        sports: sports,
      });
    } else {
      res.status(404).json({
        success: false,
        message: RESPONSE_MESSAGES.SPORTS_NOT_FOUND,
      });
    }
  } catch (error) {
    logger.error(LOG_MESSAGES.ERROR_IN_GET_SPORTS(error));
    console.log(error);
    res.status(500).json({
      success: false,
      message: RESPONSE_MESSAGES.INTERNAL_SERVER_ERROR,
    });
  }
};

export const getSportDetailsFacilityWiseController = async (req, res) => {
  try {
    const { sportId } = req.query;
    const sportDetails = await executeQuery2(
      SPORTS_QUERIES.SELECT_SPORTS_DETAILS_FACILITY_WISE,
      [sportId]
    );

    if (sportDetails && sportDetails.length > 0) {
      res.status(200).json({
        success: true,
        message: RESPONSE_MESSAGES.SPORTS_DETAILS_RETRIEVED_SUCCESSFULLY,
        sportDetails: sportDetails,
      });
    } else {
      res.status(404).json({
        success: false,
        message: RESPONSE_MESSAGES.SPORTS_DETAILS_NOT_FOUND,
      });
    }
  } catch (error) {
    logger.error(LOG_MESSAGES.ERROR_IN_GET_SPORTS(error));
    console.log(error);
    res.status(500).json({
      success: false,
      message: RESPONSE_MESSAGES.INTERNAL_SERVER_ERROR,
    });
  }
};

export const getSportsDetailsDayWiseAndFacilityWiseController = async (req, res) => {
  try {
    const { date, facilityId } = req.query;

     const day = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }); 
     console.log("day", day);
    const rows = await executeQuery2(
      SPORTS_QUERIES.SELECT_SPORTS_DETAILS_DAY_WISE_AND_FACILITY_WISE,
      [day, facilityId]
    );
  
    

    const defaultFacility = {
      facility_id: Number(facilityId),
      facility_name: null,
      day_type_id: null,
      day_type_name: null,
      day: day,
      "open_time": "00:00:00",
      "close_time": "00:00:00",
      pricing_rules: [
        {
          start_time: "00:00:00",
          end_time: "00:00:00",
          price: "0.00",
          unit: "hour"
        }
      ],
      equipment_rentals: []
    };

    if (!rows || rows.length === 0 || !rows[0].facility_id) {
      return res.status(200).json({
        success: true,
        message: "Facility closed or no data available for the given day",
        sportDetails: defaultFacility
      });
    }

    const facility = {
      facility_id: rows[0].facility_id,
      facility_name: rows[0].facility_name,
      day_type_id: rows[0].day_type_id,
      day_type_name: rows[0].day_type_name,
      day: rows[0].day,
      open_time: rows[0].open_time,
      close_time: rows[0].close_time,
      pricing_rules: [],
      equipment_rentals: []
    };

    const rentalMap = new Map();

    rows.forEach(row => {
      // Push pricing rules if valid
      if (row.pricing_start_time && row.pricing_end_time) {
        facility.pricing_rules.push({
          start_time: row.pricing_start_time,
          end_time: row.pricing_end_time,
          price: row.price,
          unit: row.unit
        });
      }

      // Avoid duplicate rental items
      if (row.rental_item && !rentalMap.has(row.rental_item)) {
        rentalMap.set(row.rental_item, {
          item_name: row.rental_item,
          price: row.rental_price
        });
      }
    });

    facility.equipment_rentals = Array.from(rentalMap.values());

    return res.status(200).json({
      success: true,
      message: RESPONSE_MESSAGES.SPORTS_RETRIEVED_SUCCESSFULLY,
      sportDetails: facility
    });

  } catch (error) {
    logger.error(LOG_MESSAGES.ERROR_IN_GET_SPORTS(error));
    console.error(error);
    return res.status(500).json({
      success: false,
      message: RESPONSE_MESSAGES.INTERNAL_SERVER_ERROR,
    });
  }
};


export const eachFacilityWiseSportsDetailsController = async (req, res) => {
  try {
    


    const rows = await executeQuery2(SPORTS_QUERIES.SELECT_SPORTS_DETAILS_FACILITY_WISE);
    
    const facilityMap = {};
    
    for (const row of rows) {
      const fid = row.facility_id;
      if (!facilityMap[fid]) {
        facilityMap[fid] = {
          facility_id: fid,
          facility_name: row.facility_name,
          operating_hours: [],
          pricing_rules: [],
          equipment_rentals: []
        };
      }
    
      if (
        row.day_type_id &&
        !facilityMap[fid].operating_hours.some(h => h.day_type_id === row.day_type_id)
      ) {
        facilityMap[fid].operating_hours.push({
          day_type_id: row.day_type_id,
          day_type_name: row.day_type_name,
          open_time: row.open_time,
          close_time: row.close_time
        });
      }
    
      if (
        row.pricing_start_time &&
        !facilityMap[fid].pricing_rules.some(
          p =>
            p.day_type_id === row.day_type_id &&
            p.start_time === row.pricing_start_time &&
            p.end_time === row.pricing_end_time
        )
      ) {
        facilityMap[fid].pricing_rules.push({
          day_type_id: row.day_type_id,
          day_type_name: row.day_type_name,
          start_time: row.pricing_start_time,
          end_time: row.pricing_end_time,
          price: row.price,
          unit: row.unit
        });
      }
    
      if (
        row.item_name &&
        !facilityMap[fid].equipment_rentals.some(e => e.item_name === row.item_name)
      ) {
        facilityMap[fid].equipment_rentals.push({
          item_name: row.item_name,
          price: row.rental_price
        });
      }
    }
    
    const result = {
      success: true,
      message: "Facility details retrieved successfully",
      facilities: Object.values(facilityMap)
    };
    

    if (rows && rows.length > 0) {
      res.status(200).json(result);
    } else {
      res.status(404).json({
        success: false,
        message: RESPONSE_MESSAGES.SPORTS_DETAILS_NOT_FOUND,
      });
    }
  } catch (error) {
    logger.error(LOG_MESSAGES.ERROR_IN_GET_SPORTS(error));
    console.log(error);
  }
};

export const getAllFacilitiesController = async (req, res) => {
  try {
    const rows = await executeQuery2(SPORTS_QUERIES.SELECT_ALL_FACILITIES);
    res.status(200).json({
      success: true,
      message: RESPONSE_MESSAGES.FACILITIES_RETRIEVED_SUCCESSFULLY,
      facilities: rows
    });
    
  } catch (error) {
    logger.error(LOG_MESSAGES.ERROR_IN_GET_FACILITIES(error));
    console.log(error);
    res.status(500).json({
      success: false,
      message: RESPONSE_MESSAGES.INTERNAL_SERVER_ERROR,
    });
  }
};

