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

        const { amount, currency = 'inr' } = req.body;

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
                user_id: _id
            },
            automatic_payment_methods: {
                enabled: true,
                allow_redirects: 'never'
            }
        });

        logger.info(`Payment intent created successfully for user: ${_id}`);

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

        // Handle the event
        switch (event.type) {
            case 'payment_intent.succeeded':
                const paymentIntent = event.data.object;
                try {
                    // Update payment status in database
                    await executeQuery2(SQL_QUERIES.UPDATE_PAYMENT_STATUS, [
                        'completed',
                        paymentIntent.amount / 100,
                        new Date(),
                        paymentIntent.id,
                        paymentIntent.metadata.order_id,
                        paymentIntent.metadata.user_id
                    ]);

                    // Create booking record
                    await executeQuery2(SQL_QUERIES.CREATE_BOOKING_RECORD, [
                        paymentIntent.metadata.user_id,
                        paymentIntent.metadata.order_id,
                        new Date(),
                        'confirmed'
                    ]);

                    logger.info(`Payment succeeded for order: ${paymentIntent.metadata.order_id}`);
                } catch (dbError) {
                    logger.error(`Database error processing successful payment: ${dbError.message}`);
                    throw dbError;
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
                        failedPayment.metadata.order_id,
                        failedPayment.metadata.user_id
                    ]);

                    logger.error(`Payment failed for order: ${failedPayment.metadata.order_id}`);
                } catch (dbError) {
                    logger.error(`Database error processing failed payment: ${dbError.message}`);
                    throw dbError;
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
                        processingPayment.metadata.order_id,
                        processingPayment.metadata.user_id
                    ]);
                } catch (dbError) {
                    logger.error(`Database error processing payment in processing state: ${dbError.message}`);
                    throw dbError;
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
                        canceledPayment.metadata.order_id,
                        canceledPayment.metadata.user_id
                    ]);
                } catch (dbError) {
                    logger.error(`Database error processing canceled payment: ${dbError.message}`);
                    throw dbError;
                }
                break;

            default:
                logger.info(`Unhandled event type: ${event.type}`);
        }

        // Return a 200 response to acknowledge receipt of the event
        res.json({received: true});
        
    } catch (err) {
        if (err.type === 'StripeSignatureVerificationError') {
            logger.error(`Webhook signature verification failed: ${err.message}`);
            return res.status(400).json({
                success: false,
                message: 'Webhook signature verification failed'
            });
        }

        logger.error(`Error processing webhook: ${err.message}`);
        res.status(400).json({
            success: false,
            message: 'Webhook processing failed',
            error: err.message
        });
    }
};

export const getPaymentStatus = async (req, res) => {
    const { _id } = req.user;
    const { orderId } = req.query;
    
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
        res.status(500).json({
            success: false,
            message: RESPONSE_MESSAGES.INTERNAL_SERVER_ERROR
        });
    }
};
