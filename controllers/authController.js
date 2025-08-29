import dotenv from "dotenv";
import logger from "../utils/logger.js";
import { executeQuery2 } from "../config/db.js";
import { LOG_MESSAGES, RESPONSE_MESSAGES } from "../constants/constants.js";
import { SQL_QUERIES } from "../queries/queries.js";
import JWT from "jsonwebtoken";
import transporter from "../config/email.js";
import bcrypt from "bcryptjs";
dotenv.config();

 
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

export const getUserDetailsController = async (req, res) => {
  try {
    const { _id } = req.user;
    const user = await executeQuery2(`SELECT * FROM users WHERE id = ?`, [_id]);
    res.status(200).json({
      success: true,
      message: 'User details retrieved successfully',
      user,
    });
  } catch (error) {
    logger.error('Error in getUserDetailsController' + error);
    res.status(500).json({
      success: false,
      message: RESPONSE_MESSAGES.INTERNAL_SERVER_ERROR,
    });
  }
};

export const updateUserDetailsController = async (req, res) => {
  try {
    const { _id } = req.user;
    const { fullName, email, phone, occupation, maritalStatus, dateOfBirth } = req.body;
    
    // Get existing user data first
    const existingUser = await executeQuery2(SQL_QUERIES.SELECT_USER_DETAILS, [_id]);
    if (!existingUser || existingUser.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    
    let profilePictureUrl = existingUser[0].profile_picture;
    
    // Update profile picture if new one is uploaded
    if (req.file) {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      profilePictureUrl = `${baseUrl}/uploads/profiles/${req.file.filename}`;
    }
    
    // Remove profile picture if requested
    if (req.body.removeProfilePicture === 'true') {
      profilePictureUrl = null;
    }
    
    // Update user details
    const result = await executeQuery2(SQL_QUERIES.UPDATE_USER, [
      fullName || existingUser[0].full_name,
      email || existingUser[0].email,
      phone || existingUser[0].phone,
      occupation || existingUser[0].occupation,
      maritalStatus || existingUser[0].marital_status,
      dateOfBirth || existingUser[0].date_of_birth,
      profilePictureUrl,
      _id
    ]);
    
    res.status(200).json({
      success: true,
      message: "User details updated successfully",
      user: {
        fullName: fullName || existingUser[0].full_name,
        email: email || existingUser[0].email,
        phone: phone || existingUser[0].phone,
        occupation: occupation || existingUser[0].occupation,
        maritalStatus: maritalStatus || existingUser[0].marital_status,
        dateOfBirth: dateOfBirth || existingUser[0].date_of_birth,
        profilePicture: profilePictureUrl
      }
    });
  } catch (error) {
    logger.error('Error in updateUserDetailsController' + error);
    res.status(500).json({
      success: false,
      message: "Error updating user details",
      error: error.message
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


export const CreateAdminUser = async (req, res) => {
  try {
    const { email, password, name, role, accessLevel, permissions } = req.body;
    
    // Validate required fields
    if (!email || !password || !name || !role) {
      return res.status(400).json({
        success: false,
        message: "Email, password, name, and role are required",
      });
    }


    console.log( role);

    // Check if admin already exists
    const existingAdmin = await executeQuery2(SQL_QUERIES.SELECT_ADMIN_BY_EMAIL, [email]);
    if (existingAdmin && existingAdmin.length > 0) {
      return res.status(400).json({
        success: false,
        message: RESPONSE_MESSAGES.USER_ALREADY_EXISTS,
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    console.log('Creating admin user with data:', {
      email,
      name,
      role,
      accessLevel,
      permissions,
      isVerified: 1
    });

    // Create new admin user
    const result = await executeQuery2(SQL_QUERIES.CREATE_ADMIN_USER, [
      email,
      hashedPassword,
      name,
      role,
      accessLevel || 'medium',
      JSON.stringify(permissions || []),
      1 // is_verified
    ]);

    if (result && result.insertId) {
      // Fetch the created admin
      const newAdmin = await executeQuery2(SQL_QUERIES.SELECT_USER_BY_ID, [result.insertId]);
      
      logger.info(`Admin user created successfully: ${email}`);
      res.status(201).json({
        success: true,
        message: "Admin user created successfully",
        user: newAdmin[0]
      });
    } else {
      throw new Error("Failed to create admin user");
    }

  } catch (error) {
    logger.error(LOG_MESSAGES.ERROR_IN_CREATE_ADMIN_USER(error));
    res.status(500).json({
      success: false,
      message: RESPONSE_MESSAGES.INTERNAL_SERVER_ERROR,
      
    });
  }
}

export const GetAllAdminUsers = async (req, res) => {
  try {
    const admins = await executeQuery2(SQL_QUERIES.SELECT_ALL_ADMIN_USERS);
    
    if (admins) {
      // Transform admins to match frontend structure
      const transformedAdmins = admins.map(admin => ({
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        accessLevel: admin.access_level,
        status: admin.is_verified ? 'active' : 'inactive',
        lastLogin: admin.last_login || admin.updated_at,
        permissions: admin.permissions ? JSON.parse(admin.permissions) : [],
        createdAt: admin.created_at,
        isSuperAdmin: admin.role === 'super_admin'
      }));

      res.status(200).json({
        success: true,
        users: transformedAdmins,
        total: transformedAdmins.length
      });
    } else {
      res.status(200).json({
        success: true,
        users: [],
        total: 0
      });
    }

  } catch (error) {
    logger.error(LOG_MESSAGES.ERROR_IN_GET_ALL_ADMIN_USERS(error));
    res.status(500).json({
      success: false,
      message: RESPONSE_MESSAGES.INTERNAL_SERVER_ERROR,
    });
  }
} 

export const DeleteAdminUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    // Check if admin exists
    const existingAdmin = await executeQuery2(SQL_QUERIES.SELECT_USER_BY_ID, [id]);
    if (!existingAdmin || existingAdmin.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Admin user not found",
      });
    }

    // Prevent deletion of super admin
    if (existingAdmin[0].role === 'super_admin') {
      return res.status(403).json({
        success: false,
        message: "Cannot delete super admin user",
      });
    }

    // Delete the admin
    const result = await executeQuery2(SQL_QUERIES.DELETE_ADMIN_USER, [id]);
    
    if (result && result.affectedRows > 0) {
      logger.info(`Admin user deleted successfully: ID ${id}`);
      res.status(200).json({
        success: true,
        message: "Admin user deleted successfully",
      });
    } else {
      throw new Error("Failed to delete admin user");
    }

  } catch (error) {
    logger.error(LOG_MESSAGES.ERROR_IN_DELETE_ADMIN_USER(error));
    res.status(500).json({
      success: false,
      message: RESPONSE_MESSAGES.INTERNAL_SERVER_ERROR,
    });
  }
}

export const UpdateAdminUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, password, name, role, accessLevel, permissions, status } = req.body;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    // Check if admin exists
    const existingAdmin = await executeQuery2(SQL_QUERIES.SELECT_USER_BY_ID, [id]);
    if (!existingAdmin || existingAdmin.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Admin user not found",
      });
    }

    // Check if email is being changed and if it already exists
    if (email && email !== existingAdmin[0].email) {
      const emailCheck = await executeQuery2(SQL_QUERIES.SELECT_ADMIN_BY_EMAIL, [email]);
      if (emailCheck && emailCheck.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Email already exists",
        });
      }
    }

    // Hash password if provided
    const hashedPassword = password ? await bcrypt.hash(password, 10) : existingAdmin[0].password;

    // Update admin
    const result = await executeQuery2(SQL_QUERIES.UPDATE_ADMIN_USER, [
      email || existingAdmin[0].email,
      hashedPassword,
      name || existingAdmin[0].name,
      role || existingAdmin[0].role,
      accessLevel || existingAdmin[0].access_level,
      permissions ? JSON.stringify(permissions) : existingAdmin[0].permissions,
      status === 'active' ? 1 : 0,
      id
    ]);

    if (result && result.affectedRows > 0) {
      // Fetch updated admin
      const updatedAdmin = await executeQuery2(SQL_QUERIES.SELECT_USER_BY_ID, [id]);
      
      logger.info(`Admin user updated successfully: ID ${id}`);
      res.status(200).json({
        success: true,
        message: "Admin user updated successfully",
        user: updatedAdmin[0]
      });
    } else {
      throw new Error("Failed to update admin user");
    }

  } catch (error) {
    logger.error(LOG_MESSAGES.ERROR_IN_UPDATE_ADMIN_USER(error));
    res.status(500).json({
      success: false,
      message: RESPONSE_MESSAGES.INTERNAL_SERVER_ERROR,
    });
  }
}

export const GetAdminUserById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const admin = await executeQuery2(SQL_QUERIES.SELECT_USER_BY_ID, [id]);
    
    if (!admin || admin.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Admin user not found",
      });
    }

    // Transform admin to match frontend structure
    const transformedAdmin = {
      id: admin[0].id,
      name: admin[0].name,
      email: admin[0].email,
      role: admin[0].role,
      accessLevel: admin[0].access_level,
      status: admin[0].is_verified ? 'active' : 'inactive',
      lastLogin: admin[0].last_login || admin[0].updated_at,
      permissions: admin[0].permissions ? JSON.parse(admin[0].permissions) : [],
      createdAt: admin[0].created_at,
      isSuperAdmin: admin[0].role === 'super_admin'
    };

    res.status(200).json({
      success: true,
      user: transformedAdmin
    });

  } catch (error) {
    logger.error(LOG_MESSAGES.ERROR_IN_GET_ADMIN_USER(error));
    res.status(500).json({
      success: false,
      message: RESPONSE_MESSAGES.INTERNAL_SERVER_ERROR,
    });
  }
}

export const adminLoginController = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // Check if admin exists
    const admin = await executeQuery2(SQL_QUERIES.SELECT_ADMIN_BY_EMAIL, [email]);
    if (!admin || admin.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Verify password using bcrypt
    const isPasswordValid = await bcrypt.compare(password, admin[0].password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Check if admin is verified
    if (!admin[0].is_verified) {
      return res.status(403).json({
        success: false,
        message: "Admin account is not verified",
      });
    }

    // Update last login
    await executeQuery2(SQL_QUERIES.UPDATE_ADMIN_LAST_LOGIN, [admin[0].id]);

    // Generate JWT token
    const token = JWT.sign(
      { 
        _id: admin[0].id, 
        email: admin[0].email, 
        role: admin[0].role,
        accessLevel: admin[0].access_level 
      }, 
      process.env.JWT_SECRET, 
      { expiresIn: "24h" }
    );

    // Transform admin data for response
    const adminData = {
      id: admin[0].id,
      name: admin[0].name,
      email: admin[0].email,
      role: admin[0].role,
      accessLevel: admin[0].access_level,
      permissions: admin[0].permissions ? JSON.parse(admin[0].permissions) : [],
      isSuperAdmin: admin[0].role === 'super_admin'
    };

    logger.info(`Admin login successful: ${email}`);
    res.status(200).json({
      success: true,
      message: "Admin login successful",
      admin: adminData,
      token,
    });

  } catch (error) {
    logger.error(`Error in adminLoginController: ${error.message}`);
    res.status(500).json({
      success: false,
      message: RESPONSE_MESSAGES.INTERNAL_SERVER_ERROR,
    });
  }
};