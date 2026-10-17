import { api } from './api';

// Safe check for valid production attendance records
export const isValidAttendanceRecord = (record) => {
  if (!record || !record.emp_id || !record.date) return false;
  // Discard only the legacy mock test punch with corrupt timestamp
  if (record.clock_in === '17:36:14' && record.date === '2026-10-15') return false;
  return true;
};

// Retrieve set of permanently deleted punch keys
export const getDeletedPunchKeys = () => {
  try {
    const delStr = localStorage.getItem('velavan_deleted_punches');
    if (delStr) {
      const arr = JSON.parse(delStr);
      if (Array.isArray(arr)) return new Set(arr.map(String));
    }
  } catch {}
  return new Set();
};

// Retrieve all local attendance records across every storage key (excluding deleted ones)
export const getLocalAttendance = () => {
  const deletedKeys = getDeletedPunchKeys();
  const recordsMap = new Map();

  const addList = (list) => {
    if (!Array.isArray(list)) return;
    for (const item of list) {
      if (isValidAttendanceRecord(item)) {
        const key = `${item.emp_id}_${item.date}`;
        // If this record was explicitly deleted by user, skip it!
        if (deletedKeys.has(key) || (item.id && deletedKeys.has(String(item.id)))) {
          continue;
        }
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

// Remove a deleted attendance punch locally across ALL storage keys and mark deleted
export const removePunchLocally = (id, emp_id, date) => {
  const matchRecord = (item) => {
    if (!item) return false;
    if (id && String(item.id) === String(id)) return true;
    if (emp_id && date && item.emp_id === emp_id && item.date === date) return true;
    return false;
  };

  const key = emp_id && date ? `${emp_id}_${date}` : null;

  // 1. Mark as permanently deleted so sync never resurrects it
  try {
    const deletedKeys = getDeletedPunchKeys();
    if (key) deletedKeys.add(key);
    if (id) deletedKeys.add(String(id));
    localStorage.setItem('velavan_deleted_punches', JSON.stringify(Array.from(deletedKeys)));
  } catch {}

  // 2. Remove from master database backup
  try {
    const bStr = localStorage.getItem('velavan_master_database_backup');
    if (bStr) {
      const b = JSON.parse(bStr);
      if (Array.isArray(b?.attendance)) {
        b.attendance = b.attendance.filter(a => !matchRecord(a));
        localStorage.setItem('velavan_master_database_backup', JSON.stringify(b));
      }
    }
  } catch {}

  // 3. Remove from attendance logs cache
  try {
    const lStr = localStorage.getItem('velavan_attendance_logs_cache');
    if (lStr) {
      const l = JSON.parse(lStr).filter(a => !matchRecord(a));
      localStorage.setItem('velavan_attendance_logs_cache', JSON.stringify(l));
    }
  } catch {}

  // 4. Remove from today attendance cache
  try {
    const tStr = localStorage.getItem('velavan_today_attendance');
    if (tStr) {
      const t = JSON.parse(tStr).filter(a => !matchRecord(a));
      localStorage.setItem('velavan_today_attendance', JSON.stringify(t));
    }
  } catch {}

  // 5. Remove from permanent realtime punches cache
  try {
    const rStr = localStorage.getItem('velavan_realtime_punches');
    if (rStr) {
      const r = JSON.parse(rStr).filter(a => !matchRecord(a));
      localStorage.setItem('velavan_realtime_punches', JSON.stringify(r));
    }
  } catch {}

  // 6. Broadcast event so all views update in real-time
  window.dispatchEvent(new CustomEvent('velavan_attendance_deleted', { detail: { id, emp_id, date } }));
  window.dispatchEvent(new CustomEvent('velavan_attendance_updated'));
};

// Save a real-time punch across ALL local storage layers and broadcast
export const savePunchLocally = (punch) => {
  if (!isValidAttendanceRecord(punch)) return;
  const key = `${punch.emp_id}_${punch.date}`;

  // If this punch was previously marked deleted, un-mark it
  try {
    const deletedKeys = getDeletedPunchKeys();
    if (deletedKeys.has(key) || (punch.id && deletedKeys.has(String(punch.id)))) {
      deletedKeys.delete(key);
      if (punch.id) deletedKeys.delete(String(punch.id));
      localStorage.setItem('velavan_deleted_punches', JSON.stringify(Array.from(deletedKeys)));
    }
  } catch {}

  // 1. Update master backup
  try {
    const bStr = localStorage.getItem('velavan_master_database_backup');
    const b = bStr ? JSON.parse(bStr) : { employees: [], attendance: [] };
    if (!Array.isArray(b.attendance)) b.attendance = [];
    const idx = b.attendance.findIndex(a => `${a.emp_id}_${a.date}` === key);
    if (idx !== -1) {
      b.attendance[idx] = { ...punch };
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
      logs[idx] = { ...punch };
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
        todayList[idx] = { ...punch };
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
      rList[idx] = { ...punch };
    } else {
      rList.unshift(punch);
    }
    localStorage.setItem('velavan_realtime_punches', JSON.stringify(rList));
  } catch (e) {}

  // 5. Broadcast real-time update event
  window.dispatchEvent(new CustomEvent('velavan_attendance_updated', { detail: punch }));
};

// Smart 2-way merge: Combine server records with local storage, prioritizing authoritative server data
export const mergeAttendanceWithLocal = (serverRecords = []) => {
  const validServer = (Array.isArray(serverRecords) ? serverRecords : []).filter(isValidAttendanceRecord);
  const localList = getLocalAttendance();

  const map = new Map();

  // 1. Authoritative server records first
  for (const s of validServer) {
    map.set(`${s.emp_id}_${s.date}`, s);
  }

  // 2. Only add offline local punches that do not exist on the server yet
  for (const l of localList) {
    const key = `${l.emp_id}_${l.date}`;
    if (!map.has(key)) {
      map.set(key, l);
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

  return merged;
};
