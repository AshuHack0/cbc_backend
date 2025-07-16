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
     // Get facility slot information
     const facilityInfo = await executeQuery2(`
       SELECT slot 
       FROM facilities 
       WHERE id = ?
     `, [facilityId]);

     const facilitySlotInfo = facilityInfo && facilityInfo.length > 0 ? facilityInfo[0].slot : null;
    const rows = await executeQuery2(
      SPORTS_QUERIES.SELECT_SPORTS_DETAILS_DAY_WISE_AND_FACILITY_WISE,
      [day, facilityId]
    );
  
        const existingBookings = await executeQuery2(`
SELECT
  b.id AS booking_id,
  b.user_id,
  b.order_id,
  b.booking_date,
  b.booked_date,
  b.start_time,
  b.booked_slot,
  b.boking_time_json,
  b.end_time,
  b.status AS booking_status,
  b.facility_id,
  p.amount,
  p.payment_date,
  p.status AS payment_status,
  p.transaction_id,
  u.phone AS user_phone,
  f.name AS facility_name,
  f.slot AS facility_slot
FROM bookings b
LEFT JOIN payments p ON b.order_id = p.order_id
LEFT JOIN users u ON b.user_id = u.id
LEFT JOIN facilities f ON b.facility_id = f.id
WHERE DATE(b.booked_date) = ? AND b.facility_id = ? AND b.status IN ('confirmed', 'active', 'booked') 
ORDER BY b.start_time ASC;
`,[date,facilityId]);

 

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
      equipment_rentals: [],
		  booking_status: "available",
      existing_bookings: []
    };

    if (!rows || rows.length === 0 || !rows[0].facility_id) {
      return res.status(200).json({
        success: true,
        message: "Facility closed or no data available for the given day",
        sportDetails: {
          ...defaultFacility,
          booking_status: existingBookings.length > 0 ? "partially_booked" : "available",
          existing_bookings: existingBookings.map(booking => ({
            booking_id: booking.booking_id,
            user_id: booking.user_id,
            user_phone: booking.user_phone,
            start_time: booking.start_time,
            end_time: booking.end_time,
            booking_status: booking.booking_status,
            payment_status: booking.payment_status,
            amount: booking.amount,
            booked_date: booking.booked_date,
            order_id: booking.order_id
          }))
        }
      });
    }

    const facility = {
      facility_id: rows[0].facility_id,
      facility_name: rows[0].facility_name,
	  facility_slot: facilitySlotInfo,
      day_type_id: rows[0].day_type_id,
      day_type_name: rows[0].day_type_name,
      day: rows[0].day,
      open_time: rows[0].open_time,
      close_time: rows[0].close_time,
      pricing_rules: [],
      equipment_rentals: [],
	  booking_status: "available",
      existing_bookings: []
    };

	   const options = {
      timeZone: 'Asia/Singapore',   // Important: use Singapore timezone
      day: 'numeric',
      month: 'long',
      year: 'numeric'
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
	  
	  if (existingBookings.length > 0) {
      facility.booking_status = "partially_booked";
      facility.existing_bookings = existingBookings.map(booking => ({
        booking_id: booking.booking_id,
        user_id: booking.user_id,
        // user_phone: booking.user_phone,
        start_time: booking.start_time,
        end_time: booking.end_time,
        // booking_status: booking.booking_status,
        // payment_status: booking.payment_status,
        // amount: booking.amount,
        booked_slot: booking.booked_slot,
        booked_date: booking.booked_date,
        booking_time_json: booking.boking_time_json,
		booked_date_formatted: new Intl.DateTimeFormat('en-SG', options).format(new Date(booking.booked_date))

        // order_id: booking.order_id
      }));

      console.log("existingBookings:::", existingBookings);

      // Check if facility is fully booked by comparing booking hours with facility operating hours
      const facilityOpenTime = new Date(`2000-01-01 ${facility.open_time}`);
      const facilityCloseTime = new Date(`2000-01-01 ${facility.close_time}`);
      const facilityTotalHours = (facilityCloseTime - facilityOpenTime) / (1000 * 60 * 60);

      let totalBookedHours = 0;
      existingBookings.forEach(booking => {
        if (booking.start_time && booking.end_time) {
          const startTime = new Date(`2000-01-01 ${booking.start_time}`);
          const endTime = new Date(`2000-01-01 ${booking.end_time}`);
          const bookedHours = (endTime - startTime) / (1000 * 60 * 60);
          totalBookedHours += bookedHours;
        }
      });

      // If total booked hours equals or exceeds facility operating hours, mark as fully booked
      if (totalBookedHours >= facilityTotalHours) {
        facility.booking_status = "fully_booked";
      }
    }

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
    logger.error("Error in eachFacilityWiseSportsDetailsController:::", error);
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
    logger.error("Error in getAllFacilitiesController:::", error);
    console.log(error);
    res.status(500).json({
      success: false,
      message: RESPONSE_MESSAGES.INTERNAL_SERVER_ERROR,
    });
  }
};

