const getApiBase = () => {
  // 1. Vite environment variable provided during build or runtime
  if (import.meta.env.VITE_API_BASE_URL && !import.meta.env.VITE_API_BASE_URL.startsWith('/')) {
    return import.meta.env.VITE_API_BASE_URL.replace(/\/+$/, '');
  }
  // 2. When deployed on Vercel or any non-localhost host, always route to Render backend
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return 'https://velavan-attendance.onrender.com/api';
  }
  // 3. Localhost development proxy
  return '/api';
};

export const API_BASE = getApiBase();

const handleResponse = async (res) => {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `Request failed with status ${res.status}`);
    }
    return data;
  }
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Request failed with status ${res.status}: ${text.slice(0, 100)}`);
  }
  throw new Error('Received non-JSON response from server. Server may be starting up.');
};

// Automatic retry wrapper for resilient cloud connections (handles Render cold-starts & transient drops)
const fetchWithRetry = async (url, options = {}, retries = 2, delayMs = 1500) => {
  try {
    const res = await fetch(url, options);
    return await handleResponse(res);
  } catch (err) {
    const isNetworkError =
      err.name === 'TypeError' ||
      err.message?.includes('Failed to fetch') ||
      err.message?.includes('NetworkError') ||
      err.message?.includes('Load failed') ||
      err.message?.includes('Server may be starting up');

    if (retries > 0 && isNetworkError) {
      console.warn(`[API Retry] Retrying request to ${url} in ${delayMs}ms due to: ${err.message}`);
      await new Promise(r => setTimeout(r, delayMs));
      return fetchWithRetry(url, options, retries - 1, Math.min(delayMs * 1.5, 4000));
    }
    throw err;
  }
};

export const api = {
  // Health
  getHealth: () => fetchWithRetry(`${API_BASE}/health`, {}, 1, 1000),

  // Admin Auth
  adminLogin: (username, password) =>
    fetchWithRetry(`${API_BASE}/auth/admin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    }, 2, 1000),

  // Settings
  getSettings: () => fetchWithRetry(`${API_BASE}/settings`, {}, 2, 1000),
  updateSettings: (data) =>
    fetchWithRetry(`${API_BASE}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }, 2, 1000),

  // Employees
  getEmployees: () => fetchWithRetry(`${API_BASE}/employees`, {}, 2, 1200),
  getNextEmployeeId: (designation = '') =>
    fetchWithRetry(`${API_BASE}/employees/next-id?designation=${encodeURIComponent(designation)}`, {}, 2, 1000),
  createEmployee: async (data) => {
    return fetchWithRetry(`${API_BASE}/employees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }, 2, 1500);
  },
  updateEmployee: async (id, data) => {
    return fetchWithRetry(`${API_BASE}/employees/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }, 2, 1500);
  },
  deleteEmployee: async (id) => {
    return fetchWithRetry(`${API_BASE}/employees/${id}`, { method: 'DELETE' }, 2, 1000);
  },
  uploadDocument: (base64, filename, docType) =>
    fetchWithRetry(`${API_BASE}/upload-document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64, filename, docType }),
    }, 2, 1500),

  // Face biometrics
  getFaceDescriptors: () => fetchWithRetry(`${API_BASE}/face-descriptors`, {}, 2, 1200),
  saveFaceDescriptor: (id, descriptor, snapshotBase64) =>
    fetchWithRetry(`${API_BASE}/employees/${id}/face-descriptor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ descriptor, snapshotBase64 }),
    }, 2, 1500),
  deleteFaceDescriptor: (id) =>
    fetchWithRetry(`${API_BASE}/employees/${id}/face-descriptor`, { method: 'DELETE' }, 2, 1000),

  // Attendance
  punchAttendance: (data) =>
    fetchWithRetry(`${API_BASE}/attendance/punch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }, 2, 1000),
  getTodayAttendance: () => fetchWithRetry(`${API_BASE}/attendance/today`, {}, 2, 1000),
  getTodaySummary: () => fetchWithRetry(`${API_BASE}/attendance/today-summary`, {}, 2, 1000),
  getAttendanceHistory: (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return fetchWithRetry(`${API_BASE}/attendance/history?${params}`, {}, 2, 1200);
  },
  getAttendanceRecord: (emp_id, date) =>
    fetchWithRetry(`${API_BASE}/attendance/record?emp_id=${encodeURIComponent(emp_id)}&date=${encodeURIComponent(date)}`, {}, 2, 1000),
  recordManualAttendance: (data) =>
    fetchWithRetry(`${API_BASE}/attendance/manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }, 3, 1500),
  updateAttendance: (id, data) =>
    fetchWithRetry(`${API_BASE}/attendance/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }, 2, 1500),
  deleteAttendance: (id, emp_id, date) => {
    let query = '';
    if (emp_id && date) {
      query = `?emp_id=${encodeURIComponent(emp_id)}&date=${encodeURIComponent(date)}`;
    }
    return fetchWithRetry(`${API_BASE}/attendance/${id || 0}${query}`, { method: 'DELETE' }, 2, 1000);
  },

  // Leaves
  getLeaves: (emp_id) => {
    const q = emp_id ? `?emp_id=${emp_id}` : '';
    return fetchWithRetry(`${API_BASE}/leaves${q}`, {}, 2, 1000);
  },
  updateLeaveStatus: (id, status, admin_notes) =>
    fetchWithRetry(`${API_BASE}/leaves/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, admin_notes }),
    }, 2, 1000),

  // Export & Database Backup
  getExportUrl: (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return `${API_BASE}/reports/export?${params}`;
  },
  getPayrollExportUrl: (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return `${API_BASE}/reports/payroll-export?${params}`;
  },
  getBackup: () => fetchWithRetry(`${API_BASE}/backup`, {}, 2, 1500),
  restoreBackup: (backupData) =>
    fetchWithRetry(`${API_BASE}/backup/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(backupData),
    }, 2, 2000)
};
