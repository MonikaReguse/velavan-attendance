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

export const api = {
  // Health
  getHealth: () => fetch(`${API_BASE}/health`).then(handleResponse),

  // Admin Auth
  adminLogin: (username, password) =>
    fetch(`${API_BASE}/auth/admin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    }).then(handleResponse),

  // Settings
  getSettings: () => fetch(`${API_BASE}/settings`).then(handleResponse),
  updateSettings: (data) =>
    fetch(`${API_BASE}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),

  // Employees
  getEmployees: () => fetch(`${API_BASE}/employees`).then(handleResponse),
  getNextEmployeeId: (designation = '') =>
    fetch(`${API_BASE}/employees/next-id?designation=${encodeURIComponent(designation)}`).then(handleResponse),
  createEmployee: async (data) => {
    const res = await fetch(`${API_BASE}/employees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },
  updateEmployee: async (id, data) => {
    const res = await fetch(`${API_BASE}/employees/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },
  deleteEmployee: async (id) => {
    const res = await fetch(`${API_BASE}/employees/${id}`, { method: 'DELETE' });
    return handleResponse(res);
  },
  deleteAllEmployees: async () => {
    const res = await fetch(`${API_BASE}/employees`, { method: 'DELETE' });
    return handleResponse(res);
  },
  uploadDocument: (base64, filename, docType) =>
    fetch(`${API_BASE}/upload-document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64, filename, docType }),
    }).then(handleResponse),

  // Face biometrics
  getFaceDescriptors: () => fetch(`${API_BASE}/face-descriptors`).then(handleResponse),
  saveFaceDescriptor: (id, descriptor, snapshotBase64) =>
    fetch(`${API_BASE}/employees/${id}/face-descriptor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ descriptor, snapshotBase64 }),
    }).then(handleResponse),
  deleteFaceDescriptor: (id) =>
    fetch(`${API_BASE}/employees/${id}/face-descriptor`, { method: 'DELETE' }).then(handleResponse),

  // Attendance
  punchAttendance: (data) =>
    fetch(`${API_BASE}/attendance/punch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),
  getTodayAttendance: () => fetch(`${API_BASE}/attendance/today`).then(handleResponse),
  getTodaySummary: () => fetch(`${API_BASE}/attendance/today-summary`).then(handleResponse),
  getAttendanceHistory: (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return fetch(`${API_BASE}/attendance/history?${params}`).then(handleResponse);
  },
  recordManualAttendance: (data) =>
    fetch(`${API_BASE}/attendance/manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),
  updateAttendance: (id, data) =>
    fetch(`${API_BASE}/attendance/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),
  deleteAttendance: (id) =>
    fetch(`${API_BASE}/attendance/${id}`, { method: 'DELETE' }).then(handleResponse),

  // Leaves
  getLeaves: (emp_id) => {
    const q = emp_id ? `?emp_id=${emp_id}` : '';
    return fetch(`${API_BASE}/leaves${q}`).then(handleResponse);
  },
  updateLeaveStatus: (id, status, admin_notes) =>
    fetch(`${API_BASE}/leaves/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, admin_notes }),
    }).then(handleResponse),

  // Export & Database Backup
  getExportUrl: (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return `${API_BASE}/reports/export?${params}`;
  },
  getPayrollExportUrl: (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return `${API_BASE}/reports/payroll-export?${params}`;
  },
  getBackup: () => fetch(`${API_BASE}/backup`).then(handleResponse),
  restoreBackup: (backupData) =>
    fetch(`${API_BASE}/backup/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(backupData),
    }).then(handleResponse)
};
