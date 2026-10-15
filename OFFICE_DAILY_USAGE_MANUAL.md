# 🏢 Velavan Properties Attendance & FaceLock System — Daily Office Manual

Official Standard Operating Procedure (SOP) for the **Velavan Properties Attendance & Payroll System**, custom-built with official brand identity, light theme styling, and 30-day salary calculation rules.

---

## 📱 1. APP 1: Employee Self-Service Portal (ஊழியர்களுக்கான போர்ட்டல்)

**Dedicated for office employees to check their attendance, shift hours, overtime minutes, and monthly salary on their smartphones.**

* **🌐 24/7 Live Online URL**:  
  👉 **[https://velavan-attendance.vercel.app](https://velavan-attendance.vercel.app)**
* **📱 Supported Devices**: Any mobile phone (Android / iPhone / Tablet) via Mobile Data (4G/5G) or Wi-Fi.
* **🔒 Availability**: 24 hours a day, 365 days a year (Works even when office PC is closed).

### 🔑 How Employees Login:
1. Open **[https://velavan-attendance.vercel.app](https://velavan-attendance.vercel.app)** on mobile.
2. Enter registered mobile number (e.g. `8754898473`) or Employee ID (e.g. `VPDM01`).
3. Tap **`SEND LOGIN OTP`**.
4. The 6-digit OTP code is generated on screen $\rightarrow$ Tap **`VERIFY & LOGIN`**!
   *(Or enter personal 4-digit Employee PIN: `1234`)*.

### 🌟 What Employees Can View:
1. **Executive Profile Card**:
   - Legal Name, Designation (e.g. *Website Design*, *Digital Marketing*), Phone, and Employee ID badge.
   - Base Monthly Salary (e.g. `₹20,000 / month`) & Joining Date (DOJ).
2. **Monthly Salary & Overtime Calculation**:
   - Fixed 30-Day Standard basis (`₹20,000 ÷ 30 = ₹666.67 / day`).
   - Earned regular shift pay + Overtime earnings (`Total OT Minutes × OT Minute Rate`).
   - Transparent formula breakdown button.
3. **5 Attendance Summary Counters**:
   - 🟢 **Present**: Full working days.
   - 🔴 **Absent**: Loss of pay days.
   - 🟡 **Half-Day**: 0.5 credited shifts.
   - 🟣 **Weekly Off**: Paid Sunday rest days.
   - 🔥 **Overtime**: Count of overtime days and **Total OT Minutes** (e.g. `150 mins`).
4. **Interactive Month Selector**:
   - Switch between October 2026, September 2026, or any previous month with 1 click.
5. **Mobile-First Attendance Feed**:
   - Swipeable cards showing Clock In, Clock Out, Total Shift Hours, and `+20m / +30m OT` badges.

---

## 💻 2. APP 2: Office Admin & FaceLock Kiosk (ஆபீஸ் & HR மேலாண்மை போர்ட்டல்)

**Dedicated for the office reception/entrance for camera FaceLock attendance check-in, and for HR/Management to handle records, manual entries, and payroll.**

* **🌐 24/7 Live Online URL**:  
  👉 **[https://velavan-attendance-cku9.vercel.app](https://velavan-attendance-cku9.vercel.app)** *(or local `http://localhost:5173`)*
* **⚡ Live Cloud Database & REST API**:  
  👉 **`https://velavan-attendance.onrender.com`**
* **🔑 Admin Unlock Password**: **`admin123`**

### 🔒 Default State: Employee FaceLock Kiosk
* When opened, the app **strictly displays only the Office FaceLock Camera Terminal**.
* **100% Locked from Staff**: Sidebar, Employee salaries, Aadhaar/Bank details, Attendance logs, and Settings are completely hidden.
* **Face Check-In / Check-Out**:
  - Employee stands in front of the camera.
  - AI biometrics recognizes their face within 0.5 seconds.
  - Automatically records Clock In (Morning) or Clock Out (Evening).
  - Shows green confirmation badge with employee name and time.

---

### 🔓 HR & Management Mode (Password: `admin123`)

Click **`[ 🔐 Admin Login ]`** in the top navbar and enter `admin123` to access:

| Menu Item | Purpose & Features |
| :--- | :--- |
| **📊 Dashboard** | Live office attendance stats, today's check-ins, on-time arrivals, late entries, and overtime tracker. |
| **📅 Manual Attendance Update** | **Full HR manual attendance control**: Select any employee and any date. Use 6 1-click presets (*Full Day*, *OT +20m*, *OT +30m*, *Half Day*, *Mark Absent*, *Weekly Off*) or enter custom times and OT minutes. |
| **👥 Add Employee Info** | Register new staff: Name, Department, Designation, DOJ, Monthly Salary, Bank details, PAN, and Aadhaar. Auto-generates standard ID (e.g. `VPDM01`). |
| **📸 Face Enrollment** | Capture employee face via camera to enroll their biometric face descriptor into the AI database. |
| **📋 Attendance Records** | Full historical attendance table with filters, search, and 1-click **Edit (✏️)** and **Delete (🗑️)**. |
| **📈 Reports & Export** | Generate monthly payroll attendance reports and download 1-click official **CSV / Excel** sheets. |
| **⚙️ Office Settings** | Configure office shift hours (`09:30 AM – 06:00 PM`), OT buffer (20 mins), and late arrival rules. |
| **🔒 Lock to Employee FaceLock** | Instantly relocks the screen into employee camera FaceLock mode when HR leaves the desk. |

---

## ⏰ 3. Official Shift & Overtime (OT) Timing Rules

* **Regular Office Timing**: **09:30 AM – 06:00 PM** (8.5 Hours total shift).
* **Late Arrival Offset**: If an employee arrives late (e.g. 09:40 AM), their required shift end shifts forward by that late duration (06:10 PM).
* **20-Minute Overtime Buffer Rule**:
  - Overtime qualifies **only when the employee works past 20 minutes** after their required shift end (06:20 PM for on-time arrivals).
  - Once qualified, Overtime is calculated **strictly in minutes from 06:00 PM onwards**:
    - `09:30 AM` in $\rightarrow$ `06:20 PM` out = **20 mins OT**
    - `09:30 AM` in $\rightarrow$ `06:25 PM` out = **25 mins OT**
    - `09:30 AM` in $\rightarrow$ `06:30 PM` out = **30 mins OT**
    - `09:35 AM` in $\rightarrow$ `06:20 PM` out = **0 mins (No OT)** *(Threshold is 6:25 PM)*
    - `09:35 AM` in $\rightarrow$ `06:25 PM` out = **25 mins OT**
* **Payroll Standard**: Fixed **30 Days basis** for daily rate and minute rate calculations.

---

## ⚡ 4. Daily Office Operations Checklist

1. **Morning (09:00 AM)**:
   - Reception staff opens **`https://velavan-attendance-cku9.vercel.app`** (or double-clicks `START_VELAVAN_ATTENDANCE.bat` on local PC).
   - Screen stays locked on the FaceLock terminal.
2. **Check-In (09:15 – 09:40 AM)**:
   - Employees look at the camera for 1 second. System punches Clock In (Late arrival starts after 09:40 AM).
3. **During the Day**:
   - Employees open **`https://velavan-attendance.vercel.app`** on their phones to view their status and earnings.
4. **Check-Out (06:00 – 07:00 PM)**:
   - Employees look at the camera when leaving. System punches Clock Out and computes OT minutes automatically.
5. **Corrections & Month-End Payroll**:
   - HR unlocks Admin mode with `admin123`.
   - Uses **Manual Attendance Update** to correct forgotten punches or add OT notes.
   - Downloads monthly CSV report for salary disbursement.
