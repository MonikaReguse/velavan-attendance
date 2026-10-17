/**
 * Time formatting utility to convert 24-hour / railway time (e.g. 18:00:00)
 * into standard 12-hour time with AM/PM (e.g. 06:00 PM).
 */
export function formatTime(timeStr) {
  if (!timeStr || timeStr === '--' || typeof timeStr !== 'string') return '--';
  const clean = timeStr.trim();
  if (!clean || clean === '--') return '--';

  // If already formatted with AM/PM, return as is
  if (/am|pm/i.test(clean)) return clean;

  // If ISO string like 2026-10-15T18:00:00...
  if (clean.includes('T')) {
    const timePart = clean.split('T')[1]?.split('.')[0];
    if (timePart) return formatTime(timePart);
  }

  // Expecting HH:MM or HH:MM:SS
  const parts = clean.split(':');
  if (parts.length >= 2) {
    let hours = parseInt(parts[0], 10);
    const minutes = parts[1].padStart(2, '0');
    if (isNaN(hours)) return clean;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    if (hours === 0) hours = 12;
    const hoursStr = String(hours).padStart(2, '0');
    return `${hoursStr}:${minutes} ${ampm}`;
  }

  return clean;
}

export function getCurrentTime12() {
  const d = new Date();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const hoursStr = String(hours).padStart(2, '0');
  return `${hoursStr}:${minutes}:${seconds} ${ampm}`;
}

/**
 * Check if a clock-in time counts as late arrival (past 09:40 AM grace period)
 */
export function isLateArrival(clockIn, status) {
  if (status === 'late') return true;
  if (!clockIn || clockIn === '--' || typeof clockIn !== 'string') return false;
  const clean = clockIn.trim();
  if (!clean || clean === '--') return false;

  // If 24-hr time like 09:45:00
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(clean)) {
    const parts = clean.split(':').map(Number);
    const sec = (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
    return sec > (9 * 3600 + 40 * 60); // 09:40:00 = 34800 sec
  }

  // If 12-hr time like 09:45 AM
  if (/am|pm/i.test(clean)) {
    const isPM = /pm/i.test(clean);
    const timeOnly = clean.replace(/am|pm/i, '').trim();
    const parts = timeOnly.split(':').map(Number);
    let h = parts[0] || 0;
    const m = parts[1] || 0;
    if (isPM && h < 12) h += 12;
    if (!isPM && h === 12) h = 0;
    const sec = h * 3600 + m * 60;
    return sec > (9 * 3600 + 40 * 60);
  }

  return false;
}

/**
 * Calculate how many minutes an employee was late past the 09:40 AM grace period
 */
export function getLateMinutes(clockIn) {
  if (!clockIn || clockIn === '--' || typeof clockIn !== 'string') return 0;
  const clean = clockIn.trim();
  if (!clean || clean === '--') return 0;

  let inSec = 0;
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(clean)) {
    const parts = clean.split(':').map(Number);
    inSec = (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  } else if (/am|pm/i.test(clean)) {
    const isPM = /pm/i.test(clean);
    const timeOnly = clean.replace(/am|pm/i, '').trim();
    const parts = timeOnly.split(':').map(Number);
    let h = parts[0] || 0;
    const m = parts[1] || 0;
    if (isPM && h < 12) h += 12;
    if (!isPM && h === 12) h = 0;
    inSec = h * 3600 + m * 60;
  } else {
    return 0;
  }

  const graceSec = 9 * 3600 + 40 * 60; // 09:40:00
  if (inSec > graceSec) {
    return Math.ceil((inSec - graceSec) / 60);
  }
  return 0;
}
