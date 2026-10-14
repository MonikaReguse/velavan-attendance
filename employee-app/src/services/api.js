const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export const api = {
  // Auth (Phone OTP)
  sendOtp: (phone) =>
    fetch(`${API_BASE}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    }).then(res => res.json()),

  verifyOtp: (phone, otp) =>
    fetch(`${API_BASE}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, otp })
    }).then(res => res.json()),

  register: (payload) =>
    fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(res => res.json()),

  // Settings
  getSettings: () => fetch(`${API_BASE}/settings`).then(res => res.json()),

  // Face biometrics
  getFaceDescriptors: () => fetch(`${API_BASE}/face-descriptors`).then(res => res.json()),

  // Attendance Punch
  punch: (payload) =>
    fetch(`${API_BASE}/attendance/punch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(res => res.json()),

  // Employee directory
  getEmployees: () => fetch(`${API_BASE}/employees`).then(res => res.json()),

  // Attendance records
  getTodayAttendance: () => fetch(`${API_BASE}/attendance/today`).then(res => res.json()),
  getHistory: (emp_id) =>
    fetch(`${API_BASE}/attendance/history?emp_id=${emp_id}`).then(res => res.json()),

  // Leaves
  getLeaves: (emp_id) =>
    fetch(`${API_BASE}/leaves?emp_id=${emp_id}`).then(res => res.json()),
  submitLeave: (data) =>
    fetch(`${API_BASE}/leaves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(res => res.json())
};
