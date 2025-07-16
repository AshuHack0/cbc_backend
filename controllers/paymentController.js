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
