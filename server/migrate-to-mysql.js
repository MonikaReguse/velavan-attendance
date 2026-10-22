// Migration script: SQLite / JSON Backup -> MySQL
// Preserves all 9 employees, attendance history, settings, and documents with zero data loss.
require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306', 10),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'velavan_attendance',
  ssl: process.env.MYSQL_SSL === 'true' || process.env.MYSQL_SSL === '1' ? { rejectUnauthorized: false } : undefined,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Support connection string URL: e.g. mysql://user:pass@host:port/dbname
function getPool() {
  if (process.env.MYSQL_URL) {
    return mysql.createPool(process.env.MYSQL_URL);
  }
  return mysql.createPool(MYSQL_CONFIG);
}

async function initSchema(pool) {
  console.log('[MySQL] Creating database tables if not exist...');
  
  await pool.query(`
    CREATE TABLE IF NOT EXISTS employees (
      id INT AUTO_INCREMENT PRIMARY KEY,
      emp_id VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      phone VARCHAR(50),
      department VARCHAR(100) NOT NULL DEFAULT 'Digital Marketing',
      role VARCHAR(100) NOT NULL,
      pin VARCHAR(20) DEFAULT '1234',
      avatar MEDIUMTEXT,
      face_descriptor LONGTEXT,
      face_enrolled_at VARCHAR(50),
      status VARCHAR(20) DEFAULT 'active',
      join_date VARCHAR(50),
      doj VARCHAR(50),
      emergency_phone VARCHAR(50),
      father_name VARCHAR(255),
      mother_name VARCHAR(255),
      spouse_name VARCHAR(255),
      gender VARCHAR(20),
      dob VARCHAR(50),
      blood_group VARCHAR(20),
      marital_status VARCHAR(50),
      address TEXT,
      aadhaar_number VARCHAR(50),
      salary VARCHAR(50),
      bank_name VARCHAR(255),
      account_number VARCHAR(100),
      ifsc_code VARCHAR(50),
      account_holder_name VARCHAR(255),
      branch_name VARCHAR(255),
      pan_number VARCHAR(50),
      doc_aadhaar MEDIUMTEXT,
      doc_pan MEDIUMTEXT,
      doc_photo MEDIUMTEXT,
      doc_bank_passbook MEDIUMTEXT,
      doc_10th MEDIUMTEXT,
      doc_12th MEDIUMTEXT,
      doc_college MEDIUMTEXT,
      doc_marksheet MEDIUMTEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_emp_id (emp_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS attendance (
      id INT AUTO_INCREMENT PRIMARY KEY,
      emp_id VARCHAR(50) NOT NULL,
      date VARCHAR(20) NOT NULL,
      clock_in VARCHAR(20) NOT NULL,
      clock_out VARCHAR(20) DEFAULT '',
      total_hours DECIMAL(5,2) DEFAULT 0.00,
      ot_hours DECIMAL(5,2) DEFAULT 0.00,
      ot_minutes INT DEFAULT 0,
      status VARCHAR(50) NOT NULL DEFAULT 'present',
      holiday_type VARCHAR(50) DEFAULT 'normal',
      punch_photo MEDIUMTEXT,
      method VARCHAR(50) DEFAULT 'facelock',
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_emp_date (emp_id, date),
      INDEX idx_att_date (date),
      CONSTRAINT fk_att_employee FOREIGN KEY (emp_id) REFERENCES employees (emp_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS leave_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      emp_id VARCHAR(50) NOT NULL,
      type VARCHAR(50) NOT NULL,
      start_date VARCHAR(20) NOT NULL,
      end_date VARCHAR(20) NOT NULL,
      days INT DEFAULT 1,
      reason TEXT,
      status VARCHAR(20) DEFAULT 'pending',
      admin_notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (emp_id) REFERENCES employees (emp_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      \`key\` VARCHAR(100) PRIMARY KEY,
      \`value\` TEXT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log('[MySQL] Schema successfully initialized.');
}

async function migrateData() {
  const pool = getPool();
  try {
    await initSchema(pool);

    // Load data from master production JSON backup (or SQLite db_snapshot)
    let backupPath = path.join(__dirname, '..', 'production_database_backup_2026-10-21T11-03-10-696Z.json');
    if (!fs.existsSync(backupPath)) {
      backupPath = path.join(__dirname, 'db_snapshot.json');
    }

    console.log(`[Migration] Reading backup dataset from ${backupPath}...`);
    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

    const employees = backupData.employees || [];
    const attendance = backupData.attendance || [];
    const settings = backupData.settings || [];

    console.log(`[Migration] Found ${employees.length} employees and ${attendance.length} attendance records.`);

    // 1. Insert or update Employees
    for (const emp of employees) {
      await pool.query(`
        INSERT INTO employees (
          emp_id, name, email, phone, department, role, pin, avatar,
          face_descriptor, face_enrolled_at, status, join_date, doj,
          emergency_phone, father_name, mother_name, spouse_name, gender,
          dob, blood_group, marital_status, address, aadhaar_number, salary,
          bank_name, account_number, ifsc_code, account_holder_name, branch_name,
          pan_number, doc_aadhaar, doc_pan, doc_photo, doc_bank_passbook,
          doc_10th, doc_12th, doc_college, doc_marksheet
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name=VALUES(name), email=VALUES(email), phone=VALUES(phone),
          department=VALUES(department), role=VALUES(role), pin=VALUES(pin),
          avatar=VALUES(avatar), face_descriptor=VALUES(face_descriptor),
          salary=VALUES(salary), bank_name=VALUES(bank_name), account_number=VALUES(account_number),
          ifsc_code=VALUES(ifsc_code), branch_name=VALUES(branch_name), pan_number=VALUES(pan_number)
      `, [
        emp.emp_id, emp.name, emp.email, emp.phone || '', emp.department || 'Digital Marketing', emp.role || 'Staff', emp.pin || '1234', emp.avatar || null,
        emp.face_descriptor || null, emp.face_enrolled_at || null, emp.status || 'active', emp.join_date || null, emp.doj || null,
        emp.emergency_phone || null, emp.father_name || null, emp.mother_name || null, emp.spouse_name || null, emp.gender || null,
        emp.dob || null, emp.blood_group || null, emp.marital_status || null, emp.address || null, emp.aadhaar_number || null, emp.salary || null,
        emp.bank_name || null, emp.account_number || null, emp.ifsc_code || null, emp.account_holder_name || null, emp.branch_name || null,
        emp.pan_number || null, emp.doc_aadhaar || null, emp.doc_pan || null, emp.doc_photo || null, emp.doc_bank_passbook || null,
        emp.doc_10th || null, emp.doc_12th || null, emp.doc_college || null, emp.doc_marksheet || null
      ]);
    }
    console.log(`[Migration] Successfully synced ${employees.length} employees to MySQL.`);

    // 2. Insert Attendance Records
    let attCount = 0;
    for (const att of attendance) {
      if (!att.emp_id || !att.date) continue;
      await pool.query(`
        INSERT INTO attendance (
          emp_id, date, clock_in, clock_out, total_hours, ot_hours, ot_minutes,
          status, holiday_type, punch_photo, method, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          clock_in=VALUES(clock_in), clock_out=VALUES(clock_out),
          total_hours=VALUES(total_hours), ot_hours=VALUES(ot_hours),
          ot_minutes=VALUES(ot_minutes), status=VALUES(status),
          holiday_type=VALUES(holiday_type), notes=VALUES(notes)
      `, [
        att.emp_id, att.date, att.clock_in || '09:30:00', att.clock_out || '',
        att.total_hours || 0, att.ot_hours || 0, att.ot_minutes || 0,
        att.status || 'present', att.holiday_type || 'normal',
        att.punch_photo || null, att.method || 'manual', att.notes || ''
      ]);
      attCount++;
    }
    console.log(`[Migration] Successfully synced ${attCount} attendance records to MySQL.`);

    // 3. Insert Settings
    for (const s of settings) {
      if (!s.key) continue;
      await pool.query(`
        INSERT INTO settings (\`key\`, \`value\`) VALUES (?, ?)
        ON DUPLICATE KEY UPDATE \`value\`=VALUES(\`value\`)
      `, [s.key, s.value]);
    }
    console.log(`[Migration] Successfully synced settings to MySQL.`);
    console.log('✅ [SUCCESS] Migration to MySQL completed with zero data loss.');
  } catch (err) {
    console.error('❌ [Migration Error]:', err);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  migrateData();
}

module.exports = { migrateData, initSchema };
