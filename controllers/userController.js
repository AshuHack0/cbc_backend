import { executeQuery2 } from '../config/db.js';
import { LOG_MESSAGES, RESPONSE_MESSAGES } from '../constants/constants.js';
import logger from '../utils/logger.js';
import { generateCustomUUID } from '../utils/uuid.js';
import { SQL_QUERIES, BOOKING_QUERIES } from '../queries/queries.js';
import STRIPE_PRICES from '../stripePriceMap.js';
import stripe from '../config/stripe.js';
import transporter from '../config/email.js';
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
  

  export const createCheckoutSession = async (req, res) => {
    try {
        // Validate request body
        if (!req.body) {
            logger.error('Request body is missing');
            return res.status(400).json({
                success: false,
                message: 'Request body is required'
            });
        }

        const {
            fullName,
            email,
            phone,
            occupation,
            maritalStatus,
            membershipType,
            packageType,
            packageLabel,
            packagePrice,
            familyMembers,
            interests,
        } = req.body;

        // Validate required fields
        if (!fullName || !email || !phone || !membershipType || !packageType) {
            logger.error('Missing required fields for checkout session');
            return res.status(400).json({
                success: false,
                message: 'fullName, email, phone, membershipType, and packageType are required'
            });
        }

        // 1. Generate UUID and Insert into Member
        const memberId = generateCustomUUID();

        const memberResult = await executeQuery2(
            `INSERT INTO Member (id, fullName, email, phone, occupation, maritalStatus, membershipType, packageType, packageLabel, packagePrice, interests)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [memberId, fullName, email, phone, occupation, maritalStatus, membershipType, packageType, packageLabel, packagePrice, JSON.stringify(interests)]
        );

        logger.info(`Member inserted with ID: ${memberId}`);

        // 2. Insert family members if provided
        if (familyMembers && familyMembers.length > 0) {
            for (const member of familyMembers) {
                const { fullName, role, phone, email, occupation, maritalStatus } = member;
                await executeQuery2(
                    `INSERT INTO FamilyMember (memberId, fullName, role, phone, email, occupation, maritalStatus)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [memberId, fullName, role, phone, email, occupation, maritalStatus]
                );
            }
        }

        // 3. Stripe line items logic
        const line_items = [];

        const subscriptionPriceId =
            STRIPE_PRICES["subscriptions"][membershipType]?.[packageType];

        if (!subscriptionPriceId) {
            logger.error(`Invalid membership/package type: ${membershipType}/${packageType}`);
            return res.status(400).json({ 
                success: false,
                error: "Invalid membership/package type" 
            });
        }

        line_items.push({
            price: subscriptionPriceId,
            quantity: 1,
        });

        if (membershipType === "Family") {
            line_items.push({
                price: STRIPE_PRICES.processingFees[220],
                quantity: 1,
            });

            const additionalMembers = familyMembers ? familyMembers.length : 0;
            if (additionalMembers > 0) {
                const unitAmount = packageType === "monthly" ? 55 * 100 : 660 * 100;

                line_items.push({
                    price_data: {
                        currency: "sgd",
                        product_data: {
                            name: "Additional Family Member",
                        },
                        unit_amount: unitAmount,
                        recurring: {
                            interval: packageType === "monthly" ? "month" : "year",
                        },
                    },
                    quantity: additionalMembers,
                });
            }
        } else {
            if (
                (membershipType === "Individual" && packageType === "monthly") ||
                membershipType === "Senior" ||
                membershipType === "Young Adult" ||
                (membershipType === "Junior" && packageType === "trial")
            ) {
                line_items.push({
                    price: STRIPE_PRICES.processingFees[110],
                    quantity: 1,
                });
            }
        }

        // 4. Create Stripe Checkout Session
        // Ensure CLIENT_URL has proper protocol
        const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
        console.log("clientUrl", clientUrl)
        const baseUrl = clientUrl.startsWith('http') ? clientUrl : `https://${clientUrl}`;
        
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            line_items,
            mode: "subscription",
            customer_email: email,
            success_url: `${baseUrl}/thank-you?token=${memberId}`,
            cancel_url: `${baseUrl}/cancel`,
            metadata: {
                memberId: memberId.toString(),
            },
        });

        // 5. Update member with stripe session ID
        await executeQuery2(
            `UPDATE Member SET stripeSessionId = ? WHERE id = ?`,
            [session.id, memberId]
        );

        logger.info(`Stripe session ID updated: ${session.id} for member: ${memberId}`);

        logger.info(`Checkout session created successfully for member: ${memberId}`);

        res.status(200).json({ 
            success: true,
            message: "Checkout session created successfully",
            url: session.url 
        });

    } catch (error) {
        logger.error(`Error in createCheckoutSession: ${error.message}`);
        console.error('Full error:', error);
        res.status(500).json({ 
            success: false,
            error: "Server error" ,
            errorMessage: error.message
        });
    }
};

export const verifyPayment = async (req, res) => {
    try {
        const { token } = req.query;
        
        if (!token) {
            logger.error('Missing token in verifyPayment');
            return res.status(400).json({ 
                success: false,
                error: "Missing token" 
            });
        }

        // 1. Fetch member by token
        const members = await executeQuery2(SQL_QUERIES.SELECT_MEMBER_BY_ID, [token]);
        const member = members && members.length > 0 ? members[0] : null;

        logger.info(`Looking for member with token: ${token}`);
        logger.info(`Found members: ${JSON.stringify(members)}`);

        if (!member || !member.stripeSessionId) {
            logger.error(`Member not found or session missing for token: ${token}`);
            return res.status(404).json({ 
                success: false,
                error: "Member not found or session missing" 
            });
        }

        // 2. Retrieve Stripe session
        const session = await stripe.checkout.sessions.retrieve(member.stripeSessionId);
        
        if (session.payment_status !== "paid") {
            logger.info(`Payment not completed for member: ${token}, status: ${session.payment_status}`);
            return res.json({ 
                success: false,
                message: "Payment not completed"
            });
        }

        // 3. Update member with payment info
        await executeQuery2(SQL_QUERIES.UPDATE_MEMBER_PAYMENT, [
            session.customer || null, 
            session.subscription || null, 
            token
        ]);

        // 4. Generate membership code if not exists
        if (!member.membershipCode) {
            const prefix = member.packageType === "trial" ? "TRIAL-VTM" : "VTM";
            const membershipCode = await generateUniqueCode(prefix);
            
            logger.info(`Generating membership code: ${membershipCode} for member: ${token}`);
            
            await executeQuery2(SQL_QUERIES.UPDATE_MEMBER_MEMBERSHIP_CODE, [membershipCode, token]);
            
            // Update the member object with the new membership code
            member.membershipCode = membershipCode;
        }

        // 5. Update family members' membership codes
        const familyMembers = await executeQuery2(SQL_QUERIES.SELECT_FAMILY_MEMBERS, [token]);

        if (familyMembers && familyMembers.length > 0) {
            const prefix = member.packageType === "trial" ? "TRIAL-VTM" : "VTM";
            
            for (const familyMember of familyMembers) {
                if (!familyMember.membershipCode) {
                    const membershipCode = await generateUniqueCode(prefix);
                    await executeQuery2(SQL_QUERIES.UPDATE_FAMILY_MEMBER_MEMBERSHIP_CODE, [
                        membershipCode, 
                        familyMember.id
                    ]);
                }
            }
        }

        logger.info(`Payment verified successfully for member: ${token}`);

        // Send welcome email
        try {
          const emailHtml = generateWelcomeEmail(member, familyMembers);
          
          await transporter.sendMail({
            from: `"Changi Beach Club" <${process.env.EMAIL_USER}>`,
            to: member.email,
            subject: "Welcome to Changi Beach Club 🎉",
            html: emailHtml,
          });
          
          logger.info(`Welcome email sent successfully to: ${member.email}`);
        } catch (emailError) {
          logger.error(`Failed to send welcome email: ${emailError.message}`);
          // Don't fail the request if email fails
        }

        res.json({ 
            success: true, 
            member: {
                ...member,
                paymentStatus: 'paid'
            }
        });

    } catch (error) {
        logger.error(`Error in verifyPayment: ${error.message}`);
        console.error('Full error:', error);
        res.status(500).json({ 
            success: false,
            error: "Server error" 
        });
    }
};

// Helper to generate a unique membership code
export const generateUniqueCode = async (prefix) => {
    const random = Math.random().toString(36).slice(2, 7).toUpperCase();
    const code = `${prefix}-${random}`;
    
    // Check uniqueness in both Member and FamilyMember tables
    const members = await executeQuery2('SELECT * FROM Member WHERE membershipCode = ?', [code]);
    const families = await executeQuery2('SELECT * FROM FamilyMember WHERE membershipCode = ?', [code]);
    
    if ((members && members.length > 0) || (families && families.length > 0)) {
        return generateUniqueCode(prefix);
    }
    return code;
};

// Helper to generate welcome email HTML
export function generateWelcomeEmail(member, familyMembers = []) {
  const fullName = member.fullName;
  const membersList = [
    { 
      name: member.fullName, 
      membershipCode: member.membershipCode || 'Pending' 
    },
    ...(familyMembers || []).map((fm) => ({
      name: fm.fullName,
      membershipCode: fm.membershipCode || 'Pending',
    })),
  ];
  
  const tableRows = membersList
    .map(
      (m, index) => `
      <tr>
        <td style="border: 1px solid #DADADA;">${index + 1}</td>
        <td style="border: 1px solid #DADADA;">${m.name}</td>
        <td style="border: 1px solid #DADADA;">${m.membershipCode}</td>
      </tr>
    `
    )
    .join("");
    
  return `
  <!DOCTYPE html>
  <html lang="en">
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f8f9fa;">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 0;">
        <tr>
          <td align="center">
            <table width="600" style="background-color: #ffffff; border-radius: 6px; overflow: hidden;">
              <tr>
                <td style="padding: 0 30px 20px 30px;">
                  <p style="color: #344054; font-size: 16px;">Dear Mr/Ms <strong>${fullName}</strong>,</p>
                  <p style="color: #344054; font-size: 16px;">
                    Thank you for signing up and joining the Changi Beach Club community!<br />
                    We're thrilled that you have decided to join us.
                  </p>
                  <p style="color: #344054; font-size: 16px;">
                    Please head down to Changi Beach Club within the next two weeks to complete your full application and collect your welcome pack, comprising of F&B vouchers and other gifts.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding: 0 30px;">
                  <table width="100%" cellpadding="10" cellspacing="0" style="border-collapse: collapse; border: 1px solid #DADADA;">
                    <thead>
                      <tr style="background-color: #e5f1fb;">
                        <th style="border: 1px solid #DADADA; text-align: left;">No</th>
                        <th style="border: 1px solid #DADADA; text-align: left;">Name</th>
                        <th style="border: 1px solid #DADADA; text-align: left;">Membership ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${tableRows}
                    </tbody>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding: 20px 30px 30px 30px; font-size: 14px; color: #344054;">
                  <p>Please present this ID to the Main Reception at Changi Beach Club and bring along the items below to complete your full registration:</p>
                  <ol>
                    <li>NRIC</li>
                    <li>Passport Size Photo</li>
                    <li>Vehicles Registration Details / Vehicle Log Card</li>
                  </ol>
                  <p>You will be able to book CBC's facilities with the temporary Membership ID issued.</p>
                  <p>If your application has not been processed, please call CBC's office at <strong>6546 5215</strong> to book the facilities.</p>
                  <p>We look forward to connecting with you soon and officially welcoming you to the Changi Beach Club family!</p>
                  <p>Thank you for your trust in us,<br /><strong style="color: #0B6BCB;">Changi Beach Club</strong></p>
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
                      </td>
                      <td align="right">
                        <br />
                        🌐 <a href="https://www.changibc.org.sg">www.ChangiBC.org.sg</a>
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


