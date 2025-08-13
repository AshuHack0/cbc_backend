import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();
// Create transporter for Plesk SMTP
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,  // Usually "mail." + your domain
  port: 465,
  secure: true, // true because port 465 uses SSL
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Test SMTP connection
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Email server error:', error);
  } else {
    console.log('✅ Email server is ready to send messages');
  }
});

 


export default transporter; 