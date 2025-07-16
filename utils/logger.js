import winston from "winston";
import path from "path";
import { fileURLToPath } from 'url';
import fs from 'fs';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create logs directory path
const logsDir = path.join(__dirname, '..', 'logs');

// Ensure logs directory exists
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Create a logger instance
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp({ 
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}${stack ? '\n' + stack : ''}`;
    })
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }), // Log to console with colors
    new winston.transports.File({ 
      filename: path.join(logsDir, "error.log"), 
      level: "error",
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }), // Log errors to a file
    new winston.transports.File({ 
      filename: path.join(logsDir, "combined.log"),
      maxsize: 5242880, // 5MB  
      maxFiles: 5
    }), // Log all messages to a file
    new winston.transports.File({ 
      filename: path.join(logsDir, "payment.log"),
      level: "info",
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }) // Dedicated payment logs
  ],
});

// Export the logger
export default logger;
