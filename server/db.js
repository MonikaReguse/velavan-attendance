const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'attendance.db');
const db = new Database(dbPath);

// WAL mode for better concurrency; foreign keys OFF to prevent crashes on orphan/manual logs
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = OFF');

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      emp_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      department TEXT NOT NULL,
      role TEXT NOT NULL,
      pin TEXT DEFAULT '1234',
      avatar TEXT,
      face_descriptor TEXT, -- JSON string array of 128 float values
      face_enrolled_at TEXT,
      status TEXT DEFAULT 'active',
      join_date TEXT,
      doj TEXT,
      emergency_phone TEXT,
      father_name TEXT,
      mother_name TEXT,
      spouse_name TEXT,
      gender TEXT,
      dob TEXT,
      blood_group TEXT,
      marital_status TEXT,
      address TEXT,
      aadhaar_number TEXT,
      salary TEXT,
      bank_name TEXT,
      account_number TEXT,
      ifsc_code TEXT,
      account_holder_name TEXT,
      branch_name TEXT,
      pan_number TEXT,
      doc_aadhaar TEXT,
      doc_pan TEXT,
      doc_photo TEXT,
      doc_bank_passbook TEXT,
      doc_10th TEXT,
      doc_12th TEXT,
      doc_college TEXT,
      doc_marksheet TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      emp_id TEXT NOT NULL,
      date TEXT NOT NULL, -- YYYY-MM-DD
      clock_in TEXT NOT NULL, -- HH:MM:SS
      clock_out TEXT, -- HH:MM:SS
      total_hours REAL DEFAULT 0,
      status TEXT NOT NULL, -- 'present', 'late', 'half_day', 'absent'
      punch_photo TEXT, -- base64 or photo URL
      method TEXT DEFAULT 'facelock', -- 'facelock', 'pin', 'manual'
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (emp_id) REFERENCES employees(emp_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS leave_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      emp_id TEXT NOT NULL,
      type TEXT NOT NULL, -- 'casual', 'sick', 'annual', 'remote'
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      days INTEGER DEFAULT 1,
      reason TEXT,
      status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
      admin_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (emp_id) REFERENCES employees(emp_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Default settings (09:30 AM start, 18:00 end, 10 min grace period -> late arrival after 09:40 AM)
  const defaultSettings = [
    { key: 'office_name', value: 'Velavan Properties' },
    { key: 'admin_username', value: 'admin' },
    { key: 'admin_password', value: 'admin123' },
    { key: 'office_start_time', value: '09:30' },
    { key: 'office_end_time', value: '18:00' },
    { key: 'grace_period_minutes', value: '10' },
    { key: 'ot_buffer_minutes', value: '20' },
    { key: 'half_day_threshold_hours', value: '4.5' },
    { key: 'face_match_threshold', value: '0.45' },
    { key: 'allow_pin_fallback', value: 'true' }
  ];

  const insertSetting = db.prepare(`
    INSERT OR IGNORE INTO settings (key, value) VALUES (@key, @value)
  `);

  for (const s of defaultSettings) {
    insertSetting.run(s);
  }

  // Ensure settings reflect requested brand & shift timings
  db.prepare("UPDATE settings SET value = 'Velavan Properties' WHERE key = 'office_name'").run();
  db.prepare("UPDATE settings SET value = '09:30' WHERE key = 'office_start_time'").run();
  db.prepare("UPDATE settings SET value = '18:00' WHERE key = 'office_end_time'").run();
  db.prepare("UPDATE settings SET value = '10' WHERE key = 'grace_period_minutes'").run();
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('ot_buffer_minutes', '20')").run();
  db.prepare("UPDATE settings SET value = '0.45' WHERE key = 'face_match_threshold' AND CAST(value AS FLOAT) > 0.48").run();

  // Ensure uploads directory exists
  const uploadsDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Migration: Add employee detailed profile columns if not present
  const employeeColumns = [
    { name: 'doj', type: 'TEXT' },
    { name: 'emergency_phone', type: 'TEXT' },
    { name: 'father_name', type: 'TEXT' },
    { name: 'mother_name', type: 'TEXT' },
    { name: 'spouse_name', type: 'TEXT' },
    { name: 'gender', type: 'TEXT' },
    { name: 'dob', type: 'TEXT' },
    { name: 'blood_group', type: 'TEXT' },
    { name: 'marital_status', type: 'TEXT' },
    { name: 'address', type: 'TEXT' },
    { name: 'aadhaar_number', type: 'TEXT' },
    { name: 'salary', type: 'TEXT' },
    { name: 'bank_name', type: 'TEXT' },
    { name: 'account_number', type: 'TEXT' },
    { name: 'ifsc_code', type: 'TEXT' },
    { name: 'account_holder_name', type: 'TEXT' },
    { name: 'branch_name', type: 'TEXT' },
    { name: 'pan_number', type: 'TEXT' },
    { name: 'doc_aadhaar', type: 'TEXT' },
    { name: 'doc_pan', type: 'TEXT' },
    { name: 'doc_photo', type: 'TEXT' },
    { name: 'doc_bank_passbook', type: 'TEXT' },
    { name: 'doc_10th', type: 'TEXT' },
    { name: 'doc_12th', type: 'TEXT' },
    { name: 'doc_college', type: 'TEXT' },
    { name: 'doc_marksheet', type: 'TEXT' }
  ];

  for (const col of employeeColumns) {
    try {
      db.exec(`ALTER TABLE employees ADD COLUMN ${col.name} ${col.type}`);
    } catch (e) {
      // Column already exists, safe to ignore
    }
  }

  // Migration: Add ot_hours and ot_minutes columns to attendance table if not present
  try {
    db.exec(`ALTER TABLE attendance ADD COLUMN ot_hours REAL DEFAULT 0`);
  } catch (e) {
    // Column already exists, safe to ignore
  }

  try {
    db.exec(`ALTER TABLE attendance ADD COLUMN ot_minutes INTEGER DEFAULT 0`);
  } catch (e) {
    // Column already exists, safe to ignore
  }

  // Populate ot_minutes from existing ot_hours if needed
  try {
    db.exec(`UPDATE attendance SET ot_minutes = CAST(ROUND(ot_hours * 60) AS INTEGER) WHERE (ot_minutes IS NULL OR ot_minutes = 0) AND ot_hours > 0`);
  } catch (e) {}

  // Auto-seed Velavan Properties team members to ensure they NEVER disappear across server restarts
  const permanentEmployees = [
    {
      emp_id: 'VPDM08',
      name: 'A Anto Monika Reguse',
      email: 'vpdm08@velavanproperties.com',
      phone: '9876543210',
      department: 'Digital Marketing',
      role: 'Digital Marketing Executive',
      salary: '25000',
      pin: '1234',
      status: 'active',
      doj: '2026-02-16'
    },
    {
      emp_id: 'VPDM02',
      name: 'M Jaffrin',
      email: 'vpdm02@velavanproperties.com',
      phone: '9876543211',
      department: 'Digital Marketing',
      role: 'Digital Marketing Specialist',
      salary: '18000',
      pin: '1234',
      status: 'active',
      doj: '2026-02-16'
    },
    {
      emp_id: 'VP003',
      name: 'M Jega Jothi',
      email: 'vp003@velavanproperties.com',
      phone: '9876543212',
      department: 'Operations',
      role: 'Executive',
      salary: '20000',
      pin: '1234',
      status: 'active',
      doj: '2026-02-16'
    },
    {
      emp_id: 'VP004',
      name: 'G Senthil Kumar',
      email: 'vp004@velavanproperties.com',
      phone: '9876543213',
      department: 'Operations',
      role: 'Operations Manager',
      salary: '30000',
      pin: '1234',
      status: 'active',
      doj: '2026-02-16'
    },
    {
      emp_id: 'VP005',
      name: 'T.R Vathana',
      email: 'vp005@velavanproperties.com',
      phone: '9876543214',
      department: 'Operations',
      role: 'HR / Operations',
      salary: '22000',
      pin: '1234',
      status: 'active',
      doj: '2026-02-16'
    },
    {
      emp_id: 'VP007',
      name: 'M Jegatheeswari',
      email: 'vp007@velavanproperties.com',
      phone: '9876543215',
      department: 'Operations',
      role: 'Senior Executive',
      salary: '22000',
      pin: '1234',
      status: 'active',
      doj: '2026-02-16'
    },
    {
      emp_id: 'VPWD01',
      name: 'monika',
      email: 'monika@velavanproperties.com',
      phone: '8754898473',
      department: 'Information Technology',
      role: 'Web Developer',
      salary: '20000',
      pin: '1234',
      status: 'active',
      doj: '2026-02-16'
    }
  ];

  for (const emp of permanentEmployees) {
    try {
      const existing = db.prepare('SELECT id, emp_id, salary FROM employees WHERE emp_id = ? OR name = ?').get(emp.emp_id, emp.name);
      if (!existing) {
        db.prepare(`
          INSERT INTO employees (emp_id, name, email, phone, department, role, salary, pin, status, doj, join_date)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(emp.emp_id, emp.name, emp.email, emp.phone, emp.department, emp.role, emp.salary, emp.pin, emp.status, emp.doj, emp.doj);
        console.log(`[Auto-Seed] Permanent employee created: ${emp.name} (${emp.emp_id})`);
      } else {
        db.prepare(`
          UPDATE employees 
          SET emp_id = COALESCE(?, emp_id),
              name = COALESCE(?, name),
              role = COALESCE(?, role),
              salary = CASE WHEN (salary IS NULL OR salary = '' OR salary = '0') THEN ? ELSE salary END,
              department = COALESCE(?, department),
              status = 'active'
          WHERE id = ?
        `).run(emp.emp_id, emp.name, emp.role, emp.salary, emp.department, existing.id);
      }
    } catch (e) {
      console.error(`[Auto-Seed Error] for ${emp.name}:`, e.message);
    }
  }

  // Pre-seed known historical attendance records (e.g. 2026-10-14 audit logs)
  const permanentAttendance = [
    { emp_id: 'VP004', date: '2026-10-14', clock_in: '09:55:00', clock_out: '18:18:00', total_hours: 8.38, ot_minutes: 0, status: 'present', method: 'manual', notes: 'Manual Entry' },
    { emp_id: 'VP007', date: '2026-10-14', clock_in: '09:35:00', clock_out: '18:18:00', total_hours: 8.72, ot_minutes: 0, status: 'present', method: 'manual', notes: 'Manual Entry' },
    { emp_id: 'VP005', date: '2026-10-14', clock_in: '09:32:00', clock_out: '18:17:00', total_hours: 8.75, ot_minutes: 0, status: 'present', method: 'manual', notes: 'Manual Entry' },
    { emp_id: 'VPDM01', date: '2026-10-14', clock_in: '09:00:00', clock_out: '18:17:00', total_hours: 9.28, ot_minutes: 0, status: 'present', method: 'manual', notes: 'Manual Entry' },
    { emp_id: 'VP003', date: '2026-10-14', clock_in: '09:50:00', clock_out: '18:05:00', total_hours: 8.25, ot_minutes: 0, status: 'present', method: 'manual', notes: 'Manual Entry' },
    { emp_id: 'VPDM02', date: '2026-10-14', clock_in: '09:50:00', clock_out: '19:15:00', total_hours: 9.42, ot_minutes: 55, status: 'present', method: 'manual', notes: 'HR manual attendance entry' }
  ];

  const insertAttStmt = db.prepare(`
    INSERT INTO attendance (emp_id, date, clock_in, clock_out, total_hours, ot_minutes, status, method, notes)
    VALUES (@emp_id, @date, @clock_in, @clock_out, @total_hours, @ot_minutes, @status, @method, @notes)
  `);

  for (const att of permanentAttendance) {
    try {
      const exists = db.prepare('SELECT id FROM attendance WHERE emp_id = ? AND date = ?').get(att.emp_id, att.date);
      if (!exists) {
        insertAttStmt.run(att);
      }
    } catch (e) {}
  }

  console.log('Database initialized successfully.');
}

initDb();

module.exports = db;
