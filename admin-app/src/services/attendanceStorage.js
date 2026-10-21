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
          if (existing.clock_out && existing.clock_out !== '--' && (!item.clock_out || item.clock_out === '--')) {
            merged.clock_out = existing.clock_out;
          }
          if (existing.clock_in && existing.clock_in !== '--' && (!item.clock_in || item.clock_in === '--')) {
            merged.clock_in = existing.clock_in;
          }
          if (existing.total_hours && (!item.total_hours || item.total_hours === 0)) {
            merged.total_hours = existing.total_hours;
          }
          if (existing.ot_hours && (!item.ot_hours || item.ot_hours === 0)) {
            merged.ot_hours = existing.ot_hours;
          }
          if (existing.ot_minutes && (!item.ot_minutes || item.ot_minutes === 0)) {
            merged.ot_minutes = existing.ot_minutes;
          }
          if (existing.punch_photo && !item.punch_photo) {
            merged.punch_photo = existing.punch_photo;
          }
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

  // Helper to merge punch into an existing record in array
  const mergeIntoRecord = (prev, next) => {
    const merged = { ...prev, ...next };
    if (!merged.punch_photo && prev.punch_photo) merged.punch_photo = prev.punch_photo;
    if (prev.method === 'facelock' && (!next.method || next.method === 'manual')) merged.method = 'facelock';
    if ((!next.clock_in || next.clock_in === '--') && prev.clock_in && prev.clock_in !== '--') {
      merged.clock_in = prev.clock_in;
    }
    if ((!next.clock_out || next.clock_out === '--') && prev.clock_out && prev.clock_out !== '--' && !next.leave_checkout_pending) {
      merged.clock_out = prev.clock_out;
    }
    return merged;
  };

  // 1. Update master backup
  try {
    const bStr = localStorage.getItem('velavan_master_database_backup');
    const b = bStr ? JSON.parse(bStr) : { employees: [], attendance: [] };
    if (!Array.isArray(b.attendance)) b.attendance = [];
    const idx = b.attendance.findIndex(a => `${a.emp_id}_${a.date}` === key);
    if (idx !== -1) {
      b.attendance[idx] = mergeIntoRecord(b.attendance[idx], punch);
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
      logs[idx] = mergeIntoRecord(logs[idx], punch);
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
        todayList[idx] = mergeIntoRecord(todayList[idx], punch);
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
      rList[idx] = mergeIntoRecord(rList[idx], punch);
    } else {
      rList.unshift(punch);
    }
    localStorage.setItem('velavan_realtime_punches', JSON.stringify(rList));
  } catch (e) {}

  // 5. Broadcast real-time update event
  window.dispatchEvent(new CustomEvent('velavan_attendance_updated', { detail: punch }));
};

// Background synchronization queue to ensure server gets any locally preserved records
let syncInProgress = false;
export const syncLocalRecordsToServer = async (recordsToSync) => {
  if (syncInProgress || !Array.isArray(recordsToSync) || recordsToSync.length === 0) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  syncInProgress = true;
  try {
    for (const rec of recordsToSync) {
      if (!isValidAttendanceRecord(rec)) continue;
      try {
        await api.recordManualAttendance({
          emp_id: rec.emp_id,
          date: rec.date,
          clock_in: rec.clock_in,
          clock_out: rec.clock_out,
          status: rec.status,
          notes: rec.notes || 'Restored from local persistent storage',
          ot_minutes: rec.ot_minutes || 0
        });
      } catch (err) {
        console.warn(`[Sync] Failed to push local attendance for ${rec.emp_id} on ${rec.date}:`, err.message);
      }
    }
  } catch (e) {
    console.error('[Sync Error]:', e);
  } finally {
    syncInProgress = false;
  }
};

// Smart 2-way merge: Combine server records with local storage, prioritizing authoritative server data
// and permanently preserving all local records across all dates and all employees.
export const mergeAttendanceWithLocal = (serverRecords = []) => {
  const validServer = (Array.isArray(serverRecords) ? serverRecords : []).filter(isValidAttendanceRecord);
  const localList = getLocalAttendance();
  const deletedKeys = getDeletedPunchKeys();

  const map = new Map();

  // 1. Populate map with existing local records (excluding permanently deleted ones)
  for (const l of localList) {
    const key = `${l.emp_id}_${l.date}`;
    if (!deletedKeys.has(key) && (!l.id || !deletedKeys.has(String(l.id)))) {
      map.set(key, l);
    }
  }

  // 2. Overlay authoritative server records (updating or inserting)
  for (const s of validServer) {
    const key = `${s.emp_id}_${s.date}`;
    // If it came directly from the server database, ensure it is not blocked by deletedKeys
    if (deletedKeys.has(key) || (s.id && deletedKeys.has(String(s.id)))) {
      deletedKeys.delete(key);
      if (s.id) deletedKeys.delete(String(s.id));
      try {
        localStorage.setItem('velavan_deleted_punches', JSON.stringify(Array.from(deletedKeys)));
      } catch {}
    }

    const existing = map.get(key);
    if (!existing) {
      map.set(key, s);
    } else {
      // Merge authoritative server record with any richer local fields (e.g. biometric photo)
      const mergedRec = { ...existing, ...s };
      if (!mergedRec.punch_photo && existing.punch_photo) {
        mergedRec.punch_photo = existing.punch_photo;
      }
      if ((!mergedRec.clock_out || mergedRec.clock_out === '--') && existing.clock_out && existing.clock_out !== '--') {
        mergedRec.clock_out = existing.clock_out;
      }
      if ((!mergedRec.clock_in || mergedRec.clock_in === '--') && existing.clock_in && existing.clock_in !== '--') {
        mergedRec.clock_in = existing.clock_in;
      }
      map.set(key, mergedRec);
    }
  }

  const merged = Array.from(map.values()).sort((a, b) => {
    if (b.date !== a.date) return b.date.localeCompare(a.date);
    return (b.clock_in || '').localeCompare(a.clock_in || '');
  });

  // Save merged result back to local caches so local storage ALWAYS has the full history
  try {
    localStorage.setItem('velavan_attendance_logs_cache', JSON.stringify(merged));
  } catch {}

  try {
    const bStr = localStorage.getItem('velavan_master_database_backup');
    const b = bStr ? JSON.parse(bStr) : { employees: [], attendance: [] };
    b.attendance = merged;
    localStorage.setItem('velavan_master_database_backup', JSON.stringify(b));
  } catch {}

  return merged;
};
