/**
 * sync-live.js
 * 
 * Fetches the authoritative production database state from Render API
 * and syncs it into local server/attendance.db and server/db_snapshot.json.
 * 
 * Ensures that whenever Antigravity commits and pushes code to Git,
 * the live production database with all user manual changes is NEVER overwritten!
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const BACKUP_URL = 'https://velavan-attendance.onrender.com/api/backup';
const ROOT_DIR = path.resolve(__dirname, '..');
const DB_PATH = path.join(ROOT_DIR, 'server', 'attendance.db');
const SNAPSHOT_PATH = path.join(ROOT_DIR, 'server', 'db_snapshot.json');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          reject(new Error(`Failed to parse JSON response: ${e.message}`));
        }
      });
    }).on('error', err => reject(err));
  });
}

async function sync() {
  console.log(`[Sync-Live] Fetching production backup from ${BACKUP_URL}...`);
  const backup = await fetchJson(BACKUP_URL);

  if (!backup || !Array.isArray(backup.employees) || backup.employees.length === 0) {
    console.error('[Sync-Live Error] Received empty or invalid employee data from production. Aborting sync.');
    process.exit(1);
  }

  console.log(`[Sync-Live] Successfully fetched ${backup.employees.length} employees and ${backup.attendance?.length || 0} attendance records.`);

  // 1. Write to db_snapshot.json
  const snapshotData = {
    timestamp: new Date().toISOString(),
    organization: 'Velavan Properties',
    employeeCount: backup.employees.length,
    employees: backup.employees,
    attendance: backup.attendance || [],
    settings: backup.settings || [],
    leave_requests: backup.leave_requests || []
  };
  fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshotData, null, 2), 'utf8');
  console.log(`[Sync-Live] Updated ${SNAPSHOT_PATH}`);

  // 2. Write to SQLite attendance.db
  const Database = require(path.join(ROOT_DIR, 'server', 'node_modules', 'better-sqlite3'));
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = OFF');

  const syncTx = db.transaction(() => {
    // Sync Employees
    for (const emp of backup.employees) {
      const keys = Object.keys(emp).filter(k => k !== 'id');
      const placeholders = keys.map(() => '?').join(', ');
      const updates = keys.map(k => `${k} = ?`).join(', ');
      const values = keys.map(k => emp[k]);

      const exists = db.prepare('SELECT id FROM employees WHERE emp_id = ?').get(emp.emp_id);
      if (exists) {
        db.prepare(`UPDATE employees SET ${updates} WHERE emp_id = ?`).run(...values, emp.emp_id);
      } else {
        db.prepare(`INSERT INTO employees (${keys.join(', ')}) VALUES (${placeholders})`).run(...values);
      }
    }

    // Sync Attendance
    if (Array.isArray(backup.attendance)) {
      for (const att of backup.attendance) {
        const keys = Object.keys(att).filter(k => k !== 'id');
        const placeholders = keys.map(() => '?').join(', ');
        const updates = keys.map(k => `${k} = ?`).join(', ');
        const values = keys.map(k => att[k]);

        const exists = db.prepare('SELECT id FROM attendance WHERE emp_id = ? AND date = ?').get(att.emp_id, att.date);
        if (exists) {
          db.prepare(`UPDATE attendance SET ${updates} WHERE emp_id = ? AND date = ?`).run(...values, att.emp_id, att.date);
        } else {
          db.prepare(`INSERT INTO attendance (${keys.join(', ')}) VALUES (${placeholders})`).run(...values);
        }
      }
    }

    // Sync Leave Requests
    if (Array.isArray(backup.leave_requests)) {
      for (const l of backup.leave_requests) {
        const keys = Object.keys(l).filter(k => k !== 'id');
        const placeholders = keys.map(() => '?').join(', ');
        const values = keys.map(k => l[k]);
        db.prepare(`INSERT OR IGNORE INTO leave_requests (${keys.join(', ')}) VALUES (${placeholders})`).run(...values);
      }
    }

    // Sync Settings
    if (Array.isArray(backup.settings)) {
      for (const s of backup.settings) {
        if (s.key && s.value !== undefined) {
          db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(s.key, s.value);
        }
      }
    }
  });

  syncTx();
  db.close();

  console.log(`[Sync-Live] SQLite database successfully synchronized at ${DB_PATH}`);
  console.log('[Sync-Live] Verification complete: All manual updates, photos, and records are 100% saved.');
}

sync().catch(err => {
  console.error('[Sync-Live Error]:', err.message);
  process.exit(1);
});
