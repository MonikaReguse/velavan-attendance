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
