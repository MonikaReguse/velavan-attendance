// Force Indian Standard Time (IST, UTC+05:30) across all environments
process.env.TZ = 'Asia/Kolkata';

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Disaster Recovery Snapshot Persistence Helpers
function saveDbSnapshot() {
  try {
    const employees = db.prepare('SELECT * FROM employees').all();
    const attendance = db.prepare('SELECT * FROM attendance').all();
    const settings = db.prepare('SELECT * FROM settings').all();
    const leave_requests = db.prepare('SELECT * FROM leave_requests').all();
    const snapshotPath = path.join(__dirname, 'db_snapshot.json');
    fs.writeFileSync(snapshotPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      organization: 'Velavan Properties',
      employeeCount: employees.length,
      employees,
      attendance,
      settings,
      leave_requests
    }, null, 2));
    console.log(`[Snapshot] Saved ${employees.length} employees and ${attendance.length} attendance records.`);
  } catch (err) {
    console.error('[Snapshot Save Error]:', err.message);
  }
}

function loadDbSnapshot() {
  try {
    const snapshotPath = path.join(__dirname, 'db_snapshot.json');
    if (!fs.existsSync(snapshotPath)) return;

    const data = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
    if (!data) return;

    // Check permanently deleted employee IDs so deleted staff are NEVER resurrected by snapshot
    let deletedEmpIds = new Set();
    try {
      const delRow = db.prepare("SELECT value FROM settings WHERE key = 'deleted_emp_ids'").get();
      if (delRow && delRow.value) {
        const arr = JSON.parse(delRow.value);
        if (Array.isArray(arr)) deletedEmpIds = new Set(arr);
      }
    } catch {}

    const empValidCols = new Set(db.prepare('PRAGMA table_info(employees)').all().map(c => c.name));
    const attValidCols = new Set(db.prepare('PRAGMA table_info(attendance)').all().map(c => c.name));
    const leaveValidCols = new Set(db.prepare('PRAGMA table_info(leave_requests)').all().map(c => c.name));

    const restoreTx = db.transaction(() => {
      // 1. Restore missing employees non-destructively
      if (Array.isArray(data.employees) && data.employees.length > 0) {
        for (const emp of data.employees) {
          if (!emp || !emp.emp_id || deletedEmpIds.has(emp.emp_id)) continue;
          const exists = db.prepare('SELECT id FROM employees WHERE emp_id = ?').get(emp.emp_id);
          if (!exists) {
            const keys = Object.keys(emp).filter(k => k !== 'id' && empValidCols.has(k));
            const placeholders = keys.map(() => '?').join(', ');
            const values = keys.map(k => emp[k]);
            db.prepare(`INSERT OR IGNORE INTO employees (${keys.join(', ')}) VALUES (${placeholders})`).run(...values);
          }
        }
      }

      // 2. Restore missing attendance records non-destructively (CRITICAL for disaster recovery)
      if (Array.isArray(data.attendance) && data.attendance.length > 0) {
        for (const att of data.attendance) {
          if (!att || !att.emp_id || !att.date || deletedEmpIds.has(att.emp_id)) continue;
          const exists = db.prepare('SELECT id FROM attendance WHERE emp_id = ? AND date = ?').get(att.emp_id, att.date);
          if (!exists) {
            const keys = Object.keys(att).filter(k => k !== 'id' && attValidCols.has(k));
            const placeholders = keys.map(() => '?').join(', ');
            const values = keys.map(k => att[k]);
            db.prepare(`INSERT INTO attendance (${keys.join(', ')}) VALUES (${placeholders})`).run(...values);
          }
        }
      }

      // 3. Restore missing leaves
      if (Array.isArray(data.leave_requests) && data.leave_requests.length > 0) {
        for (const l of data.leave_requests) {
          if (!l || !l.emp_id || deletedEmpIds.has(l.emp_id)) continue;
          const exists = db.prepare('SELECT id FROM leave_requests WHERE emp_id = ? AND start_date = ?').get(l.emp_id, l.start_date);
          if (!exists) {
            const keys = Object.keys(l).filter(k => k !== 'id' && leaveValidCols.has(k));
            const placeholders = keys.map(() => '?').join(', ');
            const values = keys.map(k => l[k]);
            db.prepare(`INSERT OR IGNORE INTO leave_requests (${keys.join(', ')}) VALUES (${placeholders})`).run(...values);
          }
        }
      }
    });

    restoreTx();
    console.log('[Snapshot Auto-Restore] Verified database state against snapshot.');
  } catch (err) {
    console.error('[Snapshot Auto-Restore Error]:', err.message);
  }
}

// Auto-check on server startup
loadDbSnapshot();

// Helper: Get settings as object
function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  return rows.reduce((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});
}

// Helper: Calculate total hours between two HH:MM:SS strings
function calculateHours(timeIn, timeOut) {
  if (!timeIn || !timeOut) return 0;
  if (timeIn === 'OD' || timeOut === 'OD' || timeIn === '--' || timeOut === '--') {
    return 8.5;
  }
  const [h1, m1, s1 = 0] = timeIn.split(':').map(Number);
  const [h2, m2, s2 = 0] = timeOut.split(':').map(Number);
  if (isNaN(h1) || isNaN(h2)) return 8.5;
  const d1 = new Date(2000, 0, 1, h1, m1, s1);
  const d2 = new Date(2000, 0, 1, h2, m2, s2);
  let diffMs = d2 - d1;
  if (diffMs < 0) diffMs += 24 * 60 * 60 * 1000;
  return Number((diffMs / (1000 * 60 * 60)).toFixed(2));
}

// Helper: Calculate Overtime (OT) hours based on dynamic late-entry offset and 20-min buffer rule:
function calculateOT(timeOut, timeIn = '09:30', officeStartTime = '09:30', officeEndTime = '18:00', bufferMinutes = 20) {
  if (!timeOut || timeOut === '--' || timeOut === 'OD' || timeIn === 'OD') return { otHours: 0, otMinutes: 0 };

  const toMinutes = (timeStr) => {
    if (!timeStr || timeStr === '--') return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const inM = toMinutes(timeIn || officeStartTime);
  const startM = toMinutes(officeStartTime || '09:30');
  const baseEndM = toMinutes(officeEndTime || '18:00');
  const outM = toMinutes(timeOut);

  // Late minutes past 09:30 AM
  const lateMinutes = Math.max(0, inM - startM);

  // Required regular shift end time (compensates late arrival)
  const requiredEndM = baseEndM + lateMinutes;

  // Overtime qualification buffer (20 minutes past required shift end)
  const thresholdM = requiredEndM + Number(bufferMinutes || 20);

  // If left before reaching qualification threshold, No OT
  if (outM < thresholdM) {
    return { otHours: 0, otMinutes: 0 };
  }

  // Once qualified (stayed past threshold / after 6:20), calculate OT strictly starting from 6:00 PM onwards in minutes
  const otMinutes = Math.max(0, outM - baseEndM);
  const otHours = Number((otMinutes / 60).toFixed(2));
  return { otHours, otMinutes };
}

// Helper: Format date as YYYY-MM-DD in Indian Standard Time (IST, UTC+05:30)
function getTodayDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

// Helper: Format current time as HH:MM:SS in 24-hour Indian Standard Time (IST, UTC+05:30)
function getCurrentTime() {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(new Date());
}

// ---------------- AUTH (PHONE OTP) ----------------
const otpStore = new Map(); // normalizedPhone -> { code, expiresAt, emp_id }

function normalizePhone(phone) {
  if (!phone) return '';
  return String(phone).replace(/[\s\-\(\)\+]/g, '');
}

// Extract Designation Code (e.g. "Digital Marketing" -> "DM", "Software Engineer" -> "SE")
function extractDesignationCode(designation) {
  if (!designation || !designation.trim()) return 'EM';
  const clean = designation.trim().replace(/[^a-zA-Z0-9\s]/g, '');
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return words.map(w => w[0].toUpperCase()).join('').slice(0, 4);
  } else if (words.length === 1) {
    const single = words[0].toUpperCase();
    if (single.length <= 3) return single;
    return single.slice(0, 2);
  }
  return 'EM';
}

// Generate Employee ID: VP + Designation Code + 2-digit Serial Number (e.g. VPDM01)
function generateEmployeeId(designation) {
  const code = extractDesignationCode(designation);
  const prefix = `VP${code}`;

  const rows = db.prepare(`
    SELECT emp_id FROM employees WHERE emp_id LIKE ?
  `).all(`${prefix}%`);

  let maxSerial = 0;
  for (const r of rows) {
    const match = r.emp_id.match(new RegExp(`^${prefix}(\\d+)$`, 'i'));
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxSerial) {
        maxSerial = num;
      }
    }
  }

  let nextSerial = maxSerial + 1;
  let candidate = `${prefix}${String(nextSerial).padStart(2, '0')}`;
  while (db.prepare('SELECT id FROM employees WHERE emp_id = ?').get(candidate)) {
    nextSerial++;
    candidate = `${prefix}${String(nextSerial).padStart(2, '0')}`;
  }
  return candidate;
}

// Quick Employee Registration
app.post('/api/auth/register', (req, res) => {
  try {
    const { name, phone, department = 'Engineering', role = 'Team Member', email } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and phone number are required' });
    }

    const existing = db.prepare("SELECT * FROM employees WHERE phone = ?").get(phone.trim());
    if (existing) {
      return res.json({ success: true, employee: existing });
    }

    const emp_id = generateEmployeeId(role);
    const empEmail = email || `${name.toLowerCase().replace(/\s+/g, '.')}${Date.now().toString().slice(-3)}@company.com`;
    const today = getTodayDate();

    const insertStmt = db.prepare(`
      INSERT INTO employees (emp_id, name, email, phone, department, role, pin, join_date, status)
      VALUES (?, ?, ?, ?, ?, ?, '1234', ?, 'active')
    `);
    const result = insertStmt.run(emp_id, name.trim(), empEmail, phone.trim(), department, role, today);

    const newEmp = db.prepare('SELECT * FROM employees WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, employee: newEmp });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Real SMS Dispatcher
async function sendRealSms(targetPhone, otpCode, employeeName = 'Employee') {
  const cleanPhone = String(targetPhone).replace(/[^0-9]/g, '').slice(-10);

  // 1. Fast2SMS (Popular in India for quick OTP delivery)
  const fast2smsKey = process.env.FAST2SMS_API_KEY;
  if (fast2smsKey && cleanPhone.length === 10) {
    try {
      const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          'authorization': fast2smsKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          route: 'otp',
          variables_values: otpCode,
          numbers: cleanPhone
        })
      });
      const data = await response.json();
      console.log(`[SMS] Fast2SMS sent to +91 ${cleanPhone}:`, data);
      return data;
    } catch (err) {
      console.error('[SMS] Fast2SMS dispatch error:', err.message);
    }
  }

  // 2. Twilio (Global SMS Gateway)
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuth = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_PHONE_NUMBER;
  if (twilioSid && twilioAuth && twilioFrom && cleanPhone.length === 10) {
    try {
      const authHeader = 'Basic ' + Buffer.from(`${twilioSid}:${twilioAuth}`).toString('base64');
      const params = new URLSearchParams();
      params.append('To', `+91${cleanPhone}`);
      params.append('From', twilioFrom);
      params.append('Body', `Velavan Properties: Your login OTP is ${otpCode}. Valid for 10 minutes.`);

      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });
      const data = await response.json();
      console.log(`[SMS] Twilio sent to +91 ${cleanPhone}:`, data?.sid || data);
      return data;
    } catch (err) {
      console.error('[SMS] Twilio dispatch error:', err.message);
    }
  }

  console.log(`[SMS DISPATCH] To: +91 ${cleanPhone} (${employeeName}) | OTP: ${otpCode}`);
  return null;
}

// Send OTP to Employee Phone
app.post('/api/auth/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'Mobile phone number is required' });
    }

    const cleanInput = normalizePhone(phone);
    const allEmployees = db.prepare("SELECT * FROM employees WHERE status = 'active'").all();

    // Match phone or emp_id
    const emp = allEmployees.find(e => {
      const eClean = normalizePhone(e.phone);
      return eClean === cleanInput || 
             (cleanInput.length >= 7 && eClean.endsWith(cleanInput)) || 
             (eClean.length >= 7 && cleanInput.endsWith(eClean)) ||
             e.emp_id.toLowerCase() === phone.trim().toLowerCase();
    });

    if (!emp) {
      return res.status(404).json({ 
        error: 'No registered employee found with this phone number. Please check the number or contact office HR.' 
      });
    }

    // Generate 6-digit OTP code (e.g., 654321 or random)
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    otpStore.set(cleanInput, { code: otpCode, expiresAt, emp_id: emp.emp_id });
    otpStore.set(normalizePhone(emp.phone), { code: otpCode, expiresAt, emp_id: emp.emp_id });

    // Send real SMS to employee phone
    await sendRealSms(emp.phone || phone, otpCode, emp.name);

    // Mask phone for privacy in UI (e.g. ••••••8473)
    const rawDigits = String(emp.phone || phone).replace(/[^0-9]/g, '');
    const maskedPhone = rawDigits.length >= 4 
      ? '••••••' + rawDigits.slice(-4) 
      : rawDigits;

    res.json({
      success: true,
      message: `OTP sent successfully to registered mobile number ${maskedPhone}`,
      demo_otp: otpCode,
      masked_phone: maskedPhone,
      employee: {
        emp_id: emp.emp_id,
        name: emp.name,
        department: emp.department,
        role: emp.role,
        avatar: emp.avatar
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Verify OTP
app.post('/api/auth/verify-otp', (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) {
      return res.status(400).json({ error: 'Phone and OTP are required' });
    }

    const cleanInput = normalizePhone(phone);
    const record = otpStore.get(cleanInput);

    let empId = record?.emp_id;
    let employeeData = null;

    // Find employee by phone or emp_id
    const allEmployees = db.prepare("SELECT * FROM employees WHERE status = 'active'").all();
    const matchedEmp = allEmployees.find(e => {
      const eClean = normalizePhone(e.phone);
      return eClean === cleanInput || 
             (cleanInput.length >= 7 && eClean.endsWith(cleanInput)) ||
             e.emp_id.toLowerCase() === phone.trim().toLowerCase();
    });

    if (matchedEmp) {
      empId = matchedEmp.emp_id;
      employeeData = matchedEmp;
    }

    // Support:
    // 1. Generated SMS OTP code
    // 2. Employee personal PIN (default 1234)
    // 3. Backup emergency code 123456
    const empPin = employeeData?.pin ? String(employeeData.pin).trim() : '1234';
    const isOtpMatch = record && record.code === otp.trim() && Date.now() <= record.expiresAt;
    const isPinMatch = otp.trim() === empPin;
    const isMasterMatch = otp.trim() === '123456';

    if (!isOtpMatch && !isPinMatch && !isMasterMatch) {
      return res.status(400).json({ error: 'Invalid or expired OTP code. Please check your SMS and try again.' });
    }

    if (!empId) {
      empId = record?.emp_id;
    }
    if (!empId) {
      // Find employee by phone
      const allEmployees = db.prepare("SELECT * FROM employees WHERE status = 'active'").all();
      const emp = allEmployees.find(e => {
        const eClean = normalizePhone(e.phone);
        return eClean === cleanInput || 
               (cleanInput.length >= 7 && eClean.endsWith(cleanInput)) ||
               e.emp_id.toLowerCase() === phone.trim().toLowerCase();
      });
      if (emp) empId = emp.emp_id;
    }

    if (!empId) {
      return res.status(404).json({ error: 'Employee record not found.' });
    }

    const employee = db.prepare(`
      SELECT 
        id, emp_id, name, email, phone, department, role, pin, avatar,
        status, join_date, doj, salary,
        bank_name, account_number, ifsc_code, account_holder_name, branch_name, pan_number,
        doc_aadhaar, doc_pan, doc_photo, doc_bank_passbook,
        face_enrolled_at, created_at,
        CASE WHEN face_descriptor IS NOT NULL AND face_descriptor != '' THEN 1 ELSE 0 END as has_face_enrolled
      FROM employees 
      WHERE emp_id = ?
    `).get(empId);

    // Clear OTP
    otpStore.delete(cleanInput);

    res.json({
      success: true,
      message: 'Authentication successful',
      employee
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Login
app.post('/api/auth/admin-login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const settings = getSettings();
    const validUser = (settings.admin_username || 'admin').trim();
    const validPass = (settings.admin_password || 'admin123').trim();

    if (username.trim() === validUser && password.trim() === validPass) {
      return res.json({
        success: true,
        message: 'Admin login successful',
        user: { username: validUser, role: 'Administrator' }
      });
    }

    return res.status(401).json({ error: 'Invalid admin username or password' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------- API ROUTES ----------------

// Health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'WorkPulse Attendance API', time: new Date().toISOString() });
});

// Settings
app.get('/api/settings', (req, res) => {
  try {
    res.json(getSettings());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/settings', (req, res) => {
  try {
    const updateStmt = db.prepare(`
      INSERT INTO settings (key, value) VALUES (@key, @value)
      ON CONFLICT(key) DO UPDATE SET value = @value
    `);
    const updateMany = db.transaction((settingsObj) => {
      for (const [key, value] of Object.entries(settingsObj)) {
        updateStmt.run({ key, value: String(value) });
      }
    });
    updateMany(req.body);
    saveDbSnapshot();
    res.json({ success: true, settings: getSettings() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload Employee Document (Images / PDFs)
app.post('/api/upload-document', (req, res) => {
  try {
    const { base64, filename = 'document', docType = 'doc' } = req.body;
    if (!base64) {
      return res.status(400).json({ error: 'File data is required' });
    }
    const matches = base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    let ext = 'jpg';
    let dataBuffer;
    if (matches && matches.length === 3) {
      const mime = matches[1].toLowerCase();
      if (mime.includes('png')) ext = 'png';
      else if (mime.includes('jpeg') || mime.includes('jpg')) ext = 'jpg';
      else if (mime.includes('webp')) ext = 'webp';
      else if (mime.includes('pdf')) ext = 'pdf';
      dataBuffer = Buffer.from(matches[2], 'base64');
    } else {
      dataBuffer = Buffer.from(base64, 'base64');
    }
    const safeType = (docType || 'doc').replace(/[^a-zA-Z0-9_]/g, '');
    const safeName = `doc_${safeType}_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;
    const filePath = path.join(__dirname, 'uploads', safeName);
    fs.writeFileSync(filePath, dataBuffer);
    res.json({
      success: true,
      url: `/uploads/${safeName}`,
      filename: safeName,
      originalName: filename
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Employees
app.get('/api/employees', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT 
        id, emp_id, name, email, phone, department, role, pin, avatar,
        status, join_date, doj, emergency_phone, father_name, mother_name,
        spouse_name, gender, dob, blood_group, marital_status, address,
        aadhaar_number, salary,
        bank_name, account_number, ifsc_code, account_holder_name, branch_name, pan_number,
        doc_aadhaar, doc_pan, doc_photo, doc_bank_passbook,
        doc_10th, doc_12th, doc_college, doc_marksheet,
        face_enrolled_at, created_at,
        CASE WHEN face_descriptor IS NOT NULL AND face_descriptor != '' THEN 1 ELSE 0 END as has_face_enrolled
      FROM employees
      ORDER BY name ASC
    `).all();
    const formatted = rows.map(r => ({
      ...r,
      email: (r.email && !r.email.endsWith('@noemail.internal')) ? r.email : ''
    }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Next Available Employee ID for a Designation
app.get('/api/employees/next-id', (req, res) => {
  try {
    const designation = req.query.designation || '';
    const nextId = generateEmployeeId(designation);
    res.json({ emp_id: nextId, code: extractDesignationCode(designation) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/employees', (req, res) => {
  try {
    const { 
      emp_id, name, email, phone, department, role, pin, avatar,
      join_date, doj, emergency_phone, father_name, mother_name,
      spouse_name, gender, dob, blood_group, marital_status,
      address, aadhaar_number, salary,
      bank_name, account_number, ifsc_code, account_holder_name, branch_name, pan_number,
      doc_aadhaar, doc_pan, doc_photo, doc_bank_passbook,
      doc_10th, doc_12th, doc_college, doc_marksheet,
      face_descriptor
    } = req.body;

    let actualEmpId = (emp_id && emp_id.trim()) ? emp_id.trim().toUpperCase() : generateEmployeeId(role);
    const existingWithId = db.prepare('SELECT id FROM employees WHERE emp_id = ?').get(actualEmpId);
    if (existingWithId) {
      actualEmpId = generateEmployeeId(role);
    }

    const actualDoj = doj || join_date || getTodayDate();
    const faceEnrolledAt = (face_descriptor && face_descriptor !== '') ? new Date().toISOString() : null;
    const actualEmail = (email && email.trim()) ? email.trim() : `${actualEmpId.toLowerCase()}@noemail.internal`;

    const finalAvatar = avatar || doc_photo || null;
    const finalDocPhoto = doc_photo || avatar || null;

    // Check duplicate phone number
    if (phone && phone.trim()) {
      const existingPhone = db.prepare('SELECT id, name, emp_id FROM employees WHERE phone = ?').get(phone.trim());
      if (existingPhone) {
        return res.status(400).json({ 
          error: `An employee with phone ${phone.trim()} is already registered (${existingPhone.name} - ${existingPhone.emp_id}).` 
        });
      }
    }

    // Check duplicate Aadhaar number
    if (aadhaar_number && aadhaar_number.trim()) {
      const existingAadhaar = db.prepare('SELECT id, name, emp_id FROM employees WHERE aadhaar_number = ?').get(aadhaar_number.trim());
      if (existingAadhaar) {
        return res.status(400).json({ 
          error: `An employee with Aadhaar number ${aadhaar_number.trim()} is already registered (${existingAadhaar.name} - ${existingAadhaar.emp_id}).` 
        });
      }
    }

    const stmt = db.prepare(`
      INSERT INTO employees (
        emp_id, name, email, phone, department, role, pin, avatar,
        join_date, doj, emergency_phone, father_name, mother_name,
        spouse_name, gender, dob, blood_group, marital_status,
        address, aadhaar_number, salary,
        bank_name, account_number, ifsc_code, account_holder_name, branch_name, pan_number,
        doc_aadhaar, doc_pan, doc_photo, doc_bank_passbook,
        doc_10th, doc_12th, doc_college, doc_marksheet,
        face_descriptor, face_enrolled_at
      )
      VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?
      )
    `);

    const result = stmt.run(
      actualEmpId,
      name,
      actualEmail,
      phone || '',
      department || '',
      role || 'Employee',
      pin || '1234',
      finalAvatar,
      actualDoj,
      actualDoj,
      emergency_phone || '',
      father_name || '',
      mother_name || '',
      spouse_name || '',
      gender || 'Other',
      dob || '',
      blood_group || '',
      marital_status || 'Single',
      address || '',
      aadhaar_number || '',
      salary || '',
      bank_name || '',
      account_number || '',
      ifsc_code || '',
      account_holder_name || '',
      branch_name || '',
      pan_number || '',
      doc_aadhaar || null,
      doc_pan || null,
      finalDocPhoto,
      doc_bank_passbook || null,
      doc_10th || null,
      doc_12th || null,
      doc_college || null,
      doc_marksheet || null,
      face_descriptor || null,
      faceEnrolledAt
    );
    const createdEmp = db.prepare('SELECT * FROM employees WHERE id = ?').get(result.lastInsertRowid);
    saveDbSnapshot();
    res.status(201).json({ id: result.lastInsertRowid, emp_id: actualEmpId, employee: createdEmp, success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/employees/:id', (req, res) => {
  try {
    const { 
      emp_id,
      name, email, phone, department, role, pin, avatar, status,
      doj, emergency_phone, father_name, mother_name, spouse_name,
      gender, dob, blood_group, marital_status, address, aadhaar_number,
      salary,
      bank_name, account_number, ifsc_code, account_holder_name, branch_name, pan_number,
      doc_aadhaar, doc_pan, doc_photo, doc_bank_passbook,
      doc_10th, doc_12th, doc_college, doc_marksheet,
      face_descriptor
    } = req.body;

    // Locate target employee by numeric id, emp_id, or request body details
    let target = db.prepare('SELECT * FROM employees WHERE id = ? OR emp_id = ?').get(req.params.id, req.params.id);
    if (!target && emp_id) {
      target = db.prepare('SELECT * FROM employees WHERE emp_id = ?').get(emp_id);
    }
    if (!target && name) {
      target = db.prepare('SELECT * FROM employees WHERE name = ?').get(name);
    }

    const faceEnrolledAt = (face_descriptor && face_descriptor !== '') ? new Date().toISOString() : null;

    // If employee does not exist in SQLite yet, auto-create to ensure data is never lost
    if (!target) {
      const actualEmpId = (emp_id && emp_id.trim()) 
        ? emp_id.trim().toUpperCase() 
        : (req.params.id && req.params.id !== 'undefined' ? req.params.id.trim().toUpperCase() : generateEmployeeId(role));
      const actualDoj = doj || getTodayDate();
      const actualEmail = (email && email.trim()) ? email.trim() : `${actualEmpId.toLowerCase()}@noemail.internal`;
      const finalAvatar = avatar || doc_photo || null;
      const finalDocPhoto = doc_photo || avatar || null;

      const insertStmt = db.prepare(`
        INSERT INTO employees (
          emp_id, name, email, phone, department, role, pin, avatar,
          join_date, doj, emergency_phone, father_name, mother_name,
          spouse_name, gender, dob, blood_group, marital_status,
          address, aadhaar_number, salary,
          bank_name, account_number, ifsc_code, account_holder_name, branch_name, pan_number,
          doc_aadhaar, doc_pan, doc_photo, doc_bank_passbook,
          doc_10th, doc_12th, doc_college, doc_marksheet,
          face_descriptor, face_enrolled_at, status
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, 'active'
        )
      `);
      const result = insertStmt.run(
        actualEmpId, name || 'Employee', actualEmail, phone || '', department || '', role || 'Employee', pin || '1234', finalAvatar,
        actualDoj, actualDoj, emergency_phone || '', father_name || '', mother_name || '',
        spouse_name || '', gender || 'Other', dob || '', blood_group || '', marital_status || 'Single',
        address || '', aadhaar_number || '', salary || '',
        bank_name || '', account_number || '', ifsc_code || '', account_holder_name || '', branch_name || '', pan_number || '',
        doc_aadhaar || null, doc_pan || null, finalDocPhoto, doc_bank_passbook || null,
        doc_10th || null, doc_12th || null, doc_college || null, doc_marksheet || null,
        face_descriptor || null, faceEnrolledAt
      );
      const newEmp = db.prepare('SELECT * FROM employees WHERE id = ?').get(result.lastInsertRowid);
      saveDbSnapshot();
      return res.json({ success: true, employee: newEmp, created: true });
    }

    const internalId = target.id;

    // Prevent duplicate phone number on a DIFFERENT employee
    if (phone && phone.trim()) {
      const cleanPhone = phone.trim();
      const existingPhone = db.prepare('SELECT id, name, emp_id FROM employees WHERE phone = ? AND id != ?').get(cleanPhone, internalId);
      if (existingPhone) {
        return res.status(400).json({ 
          error: `Phone ${cleanPhone} is already used by another employee (${existingPhone.name} - ${existingPhone.emp_id}).` 
        });
      }
    }

    // Prevent duplicate Aadhaar on a DIFFERENT employee
    if (aadhaar_number && aadhaar_number.trim()) {
      const cleanAadhaar = aadhaar_number.trim();
      const existingAadhaar = db.prepare('SELECT id, name, emp_id FROM employees WHERE aadhaar_number = ? AND id != ?').get(cleanAadhaar, internalId);
      if (existingAadhaar) {
        return res.status(400).json({ 
          error: `Aadhaar number ${cleanAadhaar} is already used by another employee (${existingAadhaar.name} - ${existingAadhaar.emp_id}).` 
        });
      }
    }

    // Validate and update emp_id if modified
    const newEmpId = (emp_id && emp_id.trim()) ? emp_id.trim().toUpperCase() : target.emp_id;
    if (newEmpId !== target.emp_id) {
      const existingEmpId = db.prepare('SELECT id, name FROM employees WHERE emp_id = ? AND id != ?').get(newEmpId, internalId);
      if (existingEmpId) {
        return res.status(400).json({ 
          error: `Employee ID ${newEmpId} is already assigned to another employee (${existingEmpId.name}).` 
        });
      }
    }

    // Allow user edits (including clearing or updating fields). Fallback only if omitted (undefined)
    const val = (v, fallback) => (v !== undefined ? v : fallback);
    const updatedFaceEnrolledAt = (face_descriptor && face_descriptor !== '') ? new Date().toISOString() : target.face_enrolled_at;

    // Safely handle email uniqueness
    let finalEmail = target.email;
    if (email !== undefined) {
      const cleanEmail = email && typeof email === 'string' ? email.trim() : '';
      if (cleanEmail && !cleanEmail.endsWith('@noemail.internal')) {
        const existingEmail = db.prepare('SELECT id, name, emp_id FROM employees WHERE email = ? AND id != ?').get(cleanEmail, internalId);
        if (existingEmail) {
          return res.status(400).json({ error: `Email ${cleanEmail} is already assigned to another employee (${existingEmail.name} - ${existingEmail.emp_id}).` });
        }
        finalEmail = cleanEmail;
      } else {
        finalEmail = `${newEmpId.toLowerCase()}@noemail.internal`;
      }
    }

    db.prepare(`
      UPDATE employees 
      SET emp_id = ?,
          name = ?,
          email = ?,
          phone = ?,
          department = ?,
          role = ?,
          pin = ?,
          avatar = ?,
          status = ?,
          doj = ?,
          join_date = ?,
          emergency_phone = ?,
          father_name = ?,
          mother_name = ?,
          spouse_name = ?,
          gender = ?,
          dob = ?,
          blood_group = ?,
          marital_status = ?,
          address = ?,
          aadhaar_number = ?,
          salary = ?,
          bank_name = ?,
          account_number = ?,
          ifsc_code = ?,
          account_holder_name = ?,
          branch_name = ?,
          pan_number = ?,
          doc_aadhaar = ?,
          doc_pan = ?,
          doc_photo = ?,
          doc_bank_passbook = ?,
          doc_10th = ?,
          doc_12th = ?,
          doc_college = ?,
          doc_marksheet = ?,
          face_descriptor = ?,
          face_enrolled_at = ?
      WHERE id = ?
    `).run(
      newEmpId,
      val(name, target.name),
      finalEmail,
      val(phone, target.phone),
      val(department, target.department),
      val(role, target.role),
      val(pin, target.pin),
      val(avatar, target.avatar),
      val(status, target.status || 'active'),
      val(doj, target.doj),
      val(doj, target.join_date || target.doj),
      val(emergency_phone, target.emergency_phone),
      val(father_name, target.father_name),
      val(mother_name, target.mother_name),
      val(spouse_name, target.spouse_name),
      val(gender, target.gender),
      val(dob, target.dob),
      val(blood_group, target.blood_group),
      val(marital_status, target.marital_status),
      val(address, target.address),
      val(aadhaar_number, target.aadhaar_number),
      val(salary, target.salary),
      val(bank_name, target.bank_name),
      val(account_number, target.account_number),
      val(ifsc_code, target.ifsc_code),
      val(account_holder_name, target.account_holder_name),
      val(branch_name, target.branch_name),
      val(pan_number, target.pan_number),
      val(doc_aadhaar, target.doc_aadhaar),
      val(doc_pan, target.doc_pan),
      val(doc_photo, target.doc_photo),
      val(doc_bank_passbook, target.doc_bank_passbook),
      val(doc_10th, target.doc_10th),
      val(doc_12th, target.doc_12th),
      val(doc_college, target.doc_college),
      val(doc_marksheet, target.doc_marksheet),
      val(face_descriptor, target.face_descriptor),
      updatedFaceEnrolledAt,
      internalId
    );

    if (newEmpId !== target.emp_id) {
      try {
        db.prepare('UPDATE attendance SET emp_id = ? WHERE emp_id = ?').run(newEmpId, target.emp_id);
        db.prepare('UPDATE leave_requests SET emp_id = ? WHERE emp_id = ?').run(newEmpId, target.emp_id);
        console.log(`[Employee ID Changed] Updated attendance & leave records from ${target.emp_id} to ${newEmpId}`);
      } catch (cascadeErr) {
        console.warn('Cascade emp_id update warning:', cascadeErr.message);
      }
    }

    const updatedEmp = db.prepare(`
      SELECT 
        *,
        CASE WHEN face_descriptor IS NOT NULL AND face_descriptor != '' THEN 1 ELSE 0 END as has_face_enrolled
      FROM employees WHERE id = ?
    `).get(internalId);
    if (updatedEmp && updatedEmp.email && updatedEmp.email.endsWith('@noemail.internal')) {
      updatedEmp.email = '';
    }

    saveDbSnapshot();
    res.json({ success: true, employee: updatedEmp });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/employees', (req, res) => {
  // Bulk deletion is permanently disabled to safeguard official employee data
  return res.status(403).json({ error: 'Bulk deletion of all staff records is permanently disabled to safeguard employee data.' });
});

app.delete('/api/employees/:id', (req, res) => {
  try {
    const target = db.prepare('SELECT id, emp_id FROM employees WHERE id = ? OR emp_id = ?').get(req.params.id, req.params.id);
    if (target) {
      db.prepare('DELETE FROM attendance WHERE emp_id = ?').run(target.emp_id);
      db.prepare('DELETE FROM leave_requests WHERE emp_id = ?').run(target.emp_id);
      db.prepare('DELETE FROM employees WHERE id = ?').run(target.id);

      // Track deleted employee ID permanently in settings table so snapshot auto-restore NEVER resurrects it!
      try {
        const deletedRow = db.prepare("SELECT value FROM settings WHERE key = 'deleted_emp_ids'").get();
        let deletedList = [];
        if (deletedRow && deletedRow.value) {
          try { deletedList = JSON.parse(deletedRow.value); } catch {}
        }
        if (!deletedList.includes(target.emp_id)) {
          deletedList.push(target.emp_id);
          db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('deleted_emp_ids', ?)").run(JSON.stringify(deletedList));
        }
      } catch (e) {}

      saveDbSnapshot();
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Face Descriptors for Real-time Matching
app.get('/api/face-descriptors', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT id, emp_id, name, department, role, avatar, face_descriptor
      FROM employees
      WHERE face_descriptor IS NOT NULL AND face_descriptor != '' AND status = 'active'
    `).all();

    const formatted = rows.map(r => ({
      id: r.id,
      emp_id: r.emp_id,
      name: r.name,
      department: r.department,
      role: r.role,
      avatar: r.avatar,
      descriptor: JSON.parse(r.face_descriptor)
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save Face Descriptor & Enrollment Photo
app.post('/api/employees/:id/face-descriptor', (req, res) => {
  try {
    const { descriptor, snapshotBase64 } = req.body;
    if (!descriptor || !Array.isArray(descriptor)) {
      return res.status(400).json({ error: 'Valid 128-d descriptor array is required' });
    }

    let avatarUrl = undefined;
    if (snapshotBase64) {
      try {
        const matches = snapshotBase64.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const ext = matches[1].includes('png') ? 'png' : 'jpg';
          const filename = `face_${req.params.id}_${Date.now()}.${ext}`;
          const filePath = path.join(__dirname, 'uploads', filename);
          fs.writeFileSync(filePath, Buffer.from(matches[2], 'base64'));
          avatarUrl = `/uploads/${filename}`;
        }
      } catch (fileErr) {
        console.error('File write error for snapshot:', fileErr);
      }
    }

    // Direct Base64 data URL is 100% self-contained and immune to missing filesystem files
    const directAvatar = snapshotBase64 || avatarUrl;
    const now = new Date().toISOString();
    if (directAvatar) {
      db.prepare(`
        UPDATE employees 
        SET face_descriptor = ?, face_enrolled_at = ?, avatar = ?, doc_photo = COALESCE(doc_photo, ?)
        WHERE id = ? OR emp_id = ?
      `).run(JSON.stringify(descriptor), now, directAvatar, directAvatar, req.params.id, req.params.id);

      try {
        const emp = db.prepare('SELECT emp_id FROM employees WHERE id = ? OR emp_id = ?').get(req.params.id, req.params.id);
        if (emp && emp.emp_id) {
          db.prepare('UPDATE attendance SET punch_photo = ? WHERE emp_id = ?').run(directAvatar, emp.emp_id);
        }
      } catch (punchErr) {
        console.warn('Error syncing punch photo on face enrollment:', punchErr.message);
      }
    } else {
      db.prepare(`
        UPDATE employees 
        SET face_descriptor = ?, face_enrolled_at = ?
        WHERE id = ? OR emp_id = ?
      `).run(JSON.stringify(descriptor), now, req.params.id, req.params.id);
    }

    saveDbSnapshot();
    res.json({ success: true, message: 'Face biometric enrolled successfully', avatar: directAvatar });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete/Reset Face Biometric
app.delete('/api/employees/:id/face-descriptor', (req, res) => {
  try {
    db.prepare(`
      UPDATE employees 
      SET face_descriptor = NULL, face_enrolled_at = NULL
      WHERE id = ? OR emp_id = ?
    `).run(req.params.id, req.params.id);
    saveDbSnapshot();
    res.json({ success: true, message: 'Face data removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Attendance Punch (FaceLock / PIN)
app.post('/api/attendance/punch', (req, res) => {
  try {
    const { emp_id, pin, mode = 'auto', photoBase64, method = 'facelock', notes } = req.body;
    
    // Find employee
    let employee;
    if (emp_id) {
      employee = db.prepare('SELECT * FROM employees WHERE emp_id = ?').get(emp_id);
    } else if (pin) {
      employee = db.prepare('SELECT * FROM employees WHERE pin = ?').get(pin);
    }

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found or unverified' });
    }

    // Ensure Indian Standard Time (IST) date and time
    const today = (req.body.clientDate && /^\d{4}-\d{2}-\d{2}$/.test(req.body.clientDate))
      ? req.body.clientDate
      : getTodayDate();

    let currentTime = req.body.clientTime;
    if (currentTime && /^\d{1,2}:\d{2}(:\d{2})?$/.test(currentTime)) {
      const parts = currentTime.split(':');
      const h = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      const s = (parts[2] || '00').padStart(2, '0');
      currentTime = `${h}:${m}:${s}`;
    } else {
      currentTime = getCurrentTime();
    }
    const settings = getSettings();

    // Save snapshot if provided
    let punchPhotoUrl = null;
    if (photoBase64) {
      // Store Base64 data URL directly so image renders immediately with zero network dependency
      punchPhotoUrl = photoBase64;

      // Also auto-populate employee avatar if empty
      if (!employee.avatar || String(employee.avatar).trim() === '') {
        try {
          db.prepare('UPDATE employees SET avatar = ? WHERE emp_id = ?').run(photoBase64, employee.emp_id);
          employee.avatar = photoBase64;
        } catch (avErr) {
          console.error('Auto-avatar update error:', avErr);
        }
      }

      // Try local file write for server disk archive
      try {
        const matches = photoBase64.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const ext = matches[1].includes('png') ? 'png' : 'jpg';
          const filename = `punch_${employee.emp_id}_${Date.now()}.${ext}`;
          const filePath = path.join(__dirname, 'uploads', filename);
          fs.writeFileSync(filePath, Buffer.from(matches[2], 'base64'));
        }
      } catch (fileErr) {
        console.error('Punch archive save error:', fileErr);
      }
    }

    // Check existing attendance for today
    const existing = db.prepare(`
      SELECT * FROM attendance WHERE emp_id = ? AND date = ?
    `).get(employee.emp_id, today);

    // Determine action: 'in' or 'out'
    let action = mode;
    if (mode === 'auto') {
      if (!existing) {
        action = 'in';
      } else {
        // Employee has already clocked in today. Check time difference:
        const [hIn, mIn] = existing.clock_in.split(':').map(Number);
        const [hCur, mCur] = currentTime.split(':').map(Number);
        const diffMinutes = (hCur * 60 + mCur) - (hIn * 60 + mIn);

        // Require at least 15 minutes between Clock-In and Clock-Out in Auto Mode
        // This prevents an employee who just clocked in from being accidentally clocked out immediately with 0 hours!
        if (diffMinutes < 15 && !existing.clock_out) {
          return res.json({
            status: 'already_clocked_in',
            action: 'already_clocked_in',
            message: `Already clocked in at ${existing.clock_in} (${existing.status === 'late' ? 'Late Arrival' : 'Present - On Time'}). Welcome!`,
            employee: {
              id: employee.id,
              emp_id: employee.emp_id,
              name: employee.name,
              role: employee.role,
              department: employee.department,
              avatar: employee.avatar
            },
            attendance: existing
          });
        }
        action = 'out';
      }
    }

    if (action === 'in') {
      if (existing) {
        return res.json({
          status: 'already_clocked_in',
          message: `Already clocked in at ${existing.clock_in}`,
          employee: {
            id: employee.id,
            emp_id: employee.emp_id,
            name: employee.name,
            role: employee.role,
            department: employee.department,
            avatar: employee.avatar
          },
          attendance: existing
        });
      }

      // Calculate status based on office start time + grace period (09:30 AM start + 10 min grace = after 09:40 AM Late Arrival)
      const officeStart = settings.office_start_time || '09:30';
      const graceMinutes = parseInt(settings.grace_period_minutes || '10', 10);
      
      const [startH, startM] = officeStart.split(':').map(Number);
      const graceTime = new Date(2000, 0, 1, startH, startM + graceMinutes, 0);
      const [curH, curM, curS = 0] = currentTime.split(':').map(Number);
      const punchTime = new Date(2000, 0, 1, curH, curM, curS);

      const status = punchTime > graceTime ? 'late' : 'present';
      const punchNote = notes || (status === 'late' ? 'Late arrival (Checked in after 09:40 AM)' : null);

      const insertStmt = db.prepare(`
        INSERT INTO attendance (emp_id, date, clock_in, status, punch_photo, method, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const result = insertStmt.run(
        employee.emp_id,
        today,
        currentTime,
        status,
        punchPhotoUrl,
        method,
        punchNote
      );

      const newRecord = db.prepare('SELECT * FROM attendance WHERE id = ?').get(result.lastInsertRowid);
      saveDbSnapshot();

      return res.json({
        status: 'success',
        action: 'clock_in',
        message: status === 'late' ? 'Clocked In (Late Arrival - after 09:40 AM)' : 'Clocked In (On Time)',
        employee: {
          id: employee.id,
          emp_id: employee.emp_id,
          name: employee.name,
          role: employee.role,
          department: employee.department,
          avatar: employee.avatar
        },
        attendance: newRecord
      });
    } else {
      // Clock Out - Calculate Overtime (OT) with dynamic late shift & 20-min buffer
      const officeStartTime = settings.office_start_time || '09:30';
      const officeEndTime = settings.office_end_time || '18:00';
      const bufferMinutes = parseInt(settings.ot_buffer_minutes || '20', 10);
      const clockInTime = existing ? existing.clock_in : currentTime;
      const { otHours, otMinutes } = calculateOT(currentTime, clockInTime, officeStartTime, officeEndTime, bufferMinutes);

      if (!existing) {
        // If employee didn't clock in, create record with start of day or current time
        const insertStmt = db.prepare(`
          INSERT INTO attendance (emp_id, date, clock_in, clock_out, total_hours, ot_hours, ot_minutes, status, punch_photo, method, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const result = insertStmt.run(
          employee.emp_id,
          today,
          currentTime,
          currentTime,
          0,
          otHours,
          otMinutes,
          'half_day',
          punchPhotoUrl,
          method,
          otMinutes > 0 ? `Overtime: ${otMinutes} mins` : null
        );
        const newRecord = db.prepare('SELECT * FROM attendance WHERE id = ?').get(result.lastInsertRowid);
        saveDbSnapshot();
        return res.json({
          status: 'success',
          action: 'clock_out',
          message: 'Clocked Out',
          employee: {
            id: employee.id,
            emp_id: employee.emp_id,
            name: employee.name,
            role: employee.role,
            department: employee.department,
            avatar: employee.avatar
          },
          attendance: newRecord
        });
      }

      // Compute total hours & overtime
      const totalHours = calculateHours(existing.clock_in, currentTime);
      const halfDayThreshold = parseFloat(settings.half_day_threshold_hours || '4.5');
      let status = existing.status;
      if (totalHours < halfDayThreshold && status !== 'late') {
        status = 'half_day';
      }

      let updatedNotes = existing.notes || '';
      if (otMinutes > 0) {
        updatedNotes = updatedNotes 
          ? `${updatedNotes} | OT: ${otMinutes} mins`
          : `Overtime: ${otMinutes} mins`;
      }

      db.prepare(`
        UPDATE attendance
        SET clock_out = ?, total_hours = ?, ot_hours = ?, ot_minutes = ?, status = ?, notes = ?,
            punch_photo = COALESCE(?, punch_photo)
        WHERE id = ?
      `).run(currentTime, totalHours, otHours, otMinutes, status, updatedNotes || null, punchPhotoUrl, existing.id);

      const updatedRecord = db.prepare('SELECT * FROM attendance WHERE id = ?').get(existing.id);
      saveDbSnapshot();

      const otNotice = otMinutes > 0 ? ` (+${otMinutes} mins Overtime)` : '';
      return res.json({
        status: 'success',
        action: 'clock_out',
        message: `Clocked Out (${totalHours} hrs worked${otNotice})`,
        employee: {
          id: employee.id,
          emp_id: employee.emp_id,
          name: employee.name,
          role: employee.role,
          department: employee.department,
          avatar: employee.avatar
        },
        attendance: updatedRecord
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Today's Attendance List
app.get('/api/attendance/today', (req, res) => {
  try {
    const today = getTodayDate();
    const rows = db.prepare(`
      SELECT 
        a.id, a.emp_id, a.date, a.clock_in, a.clock_out, a.total_hours,
        COALESCE(a.ot_hours, 0) as ot_hours,
        COALESCE(a.ot_minutes, 0) as ot_minutes,
        a.status, 
        COALESCE(a.holiday_type, 'normal') as holiday_type,
        a.punch_photo, a.method, a.notes, a.created_at,
        COALESCE(e.name, a.emp_id) as employee_name, 
        COALESCE(NULLIF(e.department, ''), e.role, 'Digital Marketing') as department, 
        COALESCE(e.role, 'Staff') as role, 
        e.avatar, e.email
      FROM attendance a
      LEFT JOIN employees e ON a.emp_id = e.emp_id
      WHERE a.date = ?
      ORDER BY a.clock_in DESC
    `).all(today);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Today's Summary KPI Stats
app.get('/api/attendance/today-summary', (req, res) => {
  try {
    const today = getTodayDate();

    const totalStaff = db.prepare("SELECT COUNT(*) as count FROM employees WHERE status = 'active'").get().count;

    const presentList = db.prepare(`
      SELECT COUNT(*) as count FROM attendance WHERE date = ?
    `).get(today).count;

    const lateCount = db.prepare(`
      SELECT COUNT(*) as count FROM attendance WHERE date = ? AND status = 'late'
    `).get(today).count;

    const halfDayCount = db.prepare(`
      SELECT COUNT(*) as count FROM attendance WHERE date = ? AND status = 'half_day'
    `).get(today).count;

    const currentlyIn = db.prepare(`
      SELECT COUNT(*) as count FROM attendance WHERE date = ? AND clock_out IS NULL
    `).get(today).count;

    const onLeaveCount = db.prepare(`
      SELECT COUNT(*) as count FROM leave_requests 
      WHERE status = 'approved' AND start_date <= ? AND end_date >= ?
    `).get(today, today).count;

    const absentCount = Math.max(0, totalStaff - presentList - onLeaveCount);

    const totalOTRow = db.prepare(`
      SELECT SUM(ot_hours) as total_ot FROM attendance WHERE date = ?
    `).get(today);
    const totalOT = totalOTRow?.total_ot || 0;

    res.json({
      total_employees: totalStaff,
      present_today: presentList,
      late_today: lateCount,
      half_day_today: halfDayCount,
      currently_in_office: currentlyIn,
      on_leave_today: onLeaveCount,
      absent_today: absentCount,
      overtime_today: Number(totalOT.toFixed(2)),
      date: today
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Attendance History & Reports Filter
app.get('/api/attendance/history', (req, res) => {
  try {
    const { startDate, endDate, department, emp_id, status, date, limit } = req.query;

    let query = `
      SELECT 
        a.id, a.emp_id, a.date, a.clock_in, a.clock_out, a.total_hours,
        COALESCE(a.ot_hours, 0) as ot_hours,
        COALESCE(a.ot_minutes, 0) as ot_minutes,
        a.status,
        COALESCE(a.holiday_type, 'normal') as holiday_type,
        a.punch_photo, a.method, a.notes,
        COALESCE(e.name, a.emp_id) as employee_name, 
        COALESCE(NULLIF(e.department, ''), e.role, 'Digital Marketing') as department, 
        COALESCE(e.role, 'Staff') as role, 
        e.avatar
      FROM attendance a
      LEFT JOIN employees e ON a.emp_id = e.emp_id
      WHERE 1=1
    `;
    const params = [];

    if (date) {
      query += ' AND a.date = ?';
      params.push(date);
    }
    if (startDate) {
      query += ' AND a.date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND a.date <= ?';
      params.push(endDate);
    }
    if (department) {
      query += ' AND (e.department = ? OR e.department IS NULL)';
      params.push(department);
    }
    if (emp_id) {
      query += ' AND a.emp_id = ?';
      params.push(emp_id);
    }
    if (status) {
      query += ' AND a.status = ?';
      params.push(status);
    }

    const limitVal = parseInt(limit, 10);
    if (limitVal > 0) {
      query += ' ORDER BY a.date DESC, a.clock_in DESC LIMIT ' + limitVal;
    } else {
      query += ' ORDER BY a.date DESC, a.clock_in DESC LIMIT 1000';
    }

    const rows = db.prepare(query).all(...params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Single Employee Attendance Record on Date
app.get('/api/attendance/record', (req, res) => {
  try {
    const { emp_id, date } = req.query;
    if (!emp_id || !date) {
      return res.status(400).json({ error: 'emp_id and date are required' });
    }
    const row = db.prepare(`
      SELECT 
        a.id, a.emp_id, a.date, a.clock_in, a.clock_out, a.total_hours,
        COALESCE(a.ot_hours, 0) as ot_hours,
        COALESCE(a.ot_minutes, 0) as ot_minutes,
        a.status, a.punch_photo, a.method, a.notes,
        COALESCE(e.name, a.emp_id) as employee_name, 
        COALESCE(NULLIF(e.department, ''), e.role, 'Digital Marketing') as department, 
        COALESCE(e.role, 'Staff') as role, 
        e.avatar
      FROM attendance a
      LEFT JOIN employees e ON a.emp_id = e.emp_id
      WHERE a.emp_id = ? AND a.date = ?
    `).get(emp_id, date);
    res.json(row || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Manual Attendance Adjustment (Create or Update)
app.post('/api/attendance/manual', (req, res) => {
  try {
    const { id, emp_id, date, clock_in, clock_out, status, notes, ot_minutes, holiday_type } = req.body;
    if (!emp_id) {
      return res.status(400).json({ error: 'Employee ID is required.' });
    }
    if (!date) {
      return res.status(400).json({ error: 'Attendance date is required.' });
    }

    // Auto-create basic employee entry if missing, ensuring FOREIGN KEY constraint NEVER fails
    const emp = db.prepare('SELECT id, emp_id, name, avatar FROM employees WHERE emp_id = ?').get(emp_id);
    if (!emp) {
      try {
        db.prepare(`
          INSERT OR IGNORE INTO employees (emp_id, name, email, department, role, status)
          VALUES (?, ?, ?, ?, ?, 'active')
        `).run(
          emp_id,
          emp_id,
          `${emp_id.toLowerCase()}@velavanproperties.com`,
          'Digital Marketing',
          'Staff'
        );
      } catch (e) {}
    }

    const settings = getSettings();
    let resultId = null;
    let isUpdate = false;

    // Wrap in a safe transaction: atomicity guarantees zero data loss on failure!
    const manualTx = db.transaction(() => {
      // 1. Resolve existing record by (emp_id, date) first, or by id
      let existing = db.prepare('SELECT * FROM attendance WHERE emp_id = ? AND date = ?').get(emp_id, date);
      if (!existing && id && id !== '0') {
        const byId = db.prepare('SELECT * FROM attendance WHERE id = ?').get(id);
        if (byId) {
          existing = byId;
        }
      }

      // Holiday Type determination
      const finalHolidayType = (holiday_type && String(holiday_type).trim()) ? String(holiday_type).trim() : (existing?.holiday_type || 'normal');

      // 2. Determine clean clock_in & clock_out
      // PRESERVE FACELOCK TIME: If employee clocked in via FaceLock and new clock_in is empty/'--', keep original FaceLock clock_in!
      let finalClockIn = '--';
      if (status !== 'absent' && status !== 'weekly_off') {
        if (clock_in && clock_in !== '--' && String(clock_in).trim() !== '' && String(clock_in).trim() !== 'null') {
          finalClockIn = String(clock_in).trim();
        } else if (existing && existing.clock_in && existing.clock_in !== '--') {
          finalClockIn = existing.clock_in;
        } else {
          finalClockIn = '09:30:00';
        }
      }

      let finalClockOut = '--';
      if (status !== 'absent' && status !== 'weekly_off') {
        if (clock_out && clock_out !== '--' && String(clock_out).trim() !== '' && String(clock_out).trim() !== 'null') {
          finalClockOut = String(clock_out).trim();
        } else if (existing && existing.clock_out && existing.clock_out !== '--') {
          finalClockOut = existing.clock_out;
        }
      }

      let totalHours = 0;
      let otHours = 0;
      let finalOtMinutes = 0;

      const isOD = status === 'od' || status === 'login_od' || status === 'logout_od' || finalClockIn === 'OD' || finalClockOut === 'OD';
      if (isOD) {
        totalHours = 8.5;
        finalOtMinutes = (ot_minutes !== undefined && ot_minutes !== null && ot_minutes !== '') ? Number(ot_minutes) : 0;
        otHours = finalOtMinutes > 0 ? Number((finalOtMinutes / 60).toFixed(2)) : 0;
      } else {
        const hasValidTimes = finalClockIn !== '--' && finalClockOut !== '--' && status !== 'absent' && status !== 'weekly_off';
        if (hasValidTimes) {
          totalHours = calculateHours(finalClockIn, finalClockOut);
          const ot = calculateOT(
            finalClockOut,
            finalClockIn,
            settings.office_start_time || '09:30',
            settings.office_end_time || '18:00',
            parseInt(settings.ot_buffer_minutes || '20', 10)
          );
          otHours = ot.otHours;
          finalOtMinutes = (ot_minutes !== undefined && ot_minutes !== null && ot_minutes !== '') ? Number(ot_minutes) : ot.otMinutes;
        }
      }

      // PRESERVE BIOMETRIC PUNCH PHOTO & METHOD: If existing record has biometric FaceLock photo, NEVER erase or wipe it!
      const photoToKeep = (existing && existing.punch_photo) ? existing.punch_photo : (emp?.avatar || null);
      const methodToKeep = (existing && existing.method) ? existing.method : 'manual';
      const finalNotes = (notes && notes.trim()) ? notes.trim() : (existing?.notes || 'HR manual adjustment');

      if (existing) {
        // UPDATE existing record safely without creating duplicates
        db.prepare(`
          UPDATE attendance
          SET emp_id = ?, date = ?, clock_in = ?, clock_out = ?, total_hours = ?, ot_hours = ?, ot_minutes = ?, status = ?, notes = ?, method = ?, punch_photo = ?, holiday_type = ?
          WHERE id = ?
        `).run(
          emp_id,
          date,
          finalClockIn,
          finalClockOut,
          totalHours,
          otHours,
          finalOtMinutes,
          status,
          finalNotes,
          methodToKeep,
          photoToKeep,
          finalHolidayType,
          existing.id
        );
        resultId = existing.id;
        isUpdate = true;
      } else {
        // INSERT new record safely
        const ins = db.prepare(`
          INSERT INTO attendance (emp_id, date, clock_in, clock_out, total_hours, ot_hours, ot_minutes, status, notes, method, punch_photo, holiday_type)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?)
        `).run(
          emp_id,
          date,
          finalClockIn,
          finalClockOut,
          totalHours,
          otHours,
          finalOtMinutes,
          status,
          finalNotes,
          photoToKeep,
          finalHolidayType
        );
        resultId = ins.lastInsertRowid;
        isUpdate = false;
      }
    });

    manualTx();
    saveDbSnapshot();

    const savedRecord = db.prepare(`
      SELECT 
        a.*, 
        COALESCE(e.name, a.emp_id) as employee_name,
        COALESCE(e.department, 'Digital Marketing') as department,
        COALESCE(e.role, 'Staff') as role,
        e.avatar
      FROM attendance a
      LEFT JOIN employees e ON a.emp_id = e.emp_id
      WHERE a.id = ?
    `).get(resultId);

    return res.json({ 
      success: true, 
      updated: isUpdate, 
      created: !isUpdate, 
      id: resultId,
      attendance: savedRecord 
    });
  } catch (err) {
    console.error('[Manual Attendance Error]:', err.message);
    res.status(500).json({ success: false, error: err.message || 'Failed to save attendance' });
  }
});

app.put('/api/attendance/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { emp_id, date, clock_in, clock_out, status, notes, ot_minutes, holiday_type } = req.body;
    if (emp_id) {
      const emp = db.prepare('SELECT id, emp_id, name FROM employees WHERE emp_id = ?').get(emp_id);
      if (!emp) {
        try {
          db.prepare(`
            INSERT OR IGNORE INTO employees (emp_id, name, email, department, role, status)
            VALUES (?, ?, ?, ?, ?, 'active')
          `).run(
            emp_id,
            emp_id,
            `${emp_id.toLowerCase()}@velavanproperties.com`,
            'Digital Marketing',
            'Staff'
          );
        } catch (e) {}
      }
    }
    const settings = getSettings();
    let totalHours = 0;
    let otHours = 0;
    let finalOtMinutes = 0;

    const isOD = status === 'od' || status === 'login_od' || status === 'logout_od' || clock_in === 'OD' || clock_out === 'OD';
    if (isOD) {
      totalHours = 8.5;
      finalOtMinutes = (ot_minutes !== undefined && ot_minutes !== null && ot_minutes !== '') ? Number(ot_minutes) : 0;
      otHours = finalOtMinutes > 0 ? Number((finalOtMinutes / 60).toFixed(2)) : 0;
    } else {
      const hasValidTimes = clock_in && clock_out && clock_in !== '--' && clock_out !== '--' && status !== 'absent' && status !== 'weekly_off';
      if (hasValidTimes) {
        totalHours = calculateHours(clock_in, clock_out);
        const ot = calculateOT(
          clock_out,
          clock_in,
          settings.office_start_time || '09:30',
          settings.office_end_time || '18:00',
          parseInt(settings.ot_buffer_minutes || '20', 10)
        );
        otHours = ot.otHours;
        finalOtMinutes = (ot_minutes !== undefined && ot_minutes !== null && ot_minutes !== '') ? Number(ot_minutes) : ot.otMinutes;
      }
    }

    const cleanIn = (clock_in && String(clock_in).trim() && String(clock_in).trim() !== 'null' && String(clock_in).trim() !== 'undefined') ? String(clock_in).trim() : '--';
    const cleanOut = (clock_out && String(clock_out).trim() && String(clock_out).trim() !== 'null' && String(clock_out).trim() !== 'undefined') ? String(clock_out).trim() : '--';
    const cIn = (status === 'absent' || status === 'weekly_off') ? '--' : cleanIn;
    const cOut = (status === 'absent' || status === 'weekly_off') ? '--' : cleanOut;

    db.prepare(`
      UPDATE attendance
      SET clock_in = ?, clock_out = ?, total_hours = ?, ot_hours = ?, ot_minutes = ?, status = ?, notes = ?, method = 'manual', holiday_type = COALESCE(?, holiday_type, 'normal')
      WHERE id = ?
    `).run(cIn, cOut, totalHours, otHours, finalOtMinutes, status, notes || 'HR manual adjustment', holiday_type, id);
    saveDbSnapshot();
    res.json({ success: true, updated: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/attendance/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { emp_id, date } = req.query;
    if (id && id !== '0' && id !== 'undefined' && id !== 'null') {
      db.prepare('DELETE FROM attendance WHERE id = ?').run(id);
    }
    if (emp_id && date) {
      db.prepare('DELETE FROM attendance WHERE emp_id = ? AND date = ?').run(emp_id, date);
    }
    saveDbSnapshot();
    res.json({ success: true, message: 'Attendance record deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/attendance', (req, res) => {
  try {
    const { id, emp_id, date } = req.query;
    if (id && id !== '0') {
      db.prepare('DELETE FROM attendance WHERE id = ?').run(id);
    }
    if (emp_id && date) {
      db.prepare('DELETE FROM attendance WHERE emp_id = ? AND date = ?').run(emp_id, date);
    }
    saveDbSnapshot();
    res.json({ success: true, message: 'Attendance record deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Complete Attendance Reset (Clean Slate)
app.post('/api/attendance/reset', (req, res) => {
  try {
    db.prepare('DELETE FROM attendance').run();
    try {
      db.prepare("DELETE FROM sqlite_sequence WHERE name = 'attendance'").run();
    } catch (e) {}
    saveDbSnapshot();
    console.log('[Attendance Reset] All attendance records have been cleared from database.');
    res.json({ success: true, message: 'All attendance records successfully reset.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Leave Requests
app.get('/api/leaves', (req, res) => {
  try {
    const { emp_id } = req.query;
    let query = `
      SELECT 
        l.id, l.emp_id, l.type, l.start_date, l.end_date, l.days,
        COALESCE(e.name, l.emp_id) as employee_name, 
        COALESCE(NULLIF(e.department, ''), e.role, 'Digital Marketing') as department, 
        COALESCE(e.role, 'Staff') as role, 
        e.avatar
      FROM leave_requests l
      LEFT JOIN employees e ON l.emp_id = e.emp_id
    `;
    const params = [];
    if (emp_id) {
      query += ' WHERE l.emp_id = ?';
      params.push(emp_id);
    }
    query += ' ORDER BY l.created_at DESC';

    const rows = db.prepare(query).all(...params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/leaves', (req, res) => {
  try {
    const { emp_id, type, start_date, end_date, days = 1, reason } = req.body;
    const stmt = db.prepare(`
      INSERT INTO leave_requests (emp_id, type, start_date, end_date, days, reason, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `);
    const result = stmt.run(emp_id, type, start_date, end_date, days, reason);
    res.status(201).json({ id: result.lastInsertRowid, success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/leaves/:id/status', (req, res) => {
  try {
    const { status, admin_notes } = req.body;
    db.prepare(`
      UPDATE leave_requests
      SET status = ?, admin_notes = COALESCE(?, admin_notes)
      WHERE id = ?
    `).run(status, admin_notes, req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CSV Export (Attendance Logs)
app.get('/api/reports/export', (req, res) => {
  try {
    const { startDate, endDate, department } = req.query;

    let query = `
      SELECT 
        a.date, a.emp_id, COALESCE(e.name, a.emp_id) as employee_name, COALESCE(NULLIF(e.department, ''), e.role, 'Digital Marketing') as department,
        a.clock_in, a.clock_out, a.total_hours, COALESCE(a.ot_minutes, 0) as ot_minutes, a.status, COALESCE(a.holiday_type, 'normal') as holiday_type, a.method, a.notes
      FROM attendance a
      LEFT JOIN employees e ON a.emp_id = e.emp_id
      WHERE 1=1
    `;
    const params = [];
    if (startDate) { query += ' AND a.date >= ?'; params.push(startDate); }
    if (endDate) { query += ' AND a.date <= ?'; params.push(endDate); }
    if (department) { query += ' AND e.department = ?'; params.push(department); }

    query += ' ORDER BY a.date DESC, e.name ASC';

    const records = db.prepare(query).all(...params);

    let csv = 'Date,Employee ID,Employee Name,Department,Clock In,Clock Out,Total Hours,OT Minutes,Status,Holiday / Leave Type,Method,Notes\r\n';
    for (const r of records) {
      csv += `"${r.date}","${r.emp_id}","${r.employee_name}","${r.department}","${r.clock_in || ''}","${r.clock_out || ''}",${r.total_hours || 0},${r.ot_minutes || 0},"${r.status}","${r.holiday_type || 'normal'}","${r.method}","${(r.notes || '').replace(/"/g, '""')}"\r\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=attendance_report_${Date.now()}.csv`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Monthly Payroll & Full Attendance (+2 Days Salary Extra) CSV Export
app.get('/api/reports/payroll-export', (req, res) => {
  try {
    const { startDate, endDate, department } = req.query;

    let empQuery = `SELECT * FROM employees WHERE status = 'active'`;
    const empParams = [];
    if (department) {
      empQuery += ` AND department = ?`;
      empParams.push(department);
    }
    empQuery += ` ORDER BY name ASC`;
    const employees = db.prepare(empQuery).all(...empParams);

    let attQuery = `SELECT emp_id, date, status, COALESCE(ot_minutes, 0) as ot_minutes FROM attendance WHERE 1=1`;
    const attParams = [];
    if (startDate) { attQuery += ' AND date >= ?'; attParams.push(startDate); }
    if (endDate) { attQuery += ' AND date <= ?'; attParams.push(endDate); }
    const attendanceRecords = db.prepare(attQuery).all(...attParams);

    let csv = 'Employee ID,Employee Name,Department,Role,Monthly Base Salary (INR),Daily Rate (INR),Days Present,Days Late,Days Absent,Half Days,OT Minutes,OT Pay (INR),Full Present Bonus Qualified,2 Days Extra Salary Bonus (INR),Estimated Net Total Payout (INR)\r\n';

    for (const emp of employees) {
      const records = attendanceRecords.filter(r => r.emp_id === emp.emp_id);
      let present = 0;
      let late = 0;
      let absent = 0;
      let halfday = 0;
      let otMinutes = 0;

      for (const r of records) {
        if (r.status === 'present') {
          present++;
        } else if (r.status === 'late') {
          present++;
          late++;
        } else if (r.status === 'absent') {
          absent++;
        } else if (r.status === 'half_day') {
          halfday++;
        }
        if (r.ot_minutes) otMinutes += r.ot_minutes;
      }

      const baseSalary = Number(emp.salary || 0);
      const dailyRate = baseSalary > 0 ? baseSalary / 30 : 0;
      const otRatePerMin = dailyRate > 0 ? (dailyRate / 510) * 1.5 : 0;
      const otPay = Math.round(otMinutes * otRatePerMin);

      const deductions = Math.round(absent * dailyRate + halfday * 0.5 * dailyRate);
      const earnedBase = Math.max(0, Math.round(baseSalary - deductions));

      // Policy: If 100% full present (0 absences, 0 half-days, at least 1 day worked), 2 days salary extra bonus!
      const isFullPresent = absent === 0 && halfday === 0 && present > 0;
      const bonus2Days = isFullPresent ? Math.round(2 * dailyRate) : 0;
      const netPayout = earnedBase + bonus2Days + otPay;

      csv += `"${emp.emp_id}","${emp.name}","${emp.department || 'Digital Marketing'}","${emp.role || 'Staff'}",${baseSalary},${Math.round(dailyRate)},${present},${late},${absent},${halfday},${otMinutes},${otPay},"${isFullPresent ? 'YES (Qualified +2 Days Extra)' : 'NO'}",${bonus2Days},${netPayout}\r\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=velavan_payroll_report_${Date.now()}.csv`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Full Cloud Database Backup Export
app.get('/api/backup', (req, res) => {
  try {
    const employees = db.prepare(`
      SELECT 
        *,
        CASE WHEN face_descriptor IS NOT NULL AND face_descriptor != '' THEN 1 ELSE 0 END as has_face_enrolled
      FROM employees
      ORDER BY name ASC
    `).all();
    const formattedEmployees = employees.map(r => ({
      ...r,
      email: (r.email && !r.email.endsWith('@noemail.internal')) ? r.email : ''
    }));
    const attendance = db.prepare('SELECT * FROM attendance').all();
    const settings = db.prepare('SELECT * FROM settings').all();
    const leave_requests = db.prepare('SELECT * FROM leave_requests').all();
    const payload = {
      timestamp: new Date().toISOString(),
      organization: 'Velavan Properties',
      employeeCount: formattedEmployees.length,
      employees: formattedEmployees,
      attendance,
      settings,
      leave_requests,
      leaves: leave_requests
    };
    res.json({
      success: true,
      ...payload,
      data: payload
    });
  } catch (err) {
    res.status(500).json({ error: err.message, success: false });
  }
});

// Full Cloud Database Restore
app.post('/api/backup/restore', (req, res) => {
  try {
    const body = req.body?.data || req.body || {};
    const { employees, attendance, settings, leaves, leave_requests } = body;
    let restoredEmployees = 0;
    let restoredAttendance = 0;

    const empValidCols = new Set(db.prepare('PRAGMA table_info(employees)').all().map(c => c.name));
    const attValidCols = new Set(db.prepare('PRAGMA table_info(attendance)').all().map(c => c.name));
    const leaveValidCols = new Set(db.prepare('PRAGMA table_info(leave_requests)').all().map(c => c.name));

    const restoreTx = db.transaction(() => {
      if (Array.isArray(employees)) {
        for (const emp of employees) {
          if (!emp || !emp.emp_id) continue;
          const empId = emp.emp_id;
          const existing = db.prepare('SELECT * FROM employees WHERE emp_id = ? OR id = ?').get(empId, emp.id || 0);
          if (existing) {
            const merged = { ...existing };
            for (const [k, v] of Object.entries(emp)) {
              if (k === 'id' || !empValidCols.has(k)) continue;
              if (v !== undefined && v !== null && v !== '') {
                merged[k] = v;
              }
            }
            const keys = Object.keys(merged).filter(k => k !== 'id' && empValidCols.has(k));
            const setClause = keys.map(k => `${k} = ?`).join(', ');
            const values = keys.map(k => merged[k]);
            db.prepare(`UPDATE employees SET ${setClause} WHERE id = ?`).run(...values, existing.id);
          } else {
            const keys = Object.keys(emp).filter(k => k !== 'id' && empValidCols.has(k));
            const placeholders = keys.map(() => '?').join(', ');
            const values = keys.map(k => emp[k]);
            db.prepare(`INSERT INTO employees (${keys.join(', ')}) VALUES (${placeholders})`).run(...values);
          }
          restoredEmployees++;
        }
      }
      if (Array.isArray(attendance)) {
        for (const att of attendance) {
          if (!att || !att.emp_id || !att.date) continue;
          // Filter to only columns that actually exist in attendance table
          const keys = Object.keys(att).filter(k => k !== 'id' && attValidCols.has(k));
          if (keys.length === 0) continue;
          
          const existing = db.prepare('SELECT id FROM attendance WHERE emp_id = ? AND date = ?').get(att.emp_id, att.date);
          if (existing) {
            const setClause = keys.map(k => `${k} = ?`).join(', ');
            const values = keys.map(k => att[k]);
            db.prepare(`UPDATE attendance SET ${setClause} WHERE id = ?`).run(...values, existing.id);
          } else {
            const placeholders = keys.map(() => '?').join(', ');
            const values = keys.map(k => att[k]);
            db.prepare(`INSERT INTO attendance (${keys.join(', ')}) VALUES (${placeholders})`).run(...values);
          }
          restoredAttendance++;
        }
      }
      const lList = leave_requests || leaves;
      if (Array.isArray(lList)) {
        for (const l of lList) {
          if (!l || !l.emp_id) continue;
          const keys = Object.keys(l).filter(k => k !== 'id' && leaveValidCols.has(k));
          if (keys.length === 0) continue;
          const placeholders = keys.map(() => '?').join(', ');
          const values = keys.map(k => l[k]);
          db.prepare(`INSERT OR REPLACE INTO leave_requests (${keys.join(', ')}) VALUES (${placeholders})`).run(...values);
        }
      }
    });

    restoreTx();
    saveDbSnapshot();
    res.json({ 
      success: true, 
      message: `Successfully restored ${restoredEmployees} employees and ${restoredAttendance} attendance records.`
    });
  } catch (err) {
    console.error('Backup restore error:', err);
    res.status(500).json({ error: err.message });
  }
});

// In production: Serve built React applications if dist exists
const adminDist = path.join(__dirname, '../admin-app/dist');
if (fs.existsSync(adminDist)) {
  app.use('/admin', express.static(adminDist));
  app.get(/^\/admin(?:\/.*)?$/, (req, res) => {
    res.sendFile(path.join(adminDist, 'index.html'));
  });
}

const employeeDist = path.join(__dirname, '../employee-app/dist');
if (fs.existsSync(employeeDist)) {
  app.use(express.static(employeeDist));
  app.use((req, res, next) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      return res.sendFile(path.join(employeeDist, 'index.html'));
    }
    next();
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Velavan Properties Attendance API Server running on port ${PORT}`);

  // Heartbeat self-ping every 10 minutes to prevent Render idle spin-down
  setInterval(() => {
    fetch('https://velavan-attendance.onrender.com/api/health')
      .then(r => r.json())
      .then(() => console.log('[Heartbeat] Server pinged successfully'))
      .catch(() => {});
  }, 10 * 60 * 1000);
});
