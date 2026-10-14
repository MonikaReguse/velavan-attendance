# Velavan Properties Attendance App — Daily Office Operations Manual

**Organization**: Velavan Properties  
**System**: Velavan Properties Attendance & Payroll Management App  
**Primary Brand**: Crimson Maroon (`#8b0000`), Amber Gold (`#f59e0b`), Light Theme  
**Standard Shift**: 09:30 AM – 06:00 PM (Late arrival marked after 09:45 AM)  
**Overtime Rule**: Work past 20-min qualification buffer -> Calculated in minutes from 06:00 PM onwards  
**Payroll Basis**: Fixed 30 Days Standard  

---

## 1. One-Click Daily System Startup

The application is configured to run all services simultaneously (Backend API, Admin & FaceLock Kiosk, and Employee Mobile Portal).

### To Start the System Every Morning:
1. Open the application folder:  
   `C:\Users\ASUS\.gemini\antigravity\scratch\office-attendance-app`
2. Double-click the file:  
   **`START_VELAVAN_ATTENDANCE.bat`**
3. The system automatically boots:
   - **API Server** on Port `5000`
   - **Office Entrance FaceLock Kiosk & Admin** on Port `5173`
   - **Employee Self-Service Portal** on Port `5174`
   - Automatically opens your default web browser to both portals.

---

## 2. System Access URLs & Network Structure

### 🌍 A. Online Public URLs (Open Anywhere — Mobile Net / 4G / 5G / Home)
No need to be connected to office Wi-Fi! Works anywhere from any smartphone:

| Portal | Public URL (HTTPS) | Who Can Access? |
| :--- | :--- | :--- |
| **📱 Employee Self-Service** | **https://owner-radio-lasting-psp.trycloudflare.com** | Staff mobile phones (Share on WhatsApp) |
| **💻 Admin & Owner Dashboard** | **https://plastic-rehab-their-manuals.trycloudflare.com** | Management & HR from home/phone |

### 🏢 B. Office Local & LAN Access (Entrance Screen & Local Wi-Fi)

| Terminal / Device | Network URL | Purpose |
| :--- | :--- | :--- |
| **Entrance Reception PC** (With Webcam) | http://localhost:5173 | Daily FaceLock check-in/out terminal |
| **HR / Management PC** | http://localhost:5173 | Employee directory, bank details, document review, reports |
| **Employee Self-Service** (Office PC) | http://localhost:5174 | Personal attendance, monthly salary & OT calculation |
| **Employee Mobile Phones** (Office Wi-Fi) | **http://192.168.1.28:5174** | Any staff member can open on their mobile phone via office Wi-Fi |


---

## 3. Daily Workflow for Employees

### Morning Check-In (Clock In):
1. Employee arrives at office (Base time: **09:30 AM**).
2. Look at the camera on the **Office FaceLock Terminal** at the entrance desk.
3. The AI recognition system scans biometrics within 1 second:
   - Green chime plays.
   - Shows employee photo, name, and designation.
   - Recorded as **On-Time** (if before 09:45 AM) or **Late Arrival** (if after 09:45 AM).
   - *Note: Attendance cannot be falsely marked from the employee app; it requires physically scanning at the entrance FaceLock kiosk.*

### Evening Check-Out (Clock Out):
1. At the end of the workday, employee looks at the camera again.
2. The system registers evening punch-out:
   - If leaving at 06:00 PM: Shift recorded as completed.
   - If leaving past the qualification buffer (06:20 PM): Overtime is calculated **in minutes from 06:00 PM onwards** (e.g. 06:20 PM checkout = **20 mins OT**; 06:30 PM checkout = **30 mins OT**).

### Checking Personal Monthly Salary & Timesheet:
1. Open http://localhost:5174 (or `http://192.168.1.28:5174` on mobile).
2. Enter registered mobile number -> enter 6-digit OTP -> Login.
3. The **Single-Page Employee Portal** displays:
   - **Profile Hero Card**: Official Photo, Name, Designation, Phone Number, Employee ID, DOJ, Allocated Base Salary.
   - **Month Selector**: View current month or select any past month (past 12 months).
   - **Salary & Overtime Calculation**:
     - Base salary earned on fixed 30-day basis.
     - Total overtime in **minutes** (e.g. `120 mins OT`).
     - Overtime pay added `@ ₹ OT rate per minute`.
     - Final net payout amount.
   - **5 Summary KPI Cards**: Present, Absent (Loss of Pay), Half-Day, Weekly Off (Paid Sunday), and Overtime.
   - **Daily Timesheet Table**: Every day's clock-in, clock-out, hours worked, OT badges (e.g. `+20 mins OT`, `+30 mins OT`), and estimated daily earnings.

---

## 4. Standard Workflow for HR & Office Admin

### 🔒 Dedicated FaceLock Terminal Mode (Employee Protection)
When the Admin app is opened on the entrance PC, tablet, or phone, it **automatically locks into Employee FaceLock Attendance mode**:
- Employees **ONLY see the FaceLock camera and check-in feed**.
- All management features (Employee List, Salaries, Documents, Reports, Settings) are **completely hidden** from employees.
- To unlock the management dashboard: Click **`[ 🔐 Admin Login ]`** on the top right and enter the admin password (`admin123`).
- When finished, click **`[ 🔒 Lock to Employee FaceLock ]`** in the top bar or sidebar to instantly return to employee mode.

### A. Enrolling a New Employee
1. Navigate to **Admin App** -> Unlock Admin Mode -> Click **"Add Employee Info"** (or Employee List -> "Add Employee").
2. Fill in the professional profile:
   - **Basic Details**: Full Name, Phone Number, Department, Role/Designation, Date of Joining (DOJ).
   - **Salary Allocated**: Monthly salary (e.g. `₹20,000`).
   - **Bank Account Details**: Bank Name, Account Number, IFSC Code, Account Holder Name, Branch Name, PAN Number.
   - **Mandatory Documents**: Aadhaar Card, PAN Card, Official Photo, Bank Passbook First Page.
   - **Academic Marksheets**: 10th Marksheet, 12th Marksheet, College Degree, Consolidated Marksheet.
3. Click **"Save Employee Details"**.

### B. Registering Face Biometrics for FaceLock
1. Go to **Employee List** -> Click **"Face Biometrics"** / **"Enroll Face"** next to the employee.
2. Have the employee face the camera -> click **"Capture & Enroll"**.
3. The system extracts the 128-point biometric descriptor and binds it to their Employee ID.
4. The employee is now ready to punch attendance immediately at the kiosk!

### C. Live Attendance Monitoring
- **Admin Dashboard**: Real-time counter of Total Staff, Staff Present Today, Staff Absent, and Late Arrivals.
- **Attendance Records**: Filter by Date Range, Department, or Employee ID to view all punch timestamps and verification methods.
- **Manual Adjustment**: HR can manually adjust hours, clock-in, clock-out, or status if an employee was on external duty.

### D. Monthly Payroll & Reports
1. Go to **"Reports & Export"**.
2. Select the month (or custom date range).
3. View aggregate hours, payable days, and overtime minutes for all employees.
4. Click **"Export to CSV / Excel"** to download the clean payroll spreadsheet for accounting.

---

## 5. Official Overtime & Payroll Formula Reference

### 30 Days Standard Payroll Basis:
- **Daily Base Rate**: `Allocated Monthly Salary ÷ 30 Days`
- **Shift Working Minutes**: `8.5 Hours = 510 Minutes / Day (09:30 AM to 06:00 PM)`
- **Base Rate per Minute**: `Daily Base Rate ÷ 510 Minutes`
- **Overtime (OT) Rate per Minute (1.5x)**: `Base Rate per Minute × 1.5`

### Overtime Qualification & Calculation:
- **Base Departure Time**: `06:00 PM`.
- **Qualification Buffer**: `20 minutes` after required shift end (adjusted for late arrival).
- **Calculation in Minutes**: When checkout >= threshold, OT is measured **from 06:00 PM onwards**:
  - Entry `09:30 AM` -> Exit `06:20 PM` = **20 mins OT**
  - Entry `09:30 AM` -> Exit `06:30 PM` = **30 mins OT**
  - Entry `09:35 AM` -> Exit `06:20 PM` = **0 mins (No OT)** (Buffer threshold is 06:25 PM)
  - Entry `09:35 AM` -> Exit `06:25 PM` = **25 mins OT**
  - Entry `09:35 AM` -> Exit `06:30 PM` = **30 mins OT**

### Net Monthly Salary Payout:
`Net Payout = Earned Base Pay + (Total Overtime Minutes × OT Rate per Minute)`
