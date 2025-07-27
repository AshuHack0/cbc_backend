import twilio from "twilio";
import dotenv from "dotenv";
import logger from "../utils/logger.js";
import { executeQuery2 } from "../config/db.js";
import { LOG_MESSAGES, RESPONSE_MESSAGES } from "../constants/constants.js";
import { SQL_QUERIES } from "../queries/queries.js";
import JWT from "jsonwebtoken";
dotenv.config();

// Initialize Twilio client
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);


const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000);
};

export const sendOtpController = async (req, res) => {
  try {
    const { phone } = req.body;

    // Validate input
    if (!phone) {
      return res.status(400).json({
        success: false,
        message: RESPONSE_MESSAGES.PHONE_REQUIRED,
      });
    }
    //check if phone number is already in the database
    const users = await executeQuery2(SQL_QUERIES.SELECT_USER, [phone]);
    //if user is not found return no user found
    if (users && users.length === 0) {
      return res.status(400).json({
        success: false,
        message: RESPONSE_MESSAGES.USER_NOT_FOUND,
      });
    }
    // Generate OTP
    const otp = generateOTP();

    // Store OTP in database (valid for 5 minutes)
    const expiryTime = new Date(Date.now() + 5 * 60 * 1000);

    //insert otp in the database
    const result = await executeQuery2(SQL_QUERIES.INSERT_OTP, [
      phone,
      otp,
      expiryTime,
    ]);
    console.log(result);

    // Send OTP via Twilio
    try {
      await client.messages.create({
        body: LOG_MESSAGES.OTP_MESSAGE(otp),
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phone,
      });
      logger.info(LOG_MESSAGES.OTP_SENT_SUCCESS(phone));
      //return success message
      res.status(200).json({
        success: true,
        message: LOG_MESSAGES.OTP_SENT_SUCCESS(phone),
      });
    } catch (twilioError) {
      logger.error(LOG_MESSAGES.TWILIO_ERROR(twilioError.message));
      //return failed to send otp
      console.log(twilioError);
      res.status(500).json({
        success: false,
        message: RESPONSE_MESSAGES.FAILED_TO_SEND_OTP,
      });
    }
  } catch (error) {
    logger.error(LOG_MESSAGES.ERROR_IN_SEND_OTP(error));
    //return internal server error
    res.status(500).json({
      success: false,
      message: RESPONSE_MESSAGES.INTERNAL_SERVER_ERROR,
    });
  }
};

export const verifyOtpController = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    // Validate input
    if (!phone || !otp) {
      return res.status(400).json({
        success: false,
        message: RESPONSE_MESSAGES.PHONE_REQUIRED,
      });
    }

    // Get latest OTP record
    const otpRecords = await executeQuery2(SQL_QUERIES.SELECT_LATEST_OTP, [
      phone,
    ]);

    // Check if OTP exists
    if (!otpRecords || otpRecords.length === 0) {
      logger.error(LOG_MESSAGES.NO_OTP_FOUND(phone));
      return res.status(400).json({
        success: false,
        message: LOG_MESSAGES.NO_OTP_FOUND(phone),
      });
    }

    const otpRecord = otpRecords[0];

    // Check if OTP is expired
    if (new Date() > new Date(otpRecord.expires_at)) {
      logger.error(LOG_MESSAGES.OTP_EXPIRED(phone));
      // Delete the expired OTP record
      await executeQuery2(SQL_QUERIES.DELETE_OTP, [otpRecord.id]);
      return res.status(400).json({
        success: false,
        message: LOG_MESSAGES.OTP_EXPIRED(phone),
      });
    }

    // Check max attempts (3)
    if (otpRecord.attempts >= 3) {
      logger.error(LOG_MESSAGES.MAX_ATTEMPTS_REACHED(phone));
      // Delete the OTP record after max attempts
      await executeQuery2(SQL_QUERIES.DELETE_OTP, [otpRecord.id]);
      return res.status(400).json({
        success: false,
        message: LOG_MESSAGES.MAX_ATTEMPTS_REACHED(phone),
      });
    }

    // Update attempts
    await executeQuery2(SQL_QUERIES.UPDATE_ATTEMPTS, [otpRecord.id]);

    // Verify OTP
    if (otpRecord.otp === otp) {
      // Delete the OTP record after successful verification
      await executeQuery2(SQL_QUERIES.DELETE_OTP, [otpRecord.id]);

      // Check if user exists
      const users = await executeQuery2(SQL_QUERIES.SELECT_USER, [phone]);

      let userId;
      // Check if user exists
      if (!users || users.length === 0) {
        logger.info(LOG_MESSAGES.USER_NOT_FOUND(phone));
      } else {
        userId = users[0].id;
        logger.info(LOG_MESSAGES.USER_FOUND(phone));
      }

      // Generate JWT token
      const token = JWT.sign({ _id: userId }, process.env.JWT_SECRET, {
        expiresIn: "30d",
      });

      res.status(200).json({
        success: true,
        message: RESPONSE_MESSAGES.OTP_VERIFIED_SUCCESS,
        user: users,
        token,
      });
    } else {
      logger.error(LOG_MESSAGES.INVALID_OTP(phone));
      res.status(400).json({
        success: false,
        message: RESPONSE_MESSAGES.INVALID_OTP_MESSAGE,
        remainingAttempts: 2 - otpRecord.attempts,
      });
    }
  } catch (error) {
    logger.error(LOG_MESSAGES.ERROR_IN_VERIFY_OTP(error));
    res.status(500).json({
      success: false,
      message: RESPONSE_MESSAGES.INTERNAL_SERVER_ERROR,
    });
  }
};

export const resendOtpController = async (req, res) => {
  try {
    const { phone } = req.body;

    // Input validation
    if (!phone) {
      return res.status(400).json({
        success: false,
        message: RESPONSE_MESSAGES.PHONE_REQUIRED,
      });
    }

    // Check if user exists
    const users = await executeQuery2(SQL_QUERIES.SELECT_USER, [phone]);
    if (!users || users.length === 0) {
      return res.status(400).json({
        success: false,
        message: RESPONSE_MESSAGES.USER_NOT_FOUND,
      });
    }

    // Check for recent OTP requests (rate limiting)
    const recentOtpRequests = await executeQuery2(SQL_QUERIES.SELECT_RECENT_OTP, [phone]);
    if (recentOtpRequests && recentOtpRequests.length > 0) {
      const lastRequest = new Date(recentOtpRequests[0].created_at);
      const timeDiff = (new Date() - lastRequest) / 1000; // in seconds
      
      if (timeDiff < 60) { // 1 minute cooldown
        return res.status(429).json({
          success: false,
          message: RESPONSE_MESSAGES.OTP_COOLDOWN,
          retryAfter: Math.ceil(60 - timeDiff)
        });
      }
    }

    // Generate new OTP
    const otp = generateOTP();
    const expiryTime = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry

    // Start database transaction
    await executeQuery2('START TRANSACTION');

    try {
      // Delete any existing OTPs for this phone
      await executeQuery2(SQL_QUERIES.DELETE_RECENT_OTP, [phone]);

      // Insert new OTP
      await executeQuery2(SQL_QUERIES.INSERT_OTP, [
        phone,
        otp,
        expiryTime,
      ]);

      // Send OTP via Twilio
      await client.messages.create({
        body: LOG_MESSAGES.OTP_MESSAGE(otp),
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phone,
      });

      // Commit transaction
      await executeQuery2('COMMIT');

      // Log success
      logger.info(LOG_MESSAGES.OTP_SENT_SUCCESS(phone), {
        phone,
        otpExpiry: expiryTime,
        requestId: req.id
      });

      // Send success response
      return res.status(200).json({
        success: true,
        message: LOG_MESSAGES.OTP_SENT_SUCCESS(phone),
        data: {
          expiryTime: expiryTime,
          retryAfter: 60 // 1 minute cooldown
        }
      });

    } catch (error) {
      // Rollback transaction on error
      await executeQuery2('ROLLBACK');
      throw error;
    }

  } catch (error) {
    // Log error with context
    logger.error(LOG_MESSAGES.ERROR_IN_RESEND_OTP(error), {
      phone: req.body.phone,
      error: error.message,
      stack: error.stack,
      requestId: req.id
    });

    // Handle specific error types
    if (error.code === 'TWILIO_ERROR') {
      return res.status(503).json({
        success: false,
        message: RESPONSE_MESSAGES.SMS_SERVICE_ERROR
      });
    }

    // Generic error response
    return res.status(500).json({
      success: false,
      message: RESPONSE_MESSAGES.INTERNAL_SERVER_ERROR,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
