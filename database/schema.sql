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


CREATE TABLE Member (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),

  fullName VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  occupation VARCHAR(255),
  maritalStatus VARCHAR(50),

  membershipType VARCHAR(100),
  packageType VARCHAR(100),
  packageLabel VARCHAR(100),
  packagePrice FLOAT,
  packageDuration VARCHAR(100),

  interests JSON,

  stripeSessionId VARCHAR(255),
  paymentStatus ENUM('pending', 'paid', 'failed') DEFAULT 'pending',

  membershipCode VARCHAR(255),
  stripeSubscriptionId VARCHAR(255),
  stripeCustomerId VARCHAR(255),

  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);


CREATE TABLE FamilyMember (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),

  memberId CHAR(36) NOT NULL,

  fullName VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(255),
  occupation VARCHAR(255),
  maritalStatus VARCHAR(50),
  role VARCHAR(100),
  membershipCode VARCHAR(255),

  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_member FOREIGN KEY (memberId)
    REFERENCES Member(id)
    ON DELETE CASCADE
);
