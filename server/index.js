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
  const [h1, m1, s1 = 0] = timeIn.split(':').map(Number);
  const [h2, m2, s2 = 0] = timeOut.split(':').map(Number);
  const d1 = new Date(2000, 0, 1, h1, m1, s1);
  const d2 = new Date(2000, 0, 1, h2, m2, s2);
  let diffMs = d2 - d1;
  if (diffMs < 0) diffMs += 24 * 60 * 60 * 1000;
  return Number((diffMs / (1000 * 60 * 60)).toFixed(2));
}

// Helper: Calculate Overtime (OT) hours based on dynamic late-entry offset and 20-min buffer rule:
// 1. Office regular end time is 18:00 (6:00 PM).
// 2. An employee arriving on-time (<= 09:30 AM) has regular shift end 18:00 (6:00 PM) and OT buffer 18:20 (6:20 PM).
//    If clocked out > 18:20, OT is calculated from 18:00 (6:00 PM).
// 3. For an employee arriving late (e.g. 09:40 AM -> 10 mins late, 09:50 AM -> 20 mins late),
//    their required shift end shifts forward by that late duration (18:10 for 9:40, 18:20 for 9:50).
//    Their OT buffer also shifts (18:30 for 9:40, 18:40 for 9:50).
//    Once they work past that adjusted threshold, OT is calculated from their shifted shift end!
function calculateOT(timeOut, timeIn = '09:30', officeStartTime = '09:30', officeEndTime = '18:00', bufferMinutes = 20) {
  if (!timeOut || timeOut === '--') return { otHours: 0, otMinutes: 0 };

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

// Helper: Format date as YYYY-MM-DD
function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

// Helper: Format current time as HH:MM:SS
function getCurrentTime() {
  const d = new Date();
  return d.toTimeString().split(' ')[0];
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

    let empId = record?.emp_id;
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
        status, join_date, face_enrolled_at, created_at,
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
    res.status(201).json({ id: result.lastInsertRowid, emp_id: actualEmpId, success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/employees/:id', (req, res) => {
  try {
    const { 
      name, email, phone, department, role, pin, avatar, status,
      doj, emergency_phone, father_name, mother_name, spouse_name,
      gender, dob, blood_group, marital_status, address, aadhaar_number,
      salary,
      bank_name, account_number, ifsc_code, account_holder_name, branch_name, pan_number,
      doc_aadhaar, doc_pan, doc_photo, doc_bank_passbook,
      doc_10th, doc_12th, doc_college, doc_marksheet,
      face_descriptor
    } = req.body;

    const faceEnrolledAt = (face_descriptor && face_descriptor !== '') ? new Date().toISOString() : null;

    if (phone && phone.trim()) {
      const existingPhone = db.prepare('SELECT id, name, emp_id FROM employees WHERE phone = ? AND id != ?').get(phone.trim(), req.params.id);
      if (existingPhone) {
        return res.status(400).json({ 
          error: `Phone ${phone.trim()} is already used by another employee (${existingPhone.name} - ${existingPhone.emp_id}).` 
        });
      }
    }

    if (aadhaar_number && aadhaar_number.trim()) {
      const existingAadhaar = db.prepare('SELECT id, name, emp_id FROM employees WHERE aadhaar_number = ? AND id != ?').get(aadhaar_number.trim(), req.params.id);
      if (existingAadhaar) {
        return res.status(400).json({ 
          error: `Aadhaar number ${aadhaar_number.trim()} is already used by another employee (${existingAadhaar.name} - ${existingAadhaar.emp_id}).` 
        });
      }
    }

    const val = (v) => (v !== undefined ? v : null);

    db.prepare(`
      UPDATE employees 
      SET name = COALESCE(?, name),
          email = COALESCE(?, email),
          phone = COALESCE(?, phone),
          department = COALESCE(?, department),
          role = COALESCE(?, role),
          pin = COALESCE(?, pin),
          avatar = COALESCE(?, avatar),
          status = COALESCE(?, status),
          doj = COALESCE(?, doj),
          join_date = COALESCE(?, join_date),
          emergency_phone = COALESCE(?, emergency_phone),
          father_name = COALESCE(?, father_name),
          mother_name = COALESCE(?, mother_name),
          spouse_name = COALESCE(?, spouse_name),
          gender = COALESCE(?, gender),
          dob = COALESCE(?, dob),
          blood_group = COALESCE(?, blood_group),
          marital_status = COALESCE(?, marital_status),
          address = COALESCE(?, address),
          aadhaar_number = COALESCE(?, aadhaar_number),
          salary = COALESCE(?, salary),
          bank_name = COALESCE(?, bank_name),
          account_number = COALESCE(?, account_number),
          ifsc_code = COALESCE(?, ifsc_code),
          account_holder_name = COALESCE(?, account_holder_name),
          branch_name = COALESCE(?, branch_name),
          pan_number = COALESCE(?, pan_number),
          doc_aadhaar = COALESCE(?, doc_aadhaar),
          doc_pan = COALESCE(?, doc_pan),
          doc_photo = COALESCE(?, doc_photo),
          doc_bank_passbook = COALESCE(?, doc_bank_passbook),
          doc_10th = COALESCE(?, doc_10th),
          doc_12th = COALESCE(?, doc_12th),
          doc_college = COALESCE(?, doc_college),
          doc_marksheet = COALESCE(?, doc_marksheet),
          face_descriptor = COALESCE(?, face_descriptor),
          face_enrolled_at = COALESCE(?, face_enrolled_at)
      WHERE id = ?
    `).run(
      val(name), val(email), val(phone), val(department), val(role), val(pin), val(avatar), val(status),
      val(doj), val(doj), val(emergency_phone), val(father_name), val(mother_name), val(spouse_name),
      val(gender), val(dob), val(blood_group), val(marital_status), val(address), val(aadhaar_number),
      val(salary),
      val(bank_name), val(account_number), val(ifsc_code), val(account_holder_name), val(branch_name), val(pan_number),
      val(doc_aadhaar), val(doc_pan), val(doc_photo), val(doc_bank_passbook),
      val(doc_10th), val(doc_12th), val(doc_college), val(doc_marksheet),
      val(face_descriptor), val(faceEnrolledAt), req.params.id
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/employees/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM employees WHERE id = ?').run(req.params.id);
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
      // Save snapshot file
      const matches = snapshotBase64.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const ext = matches[1].includes('png') ? 'png' : 'jpg';
        const filename = `face_${req.params.id}_${Date.now()}.${ext}`;
        const filePath = path.join(__dirname, 'uploads', filename);
        fs.writeFileSync(filePath, Buffer.from(matches[2], 'base64'));
        avatarUrl = `/uploads/${filename}`;
      }
    }

    const now = new Date().toISOString();
    if (avatarUrl) {
      db.prepare(`
        UPDATE employees 
        SET face_descriptor = ?, face_enrolled_at = ?, avatar = ?
        WHERE id = ?
      `).run(JSON.stringify(descriptor), now, avatarUrl, req.params.id);
    } else {
      db.prepare(`
        UPDATE employees 
        SET face_descriptor = ?, face_enrolled_at = ?
        WHERE id = ?
      `).run(JSON.stringify(descriptor), now, req.params.id);
    }

    res.json({ success: true, message: 'Face biometric enrolled successfully', avatar: avatarUrl });
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
      WHERE id = ?
    `).run(req.params.id);
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

    const today = getTodayDate();
    const currentTime = getCurrentTime();
    const settings = getSettings();

    // Save snapshot if provided
    let punchPhotoUrl = null;
    if (photoBase64) {
      const matches = photoBase64.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const ext = matches[1].includes('png') ? 'png' : 'jpg';
        const filename = `punch_${employee.emp_id}_${Date.now()}.${ext}`;
        const filePath = path.join(__dirname, 'uploads', filename);
        fs.writeFileSync(filePath, Buffer.from(matches[2], 'base64'));
        punchPhotoUrl = `/uploads/${filename}`;
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
      } else if (!existing.clock_out) {
        action = 'out';
      } else {
        // Already clocked in and out today
        action = 'out'; // Update clock out
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

      // Calculate status based on office start time + grace period (9:30 AM start + 15 min grace = after 9:45 AM Late Arrival)
      const officeStart = settings.office_start_time || '09:30';
      const graceMinutes = parseInt(settings.grace_period_minutes || '15', 10);
      
      const [startH, startM] = officeStart.split(':').map(Number);
      const graceTime = new Date(2000, 0, 1, startH, startM + graceMinutes, 0);
      const [curH, curM, curS = 0] = currentTime.split(':').map(Number);
      const punchTime = new Date(2000, 0, 1, curH, curM, curS);

      const status = punchTime > graceTime ? 'late' : 'present';
      const punchNote = notes || (status === 'late' ? 'Late arrival (Checked in after 9:45 AM)' : null);

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

      return res.json({
        status: 'success',
        action: 'clock_in',
        message: status === 'late' ? 'Clocked In (Late Arrival - after 9:45 AM)' : 'Clocked In (On Time)',
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
        a.status, a.punch_photo, a.method, a.notes, a.created_at,
        e.name as employee_name, e.department, e.role, e.avatar, e.email
      FROM attendance a
      JOIN employees e ON a.emp_id = e.emp_id
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
    const { startDate, endDate, department, emp_id, status } = req.query;

    let query = `
      SELECT 
        a.id, a.emp_id, a.date, a.clock_in, a.clock_out, a.total_hours,
        COALESCE(a.ot_hours, 0) as ot_hours,
        COALESCE(a.ot_minutes, 0) as ot_minutes,
        a.status, a.punch_photo, a.method, a.notes,
        e.name as employee_name, e.department, e.role, e.avatar
      FROM attendance a
      JOIN employees e ON a.emp_id = e.emp_id
      WHERE 1=1
    `;
    const params = [];

    if (startDate) {
      query += ' AND a.date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND a.date <= ?';
      params.push(endDate);
    }
    if (department) {
      query += ' AND e.department = ?';
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

    query += ' ORDER BY a.date DESC, a.clock_in DESC LIMIT 500';

    const rows = db.prepare(query).all(...params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Manual Attendance Adjustment (Create or Update)
app.post('/api/attendance/manual', (req, res) => {
  try {
    const { id, emp_id, date, clock_in, clock_out, status, notes, ot_minutes } = req.body;
    const settings = getSettings();
    let totalHours = 0;
    let otHours = 0;
    let finalOtMinutes = 0;

    const hasValidTimes = clock_in && clock_out && clock_in !== '--' && clock_out !== '--' && status !== 'absent';
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

    const cIn = hasValidTimes ? clock_in : null;
    const cOut = hasValidTimes ? clock_out : null;

    if (id) {
      db.prepare(`
        UPDATE attendance
        SET emp_id = ?, date = ?, clock_in = ?, clock_out = ?, total_hours = ?, ot_hours = ?, ot_minutes = ?, status = ?, notes = ?, method = 'manual'
        WHERE id = ?
      `).run(emp_id, date, cIn, cOut, totalHours, otHours, finalOtMinutes, status, notes || 'HR manual adjustment', id);
      return res.json({ success: true, updated: true, id });
    }

    const existing = db.prepare('SELECT id FROM attendance WHERE emp_id = ? AND date = ?').get(emp_id, date);

    if (existing) {
      db.prepare(`
        UPDATE attendance
        SET clock_in = ?, clock_out = ?, total_hours = ?, ot_hours = ?, ot_minutes = ?, status = ?, notes = ?, method = 'manual'
        WHERE id = ?
      `).run(cIn, cOut, totalHours, otHours, finalOtMinutes, status, notes || 'HR manual adjustment', existing.id);
      res.json({ success: true, updated: true, id: existing.id });
    } else {
      const result = db.prepare(`
        INSERT INTO attendance (emp_id, date, clock_in, clock_out, total_hours, ot_hours, ot_minutes, status, notes, method)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual')
      `).run(emp_id, date, cIn, cOut, totalHours, otHours, finalOtMinutes, status, notes || 'HR manual adjustment');
      res.json({ success: true, created: true, id: result.lastInsertRowid });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/attendance/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { emp_id, date, clock_in, clock_out, status, notes, ot_minutes } = req.body;
    const settings = getSettings();
    let totalHours = 0;
    let otHours = 0;
    let finalOtMinutes = 0;

    const hasValidTimes = clock_in && clock_out && clock_in !== '--' && clock_out !== '--' && status !== 'absent';
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

    const cIn = hasValidTimes ? clock_in : null;
    const cOut = hasValidTimes ? clock_out : null;

    db.prepare(`
      UPDATE attendance
      SET clock_in = ?, clock_out = ?, total_hours = ?, ot_hours = ?, ot_minutes = ?, status = ?, notes = ?, method = 'manual'
      WHERE id = ?
    `).run(cIn, cOut, totalHours, otHours, finalOtMinutes, status, notes || 'HR manual adjustment', id);
    res.json({ success: true, updated: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/attendance/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM attendance WHERE id = ?').run(req.params.id);
    res.json({ success: true });
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
        l.reason, l.status, l.admin_notes, l.created_at,
        e.name as employee_name, e.department, e.role, e.avatar
      FROM leave_requests l
      JOIN employees e ON l.emp_id = e.emp_id
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

// CSV Export
app.get('/api/reports/export', (req, res) => {
  try {
    const { startDate, endDate, department } = req.query;

    let query = `
      SELECT 
        a.date, a.emp_id, e.name as employee_name, e.department,
        a.clock_in, a.clock_out, a.total_hours, a.status, a.method, a.notes
      FROM attendance a
      JOIN employees e ON a.emp_id = e.emp_id
      WHERE 1=1
    `;
    const params = [];
    if (startDate) { query += ' AND a.date >= ?'; params.push(startDate); }
    if (endDate) { query += ' AND a.date <= ?'; params.push(endDate); }
    if (department) { query += ' AND e.department = ?'; params.push(department); }

    query += ' ORDER BY a.date DESC, e.name ASC';

    const records = db.prepare(query).all(...params);

    let csv = 'Date,Employee ID,Employee Name,Department,Clock In,Clock Out,Total Hours,Status,Method,Notes\r\n';
    for (const r of records) {
      csv += `"${r.date}","${r.emp_id}","${r.employee_name}","${r.department}","${r.clock_in || ''}","${r.clock_out || ''}",${r.total_hours || 0},"${r.status}","${r.method}","${(r.notes || '').replace(/"/g, '""')}"\r\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=attendance_report_${Date.now()}.csv`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Full Cloud Database Backup Export
app.get('/api/backup', (req, res) => {
  try {
    const employees = db.prepare('SELECT * FROM employees').all();
    const attendance = db.prepare('SELECT * FROM attendance').all();
    const settings = db.prepare('SELECT * FROM settings').all();
    const leaves = db.prepare('SELECT * FROM leaves').all();
    res.json({
      timestamp: new Date().toISOString(),
      organization: 'Velavan Properties',
      employeeCount: employees.length,
      employees,
      attendance,
      settings,
      leaves
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Full Cloud Database Restore
app.post('/api/backup/restore', (req, res) => {
  try {
    const { employees, attendance, settings, leaves } = req.body;
    let restoredEmployees = 0;
    let restoredAttendance = 0;

    const restoreTx = db.transaction(() => {
      if (Array.isArray(employees)) {
        for (const emp of employees) {
          const keys = Object.keys(emp).filter(k => k !== 'id');
          const placeholders = keys.map(() => '?').join(', ');
          const values = keys.map(k => emp[k]);
          db.prepare(`INSERT OR REPLACE INTO employees (${keys.join(', ')}) VALUES (${placeholders})`).run(...values);
          restoredEmployees++;
        }
      }
      if (Array.isArray(attendance)) {
        for (const att of attendance) {
          const keys = Object.keys(att).filter(k => k !== 'id');
          const placeholders = keys.map(() => '?').join(', ');
          const values = keys.map(k => att[k]);
          db.prepare(`INSERT OR REPLACE INTO attendance (${keys.join(', ')}) VALUES (${placeholders})`).run(...values);
          restoredAttendance++;
        }
      }
    });

    restoreTx();
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
  app.get('/admin/*', (req, res) => {
    res.sendFile(path.join(adminDist, 'index.html'));
  });
}

const employeeDist = path.join(__dirname, '../employee-app/dist');
if (fs.existsSync(employeeDist)) {
  app.use(express.static(employeeDist));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      res.sendFile(path.join(employeeDist, 'index.html'));
    }
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Velavan Properties Attendance API Server running on port ${PORT}`);
});
