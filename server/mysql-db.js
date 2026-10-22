// MySQL Database Connection Pool & Adapter for Velavan Attendance App
require('dotenv').config();
const mysql = require('mysql2/promise');

const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306', 10),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'velavan_attendance',
  ssl: process.env.MYSQL_SSL === 'true' || process.env.MYSQL_SSL === '1' ? { rejectUnauthorized: false } : undefined,
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
};

let pool = null;

function getPool() {
  if (!pool) {
    if (process.env.MYSQL_URL) {
      console.log('[MySQL] Initializing connection pool via MYSQL_URL...');
      pool = mysql.createPool(process.env.MYSQL_URL);
    } else {
      console.log(`[MySQL] Initializing connection pool for ${MYSQL_CONFIG.user}@${MYSQL_CONFIG.host}:${MYSQL_CONFIG.port}/${MYSQL_CONFIG.database}...`);
      pool = mysql.createPool(MYSQL_CONFIG);
    }
  }
  return pool;
}

// Helper methods with parameterized safety
async function query(sql, params = []) {
  const p = getPool();
  const [rows] = await p.execute(sql, params);
  return rows;
}

async function getOne(sql, params = []) {
  const rows = await query(sql, params);
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function execute(sql, params = []) {
  const p = getPool();
  const [result] = await p.execute(sql, params);
  return result;
}

module.exports = {
  getPool,
  query,
  getOne,
  execute
};
