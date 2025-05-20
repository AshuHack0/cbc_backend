-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    phone VARCHAR(15) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create otp_logs table
CREATE TABLE IF NOT EXISTS otp_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    phone VARCHAR(15) NOT NULL,
    otp VARCHAR(6) NOT NULL,
    attempts INT DEFAULT 0,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    INDEX idx_phone (phone),
    INDEX idx_expires (expires_at)
); 

CREATE TABLE payments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    order_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_date DATETIME NOT NULL,
    transaction_id VARCHAR(255),
    UNIQUE KEY unique_order (order_id),
    INDEX idx_user_order (user_id, order_id)
);

CREATE TABLE bookings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    order_id VARCHAR(255) NOT NULL,
    booking_date DATETIME NOT NULL,
    status VARCHAR(50) NOT NULL,
    UNIQUE KEY unique_booking (order_id),
    FOREIGN KEY (order_id) REFERENCES payments(order_id)
);