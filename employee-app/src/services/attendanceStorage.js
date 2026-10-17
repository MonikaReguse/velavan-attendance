import { api } from './api';

// Safe date check for current production records
export const isValidAttendanceRecord = (record) => {
  if (!record || !record.emp_id || !record.date) return false;
  // Discard legacy corrupt mock test records
  if (record.date < '2026-10-16' || record.clock_in === '17:36:14') return false;
  return true;
};

// Retrieve all local attendance records across every storage key
export const getLocalAttendance = () => {
  const recordsMap = new Map();

  const addList = (list) => {
    if (!Array.isArray(list)) return;
    for (const item of list) {
      if (isValidAttendanceRecord(item)) {
        const key = `${item.emp_id}_${item.date}`;
        const existing = recordsMap.get(key);
        if (!existing) {
          recordsMap.set(key, item);
        } else {
          // Keep the richer record (e.g. with clock_out, photo or total_hours)
          const merged = { ...existing, ...item };
          if (existing.clock_out && !item.clock_out) merged.clock_out = existing.clock_out;
          if (existing.total_hours && !item.total_hours) merged.total_hours = existing.total_hours;
          if (existing.ot_hours && !item.ot_hours) merged.ot_hours = existing.ot_hours;
          if (existing.ot_minutes && !item.ot_minutes) merged.ot_minutes = existing.ot_minutes;
          if (existing.punch_photo && !item.punch_photo) merged.punch_photo = existing.punch_photo;
          recordsMap.set(key, merged);
        }
      }
    }
  };

  try {
    const b = localStorage.getItem('velavan_master_database_backup');
    if (b) addList(JSON.parse(b)?.attendance);
  } catch {}

  try {
    const l = localStorage.getItem('velavan_attendance_logs_cache');
    if (l) addList(JSON.parse(l));
  } catch {}

  try {
    const t = localStorage.getItem('velavan_today_attendance');
    if (t) addList(JSON.parse(t));
  } catch {}

  try {
    const r = localStorage.getItem('velavan_realtime_punches');
    if (r) addList(JSON.parse(r));
  } catch {}

  return Array.from(recordsMap.values());
};

// Save a real-time punch across ALL local storage layers and broadcast
export const savePunchLocally = (punch) => {
  if (!isValidAttendanceRecord(punch)) return;
  const key = `${punch.emp_id}_${punch.date}`;

  // 1. Update master backup
  try {
    const bStr = localStorage.getItem('velavan_master_database_backup');
    const b = bStr ? JSON.parse(bStr) : { employees: [], attendance: [] };
    if (!Array.isArray(b.attendance)) b.attendance = [];
    const idx = b.attendance.findIndex(a => `${a.emp_id}_${a.date}` === key);
    if (idx !== -1) {
      b.attendance[idx] = { ...b.attendance[idx], ...punch };
    } else {
      b.attendance.unshift(punch);
    }
    localStorage.setItem('velavan_master_database_backup', JSON.stringify(b));
  } catch (e) {}

  // 2. Update attendance logs cache
  try {
    const lStr = localStorage.getItem('velavan_attendance_logs_cache');
    const logs = lStr ? JSON.parse(lStr) : [];
    const idx = logs.findIndex(a => `${a.emp_id}_${a.date}` === key);
    if (idx !== -1) {
      logs[idx] = { ...logs[idx], ...punch };
    } else {
      logs.unshift(punch);
    }
    localStorage.setItem('velavan_attendance_logs_cache', JSON.stringify(logs));
  } catch (e) {}

  // 3. Update today's attendance cache if date is today
  const today = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  if (punch.date === today) {
    try {
      const tStr = localStorage.getItem('velavan_today_attendance');
      const todayList = tStr ? JSON.parse(tStr) : [];
      const idx = todayList.findIndex(a => `${a.emp_id}_${a.date}` === key);
      if (idx !== -1) {
        todayList[idx] = { ...todayList[idx], ...punch };
      } else {
        todayList.unshift(punch);
      }
      localStorage.setItem('velavan_today_attendance', JSON.stringify(todayList));
    } catch (e) {}
  }

  // 4. Update permanent real-time punches log
  try {
    const rStr = localStorage.getItem('velavan_realtime_punches');
    const rList = rStr ? JSON.parse(rStr) : [];
    const idx = rList.findIndex(a => `${a.emp_id}_${a.date}` === key);
    if (idx !== -1) {
      rList[idx] = { ...rList[idx], ...punch };
    } else {
      rList.unshift(punch);
    }
    localStorage.setItem('velavan_realtime_punches', JSON.stringify(rList));
  } catch (e) {}

  // 5. Broadcast real-time update event
  window.dispatchEvent(new CustomEvent('velavan_attendance_updated', { detail: punch }));
};

// Smart 2-way merge: Combine server records with local storage, never drop records
export const mergeAttendanceWithLocal = (serverRecords = []) => {
  const validServer = Array.isArray(serverRecords) ? serverRecords.filter(isValidAttendanceRecord) : [];
  const localList = getLocalAttendance();

  const map = new Map();
  // First load local records
  for (const l of localList) {
    map.set(`${l.emp_id}_${l.date}`, l);
  }

  // Merge server records
  const serverKeys = new Set();
  for (const s of validServer) {
    const key = `${s.emp_id}_${s.date}`;
    serverKeys.add(key);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, s);
    } else {
      // Keep richest fields from both
      map.set(key, {
        ...existing,
        ...s,
        clock_out: s.clock_out || existing.clock_out || null,
        total_hours: s.total_hours || existing.total_hours || null,
        ot_hours: s.ot_hours || existing.ot_hours || null,
        ot_minutes: s.ot_minutes || existing.ot_minutes || null,
        punch_photo: s.punch_photo || existing.punch_photo || null,
        notes: s.notes || existing.notes || null
      });
    }
  }

  const merged = Array.from(map.values()).sort((a, b) => {
    if (b.date !== a.date) return b.date.localeCompare(a.date);
    return (b.clock_in || '').localeCompare(a.clock_in || '');
  });

  // Save merged result back to local caches
  try {
    localStorage.setItem('velavan_attendance_logs_cache', JSON.stringify(merged));
  } catch {}

  // Check if local has any records that the server is missing
  const missingOnServer = localList.filter(l => !serverKeys.has(`${l.emp_id}_${l.date}`));
  if (missingOnServer.length > 0) {
    console.log(`[Attendance Sync] Restoring ${missingOnServer.length} local attendance records to server...`);
    api.restoreBackup({ attendance: missingOnServer }).catch(console.error);
  }

  return merged;
};
