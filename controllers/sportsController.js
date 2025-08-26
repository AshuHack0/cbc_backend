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

export const createFacilityController = async (req, res) => {
  try {
    const { name, description, image, price, capacity } = req.body; 
    const facility = await executeQuery2(`INSERT INTO facilities (name, description, image, price, capacity) VALUES (?, ?, ?, ?, ?)`, [name, description, image, price, capacity]);
    res.status(200).json({
      success: true,
      message: "Facility created successfully",
      facility: facility
    });
  } catch (error) {
    logger.error("Error in createFacilityController:::", error);
    console.log(error);
    res.status(500).json({
      success: false,
      message: RESPONSE_MESSAGES.INTERNAL_SERVER_ERROR,
    });
  }
};


export const getOperatingHoursController = async (req, res) => {
  try {
    const { facilityId } = req.query;
    const operatingHours = await executeQuery2(`SELECT * FROM operating_hours WHERE facility_id = ?`, [facilityId]);
    res.status(200).json({
      success: true,
      message: "Operating hours retrieved successfully",
      operatingHours: operatingHours
    });

  } catch (error) {
    logger.error("Error in getOperatingHoursController:::", error);
    console.log(error);
    res.status(500).json({
      success: false,
      message: RESPONSE_MESSAGES.INTERNAL_SERVER_ERROR,
    });
  }
};


export const getDayTypesController = async (req, res) => {
  try {
    // Only select required fields
    const rows = await executeQuery2(`
      SELECT 
        dt.id AS day_type_id,
        dt.name AS day_type_name,
        dtd.id AS weekday_id,
        dtd.weekday
      FROM day_types dt
      INNER JOIN day_type_days dtd 
        ON dt.id = dtd.day_type_id
      ORDER BY dt.id, dtd.id
    `);

    // Group results by day_type_id
    const groupedDayTypes = rows.reduce((acc, row) => {
      if (!acc[row.day_type_id]) {
        acc[row.day_type_id] = {
          id: row.day_type_id,
          name: row.day_type_name,
          weekdays: []
        };
      }
      acc[row.day_type_id].weekdays.push({
        id: row.weekday_id,
        name: row.weekday
      });
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      message: "Day types retrieved successfully",
      dayTypes: Object.values(groupedDayTypes) // convert to array
    });
  } catch (error) {
    logger.error("Error in getDayTypesController:::", error);
    res.status(500).json({
      success: false,
      message: RESPONSE_MESSAGES.INTERNAL_SERVER_ERROR,
    });
  }
};



export const createDayTypeController = async (req, res) => {
  const { name, weekdays } = req.body;
  // weekdays = [ { id?: number, name: "Monday" }, { name: "Tuesday" } ]

  
  // reqpuest body
  // {
  //   "name": "Mon-Thu",
  //   "weekdays": [
  //     { "name": "Monday" },
  //     { "name": "Tuesday" },
  //     { "name": "Wednesday" },
  //     { "name": "Thursday" }
  //   ]
  // } 


  if (!name || !Array.isArray(weekdays) || weekdays.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Day type name and weekdays are required",
    });
  }

  try {
    // Start database transaction
    await executeQuery2('START TRANSACTION');

    // 1. Insert into day_types
    const result = await executeQuery2(
      "INSERT INTO day_types (name) VALUES (?)",
      [name]
    );
    const dayTypeId = result.insertId;

    // 2. Insert weekdays into day_type_days
    const weekdayValues = weekdays.map(w => [dayTypeId, w.name]);
    await executeQuery2(
      "INSERT INTO day_type_days (day_type_id, weekday) VALUES ?",
      [weekdayValues]
    );

    // Commit transaction
    await executeQuery2('COMMIT');

    res.status(201).json({
      success: true,
      message: "Day type created successfully",
      data: {
        id: dayTypeId,
        name,
        weekdays
      }
    });
  } catch (error) {
    // Rollback transaction on error
    await executeQuery2('ROLLBACK');
    logger.error("Error in createDayTypeController:::", error);
    res.status(500).json({
      success: false,
      message: RESPONSE_MESSAGES.INTERNAL_SERVER_ERROR,
    });
  }
};


export const deleteDayTypeController = async (req, res) => {
  const { id } = req.params; // /day-types/:id

  if (!id) {
    return res.status(400).json({
      success: false,
      message: "Day type ID is required",
    });
  }

  try {
    // Start transaction
    await executeQuery2("START TRANSACTION");

    // 1. Delete weekdays first
    await executeQuery2(
      "DELETE FROM day_type_days WHERE day_type_id = ?",
      [id]
    );

    // 2. Delete the main day type
    const result = await executeQuery2(
      "DELETE FROM day_types WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      // Rollback if not found
      await executeQuery2("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Day type not found",
      });
    }

    // Commit transaction
    await executeQuery2("COMMIT");

    res.status(200).json({
      success: true,
      message: "Day type deleted successfully",
    });
  } catch (error) {
    await executeQuery2("ROLLBACK");
    logger.error("Error in deleteDayTypeController:::", error);
    res.status(500).json({
      success: false,
      message: RESPONSE_MESSAGES.INTERNAL_SERVER_ERROR,
    });
  }
};



// Get all operation hours (with facility & day type details)
// Get all operation hours (grouped by facility)
export const getOperationHours = async (req, res) => {
  try {
    const rows = await executeQuery2(
      `SELECT oh.id, f.name AS facility_name, dt.name AS day_type,
              oh.open_time, oh.close_time
       FROM operating_hours oh
       JOIN facilities f ON oh.facility_id = f.id
       JOIN day_types dt ON oh.day_type_id = dt.id
       ORDER BY f.name, dt.name`
    );

    // Group by facility_name
    const grouped = rows.reduce((acc, row) => {
      let facility = acc.find(f => f.facility_name === row.facility_name);
      if (!facility) {
        facility = { facility_name: row.facility_name, operation_hours: [] };
        acc.push(facility);
      }
      facility.operation_hours.push({
        id: row.id,
        day_type: row.day_type,
        open_time: row.open_time,
        close_time: row.close_time
      });
      return acc;
    }, []);

    res.json({ success: true, data: grouped });
  } catch (error) {
    console.error("Error fetching operation hours:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};



export const getPricingRules = async (req, res) => {
  try {
    const rows = await executeQuery2(
      `SELECT pr.id, f.name AS facility_name, dt.name AS day_type,
              pr.price, pr.start_time, pr.end_time, pr.day_type_id
       FROM pricing_rules pr
       JOIN facilities f ON pr.facility_id = f.id
       JOIN day_types dt ON pr.day_type_id = dt.id
       ORDER BY f.name, dt.name`
    );

    // Group by facility_name
    const grouped = rows.reduce((acc, row) => {
      let facility = acc.find(f => f.facility_name === row.facility_name);
      if (!facility) {
        facility = { facility_name: row.facility_name, pricing_rules: [] };
        acc.push(facility);
      }
      facility.pricing_rules.push({
        id: row.id,
        day_type: row.day_type,
        price: row.price,
        start_time: row.start_time,
        end_time: row.end_time,
        day_type_id: row.day_type_id
      });
      return acc;
    }, []);

    res.json({ success: true, data: grouped });
  } catch (error) {
    console.error("Error fetching pricing rules:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


export const createPricingRule = async (req, res) => {
  try {
    const { facility_id, day_type_id, price, start_time, end_time } = req.body;

    // Validate required fields
    if (!facility_id || !day_type_id || !price || !start_time || !end_time) {
      return res.status(400).json({
        success: false,
        message: "All fields are required: facility_id, day_type_id, price, start_time, end_time",
      });
    }

    // Insert into DB
    const result = await executeQuery2(
      `INSERT INTO pricing_rules (facility_id, day_type_id, price, start_time, end_time) 
       VALUES (?, ?, ?, ?, ?)`,
      [facility_id, day_type_id, price, start_time, end_time]
    );

    res.json({
      success: true,
      message: "Pricing rule created successfully",
      data: {
        id: result.insertId,
        facility_id,
        day_type_id,
        price,
        start_time,
        end_time
      }
    });
  } catch (error) {
    console.error("Error creating pricing rule:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


export const createEventController = async (req, res) => {
  try {
    const { 
      title, 
      type, 
      date, 
      time, 
      venue, 
      capacity, 
      description, 
      memberPrice, 
      guestPrice, 
      content
    } = req.body;

    // Get the uploaded image file // ad
    const featuredImage = req.file ? req.file.filename : null;

    // Validate required fields
    if (!title || !type || !date || !venue || !capacity) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: title, type, date, venue, and capacity are required"
      });
    }

    // Validate capacity is a positive number
    if (capacity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Capacity must be a positive number"
      });
    }

    // Validate prices are non-negative
    if (memberPrice < 0 || guestPrice < 0) {
      return res.status(400).json({
        success: false,
        message: "Prices cannot be negative"
      });
    }

    // Insert event into database
    const event = await executeQuery2(
      `INSERT INTO events (
        title, 
        type, 
        date, 
        time, 
        venue, 
        capacity, 
        description, 
        member_price, 
        guest_price, 
        content, 
        featured_image,
        status,
        registrations,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        title, 
        type, 
        date, 
        time || null, 
        venue, 
        capacity, 
        description || null, 
        memberPrice || 0, 
        guestPrice || 0, 
        content || null, 
        featuredImage, // Use the uploaded image filename
        'Upcoming', // Default status
        0 // Default registrations
      ]
    );

    // Get the created event details
    const createdEvent = await executeQuery2(
      `SELECT * FROM events WHERE id = ?`,
      [event.insertId]
    );

    res.status(201).json({
      success: true,
      message: "Event created successfully",
      event: createdEvent[0]
    });
  } catch (error) {
    logger.error("Error in createEventController:::", error);
    console.error("Error creating event:", error);
    res.status(500).json({ 
      success: false, 
      message: "Internal server error while creating event" 
    });
  }
};

export const getEventsController = async (req, res) => {
  try {
    const events = await executeQuery2(
      `SELECT * FROM events ORDER BY created_at DESC`
    );

    res.status(200).json({
      success: true,
      message: "Events retrieved successfully",
      events: events
    });
  } catch (error) {
    logger.error("Error in getEventsController:::", error);
    console.error("Error fetching events:", error);
    res.status(500).json({ 
      success: false, 
      message: "Internal server error while fetching events" 
    });
  }
};

export const updateEventController = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      title, 
      type, 
      date, 
      time, 
      venue, 
      capacity, 
      description, 
      memberPrice, 
      guestPrice, 
      content,
      status,
      registrations
    } = req.body;

    // Get the uploaded image file (if any)
    const featuredImage = req.file ? req.file.filename : undefined;

    // Validate required fields
    if (!title || !type || !date || !venue || !capacity) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: title, type, date, venue, and capacity are required"
      });
    }

    // Validate capacity is a positive number
    if (capacity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Capacity must be a positive number"
      });
    }

    // Validate prices are non-negative
    if (memberPrice < 0 || guestPrice < 0) {
      return res.status(400).json({
        success: false,
        message: "Prices cannot be negative"
      });
    }

    // Check if event exists
    const existingEvent = await executeQuery2(
      `SELECT * FROM events WHERE id = ?`,
      [id]
    );

    if (!existingEvent || existingEvent.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Event not found"
      });
    }

    // Prepare update query - only update featured_image if a new image is uploaded
    let updateQuery, updateParams;
    
    if (featuredImage) {
      // Update with new image
      updateQuery = `UPDATE events SET 
        title = ?, 
        type = ?, 
        date = ?, 
        time = ?, 
        venue = ?, 
        capacity = ?, 
        description = ?, 
        member_price = ?, 
        guest_price = ?, 
        content = ?, 
        featured_image = ?,
        status = ?,
        registrations = ?,
        updated_at = NOW()
      WHERE id = ?`;
      
      updateParams = [
        title, 
        type, 
        date, 
        time || null, 
        venue, 
        capacity, 
        description || null, 
        memberPrice || 0, 
        guestPrice || 0, 
        content || null, 
        featuredImage,
        status || existingEvent[0].status,
        registrations !== undefined ? registrations : existingEvent[0].registrations,
        id
      ];
    } else {
      // Update without changing image
      updateQuery = `UPDATE events SET 
        title = ?, 
        type = ?, 
        date = ?, 
        time = ?, 
        venue = ?, 
        capacity = ?, 
        description = ?, 
        member_price = ?, 
        guest_price = ?, 
        content = ?,
        status = ?,
        registrations = ?,
        updated_at = NOW()
      WHERE id = ?`;
      
      updateParams = [
        title, 
        type, 
        date, 
        time || null, 
        venue, 
        capacity, 
        description || null, 
        memberPrice || 0, 
        guestPrice || 0, 
        content || null,
        status || existingEvent[0].status,
        registrations !== undefined ? registrations : existingEvent[0].registrations,
        id
      ];
    }

    // Update event
    await executeQuery2(updateQuery, updateParams);

    // Get the updated event
    const updatedEvent = await executeQuery2(
      `SELECT * FROM events WHERE id = ?`,
      [id]
    );

    res.status(200).json({
      success: true,
      message: "Event updated successfully",
      event: updatedEvent[0]
    });
  } catch (error) {
    logger.error("Error in updateEventController:::", error);
    console.error("Error updating event:", error);
    res.status(500).json({ 
      success: false, 
      message: "Internal server error while updating event" 
    });
  }
};

export const deleteEventController = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if event exists
    const existingEvent = await executeQuery2(
      `SELECT * FROM events WHERE id = ?`,
      [id]
    );

    if (!existingEvent || existingEvent.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Event not found"
      });
    }

    // Delete event
    await executeQuery2(
      `DELETE FROM events WHERE id = ?`,
      [id]
    );

    res.status(200).json({
      success: true,
      message: "Event deleted successfully"
    });
  } catch (error) {
    logger.error("Error in deleteEventController:::", error);
    console.error("Error deleting event:", error);
    res.status(500).json({ 
      success: false, 
      message: "Internal server error while deleting event" 
    });
  }
};