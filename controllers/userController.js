import { executeQuery2 } from '../config/db.js';
import { LOG_MESSAGES, RESPONSE_MESSAGES } from '../constants/constants.js';
import logger from '../utils/logger.js';
import { SQL_QUERIES, BOOKING_QUERIES } from '../queries/queries.js';
export const getUserController = async (req, res) => {
    const { _id } = req.user;
    try {
        const [result] = await executeQuery2(SQL_QUERIES.SELECT_USER_DETAILS, [_id]);
        if (result) {
            res.status(200).json({ message: RESPONSE_MESSAGES.USER_DETAILS_RETRIEVED_SUCCESSFULLY, user: result });
        } else {
            res.status(404).json({ message: RESPONSE_MESSAGES.USER_NOT_FOUND });
        }
    } catch (error) {
        logger.error(LOG_MESSAGES.ERROR_IN_GET_USER(error));
        res.status(500).json({ message: RESPONSE_MESSAGES.USER_DETAILS_RETRIEVAL_FAILED, error });
    }
}; 
 
export const getBookDetailsController = async (req, res) => {
    const { _id } = req.user;
    
    try {
      const results = await executeQuery2(BOOKING_QUERIES.SELECT_PAYMENTS_WITH_BOOKINGS, [_id]);
  
      if (!results || results.length === 0) {
        return res.status(404).json({ message: "No payment or booking details found" });
      }
  
      // Map results to unify response shape
      const combined = results.map(row => {
        if (row.booking_id) {
          // booking exists
          return {
            bookingId: row.booking_id,
            facilityId: row.facility_id,
            userId: row.user_id,
            orderId: row.order_id,
            bookingDate: row.booking_date,
            bookedDate: row.booked_date,
            startTime: row.start_time,
            endTime: row.end_time,
            bookingStatus: row.booking_status,
            paymentStatus: row.payment_status,
            amount: row.amount,
            paymentDate: row.payment_date,
            transactionId: row.transaction_id,
            facilityName: row.facility_name,
            imgSrc: row.img_src,
            availabilityStatus: row.availability_status,
          };
        } else {
          // no booking, payment failed or pending
          return {
            bookingId: null,
            facilityId: null,
            userId: _id,
            orderId: null,
            bookingDate: null,
            bookedDate: null,
            startTime: null,
            endTime: null,
            bookingStatus: null,
            paymentStatus: row.payment_status,  // could be 'failed' or 'pending'
            amount: row.amount,
            paymentDate: row.payment_date,
            transactionId: row.transaction_id,
            facilityName: null,
            imgSrc: null,
            availabilityStatus: null,
          };
        }
      });
  
      res.status(200).json({ message: "Bookings and payments retrieved", data: combined });
  
    } catch (error) {
      logger.error(LOG_MESSAGES.ERROR_IN_GET_BOOK_DETAILS(error));
      res.status(500).json({ message: RESPONSE_MESSAGES.BOOK_DETAILS_RETRIEVAL_FAILED, error });
    }
  };
  
  



