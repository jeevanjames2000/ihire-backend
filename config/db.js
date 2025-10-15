import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: process.env.DB_HOST || "65.1.236.186",
  user: process.env.DB_USER || "i_hire",
  password: process.env.DB_PASSWORD || "ZKTrkCzaOpgMFSR123!@#",
  database: process.env.DB_NAME || "i_hire",
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit:10000 ,
  queueLimit: 0,
   enableKeepAlive: true
});

(async () => {
  try {
    const connection = await pool.getConnection();
    console.log("Connected to MySQL Database");
    connection.release();
  } catch (err) {
    console.error("Database connection failed:", err.message);
  }
})();

export default pool;