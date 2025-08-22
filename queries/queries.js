export const SQL_QUERIES = {
  // Room payment queries
  UPDATE_ROOM_PAYMENT_STATUS: `
    UPDATE payments_rooms 
    SET status = ?,
        amount = ?
    WHERE payment_intent_id = ? AND user_id = ?
  `,
  CREATE_ROOM_PAYMENT_RECORD: `
    INSERT INTO payments_rooms (
      payment_intent_id,
      order_id,
      user_id,
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
      status,
      client_secret
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  GET_ROOM_PAYMENT_DETAILS: `
    SELECT *
    FROM payments_rooms
    WHERE payment_intent_id = ? AND user_id = ?
  `,
  INSERT_OTP: "INSERT INTO otp_logs (email, otp, expires_at) VALUES (?, ?, ?)",
  SELECT_LATEST_OTP:"SELECT * FROM otp_logs WHERE email = ? ORDER BY created_at DESC LIMIT 1",
  SELECT_RECENT_OTP: "SELECT * FROM otp_logs WHERE email = ? ORDER BY created_at DESC LIMIT 1",
  DELETE_RECENT_OTP: "DELETE FROM otp_logs WHERE email = ?",
  DELETE_OTP: "DELETE FROM otp_logs WHERE id = ?",
  UPDATE_ATTEMPTS: "UPDATE otp_logs SET attempts = attempts + 1 WHERE id = ?",
  MARK_OTP_VERIFIED: "UPDATE otp_logs SET is_verified = TRUE WHERE id = ?",
  SELECT_USER: "SELECT * FROM users WHERE phone = ?",
  INSERT_USER: "INSERT INTO users (phone) VALUES (?)",
  SELECT_USER_DETAILS: "SELECT * FROM users WHERE id = ?",
  SELECT_ALL_USERS: "SELECT * FROM users",
  // Member-related queries
  SELECT_MEMBER_BY_ID: "SELECT * FROM Member WHERE id = ?",
  SELECT_MEMBER_BY_EMAIL: "SELECT * FROM users WHERE email = ?  order by created_at DESC limit 1",
  SELECT_FAMILY_MEMBERS: "SELECT * FROM FamilyMember WHERE memberId = ?",
  UPDATE_MEMBER_PAYMENT: `
    UPDATE Member SET 
      paymentStatus = 'paid',
      stripeCustomerId = ?,
      stripeSubscriptionId = ?
    WHERE id = ?
  `,
  UPDATE_MEMBER_MEMBERSHIP_CODE: "UPDATE Member SET membershipCode = ? WHERE id = ?",
  UPDATE_FAMILY_MEMBER_MEMBERSHIP_CODE: "UPDATE FamilyMember SET membershipCode = ? WHERE id = ?",
  
  UPDATE_PAYMENT_STATUS: `
    INSERT INTO payments (user_id, status, amount, payment_date, transaction_id)
    VALUES (?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
    status = VALUES(status),
    amount = VALUES(amount),
    payment_date = VALUES(payment_date),
    transaction_id = VALUES(transaction_id)
  `,
  GET_PAYMENT_STATUS: 'SELECT * FROM payments WHERE user_id = ? ORDER BY payment_date DESC LIMIT 1',
  CREATE_PAYMENT_RECORD: `
    INSERT INTO payments (user_id, status, amount, payment_date, order_id)
    VALUES (?, ?, ?, ?, ?)
  `,
  CREATE_PAYMENT_RECORD_FOR_ROOM: `
    INSERT INTO payments_rooms (user_id, status, amount, date, payment_intent_id	)
    VALUES (?, ?, ?, ?, ?)
  `,
  CREATE_PAYMENT_RECORD_FOR_CASH: `
    INSERT INTO payments (user_id, status, amount, payment_date, order_id, transaction_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `,
  CREATE_PAYMENT_RECORD_FOR_FREE_BOOKING: `
  INSERT INTO payments (user_id, status, amount, payment_date, order_id, transaction_id)
  VALUES (?, ?, ?, ?, ?, ?)
`,
  UPDATE_PAYMENT_STATUS: `
    UPDATE payments 
    SET status = ?, 
        amount = ?, 
        payment_date = ?, 
        transaction_id = ?
    WHERE order_id = ? AND user_id = ?
  `,
  GET_PAYMENT_STATUS_BY_ORDER: `
    SELECT p.*, u.email 
    FROM payments p
    JOIN users u ON p.user_id = u.id
    WHERE p.user_id = ? AND p.order_id = ?
    ORDER BY p.payment_date DESC
    LIMIT 1
  `,
  CREATE_BOOKING_RECORD: `
    INSERT INTO bookings (user_id, order_id, booking_date, status, facility_id, booked_date, booked_slot, boking_time_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,
  CREATE_BOOKING_RECORD_FOR_CASH: `
    INSERT INTO bookings (user_id, order_id, booking_date, status, facility_id, booked_date, booked_slot, boking_time_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,
  GET_BOOKING_DETAILS: `
    SELECT b.*, p.amount, p.payment_date, p.status as payment_status
    FROM bookings b
    JOIN payments p ON b.order_id = p.order_id
    WHERE b.order_id = ?
  `,
  SELECT_USER_DETAILS: `
    SELECT *
    FROM users
    WHERE id = ?
  `,
  SELECT_USER_BY_EMAIL: `
    SELECT *
    FROM users
    WHERE email = ?
  `, 
  UPDATE_PASSWORD: `
    UPDATE users
    SET password = ?, is_verified = ?
    WHERE id = ?
  `,
  SELECT_ALL_ROOMS: `
    SELECT * FROM rooms
  `,
  // Banner-related queries
CREATE_BANNER: `
INSERT INTO slide_banner (image_link, link_url)
VALUES (?, ?)
`,
GET_BANNERS: `
SELECT * FROM slide_banner
`,
DELETE_BANNER: `
DELETE FROM slide_banner WHERE S_No = ?
`,
GET_ALL_CASH_PAYMENT: `
SELECT 
  payments.*,
  bookings.*,
  users.email,
  users.fullName
FROM payments
INNER JOIN bookings ON payments.order_id = bookings.order_id
INNER JOIN users ON payments.user_id = users.id
WHERE payments.status = 'pending'
  AND payments.order_id LIKE 'cash%'
`,
UPDATE_CASH_PAYMENT_STATUS: `
UPDATE payments
SET status = ?
WHERE order_id = ?
`,
UPDATE_CASH_BOOKING_STATUS: `
UPDATE bookings
SET status = ?
WHERE order_id = ?
`

  }; 

export const SPORTS_QUERIES = {
  SELECT_SPORTS_DETAILS: `
  SELECT 
  f.name AS facility_name,
  o.day_type,
  TIME_FORMAT(o.open_time, '%H:%i') AS open_time,
  TIME_FORMAT(o.close_time, '%H:%i') AS close_time,
  TIME_FORMAT(p.start_time, '%H:%i') AS start_time,
  TIME_FORMAT(p.end_time, '%H:%i') AS end_time,
  p.price,
  p.price_type
  FROM facilities f
  JOIN operating_hours o 
  ON f.id = o.facility_id 
  AND o.day_type = get_day_type_for_date('2025-01-29')  -- Static Date for Now
  JOIN pricing_rules p 
  ON f.id = p.facility_id 
  AND p.day_type = get_day_type_for_date('2025-01-29')  -- Static Date for Now
  WHERE f.name = 'Badminton Courts'
  ORDER BY p.start_time
    `,
  SELECT_SPORTS_DETAILS_DAY_WISE_AND_FACILITY_WISE: `
  SELECT
  f.id AS facility_id,
  f.name AS facility_name,
  dt.id AS day_type_id,
  dt.name AS day_type_name,
  dtd.weekday AS day,
  TIME_FORMAT(oh.open_time, '%H:%i:%s') AS open_time,
  TIME_FORMAT(oh.close_time, '%H:%i:%s') AS close_time,
  pr.start_time AS pricing_start_time,
  pr.end_time AS pricing_end_time,
  pr.price,
  pr.unit,
  er.item_name AS rental_item,
  er.price AS rental_price
  FROM facilities f
  JOIN operating_hours oh ON f.id = oh.facility_id
  JOIN day_types dt ON oh.day_type_id = dt.id
  JOIN day_type_days dtd ON dt.id = dtd.day_type_id
  LEFT JOIN pricing_rules pr ON f.id = pr.facility_id AND pr.day_type_id = dt.id
  LEFT JOIN equipment_rentals er ON f.id = er.facility_id
  WHERE dtd.weekday = ? AND f.id = ?
  ORDER BY pr.start_time;

    `,
  SELECT_SPORTS_DETAILS_FACILITY_WISE: `SELECT 
  oh.id,
  f.name AS name,
  oh.facility_id,
  oh.day_type_id,
  dt.name AS day,
  oh.open_time,
  oh.close_time,
  pr.start_time AS pricing_start_time,
  pr.end_time AS pricing_end_time,
  pr.price,
  pr.unit,
  er.item_name AS rental_item,
  er.price AS rental_price
  FROM facilities f
  INNER JOIN operating_hours oh ON f.id = oh.facility_id 
  INNER JOIN day_types dt ON oh.day_type_id = dt.id 
  LEFT JOIN pricing_rules pr ON pr.facility_id = f.id AND pr.day_type_id = dt.id
  LEFT JOIN equipment_rentals er ON er.facility_id = f.id
  WHERE f.id = ?`, 
  SELECT_SPORTS_DETAILS_FACILITY_WISE: `
   SELECT
        f.id AS facility_id,
        f.name AS facility_name,
        dt.id AS day_type_id,
        dt.name AS day_type_name,
        oh.open_time,
        oh.close_time,
        pr.start_time AS pricing_start_time,
        pr.end_time AS pricing_end_time,
        pr.price,
        pr.unit,
        er.item_name,
        er.price AS rental_price
      FROM facilities f
      LEFT JOIN operating_hours oh ON f.id = oh.facility_id
      LEFT JOIN day_types dt ON oh.day_type_id = dt.id
      LEFT JOIN pricing_rules pr ON f.id = pr.facility_id AND dt.id = pr.day_type_id
      LEFT JOIN equipment_rentals er ON f.id = er.facility_id
  `,
  SELECT_ALL_FACILITIES: `SELECT * FROM facilities`,
};


export const BOOKING_QUERIES = {
  SELECT_ALL_BOOKINGS: `
  SELECT 
    b.id AS booking_id,
    b.user_id,
    b.order_id,
    b.booking_date,
    b.facility_id,
    b.booked_date,
    b.booked_slot,
    b.status AS booking_status,
    b.boking_time_json,
    p.status AS payment_status,
    p.amount,
    p.payment_date,
    p.transaction_id,
    f.name AS facility_name,
    f.img_src,
    f.availability_status,
    u.email AS user_email,
    u.phone AS user_phone
  FROM bookings b
  LEFT JOIN payments p ON b.order_id = p.order_id
  LEFT JOIN facilities f ON b.facility_id = f.id
  LEFT JOIN users u ON b.user_id = u.id
  ORDER BY b.booking_date DESC
  `,

  SELECT_SUCCESSFUL_BOOKINGS: `
  SELECT bookings.*, payments.status AS payment_status, payments.amount, payments.payment_date, facilities.name, facilities.img_src, facilities.availability_status
  FROM bookings
  INNER JOIN payments ON bookings.order_id = payments.transaction_id
  LEFT JOIN facilities ON bookings.facility_id = facilities.id
  WHERE bookings.user_id = ? AND payments.status = 'completed'
`,
SELECT_FAILED_PAYMENTS_WITHOUT_BOOKINGS: `
  SELECT payments.*
  FROM payments
  LEFT JOIN bookings ON payments.transaction_id = bookings.order_id
  WHERE payments.user_id = ? AND bookings.id IS NULL
`,
  SELECT_PAYMENT_DETAILS_IF_NO_BOOKING: `
  SELECT * FROM payments WHERE user_id = ?
`,

SELECT_PAYMENTS_WITH_BOOKINGS: `
SELECT
  payments.id AS payment_id,
  payments.user_id,
  payments.order_id,
  payments.status AS payment_status,
  payments.amount,
  payments.payment_date,
  payments.transaction_id,
  bookings.id AS booking_id,
  bookings.facility_id,
  bookings.booking_date,
  bookings.booked_date,
  bookings.start_time,
  bookings.end_time,
  bookings.status AS booking_status,
  bookings.boking_time_json,
  facilities.name AS facility_name,
  facilities.img_src,
  facilities.availability_status
FROM payments
LEFT JOIN bookings ON payments.transaction_id = bookings.order_id AND bookings.user_id = payments.user_id
LEFT JOIN facilities ON bookings.facility_id = facilities.id
WHERE payments.user_id = ?
ORDER BY payments.payment_date DESC;

`,

SELECT_BOOKINGS_BY_DATE_AND_FACILITY: `
SELECT
  b.id AS booking_id,
  b.user_id,
  b.order_id,
  b.booking_date,
  b.booked_date,
  b.start_time,
  b.end_time,
  b.status AS booking_status,
  b.facility_id,
  p.amount,
  p.payment_date,
  p.status AS payment_status,
  p.transaction_id,
  u.phone AS user_phone,
  f.name AS facility_name
FROM bookings b
LEFT JOIN payments p ON b.order_id = p.order_id
LEFT JOIN users u ON b.user_id = u.id
LEFT JOIN facilities f ON b.facility_id = f.id
WHERE DATE(b.booked_date) = ? AND b.facility_id = ? AND b.status IN ('confirmed', 'active', 'booked')
ORDER BY b.start_time ASC;
`,



};
