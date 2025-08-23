import { executeQuery2 } from '../config/db.js';
import { LOG_MESSAGES, RESPONSE_MESSAGES } from '../constants/constants.js';
import logger from '../utils/logger.js';
import { SQL_QUERIES } from '../queries/queries.js';
import stripe from '../config/stripe.js';

export const createPaymentIntent = async (req, res) => {
    try {
        const { _id } = req.user;
        
        // Validate request body
        if (!req.body) {
            logger.error('Request body is missing');
            return res.status(400).json({
                success: false,
                message: 'Request body is required'
            });
        }

        const { amount, currency , facility_id, date , slot, formattedBookings } = req.body;

        // Validate amount
        if (!amount || amount <= 0) {
            logger.error('Invalid amount provided');
            return res.status(400).json({
                success: false,
                message: 'Valid amount is required'
            });
        }

        // Create a PaymentIntent with the order amount and currency
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // Convert to smallest currency unit (paise for INR)
            currency: currency,
            metadata: {
                user_id: _id,
                facility_id: facility_id,
                slot: slot,
                date: date,
                formattedBookings: formattedBookings
            },
            automatic_payment_methods: {
                enabled: true,
                allow_redirects: 'never'
            }
        });

        // Update metadata with payment intent ID after creation
        await stripe.paymentIntents.update(paymentIntent.id, {
            metadata: {
                user_id: _id,
                order_id: paymentIntent.id,
                facility_id: facility_id,
                slot: slot,
                date: date,
                formattedBookings: formattedBookings
            }
        });

        logger.info(`Payment intent created successfully for user: ${_id}`);

        // Insert initial payment record
        await executeQuery2(SQL_QUERIES.CREATE_PAYMENT_RECORD, [
            _id,
            'pending',
            amount,
            new Date(),
            paymentIntent.id
        ]);

        res.status(200).json({
            success: true,
            message: RESPONSE_MESSAGES.PAYMENT_INTENT_CREATED,
            clientSecret: paymentIntent.client_secret
        });

    } catch (error) {
        logger.error(`Error in payment intent creation: ${error.message}`);
        console.error('Full error:', error);
        res.status(500).json({
            success: false,
            message: error.message || RESPONSE_MESSAGES.INTERNAL_SERVER_ERROR
        });
    }
};


export const createPaymentIntentForRoom = async (req, res) => {
    try {
        const { _id } = req.user;
        
        // Validate request body
        if (!req.body) {
            logger.error('Request body is missing');
            return res.status(400).json({
                success: false,
                message: 'Request body is required'
            });
        }

        const { amount, currency , room_id, date , room_count, adult_count, children_count, total_nights ,start_date, end_date  } = req.body;

        // Validate amount
        if (!amount || amount <= 0) {
            logger.error('Invalid amount provided');
            return res.status(400).json({
                success: false,
                message: 'Valid amount is required'
            });
        }

        // Create a PaymentIntent with the order amount and currency
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // Convert to smallest currency unit (paise for INR)
            currency: currency,
            metadata: {
                user_id: _id,
                room_id: room_id,
                room_count: room_count,
                adult_count: adult_count,
                children_count: children_count,
                total_nights: total_nights,
                date: date,
                start_date: start_date,
                end_date: end_date
            },
            automatic_payment_methods: {
                enabled: true,
                allow_redirects: 'never'
            }
        });

        // Update metadata with payment intent ID after creation
        await stripe.paymentIntents.update(paymentIntent.id, {
            metadata: {
                user_id: _id,
                order_id: paymentIntent.id,
                room_id: room_id,
                room_count: room_count,
                adult_count: adult_count,
                children_count: children_count,
                total_nights: total_nights,
                date: date,
                start_date: start_date,
                end_date: end_date
            }
        });

        logger.info(`Payment intent created successfully for user: ${_id}`);

        // Insert initial payment record
        await executeQuery2(SQL_QUERIES.CREATE_ROOM_PAYMENT_RECORD, [
            paymentIntent.id,
            paymentIntent.id, // order_id same as payment_intent_id
            _id,
            room_id,
            amount,
            currency,
            room_count,
            adult_count,
            children_count,
            total_nights,
            date,
            start_date,
            end_date,
            'pending',
            paymentIntent.client_secret
        ]);

        res.status(200).json({
            success: true,
            message: RESPONSE_MESSAGES.PAYMENT_INTENT_CREATED,
            clientSecret: paymentIntent.client_secret
        });

    } catch (error) {
        logger.error(`Error in payment intent creation: ${error.message}`);
        console.error('Full error:', error);
        res.status(500).json({
            success: false,
            message: error.message || RESPONSE_MESSAGES.INTERNAL_SERVER_ERROR
        });
    }
};


export const handleWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        // Verify webhook signature using raw body
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );

        // Log the event type for debugging
        logger.info(`Processing webhook event: ${event.type}`);
        logger.info(`Webhook event data: ${JSON.stringify(event, null, 2)}`);
        // Handle the event
        switch (event.type) {
            case 'payment_intent.succeeded':
                const paymentIntent = event.data.object;
                try {
                    // Update payment status in database 
                    logger.info(`Payment intent succeeded: ${JSON.stringify(paymentIntent, null, 2)}`);
                    await executeQuery2(SQL_QUERIES.UPDATE_PAYMENT_STATUS, [
                        'completed',
                        paymentIntent.amount / 100,
                        new Date(),
                        paymentIntent.id,
                        paymentIntent.id, // Using payment intent ID as order ID
                        paymentIntent.metadata.user_id,
                        paymentIntent.metadata.date,
                        paymentIntent.metadata.formattedBookings
                    ]);

                    // Create booking record
                    await executeQuery2(SQL_QUERIES.CREATE_BOOKING_RECORD, [
                        paymentIntent.metadata.user_id,
                        paymentIntent.id, // Using payment intent ID as order ID
                        new Date(),
                        'confirmed',
                        paymentIntent.metadata.facility_id,
                        paymentIntent.metadata.date,
                        paymentIntent.metadata.slot,
                        paymentIntent.metadata.formattedBookings
                    ]);

                    logger.info(`Payment succeeded for order: ${paymentIntent.id}`);
                } catch (dbError) {
                    logger.error(`Database error processing successful payment: ${dbError.message}`);
                    console.log("dbError", dbError);
                    // Don't throw the error - we'll handle it asynchronously
                }
                break;

            case 'payment_intent.payment_failed':
                const failedPayment = event.data.object;
                try {
                    console.log("failedPayment", failedPayment);
                    await executeQuery2(SQL_QUERIES.UPDATE_PAYMENT_STATUS, [
                        'failed',
                        failedPayment.amount / 100,
                        new Date(),
                        failedPayment.id,
                        failedPayment.id, // Using payment intent ID as order ID
                        failedPayment.metadata.user_id
                    ]);

                    logger.error(`Payment failed for order: ${failedPayment.id}`);
                } catch (dbError) {
                    // Log the error but still acknowledge the webhook
                    logger.error(`Database error processing failed payment: ${dbError.message}`);
                }
                break;

            case 'payment_intent.processing':
                const processingPayment = event.data.object;
                try {
                    await executeQuery2(SQL_QUERIES.UPDATE_PAYMENT_STATUS, [
                        'processing',
                        processingPayment.amount / 100,
                        new Date(),
                        processingPayment.id,
                        processingPayment.id, // Using payment intent ID as order ID
                        processingPayment.metadata.user_id
                    ]);
                } catch (dbError) {
                    // Log the error but still acknowledge the webhook
                    logger.error(`Database error processing payment in processing state: ${dbError.message}`);
                }
                break;

            case 'payment_intent.canceled':
                const canceledPayment = event.data.object;
                try {
                    await executeQuery2(SQL_QUERIES.UPDATE_PAYMENT_STATUS, [
                        'canceled',
                        canceledPayment.amount / 100,
                        new Date(),
                        canceledPayment.id,
                        canceledPayment.id, // Using payment intent ID as order ID
                        canceledPayment.metadata.user_id
                    ]);
                } catch (dbError) {
                    // Log the error but still acknowledge the webhook
                    logger.error(`Database error processing canceled payment: ${dbError.message}`);
                }
                break;

            default:
                logger.info(`Unhandled event type: ${event.type}`);
        }

        // Always return a 200 response to acknowledge receipt of the event
        res.status(200).json({ received: true });
        
    } catch (err) {
        if (err.type === 'StripeSignatureVerificationError') {
            // For signature verification errors, return 400 as this indicates an invalid request
            logger.error(`Webhook signature verification failed: ${err.message}`);
            return res.status(400).json({
                success: false,
                message: 'Webhook signature verification failed'
            });
        }

        // For all other errors, log them but still return 200 to acknowledge receipt
        logger.error(`Error processing webhook: ${err.message}`);
        res.status(200).json({
            received: true,
            warning: 'Webhook received but processing encountered an error'
        });
    }
};
 


export const getPaymentStatus = async (req, res) => {
    const { _id } = req.user;
    const { orderId } = req.query;
    console.log("orderId", orderId); 
    try {
        // Get payment status with order ID for more precise tracking
        const [payment] = await executeQuery2(
            SQL_QUERIES.GET_PAYMENT_STATUS_BY_ORDER, 
            [_id, orderId]
        );
        
        if (!payment) {
            return res.status(404).json({
                success: false,
                message: RESPONSE_MESSAGES.PAYMENT_NOT_FOUND
            });
        }

        // Get booking details if payment is completed
        let bookingDetails = null;
        if (payment.status === 'completed') {
            [bookingDetails] = await executeQuery2(
                SQL_QUERIES.GET_BOOKING_DETAILS,
                [orderId]
            );
        }
        console.log("payment", payment);
        res.status(200).json({
            success: true,
            message: RESPONSE_MESSAGES.PAYMENT_STATUS_RETRIEVED,
            payment: {
                status: payment.status,
                amount: payment.amount,
                date: payment.payment_date,
                transactionId: payment.transaction_id,
                orderId: payment.order_id,
                booking: bookingDetails
            }
        });

    } catch (error) {
        logger.error(LOG_MESSAGES.ERROR_IN_GET_PAYMENT_STATUS(error)); 
        console.log("error", error);
        res.status(500).json({
            success: false,
            message: RESPONSE_MESSAGES.INTERNAL_SERVER_ERROR
        });
    }
};



export const getPaymentStatusRooms = async (req, res) => {
    const { _id } = req.user; 
    console.log("user id", _id);
    const { orderId } = req.query;
    console.log("orderId", orderId); 
    try {
        // Get payment status with order ID for more precise tracking
        const [payment] = await executeQuery2(
            SQL_QUERIES.GET_ROOM_PAYMENT_DETAILS, 
            [orderId, _id]
        );
        
        if (!payment) {
            return res.status(404).json({
                success: false,
                message: RESPONSE_MESSAGES.PAYMENT_NOT_FOUND
            });
        }

 
       
        console.log("payment", payment);
        res.status(200).json({
            success: true,
            message: RESPONSE_MESSAGES.PAYMENT_STATUS_RETRIEVED,
            payment: {
                status: payment.status,
                amount: payment.amount,
                date: payment.payment_date,
                transactionId: payment.transaction_id,
                orderId: payment.order_id,
                room_id: payment.room_id,
               
            }
        });

    } catch (error) {
        logger.error(LOG_MESSAGES.ERROR_IN_GET_PAYMENT_STATUS(error)); 
        console.log("error", error);
        res.status(500).json({
            success: false,
            message: RESPONSE_MESSAGES.INTERNAL_SERVER_ERROR
        });
    }
};

export const createFreeBooking = async (req, res) => {
    try {
        const { _id } = req.user;
        
        // Validate request body
        if (!req.body) {
            logger.error('Request body is missing');
            return res.status(400).json({
                success: false,
                message: 'Request body is required'
            });
        }

        const { facility_id, start_time, end_time, date , slot, formattedBookings} = req.body;

        // Validate required fields
        if (!facility_id || !date) {
            logger.error('Missing required fields for free booking');
            return res.status(400).json({
                success: false,
                message: 'facility_id, start_time, end_time, and date are required'
            });
        }

        // Generate a unique booking ID
        const bookingId = `free_booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const amount = 0;

        try {
            // Insert payment record for free booking
            await executeQuery2(SQL_QUERIES.CREATE_PAYMENT_RECORD_FOR_FREE_BOOKING, [
                _id,
                'completed', // Mark as completed since it's free
                amount,
                new Date(),
                bookingId,
                bookingId

            ]);

            // Create booking record
            await executeQuery2(SQL_QUERIES.CREATE_BOOKING_RECORD, [
                _id,
                bookingId, // Using generated booking ID
                new Date(),
                'confirmed',
                facility_id,
                date,
                slot,
                formattedBookings
            ]);

            logger.info(`Free booking created successfully for user: ${_id}, booking ID: ${bookingId}`);

            res.status(200).json({
                success: true,
                message: 'Free booking created successfully',
                booking: {
                    bookingId: bookingId,
                    userId: _id,
                    facilityId: facility_id,
                    startTime: start_time,
                    endTime: end_time,
                    date: date,
                    amount: amount,
                    status: 'confirmed',
                    paymentStatus: 'completed'
                }
            });

        } catch (dbError) {
            logger.error(`Database error creating free booking: ${dbError.message}`);
            console.error('Database error:', dbError);
            
            // If there was an error, we might want to clean up any partial records
            // This is a simplified cleanup - in production you might want more sophisticated error handling
            try {
                await executeQuery2('DELETE FROM payments WHERE order_id = ?', [bookingId]);
                await executeQuery2('DELETE FROM bookings WHERE order_id = ?', [bookingId]);
            } catch (cleanupError) {
                logger.error(`Error during cleanup: ${cleanupError.message}`);
            }
            
            throw dbError;
        }

    } catch (error) {
        logger.error(`Error in free booking creation: ${error.message}`);
        console.error('Full error:', error);
        res.status(500).json({
            success: false,
            message: error.message || RESPONSE_MESSAGES.INTERNAL_SERVER_ERROR
        });
    }
};


export const createCashPayment = async (req, res) => {
    try {
        const { _id } = req.user;
        
        // Validate request body
        if (!req.body) {
            logger.error('Request body is missing');
            return res.status(400).json({
                success: false,
                message: 'Request body is required'
            });
        }

        const { amount, facility_id, date, slot, formattedBookings } = req.body;

        // Validate required fields
        if (!amount || amount <= 0) {
            logger.error('Invalid amount provided for cash payment');
            return res.status(400).json({
                success: false,
                message: 'Valid amount is required for cash payment'
            });
        }

        if (!facility_id || !date) {
            logger.error('Missing required fields for cash payment');
            return res.status(400).json({
                success: false,
                message: 'facility_id and date are required'
            });
        }

        const sgDate = new Date(
            new Date().toLocaleString("en-US", { timeZone: "Asia/Singapore" })
          );
        // Generate a unique order ID for cash payment
        const orderId = `cash_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            // Insert payment record for cash payment with pending status
            await executeQuery2(SQL_QUERIES.CREATE_PAYMENT_RECORD_FOR_CASH, [
                _id,
                'pending', // status is pending
                amount,
                sgDate,
                orderId,
                orderId
            ]);

            // Create booking record with pending status
            await executeQuery2(SQL_QUERIES.CREATE_BOOKING_RECORD_FOR_CASH, [
                _id,
                orderId,
                sgDate,
                'pending', // booking status is pending
                facility_id,
                date,
                slot,
                formattedBookings
            ]);

            logger.info(`Cash payment record created successfully for user: ${_id}, order ID: ${orderId}`);

            res.status(200).json({
                success: true,
                message: 'Cash payment record created successfully',
                booking: {
                    orderId: orderId,
                    userId: _id,
                    facilityId: facility_id,
                    date: date,
                    slot: slot,
                    amount: amount,
                    status: 'pending',
                    paymentStatus: 'not completed'
                }
            });

        } catch (dbError) {
            logger.error(`Database error creating cash payment: ${dbError.message}`);
            console.error('Database error:', dbError);
            
            // Clean up any partial records
            try {
                await executeQuery2('DELETE FROM payments WHERE order_id = ?', [orderId]);
                await executeQuery2('DELETE FROM bookings WHERE order_id = ?', [orderId]);
            } catch (cleanupError) {
                logger.error(`Error during cleanup: ${cleanupError.message}`);
            }
            
            throw dbError;
        }

    } catch (error) {
        logger.error(`Error in cash payment creation: ${error.message}`);
        console.error('Full error:', error);
        res.status(500).json({
            success: false,
            message: error.message || RESPONSE_MESSAGES.INTERNAL_SERVER_ERROR
        });
    }
};


export const createCashPaymentRooms = async (req, res) => {
    try {
        const { _id } = req.user;
        
        // Validate request body
        if (!req.body) {
            logger.error('Request body is missing');
            return res.status(400).json({
                success: false,
                message: 'Request body is required'
            });
        }

        const { amount, room_id, date, room_count, adult_count, children_count, total_nights, start_date, end_date, currency } = req.body;

        // Validate required fields
        if (!amount || amount <= 0) {
            logger.error('Invalid amount provided for room cash payment');
            return res.status(400).json({
                success: false,
                message: 'Valid amount is required for room cash payment'
            });
        }

        if (!room_id || !date) {
            logger.error('Missing required fields for room cash payment');
            return res.status(400).json({
                success: false,
                message: 'room_id and date are required'
            });
        }

        // Generate a unique order ID for room cash payment
        const orderId = `room_cash_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            // Insert payment record for room cash payment with pending status
            await executeQuery2(SQL_QUERIES.CREATE_ROOM_PAYMENT_RECORD, [
                orderId,
                orderId, // payment_intent_id same as order_id for cash
                _id,
                room_id,
                amount,
                currency || 'SGD',
                room_count,
                adult_count,
                children_count,
                total_nights,
                date,
                start_date,
                end_date,
                'pending',
                null // no client_secret for cash payments
            ]);

            logger.info(`Room cash payment record created successfully for user: ${_id}, order ID: ${orderId}`);

            res.status(200).json({
                success: true,
                message: 'Room cash payment record created successfully',
                booking: {
                    orderId: orderId,
                    userId: _id,
                    roomId: room_id,
                    date: date,
                    startDate: start_date,
                    endDate: end_date,
                    roomCount: room_count,
                    adultCount: adult_count,
                    childrenCount: children_count,
                    totalNights: total_nights,
                    amount: amount,
                    currency: currency || 'SGD',
                    status: 'pending',
                    paymentStatus: 'pending'
                }
            });

        } catch (dbError) {
            logger.error(`Database error creating room cash payment: ${dbError.message}`);
            console.error('Database error:', dbError);
            
            // Clean up any partial records
            try {
                await executeQuery2('DELETE FROM payments_rooms WHERE payment_intent_id = ?', [orderId]);
            } catch (cleanupError) {
                logger.error(`Error during cleanup: ${cleanupError.message}`);
            }
            
            throw dbError;
        }

    } catch (error) {
        logger.error(`Error in room cash payment creation: ${error.message}`);
        console.error('Full error:', error);
        res.status(500).json({
            success: false,
            message: error.message || RESPONSE_MESSAGES.INTERNAL_SERVER_ERROR
        });
    }
};

export const updateCashPaymentStatus = async (req, res) => {
    try {
        const { _id } = req.user;
        const { orderId, status, paymentStatus } = req.body;

        // Validate request body
        if (!req.body) {
            logger.error('Request body is missing');
            return res.status(400).json({
                success: false,
                message: 'Request body is required'
            });
        }

        if (!orderId) {
            logger.error('Order ID is missing');
            return res.status(400).json({
                success: false,
                message: 'Order ID is required'
            });
        }

        // Validate status values
        const validStatuses = ['pending', 'confirmed', 'cancelled'];
        const validPaymentStatuses = ['not completed', 'completed', 'failed'];

        if (status && !validStatuses.includes(status)) {
            logger.error('Invalid status provided');
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Must be one of: pending, confirmed, cancelled'
            });
        }

        if (paymentStatus && !validPaymentStatuses.includes(paymentStatus)) {
            logger.error('Invalid payment status provided');
            return res.status(400).json({
                success: false,
                message: 'Invalid payment status. Must be one of: not completed, completed, failed'
            });
        }

        try {
            // Update payment status if provided
            if (paymentStatus) {
                await executeQuery2(SQL_QUERIES.UPDATE_CASH_PAYMENT_STATUS, [
                    paymentStatus,
                    new Date(),
                    orderId
                ]);
            }

            // Update booking status if provided
            if (status) {
                await executeQuery2(SQL_QUERIES.UPDATE_CASH_BOOKING_STATUS, [
                    status,
                    new Date(),
                    orderId
                ]);
            }

            logger.info(`Cash payment status updated successfully for order: ${orderId}`);

            res.status(200).json({
                success: true,
                message: 'Cash payment status updated successfully',
                orderId: orderId,
                updatedStatus: status,
                updatedPaymentStatus: paymentStatus
            });

        } catch (dbError) {
            logger.error(`Database error updating cash payment status: ${dbError.message}`);
            console.error('Database error:', dbError);
            throw dbError;
        }

    } catch (error) {
        logger.error(`Error in updating cash payment status: ${error.message}`);
        console.error('Full error:', error);
        res.status(500).json({
            success: false,
            message: error.message || RESPONSE_MESSAGES.INTERNAL_SERVER_ERROR
        });
    }
};

export const checkExpiredCashPayments = async () => {
  try {
    // Find cash payments that are pending and older than 6 hours
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    
    const expiredPayments = await executeQuery2(SQL_QUERIES.GET_EXPIRED_CASH_PAYMENTS, [sixHoursAgo]);
    
    if (expiredPayments.length > 0) {
      logger.info(`Found ${expiredPayments.length} expired cash payments to update`);
      
      for (const payment of expiredPayments) {
        try {
          // Update payment status to failed
          await executeQuery2(SQL_QUERIES.UPDATE_EXPIRED_CASH_PAYMENT, [
            'failed',
            new Date(),
            payment.order_id
          ]);
          
          // Update booking status to failed
          await executeQuery2(SQL_QUERIES.UPDATE_EXPIRED_CASH_BOOKING, [
            'failed',
            new Date(),
            payment.order_id
          ]);
          
          logger.info(`Updated expired cash payment: ${payment.order_id}`);
        } catch (updateError) {
          logger.error(`Error updating expired cash payment ${payment.order_id}: ${updateError.message}`);
        }
      }
    }
    
    return expiredPayments.length;
  } catch (error) {
    logger.error(`Error checking expired cash payments: ${error.message}`);
    throw error;
  }
};

export const handleRoomWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        // Verify webhook signature using raw body
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET_ROOM
        );

        // Log the event type for debugging
        logger.info(`Processing room webhook event: ${event.type}`);
        logger.info(`Room webhook event data: ${JSON.stringify(event, null, 2)}`);

        // Handle the event
        switch (event.type) {
            case 'payment_intent.succeeded':
                const paymentIntent = event.data.object;
                try {
                    // Update payment status in database 
                    logger.info(`Room payment intent succeeded: ${JSON.stringify(paymentIntent, null, 2)}`);
                    await executeQuery2(SQL_QUERIES.UPDATE_ROOM_PAYMENT_STATUS, [
                        'succeeded',
                        paymentIntent.amount / 100,
                        paymentIntent.id,
                        paymentIntent.metadata.user_id
                    ]);

                    logger.info(`Room payment succeeded for payment intent: ${paymentIntent.id}`);
                } catch (dbError) {
                    logger.error(`Database error processing successful room payment: ${dbError.message}`);
                    console.log("dbError", dbError);
                    // Don't throw the error - we'll handle it asynchronously
                }
                break;

            case 'payment_intent.payment_failed':
                const failedPayment = event.data.object;
                try {
                    await executeQuery2(SQL_QUERIES.UPDATE_ROOM_PAYMENT_STATUS, [
                        'failed',
                        failedPayment.amount / 100,
                        failedPayment.id,
                        failedPayment.metadata.user_id
                    ]);

                    logger.error(`Room payment failed for payment intent: ${failedPayment.id}`);
                } catch (dbError) {
                    logger.error(`Database error processing failed room payment: ${dbError.message}`);
                }
                break;

            case 'payment_intent.processing':
                const processingPayment = event.data.object;
                try {
                    await executeQuery2(SQL_QUERIES.UPDATE_ROOM_PAYMENT_STATUS, [
                        'processing',
                        processingPayment.amount / 100,
                        processingPayment.id,
                        processingPayment.metadata.user_id
                    ]);
                } catch (dbError) {
                    logger.error(`Database error processing room payment in processing state: ${dbError.message}`);
                }
                break;

            case 'payment_intent.canceled':
                const canceledPayment = event.data.object;
                try {
                    await executeQuery2(SQL_QUERIES.UPDATE_ROOM_PAYMENT_STATUS, [
                        'cancelled',
                        canceledPayment.amount / 100,
                        canceledPayment.id,
                        canceledPayment.metadata.user_id
                    ]);
                } catch (dbError) {
                    logger.error(`Database error processing canceled room payment: ${dbError.message}`);
                }
                break;

            default:
                logger.info(`Unhandled room webhook event type: ${event.type}`);
        }

        // Always return a 200 response to acknowledge receipt of the event
        res.status(200).json({ received: true });
        
    } catch (err) {
        if (err.type === 'StripeSignatureVerificationError') {
            // For signature verification errors, return 400 as this indicates an invalid request
            logger.error(`Room webhook signature verification failed: ${err.message}`);
            return res.status(400).json({
                success: false,
                message: 'Room webhook signature verification failed'
            });
        }

        // For all other errors, log them but still return 200 to acknowledge receipt
        logger.error(`Error processing room webhook: ${err.message}`);
        res.status(200).json({
            received: true,
            warning: 'Room webhook received but processing encountered an error'
        });
    }
};

export const getCashPaymentExpiryTime = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { _id } = req.user;
    
    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required'
      });
    }
    
    // Get payment details and calculate expiry time
    const [payment] = await executeQuery2(SQL_QUERIES.GET_CASH_PAYMENT_EXPIRY, [orderId, _id]);
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }
    
    if (payment.status !== 'pending' && payment.paymentStatus !== 'not completed') {
      return res.status(400).json({
        success: false,
        message: 'Payment is not pending'
      });
    }
    
    // Calculate expiry time (6 hours from booking time)
    const bookingTime = new Date(payment.booking_date);
    const expiryTime = new Date(bookingTime.getTime() + 6 * 60 * 60 * 1000);
    const now = new Date();
    const timeRemaining = expiryTime.getTime() - now.getTime();
    
    // Check if payment has expired
    const isExpired = timeRemaining <= 0;
    
    res.status(200).json({
      success: true,
      data: {
        orderId: payment.order_id,
        bookingTime: payment.booking_date,
        expiryTime: expiryTime,
        timeRemaining: Math.max(0, timeRemaining),
        isExpired: isExpired,
        hoursRemaining: Math.max(0, Math.floor(timeRemaining / (1000 * 60 * 60))),
        minutesRemaining: Math.max(0, Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60)))
      }
    });
    
  } catch (error) {
    logger.error(`Error getting cash payment expiry time: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message || RESPONSE_MESSAGES.INTERNAL_SERVER_ERROR
    });
  }
};


export const getAllCashPayment = async (req, res) => {
    try {
     
      const cashPayment = await executeQuery2(SQL_QUERIES.GET_ALL_CASH_PAYMENT); 
     

      const cashPaymentWithBookingTime = cashPayment.map(payment => { 
        return {
          ...payment,
          bookingTime: JSON.parse(payment.boking_time_json),
          boking_time_json: undefined,
          start_time:undefined,
          end_time:undefined,
          availability_status:undefined,
          unit:undefined,
        } 
        
      });

      res.status(200).json({
        success: true,
        message: "Cash payment fetched successfully",
        cashPayment: cashPaymentWithBookingTime
      });
         
    } catch (error) {
        logger.error(`Error in getting all cash payment: ${error.message}`);
        console.error('Full error:', error);
        res.status(500).json({
            success: false,
            message: error.message || RESPONSE_MESSAGES.INTERNAL_SERVER_ERROR
        });
    }
}

export const ApproveCashPayments = async (req, res) => {
    try {

        // its a put method so we need to get the orderId from the body
        const { orderId } = req.body;
        console.log("orderId", orderId);
        

        // Update payment status to completed
        const payment =  await executeQuery2(SQL_QUERIES.UPDATE_CASH_PAYMENT_STATUS, [
            'completed', 
            orderId
        ]);

        // Update booking status to completed
        const booking = await executeQuery2(SQL_QUERIES.UPDATE_CASH_BOOKING_STATUS, [
            'confirmed',
            orderId
        ]);

        //if not d
        if (!payment || !booking) {
            return res.status(400).json({
                success: false,
                message: "Payment or booking not found"
            });
        }

        console.log("payment", payment);
        console.log("booking", booking);

 
        res.status(200).json({
            success: true,
            message: "Cash payment approved successfully",
            orderId: orderId
        });

    } catch (error) {
        logger.error(`Error in approving cash payment: ${error.message}`);
        console.error('Full error:', error);
        res.status(500).json({
            success: false,
            message: error.message || RESPONSE_MESSAGES.INTERNAL_SERVER_ERROR 
        });
    }
}

export const getAllPayment = async (req, res) => {
    try {
        const payment = await executeQuery2(SQL_QUERIES.GET_ALL_PAYMENT); 

        const paymentWithBookingTime = payment.map(payment => {
            return {
                ...payment,
                bookingTime: JSON.parse(payment.boking_time_json),
                boking_time_json: undefined,
            }
        });
        res.status(200).json({
            success: true,
            message: "Payment fetched successfully",
            payment: paymentWithBookingTime
        });
    } catch (error) {
        logger.error(`Error in getting all payment: ${error.message}`);
        console.error('Full error:', error);
        res.status(500).json({
            success: false,
            message: error.message || RESPONSE_MESSAGES.INTERNAL_SERVER_ERROR
        });
    }
}