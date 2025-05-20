import mysql from 'mysql2';
import dotenv from 'dotenv';

dotenv.config();

export const pool = mysql.createPool({
    host: process.env.SQL_HOST_NAME,
    user: process.env.SQL_USER_NAME,
    password: process.env.SQL_PASSWORD,
    database: process.env.SQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 20,
    queueLimit: 100
});

 
// check db is connected or not
pool.getConnection((err, connection) => {
    if (err) {
        console.error('Error connecting to the database:', err);
    } else {
        console.log('Connected to the database');
    }
});
export async function executeQuery2(query, params = []) {
    const promisePool = pool.promise(); 
    try {
      const [results] = await promisePool.query(query, params);
      return results;
    } catch (error) {
      throw error;
    }
}

 