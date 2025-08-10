import twilio from "twilio";
import dotenv from "dotenv";
import logger from "../utils/logger.js";
import { executeQuery2 } from "../config/db.js";
import { LOG_MESSAGES, RESPONSE_MESSAGES } from "../constants/constants.js";
import { SQL_QUERIES } from "../queries/queries.js";
import JWT from "jsonwebtoken";
import transporter from "../config/email.js";
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
    const { email } = req.body;

    // Validate input
    if (!email) {
      return res.status(400).json({
        success: false,
        message: RESPONSE_MESSAGES.EMAIL_REQUIRED,
      });
    }
    
    //check if email is already in the database
    const users = await executeQuery2(SQL_QUERIES.SELECT_USER_BY_EMAIL, [email]);
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
      email,
      otp,
      expiryTime,
    ]);
    console.log(result);

    // Send OTP via email
    try {
      const emailHtml = generateOtpEmail(users[0], otp);
          
      await transporter.sendMail({
        from: `"Changi Beach Club" <${process.env.EMAIL_USER}>`,
        to: users[0].email,
        subject: "Password Reset OTP - Changi Beach Club",
        html: emailHtml,
      });
      
      logger.info(LOG_MESSAGES.OTP_SENT_SUCCESS(email));
      //return success message
      res.status(200).json({
        success: true,
        message: LOG_MESSAGES.OTP_SENT_SUCCESS(email),
      });
    } catch (emailError) {
      logger.error(LOG_MESSAGES.EMAIL_ERROR(emailError.message));
      //return failed to send otp
      console.log(emailError);
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
    const { email, otp } = req.body;

    // Validate input
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: RESPONSE_MESSAGES.EMAIL_REQUIRED,
      });
    }
    console.log(email, otp);
    // Get latest OTP record
    const otpRecords = await executeQuery2(SQL_QUERIES.SELECT_LATEST_OTP, [
      email,
    ]);
 
    console.log(otpRecords);


    // Check if OTP exists
    if (!otpRecords || otpRecords.length === 0) {
      logger.error(LOG_MESSAGES.NO_OTP_FOUND(email));
      return res.status(400).json({
        success: false,
        message: LOG_MESSAGES.NO_OTP_FOUND(email),
      });
    }

    const otpRecord = otpRecords[0];

    // Check if OTP is expired
    if (new Date() > new Date(otpRecord.expires_at)) {
      logger.error(LOG_MESSAGES.OTP_EXPIRED(email));
      // Delete the expired OTP record
      await executeQuery2(SQL_QUERIES.DELETE_OTP, [otpRecord.id]);
      return res.status(400).json({
        success: false,
        message: LOG_MESSAGES.OTP_EXPIRED(email),
      });
    }

    // Check max attempts (3)
    if (otpRecord.attempts >= 3) {
      logger.error(LOG_MESSAGES.MAX_ATTEMPTS_REACHED(email));
      // Delete the OTP record after max attempts
      await executeQuery2(SQL_QUERIES.DELETE_OTP, [otpRecord.id]);
      return res.status(400).json({
        success: false,
        message: LOG_MESSAGES.MAX_ATTEMPTS_REACHED(email),
      });
    }

    // Update attempts
    await executeQuery2(SQL_QUERIES.UPDATE_ATTEMPTS, [otpRecord.id]);

    // Verify OTP
    if (otpRecord.otp === otp) {
      // Delete the OTP record after successful verification
      await executeQuery2(SQL_QUERIES.DELETE_OTP, [otpRecord.id]);

      // Check if user exists
      const users = await executeQuery2(SQL_QUERIES.SELECT_USER_BY_EMAIL, [email]);

      let userId;
      // Check if user exists
      if (!users || users.length === 0) {
        logger.info(LOG_MESSAGES.USER_NOT_FOUND(email));
      } else {
        userId = users[0].id;
        logger.info(LOG_MESSAGES.USER_FOUND(email));
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
      logger.error(LOG_MESSAGES.INVALID_OTP(email));
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
    const { email } = req.body;
    console.log(email);
    // Input validation
    if (!email) {
      return res.status(400).json({
        success: false,
        message: RESPONSE_MESSAGES.EMAIL_REQUIRED,
      });
    }

    // Check if user exists
    const users = await executeQuery2(SQL_QUERIES.SELECT_USER_BY_EMAIL, [email]);
    if (!users || users.length === 0) {
      return res.status(400).json({
        success: false,
        message: RESPONSE_MESSAGES.USER_NOT_FOUND,
      });
    }

    // Check for recent OTP requests (rate limiting)
    const recentOtpRequests = await executeQuery2(SQL_QUERIES.SELECT_RECENT_OTP, [email]);
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
      // Delete any existing OTPs for this email
      await executeQuery2(SQL_QUERIES.DELETE_RECENT_OTP, [email]);

      // Insert new OTP
      await executeQuery2(SQL_QUERIES.INSERT_OTP, [
        email,
        otp,
        expiryTime,
      ]);

      // Send OTP via email
      const emailHtml = generateOtpEmail(users[0], otp);
          
      await transporter.sendMail({
        from: `"Changi Beach Club" <${process.env.EMAIL_USER}>`,
        to: users[0].email,
        subject: "Password Reset OTP - Changi Beach Club",
        html: emailHtml,
      });

      // Commit transaction
      await executeQuery2('COMMIT');

      // Log success
      logger.info(LOG_MESSAGES.OTP_SENT_SUCCESS(email), {
        email,
        otpExpiry: expiryTime,
        requestId: req.id
      });

      // Send success response
      return res.status(200).json({
        success: true,
        message: LOG_MESSAGES.OTP_SENT_SUCCESS(email),
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
      email: req.body.email,
      error: error.message,
      stack: error.stack,
      requestId: req.id
    });

    // Handle specific error types
    if (error.code === 'EMAIL_ERROR') {
      return res.status(503).json({
        success: false,
        message: RESPONSE_MESSAGES.EMAIL_SERVICE_ERROR
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


export const loginController = async (req, res) => {
  try {
    const { email, password } = req.body; 

    // check is email and password are provided
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: RESPONSE_MESSAGES.EMAIL_AND_PASSWORD_REQUIRED,
      });
    }

    //check if email is valid
    if (!email.includes('@') || !email.includes('.')) {
      return res.status(400).json({
        success: false,
        message: RESPONSE_MESSAGES.INVALID_EMAIL,
      });
    }

    //check if password is valid
    if (!password) {
      return res.status(400).json({
        success: false,
        message: RESPONSE_MESSAGES.PASSWORD_REQUIRED,
      });
    }


    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: RESPONSE_MESSAGES.INVALID_PASSWORD,
      });
    }

    //check if user exists
    const users = await executeQuery2(SQL_QUERIES.SELECT_USER_BY_EMAIL, [email]);
    if (!users || users.length === 0) {
      return res.status(400).json({
        success: false,
        message: RESPONSE_MESSAGES.USER_NOT_FOUND, 
      });
    }
    //check if password is correct
    if (users[0].password !== password) {
      return res.status(400).json({
        success: false,
        message: RESPONSE_MESSAGES.INVALID_PASSWORD,
      });
    } 

    //check if user is active
    if (users[0].is_verified === 0) {
      return res.status(200).json({
        success: true,
        message: RESPONSE_MESSAGES.USER_NOT_VERIFIED, 
        isVerified: false,
      });
    }

    //generate jwt token
    const token = JWT.sign({ _id: users[0].id }, process.env.JWT_SECRET, {
      expiresIn: "30d",
    });

    res.status(200).json({
      success: true,
      message: RESPONSE_MESSAGES.LOGIN_SUCCESS,
      user: users,
      token,
      isVerified: true,
    });
  

  } catch (error) {
    logger.error(LOG_MESSAGES.ERROR_IN_LOGIN(error));
    res.status(500).json({
      success: false,
      message: RESPONSE_MESSAGES.INTERNAL_SERVER_ERROR,
    });
  }
};

export const resetPasswordController = async (req, res) => {
  try {
    const { email, password } = req.body;
 

    

    //check if email is valid
    if (!email.includes('@') || !email.includes('.')) {
      return res.status(400).json({
        success: false,
        message: RESPONSE_MESSAGES.INVALID_EMAIL,
      });
    }

    //check if password is valid
    if (!password) {
      return res.status(400).json({
        success: false,
        message: RESPONSE_MESSAGES.PASSWORD_REQUIRED,
      }); 
    }

    //check if password is valid
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: RESPONSE_MESSAGES.INVALID_PASSWORD,
      });
    }

    //check if user exists 
    const users = await executeQuery2(SQL_QUERIES.SELECT_USER_BY_EMAIL, [email]);
    if (!users || users.length === 0) {
      return res.status(400).json({
        success: false,
        message: RESPONSE_MESSAGES.USER_NOT_FOUND,
      }); 
    }

      //update password
     await executeQuery2(SQL_QUERIES.UPDATE_PASSWORD, [password ,1,users[0].id]);
     const token = JWT.sign({ _id: users[0].id }, process.env.JWT_SECRET, {
      expiresIn: "30d",
    });


  
    res.status(200).json({
      success: true,
      message: RESPONSE_MESSAGES.LOGIN_SUCCESS,
      user: users,
      token,
      isVerified: true,
    });


  } catch (error) {
    logger.error(LOG_MESSAGES.ERROR_IN_RESET_PASSWORD(error));
  }
}; 


// Helper to generate OTP email HTML
export function generateOtpEmail(user, otp) {
  const fullName = user.full_name || user.name || 'Valued Member';
  
  return `
  <!DOCTYPE html>
  <html lang="en">
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f8f9fa;">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 0;">
        <tr>
          <td align="center">
            <table width="600" style="background-color: #ffffff; border-radius: 6px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <tr style="background-color: #00a5ec;">
                <td style="padding: 30px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Changi Beach Club</h1>
                  <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 16px;">Password Reset Verification</p>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="color: #344054; font-size: 16px; margin-bottom: 20px;">Dear <strong>${fullName}</strong>,</p>
                  
                  <p style="color: #344054; font-size: 16px; margin-bottom: 20px;">
                    We received a request to reset your password for your Changi Beach Club account. 
                    To proceed with the password reset, please use the verification code below:
                  </p>
                  
                  <div style="text-align: center; margin: 30px 0;">
                    <div style="background-color: #f3f5f9; border: 2px solid #00a5ec; border-radius: 8px; padding: 20px; display: inline-block;">
                      <p style="margin: 0; font-size: 14px; color: #666; margin-bottom: 10px;">Your Verification Code</p>
                      <p style="margin: 0; font-size: 32px; font-weight: bold; color: #00a5ec; letter-spacing: 5px; font-family: 'Courier New', monospace;">${otp}</p>
                    </div>
                  </div>
                  
                  <p style="color: #344054; font-size: 16px; margin-bottom: 20px;">
                    <strong>Important:</strong>
                  </p>
                  <ul style="color: #344054; font-size: 16px; margin-bottom: 20px;">
                    <li>This code is valid for 5 minutes only</li>
                    <li>Do not share this code with anyone</li>
                    <li>If you didn't request this password reset, please ignore this email</li>
                  </ul>
                  
                  <p style="color: #344054; font-size: 16px; margin-bottom: 20px;">
                    If you have any questions or need assistance, please contact our support team.
                  </p>
                  
                  <p style="color: #344054; font-size: 16px; margin-bottom: 0;">
                    Best regards,<br />
                    <strong style="color: #00a5ec;">Changi Beach Club Team</strong>
                  </p>
                </td>
              </tr>
              <tr style="background-color: #f1f1f1;">
                <td style="padding: 20px 30px; font-size: 12px; color: #444;">
                  <table width="100%">
                    <tr>
                      <td>
                        📧 CBC@Gmail.com<br />
                        📞 +6546 5215<br />
                        📍 Changi Beach Club, 2 Andover Road Singapore 509984
                        🌐 <a href="https://www.changibc.org.sg" style="color: #00a5ec;">www.ChangiBC.org.sg</a>
                      </td>

                       
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;
}

