import { api } from './api';
import { getTodayDateIST } from './timeUtils';

// Authoritative in-memory attendance cache (preserves session edits and recent saves)
const memoryAttendanceMap = new Map();

// Safe check for valid production attendance records
export const isValidAttendanceRecord = (record) => {
  if (!record || !record.emp_id || !record.date) return false;
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
        return new Set(arr.filter(k => k && !String(k).includes('_')).map(String));
      }
    }
  } catch {}
  return new Set();
};

export const getDeletedPunchKeys = getDeletedPunchIds;

// Sanitize attendance record for local storage to prevent QuotaExceededError
export const sanitizePunchForLocal = (punch) => {
  if (!punch) return punch;
  const clean = { ...punch };
  if (clean.punch_photo && typeof clean.punch_photo === 'string' && clean.punch_photo.length > 2048 && clean.punch_photo.startsWith('data:')) {
    clean.has_photo = true;
    clean.punch_photo = undefined;
  }
  return clean;
};

// Safe localStorage setter
export const safeSetItem = (key, value) => {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    try {
      localStorage.removeItem('velavan_employee_form_draft');
      localStorage.removeItem('velavan_deleted_ids');
      localStorage.setItem(key, value);
      return true;
    } catch {
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
          recordsMap.set(key, {
            ...item,
            ...existing,
            punch_photo: existing.punch_photo || item.punch_photo
          });
        }
      }
    }
  };

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

  // Overlay in-memory cache ON TOP of storage caches
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
 * Save an attendance record locally across memory and storage, then broadcast
 */
export const savePunchLocally = (punch) => {
  if (!isValidAttendanceRecord(punch)) return;
  const key = `${punch.emp_id}_${punch.date}`;

  memoryAttendanceMap.set(key, punch);

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

  try {
    const lStr = localStorage.getItem('velavan_attendance_logs_cache');
    const logs = lStr ? JSON.parse(lStr) : [];
    safeSetItem('velavan_attendance_logs_cache', JSON.stringify(upsertRecordInArray(logs)));
  } catch {}

  const todayIST = getTodayDateIST();
  if (punch.date === todayIST) {
    try {
      const tStr = localStorage.getItem('velavan_today_attendance');
      const todayList = tStr ? JSON.parse(tStr) : [];
      safeSetItem('velavan_today_attendance', JSON.stringify(upsertRecordInArray(todayList)));
    } catch {}
  }

  window.dispatchEvent(new CustomEvent('velavan_attendance_updated', { detail: punch }));
};

/**
 * Smart 2-way merge
 */
export const mergeAttendanceWithLocal = (serverRecords = []) => {
  const validServer = (Array.isArray(serverRecords) ? serverRecords : []).filter(isValidAttendanceRecord);
  const localList = getLocalAttendance();
  const deletedIds = getDeletedPunchIds();

  const map = new Map();

  for (const l of localList) {
    if (l.id && deletedIds.has(String(l.id))) continue;
    const key = `${l.emp_id}_${l.date}`;
    map.set(key, l);
  }

  for (const s of validServer) {
    if (s.id && deletedIds.has(String(s.id))) {
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

  const sanitizedList = merged.map(sanitizePunchForLocal);
  try {
    safeSetItem('velavan_attendance_logs_cache', JSON.stringify(sanitizedList));
  } catch {}

  return merged;
};
