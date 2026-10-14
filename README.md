# WorkPulse: Two-App Office Attendance System with FaceLock AI

A production-ready office attendance solution featuring **Two Dedicated Applications** powered by a unified **Node.js + SQLite Backend**:

1. **Admin & HR App** (`http://localhost:5173`):
   - **Face Enrollment Studio**: Live webcam capture & face biometric enrollment for staff.
   - **Live Attendance Dashboard**: Real-time KPI counters (Present, Late, On Leave, Absent, Inside Now).
   - **Employee Directory**: Full staff management (CRUD, departments, designations, backup PINs).
   - **Attendance Records**: Search & filter logs, review punch snapshots, manual adjustment/regularization.
   - **Leave Management**: Review, approve, or reject employee leave requests with remarks.
   - **Reports & Export**: Work-hour analytics and 1-click CSV download for payroll.
   - **Office Settings**: Configurable shift hours, grace period, and facial recognition tolerance.

2. **Employee FaceLock App** (`http://localhost:5174`):
   - **FaceLock Kiosk Terminal**: Real-time webcam tracking with AI neural net face detection overlay (`@vladmandic/face-api`).
   - **Automatic Attendance Punch**: Automatic instant recognition of enrolled employees, marks Clock-In/Clock-Out, plays audio chimes, bursts celebratory confetti, and displays confirmation cards.
   - **Smart Directional Modes**: Smart Auto (in/out toggle), Clock In Only, Clock Out Only.
   - **PIN Backup Punch**: Keypad modal for manual punch if camera is unavailable.
   - **Employee Self-Service**: Timesheets, cumulative work hours, late statistics, and leave request submission.

---

## Quick Start

### 1. Launch All Apps Concurrently
```bash
npm run dev
```
This starts:
- **Backend API**: `http://localhost:5000`
- **Admin App**: `http://localhost:5173`
- **Employee FaceLock App**: `http://localhost:5174`

### 2. Independent Commands
- Run Server only: `npm run server`
- Run Admin App only: `npm run admin`
- Run Employee App only: `npm run employee`
- Re-seed sample office data: `npm run seed`

---

## Pre-loaded Demo Accounts
The database is pre-seeded with 8 active employees across Engineering, Product, HR, Sales, Design, Ops, and Finance. You can enroll faces for any of them in the **Admin Face Enrollment Studio**, and then step in front of the **Employee FaceLock Kiosk** camera to test live recognition!
