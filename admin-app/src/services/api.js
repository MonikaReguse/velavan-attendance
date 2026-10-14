const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export const api = {
  // Health
  getHealth: () => fetch(`${API_BASE}/health`).then(res => res.json()),

  // Admin Auth
  adminLogin: (username, password) =>
    fetch(`${API_BASE}/auth/admin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    }).then(res => res.json()),

  // Settings
  getSettings: () => fetch(`${API_BASE}/settings`).then(res => res.json()),
  updateSettings: (data) =>
    fetch(`${API_BASE}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(res => res.json()),

  // Employees
  getEmployees: () => fetch(`${API_BASE}/employees`).then(res => res.json()),
  getNextEmployeeId: (designation = '') =>
    fetch(`${API_BASE}/employees/next-id?designation=${encodeURIComponent(designation)}`).then(res => res.json()),
  createEmployee: (data) =>
    fetch(`${API_BASE}/employees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(res => res.json()),
  updateEmployee: (id, data) =>
    fetch(`${API_BASE}/employees/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(res => res.json()),
  deleteEmployee: (id) =>
    fetch(`${API_BASE}/employees/${id}`, { method: 'DELETE' }).then(res => res.json()),
  uploadDocument: (base64, filename, docType) =>
    fetch(`${API_BASE}/upload-document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64, filename, docType }),
    }).then(res => res.json()),

  // Face biometrics
  getFaceDescriptors: () => fetch(`${API_BASE}/face-descriptors`).then(res => res.json()),
  saveFaceDescriptor: (id, descriptor, snapshotBase64) =>
    fetch(`${API_BASE}/employees/${id}/face-descriptor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ descriptor, snapshotBase64 }),
    }).then(res => res.json()),
  deleteFaceDescriptor: (id) =>
    fetch(`${API_BASE}/employees/${id}/face-descriptor`, { method: 'DELETE' }).then(res => res.json()),

  // Attendance
  punchAttendance: (data) =>
    fetch(`${API_BASE}/attendance/punch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(res => res.json()),
  getTodayAttendance: () => fetch(`${API_BASE}/attendance/today`).then(res => res.json()),
  getTodaySummary: () => fetch(`${API_BASE}/attendance/today-summary`).then(res => res.json()),
  getAttendanceHistory: (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return fetch(`${API_BASE}/attendance/history?${params}`).then(res => res.json());
  },
  recordManualAttendance: (data) =>
    fetch(`${API_BASE}/attendance/manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(res => res.json()),
  updateAttendance: (id, data) =>
    fetch(`${API_BASE}/attendance/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(res => res.json()),
  deleteAttendance: (id) =>
    fetch(`${API_BASE}/attendance/${id}`, { method: 'DELETE' }).then(res => res.json()),

  // Leaves
  getLeaves: (emp_id) => {
    const q = emp_id ? `?emp_id=${emp_id}` : '';
    return fetch(`${API_BASE}/leaves${q}`).then(res => res.json());
  },
  updateLeaveStatus: (id, status, admin_notes) =>
    fetch(`${API_BASE}/leaves/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, admin_notes }),
    }).then(res => res.json()),

  // Export
  getExportUrl: (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return `${API_BASE}/reports/export?${params}`;
  }
};
