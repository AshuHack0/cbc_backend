import winston from 'winston';

// Create a logger instance
const logger = winston.createLogger({
    level: 'info', // Set the default log level
    format: winston.format.combine(
        winston.format.timestamp(), // Add timestamp to logs
        winston.format.json() // Format logs as JSON
    ),
    transports: [
        new winston.transports.Console(), // Log to console
        new winston.transports.File({ filename: 'error.log', level: 'error' }), // Log errors to a file
        new winston.transports.File({ filename: 'combined.log' }) // Log all messages to a file
    ],
});

// Export the logger
export default logger;