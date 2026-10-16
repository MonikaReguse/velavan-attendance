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
  // Auth (Phone OTP)
  sendOtp: (phone) =>
    fetch(`${API_BASE}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    }).then(handleResponse),

  verifyOtp: (phone, otp) =>
    fetch(`${API_BASE}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, otp })
    }).then(handleResponse),

  register: (payload) =>
    fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(handleResponse),

  // Settings
  getSettings: () => fetch(`${API_BASE}/settings`).then(handleResponse),

  // Face biometrics
  getFaceDescriptors: () => fetch(`${API_BASE}/face-descriptors`).then(handleResponse),

  // Attendance Punch
  punch: (payload) =>
    fetch(`${API_BASE}/attendance/punch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(handleResponse),

  // Employee directory
  getEmployees: () => fetch(`${API_BASE}/employees`).then(handleResponse),

  // Attendance records
  getTodayAttendance: () => fetch(`${API_BASE}/attendance/today`).then(handleResponse),
  getHistory: (emp_id) =>
    fetch(`${API_BASE}/attendance/history?emp_id=${emp_id}`).then(handleResponse),

  // Leaves
  getLeaves: (emp_id) =>
    fetch(`${API_BASE}/leaves?emp_id=${emp_id}`).then(handleResponse),
  submitLeave: (data) =>
    fetch(`${API_BASE}/leaves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(handleResponse)
};
