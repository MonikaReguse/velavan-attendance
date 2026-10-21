import { api } from './api';
import { getTodayDateIST } from './timeUtils';

// In-memory persistent master cache ensuring punches survive any localStorage drops/delays
const memoryAttendanceMap = new Map();

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

// Sanitize attendance record for local storage to prevent QuotaExceededError
// Strips massive base64 images from log caches while preserving URLs and metadata
export const sanitizePunchForLocal = (punch) => {
  if (!punch) return punch;
  const clean = { ...punch };
  if (clean.punch_photo && typeof clean.punch_photo === 'string' && clean.punch_photo.length > 2048 && clean.punch_photo.startsWith('data:')) {
    clean.has_photo = true;
    clean.punch_photo = undefined;
  }
  return clean;
};

// Safe localStorage setter with automatic quota recovery
export const safeSetItem = (key, value) => {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.warn(`[Storage Quota Warning] Failed to set ${key}. Cleaning heavy bloat...`, err.message);
    try {
      // Clear non-critical caches to free up localStorage quota immediately
      localStorage.removeItem('velavan_employee_form_draft');
      localStorage.removeItem('velavan_deleted_ids');

      // Clean up master backup if it contains bloated base64 documents
      const bStr = localStorage.getItem('velavan_master_database_backup');
      if (bStr && bStr.length > 1000000) {
        try {
          const b = JSON.parse(bStr);
          if (Array.isArray(b?.employees)) {
            b.employees = b.employees.map(e => {
              const stripped = { ...e };
              ['doc_aadhaar', 'doc_pan', 'doc_bank_passbook', 'doc_10th', 'doc_12th', 'doc_college', 'doc_marksheet'].forEach(doc => {
                if (stripped[doc] && typeof stripped[doc] === 'string' && stripped[doc].length > 500) {
                  stripped[doc] = 'stored_in_db';
                }
              });
              return stripped;
            });
            localStorage.setItem('velavan_master_database_backup', JSON.stringify(b));
          }
        } catch {}
      }

      // Retry original write
      localStorage.setItem(key, value);
      return true;
    } catch (retryErr) {
      console.error(`[Storage Quota Critical] Could not save ${key} even after cleanup:`, retryErr.message);
      return false;
    }
  }
};

// Retrieve all local attendance records across in-memory cache and storage keys (excluding deleted ones)
export const getLocalAttendance = () => {
  const deletedKeys = getDeletedPunchKeys();
  const recordsMap = new Map();

  // 1. First include any in-memory records
  for (const [key, item] of memoryAttendanceMap.entries()) {
    if (isValidAttendanceRecord(item)) {
      if (!deletedKeys.has(key) && (!item.id || !deletedKeys.has(String(item.id)))) {
        recordsMap.set(key, item);
      }
    }
  }

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
          memoryAttendanceMap.set(key, item);
        } else {
          // Respect latest item, preserving biometric photo if item has none
          const photo = item.punch_photo || existing.punch_photo;
          const mergedItem = {
            ...existing,
            ...item,
            punch_photo: photo
          };
          recordsMap.set(key, mergedItem);
          memoryAttendanceMap.set(key, mergedItem);
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

// Remove a deleted attendance punch locally across memory and ALL storage keys and mark deleted
export const removePunchLocally = (id, emp_id, date) => {
  const matchRecord = (item) => {
    if (!item) return false;
    if (id && String(item.id) === String(id)) return true;
    if (emp_id && date && item.emp_id === emp_id && item.date === date) return true;
    return false;
  };

  const key = emp_id && date ? `${emp_id}_${date}` : null;

  // Remove from in-memory map
  if (key) memoryAttendanceMap.delete(key);
  if (id) {
    for (const [k, v] of memoryAttendanceMap.entries()) {
      if (String(v.id) === String(id)) {
        memoryAttendanceMap.delete(k);
      }
    }
  }

  // 1. Mark as permanently deleted so sync never resurrects it
  try {
    const deletedKeys = getDeletedPunchKeys();
    if (key) deletedKeys.add(key);
    if (id) deletedKeys.add(String(id));
    safeSetItem('velavan_deleted_punches', JSON.stringify(Array.from(deletedKeys)));
  } catch {}

  // 2. Remove from master database backup
  try {
    const bStr = localStorage.getItem('velavan_master_database_backup');
    if (bStr) {
      const b = JSON.parse(bStr);
      if (Array.isArray(b?.attendance)) {
        b.attendance = b.attendance.filter(a => !matchRecord(a));
        safeSetItem('velavan_master_database_backup', JSON.stringify(b));
      }
    }
  } catch {}

  // 3. Remove from attendance logs cache
  try {
    const lStr = localStorage.getItem('velavan_attendance_logs_cache');
    if (lStr) {
      const l = JSON.parse(lStr).filter(a => !matchRecord(a));
      safeSetItem('velavan_attendance_logs_cache', JSON.stringify(l));
    }
  } catch {}

  // 4. Remove from today attendance cache
  try {
    const tStr = localStorage.getItem('velavan_today_attendance');
    if (tStr) {
      const t = JSON.parse(tStr).filter(a => !matchRecord(a));
      safeSetItem('velavan_today_attendance', JSON.stringify(t));
    }
  } catch {}

  // 5. Remove from permanent realtime punches cache
  try {
    const rStr = localStorage.getItem('velavan_realtime_punches');
    if (rStr) {
      const r = JSON.parse(rStr).filter(a => !matchRecord(a));
      safeSetItem('velavan_realtime_punches', JSON.stringify(r));
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

  // Store in authoritative memory cache immediately
  memoryAttendanceMap.set(key, punch);

  // If this punch was previously marked deleted, un-mark it
  try {
    const deletedKeys = getDeletedPunchKeys();
    if (deletedKeys.has(key) || (punch.id && deletedKeys.has(String(punch.id)))) {
      deletedKeys.delete(key);
      if (punch.id) deletedKeys.delete(String(punch.id));
      safeSetItem('velavan_deleted_punches', JSON.stringify(Array.from(deletedKeys)));
    }
  } catch {}

  // Helper to merge punch into an existing record in array
  const mergeIntoRecord = (prev, next) => {
    if (!prev) return next;
    const photo = next.punch_photo || prev.punch_photo;
    return {
      ...prev,
      ...next,
      punch_photo: photo
    };
  };

  const sanitized = sanitizePunchForLocal(punch);

  // 1. Update master backup
  try {
    const bStr = localStorage.getItem('velavan_master_database_backup');
    const b = bStr ? JSON.parse(bStr) : { employees: [], attendance: [] };
    if (!Array.isArray(b.attendance)) b.attendance = [];
    const idx = b.attendance.findIndex(a => `${a.emp_id}_${a.date}` === key);
    if (idx !== -1) {
      b.attendance[idx] = mergeIntoRecord(b.attendance[idx], sanitized);
    } else {
      b.attendance.unshift(sanitized);
    }
    safeSetItem('velavan_master_database_backup', JSON.stringify(b));
  } catch (e) {}

  // 2. Update attendance logs cache
  try {
    const lStr = localStorage.getItem('velavan_attendance_logs_cache');
    const logs = lStr ? JSON.parse(lStr) : [];
    const idx = logs.findIndex(a => `${a.emp_id}_${a.date}` === key);
    if (idx !== -1) {
      logs[idx] = mergeIntoRecord(logs[idx], sanitized);
    } else {
      logs.unshift(sanitized);
    }
    safeSetItem('velavan_attendance_logs_cache', JSON.stringify(logs));
  } catch (e) {}

  // 3. Update today's attendance cache if date is today (in Asia/Kolkata timezone!)
  const todayIST = getTodayDateIST();
  if (punch.date === todayIST) {
    try {
      const tStr = localStorage.getItem('velavan_today_attendance');
      const todayList = tStr ? JSON.parse(tStr) : [];
      const idx = todayList.findIndex(a => `${a.emp_id}_${a.date}` === key);
      if (idx !== -1) {
        todayList[idx] = mergeIntoRecord(todayList[idx], sanitized);
      } else {
        todayList.unshift(sanitized);
      }
      safeSetItem('velavan_today_attendance', JSON.stringify(todayList));
    } catch (e) {}
  }

  // 4. Update permanent real-time punches log
  try {
    const rStr = localStorage.getItem('velavan_realtime_punches');
    const rList = rStr ? JSON.parse(rStr) : [];
    const idx = rList.findIndex(a => `${a.emp_id}_${a.date}` === key);
    if (idx !== -1) {
      rList[idx] = mergeIntoRecord(rList[idx], sanitized);
    } else {
      rList.unshift(sanitized);
    }
    safeSetItem('velavan_realtime_punches', JSON.stringify(rList));
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
          id: rec.id || undefined,
          emp_id: rec.emp_id,
          date: rec.date,
          clock_in: rec.clock_in,
          clock_out: rec.clock_out,
          status: rec.status,
          notes: rec.notes || 'Restored from persistent storage',
          ot_minutes: rec.ot_minutes || 0,
          holiday_type: rec.holiday_type || 'normal'
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
// and permanently preserving ALL local records across all dates and all employees.
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
      memoryAttendanceMap.set(key, l);
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
        safeSetItem('velavan_deleted_punches', JSON.stringify(Array.from(deletedKeys)));
      } catch {}
    }

    const existing = map.get(key);
    if (!existing) {
      map.set(key, s);
      memoryAttendanceMap.set(key, s);
    } else {
      // Authoritative database record s ALWAYS wins, preserving biometric photo if s has none
      const photo = s.punch_photo || existing.punch_photo;
      const mergedItem = {
        ...existing,
        ...s,
        punch_photo: photo
      };
      map.set(key, mergedItem);
      memoryAttendanceMap.set(key, mergedItem);
    }
  }

  const merged = Array.from(map.values()).sort((a, b) => {
    if (b.date !== a.date) return b.date.localeCompare(a.date);
    return (b.clock_in || '').localeCompare(a.clock_in || '');
  });

  // Save sanitized result back to local caches so local storage ALWAYS has the full history
  const sanitizedList = merged.map(sanitizePunchForLocal);

  try {
    safeSetItem('velavan_attendance_logs_cache', JSON.stringify(sanitizedList));
  } catch {}

  try {
    const bStr = localStorage.getItem('velavan_master_database_backup');
    const b = bStr ? JSON.parse(bStr) : { employees: [], attendance: [] };
    b.attendance = sanitizedList;
    safeSetItem('velavan_master_database_backup', JSON.stringify(b));
  } catch {}

  return merged;
};
