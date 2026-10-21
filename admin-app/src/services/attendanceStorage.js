import { api } from './api';
import { getTodayDateIST } from './timeUtils';

// Authoritative in-memory attendance cache (preserves session edits and recent saves)
const memoryAttendanceMap = new Map();

// Safe check for valid production attendance records
export const isValidAttendanceRecord = (record) => {
  if (!record || !record.emp_id || !record.date) return false;
  // Discard only legacy mock test punch with corrupt timestamp
  if (record.clock_in === '17:36:14' && record.date === '2026-10-15') return false;
  return true;
};

// Retrieve set of permanently deleted record IDs (never blacklist an entire employee+date!)
export const getDeletedPunchIds = () => {
  try {
    const delStr = localStorage.getItem('velavan_deleted_punches');
    if (delStr) {
      const arr = JSON.parse(delStr);
      if (Array.isArray(arr)) {
        // Return only numeric or string record IDs, never compound date keys
        return new Set(arr.filter(k => k && !String(k).includes('_')).map(String));
      }
    }
  } catch {}
  return new Set();
};

// Backwards-compatible export
export const getDeletedPunchKeys = getDeletedPunchIds;

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
      localStorage.removeItem('velavan_employee_form_draft');
      localStorage.removeItem('velavan_deleted_ids');

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

      localStorage.setItem(key, value);
      return true;
    } catch (retryErr) {
      console.error(`[Storage Quota Critical] Could not save ${key} even after cleanup:`, retryErr.message);
      return false;
    }
  }
};

/**
 * Retrieve all local attendance records across in-memory cache and storage layers.
 * Memory cache and latest edits ALWAYS take precedence over older disk caches.
 */
export const getLocalAttendance = () => {
  const deletedIds = getDeletedPunchIds();
  const recordsMap = new Map();

  // Helper to load array into map, only filling if not already populated by a higher-priority source
  const addListFromStorage = (list) => {
    if (!Array.isArray(list)) return;
    for (const item of list) {
      if (isValidAttendanceRecord(item)) {
        if (item.id && deletedIds.has(String(item.id))) continue;
        const key = `${item.emp_id}_${item.date}`;
        const existing = recordsMap.get(key);
        if (!existing) {
          recordsMap.set(key, item);
        } else {
          // Keep newer data, preserve photo if missing in incoming
          recordsMap.set(key, {
            ...item,
            ...existing,
            punch_photo: existing.punch_photo || item.punch_photo
          });
        }
      }
    }
  };

  // 1. Read persistent disk caches in ascending order of recency
  try {
    const b = localStorage.getItem('velavan_master_database_backup');
    if (b) addListFromStorage(JSON.parse(b)?.attendance);
  } catch {}

  try {
    const l = localStorage.getItem('velavan_attendance_logs_cache');
    if (l) addListFromStorage(JSON.parse(l));
  } catch {}

  try {
    const t = localStorage.getItem('velavan_today_attendance');
    if (t) addListFromStorage(JSON.parse(t));
  } catch {}

  try {
    const r = localStorage.getItem('velavan_realtime_punches');
    if (r) addListFromStorage(JSON.parse(r));
  } catch {}

  // 2. CRITICAL: Overlay in-memory cache ON TOP of storage caches!
  // In-memory records represent the freshest edits from the current session.
  for (const [key, item] of memoryAttendanceMap.entries()) {
    if (isValidAttendanceRecord(item)) {
      if (!item.id || !deletedIds.has(String(item.id))) {
        const diskItem = recordsMap.get(key);
        recordsMap.set(key, {
          ...(diskItem || {}),
          ...item,
          punch_photo: item.punch_photo || diskItem?.punch_photo
        });
      }
    }
  }

  return Array.from(recordsMap.values()).sort((a, b) => {
    if (b.date !== a.date) return b.date.localeCompare(a.date);
    return (b.clock_in || '').localeCompare(a.clock_in || '');
  });
};

/**
 * Remove an attendance record locally across memory and storage
 */
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
    // Track deleted ID so temporary sync delays do not resurrect it
    try {
      const deletedIds = getDeletedPunchIds();
      deletedIds.add(String(id));
      safeSetItem('velavan_deleted_punches', JSON.stringify(Array.from(deletedIds)));
    } catch {}
  }

  // Remove from storage caches
  const cleanCacheKey = (storageKey) => {
    try {
      const str = localStorage.getItem(storageKey);
      if (str) {
        const arr = JSON.parse(str);
        if (Array.isArray(arr)) {
          safeSetItem(storageKey, JSON.stringify(arr.filter(a => !matchRecord(a))));
        }
      }
    } catch {}
  };

  cleanCacheKey('velavan_attendance_logs_cache');
  cleanCacheKey('velavan_today_attendance');
  cleanCacheKey('velavan_realtime_punches');

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

  // Broadcast real-time deletion
  window.dispatchEvent(new CustomEvent('velavan_attendance_deleted', { detail: { id, emp_id, date } }));
  window.dispatchEvent(new CustomEvent('velavan_attendance_updated'));
};

/**
 * Save an attendance record locally across memory and all storage layers, then broadcast
 */
export const savePunchLocally = (punch) => {
  if (!isValidAttendanceRecord(punch)) return;
  const key = `${punch.emp_id}_${punch.date}`;

  // 1. Authoritative memory cache receives the exact saved punch immediately
  memoryAttendanceMap.set(key, punch);

  // 2. Un-mark from deleted IDs if present
  if (punch.id) {
    try {
      const deletedIds = getDeletedPunchIds();
      if (deletedIds.has(String(punch.id))) {
        deletedIds.delete(String(punch.id));
        safeSetItem('velavan_deleted_punches', JSON.stringify(Array.from(deletedIds)));
      }
    } catch {}
  }

  const sanitized = sanitizePunchForLocal(punch);

  // Helper to upsert a record into an array by key (emp_id + date) or ID
  const upsertRecordInArray = (arr) => {
    if (!Array.isArray(arr)) return [sanitized];
    const idx = arr.findIndex(a => 
      (a.emp_id === punch.emp_id && a.date === punch.date) || 
      (punch.id && a.id && String(a.id) === String(punch.id))
    );
    if (idx !== -1) {
      const prev = arr[idx];
      arr[idx] = {
        ...prev,
        ...sanitized,
        punch_photo: sanitized.punch_photo || prev.punch_photo
      };
    } else {
      arr.unshift(sanitized);
    }
    return arr;
  };

  // 3. Update attendance logs cache
  try {
    const lStr = localStorage.getItem('velavan_attendance_logs_cache');
    const logs = lStr ? JSON.parse(lStr) : [];
    safeSetItem('velavan_attendance_logs_cache', JSON.stringify(upsertRecordInArray(logs)));
  } catch {}

  // 4. Update master database backup
  try {
    const bStr = localStorage.getItem('velavan_master_database_backup');
    const b = bStr ? JSON.parse(bStr) : { employees: [], attendance: [] };
    if (!Array.isArray(b.attendance)) b.attendance = [];
    b.attendance = upsertRecordInArray(b.attendance);
    safeSetItem('velavan_master_database_backup', JSON.stringify(b));
  } catch {}

  // 5. Update today attendance cache if date is today
  const todayIST = getTodayDateIST();
  if (punch.date === todayIST) {
    try {
      const tStr = localStorage.getItem('velavan_today_attendance');
      const todayList = tStr ? JSON.parse(tStr) : [];
      safeSetItem('velavan_today_attendance', JSON.stringify(upsertRecordInArray(todayList)));
    } catch {}
  }

  // 6. Update realtime punches cache
  try {
    const rStr = localStorage.getItem('velavan_realtime_punches');
    const rList = rStr ? JSON.parse(rStr) : [];
    safeSetItem('velavan_realtime_punches', JSON.stringify(upsertRecordInArray(rList)));
  } catch {}

  // 7. Broadcast real-time update event so all open views immediately refresh
  window.dispatchEvent(new CustomEvent('velavan_attendance_updated', { detail: punch }));
};

/**
 * Background sync queue: guarantees server gets any offline punches
 */
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

/**
 * Smart 2-way merge: Combine server records with local storage, prioritizing authoritative server data
 * and permanently preserving all local records across all dates and employees.
 */
export const mergeAttendanceWithLocal = (serverRecords = []) => {
  const validServer = (Array.isArray(serverRecords) ? serverRecords : []).filter(isValidAttendanceRecord);
  const localList = getLocalAttendance();
  const deletedIds = getDeletedPunchIds();

  const map = new Map();

  // 1. First load existing local records
  for (const l of localList) {
    if (l.id && deletedIds.has(String(l.id))) continue;
    const key = `${l.emp_id}_${l.date}`;
    map.set(key, l);
  }

  // 2. Authoritative server records overlay onto the map
  for (const s of validServer) {
    if (s.id && deletedIds.has(String(s.id))) {
      // Server returned it, meaning it exists in production DB — remove from deletedIds
      deletedIds.delete(String(s.id));
      try {
        safeSetItem('velavan_deleted_punches', JSON.stringify(Array.from(deletedIds)));
      } catch {}
    }

    const key = `${s.emp_id}_${s.date}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, s);
      memoryAttendanceMap.set(key, s);
    } else {
      // Authoritative database record s wins, preserving biometric photo if s has none
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

  // Save sanitized results to local caches
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
