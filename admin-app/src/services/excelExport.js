import * as XLSX from 'xlsx';
import { formatTime } from './timeUtils';

/**
 * Format currency helper
 */
const formatCurrency = (val) => {
  return Number(val || 0);
};

/**
 * Calculate month details (working days, Sundays, etc.)
 */
export const getMonthCalendarInfo = (year, monthIndex) => {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  let sundaysCount = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, monthIndex, day);
    if (d.getDay() === 0) {
      sundaysCount++;
    }
  }
  const workingDays = daysInMonth - sundaysCount;
  return { daysInMonth, sundaysCount, workingDays };
};

/**
 * Export Comprehensive Monthly Attendance & Salary Excel Report (.xlsx)
 * with dedicated Executive Summary Sheet and All-Employee Coverage including
 * Government Holiday Rules & Employee Own Leave.
 */
export const exportMonthlyPayrollExcel = ({
  payrollStats = [],
  attendanceData = [],
  filters = {},
  settings = {},
  generatedBy = 'Administrator'
}) => {
  // 1. Determine selected month
  let year = new Date().getFullYear();
  let monthIndex = new Date().getMonth();
  if (filters?.startDate) {
    try {
      const parts = filters.startDate.split('-').map(Number);
      year = parts[0];
      monthIndex = parts[1] - 1;
    } catch {}
  }
  const monthDateObj = new Date(year, monthIndex, 1);
  const monthName = monthDateObj.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const { daysInMonth, sundaysCount, workingDays } = getMonthCalendarInfo(year, monthIndex);

  // 2. Prepare Detailed Data Rows
  const rows = payrollStats.map(p => {
    const baseSalary = Number(p.baseSalary || 0);
    const dailyRate = Number(p.dailyRate || (baseSalary > 0 ? Math.round(baseSalary / 30) : 0));
    
    const normalPresent = Number(p.normalPresent !== undefined ? p.normalPresent : p.present || 0);
    const govtHolidayWorked = Number(p.govtHolidayWorked || 0);
    const govtHolidayGranted = Number(p.govtHolidayGranted || 0);
    const ownLeaveDays = Number(p.ownLeaveDays || 0);
    const otherAbsent = Number(p.otherAbsent !== undefined ? p.otherAbsent : (p.absent || 0));
    const halfday = Number(p.halfday || 0);
    const paidLeaveDays = Number(p.paidLeaveDays || 0);
    const weeklyOffs = Number(sundaysCount);

    const otHours = Number(p.otHours || (p.otMinutes ? Number((p.otMinutes / 60).toFixed(2)) : 0));
    const otAmount = Number(p.otPay || 0);
    
    // Double salary days = Govt Holidays Worked + 2 days if eligible for full attendance bonus
    const doubleSalaryDays = Number(p.doubleSalaryDays || (govtHolidayWorked + (p.isFullPresentEligible ? 2 : 0)));
    
    // Holiday Extra Salary = 1x extra daily salary per govt holiday worked + full attendance bonus
    const holidayExtraSalary = Number(p.holidayExtraSalary !== undefined ? p.holidayExtraSalary : (doubleSalaryDays * dailyRate));
    
    // Deductions: Unpaid Leave + Other Absents + Half Days
    const unpaidLeaveDeductions = Number(p.unpaidLeaveDeductions !== undefined ? p.unpaidLeaveDeductions : (ownLeaveDays * dailyRate));
    const otherDeductions = Number(p.otherDeductions !== undefined ? p.otherDeductions : Math.round(otherAbsent * dailyRate + halfday * 0.5 * dailyRate));
    const totalDeductions = unpaidLeaveDeductions + otherDeductions;

    // Normal Salary (Earned Base) = Base Salary - Total Deductions
    const normalSalary = Number(p.normalSalary !== undefined ? p.normalSalary : Math.max(0, baseSalary - totalDeductions));
    const otherAllowances = Number(p.otherAllowances || 0);

    // Total Monthly Salary = Base Salary + OT + Holiday Extra + Allowances
    const totalMonthlySalary = baseSalary + otAmount + holidayExtraSalary + otherAllowances;

    // Final Payable Salary = Normal Salary + Holiday Extra Salary + OT + Allowances
    // (Notice: Normal Salary already accounts for deductions, so no double counting!)
    const finalPayableSalary = Math.max(0, normalSalary + holidayExtraSalary + otAmount + otherAllowances);

    return {
      'Employee ID': p.emp_id || '--',
      'Employee Name': p.name || '--',
      'Designation': p.role || p.designation || 'Staff',
      'Monthly Basic Salary': baseSalary,
      'Selected Month': monthName,
      'Total Working Days': workingDays,
      'Normal Present Days': normalPresent,
      'Government Holidays Worked': govtHolidayWorked,
      'Government Holidays Granted by Office': govtHolidayGranted,
      'Employee Unpaid Leave Days': ownLeaveDays,
      'Absent Days': otherAbsent,
      'Half Days': halfday,
      'Paid Leave Days': paidLeaveDays,
      'Weekly Offs and Holidays': weeklyOffs,
      'Overtime Hours': otHours,
      'Double-Salary Days': doubleSalaryDays,
      'Per-Day Salary': dailyRate,
      'Normal Salary': normalSalary,
      'Overtime Amount': otAmount,
      'Holiday Extra Salary': holidayExtraSalary,
      'Unpaid Leave Deductions': unpaidLeaveDeductions,
      'Other Deductions': otherDeductions,
      'Total Monthly Salary': totalMonthlySalary,
      'Final Payable Salary': finalPayableSalary
    };
  });

  // Calculate Totals Row
  const totals = {
    'Employee ID': 'TOTAL',
    'Employee Name': `${rows.length} Employees`,
    'Designation': '',
    'Monthly Basic Salary': rows.reduce((s, r) => s + r['Monthly Basic Salary'], 0),
    'Selected Month': monthName,
    'Total Working Days': workingDays,
    'Normal Present Days': rows.reduce((s, r) => s + r['Normal Present Days'], 0),
    'Government Holidays Worked': rows.reduce((s, r) => s + r['Government Holidays Worked'], 0),
    'Government Holidays Granted by Office': rows.reduce((s, r) => s + r['Government Holidays Granted by Office'], 0),
    'Employee Unpaid Leave Days': rows.reduce((s, r) => s + r['Employee Unpaid Leave Days'], 0),
    'Absent Days': rows.reduce((s, r) => s + r['Absent Days'], 0),
    'Half Days': rows.reduce((s, r) => s + r['Half Days'], 0),
    'Paid Leave Days': rows.reduce((s, r) => s + r['Paid Leave Days'], 0),
    'Weekly Offs and Holidays': rows.reduce((s, r) => s + r['Weekly Offs and Holidays'], 0),
    'Overtime Hours': Number(rows.reduce((s, r) => s + r['Overtime Hours'], 0).toFixed(2)),
    'Double-Salary Days': rows.reduce((s, r) => s + r['Double-Salary Days'], 0),
    'Per-Day Salary': '',
    'Normal Salary': rows.reduce((s, r) => s + r['Normal Salary'], 0),
    'Overtime Amount': rows.reduce((s, r) => s + r['Overtime Amount'], 0),
    'Holiday Extra Salary': rows.reduce((s, r) => s + r['Holiday Extra Salary'], 0),
    'Unpaid Leave Deductions': rows.reduce((s, r) => s + r['Unpaid Leave Deductions'], 0),
    'Other Deductions': rows.reduce((s, r) => s + r['Other Deductions'], 0),
    'Total Monthly Salary': rows.reduce((s, r) => s + r['Total Monthly Salary'], 0),
    'Final Payable Salary': rows.reduce((s, r) => s + r['Final Payable Salary'], 0)
  };

  const finalRows = [...rows, totals];

  // 3. Create Workbook & Sheets
  const wb = XLSX.utils.book_new();

  // Sheet 1: Main Monthly Attendance & Salary Sheet
  const wsPayroll = XLSX.utils.json_to_sheet(finalRows);

  // Set Column Widths for clean viewing in Excel
  wsPayroll['!cols'] = [
    { wch: 14 }, // Employee ID
    { wch: 24 }, // Employee Name
    { wch: 28 }, // Designation
    { wch: 20 }, // Monthly Basic Salary
    { wch: 16 }, // Selected Month
    { wch: 18 }, // Total Working Days
    { wch: 20 }, // Normal Present Days
    { wch: 26 }, // Government Holidays Worked
    { wch: 32 }, // Government Holidays Granted by Office
    { wch: 24 }, // Employee Unpaid Leave Days
    { wch: 14 }, // Absent Days
    { wch: 12 }, // Half Days
    { wch: 16 }, // Paid Leave Days
    { wch: 24 }, // Weekly Offs and Holidays
    { wch: 16 }, // Overtime Hours
    { wch: 18 }, // Double-Salary Days
    { wch: 16 }, // Per-Day Salary
    { wch: 18 }, // Normal Salary
    { wch: 16 }, // Overtime Amount
    { wch: 22 }, // Holiday Extra Salary
    { wch: 24 }, // Unpaid Leave Deductions
    { wch: 18 }, // Other Deductions
    { wch: 20 }, // Total Monthly Salary
    { wch: 20 }  // Final Payable Salary
  ];

  XLSX.utils.book_append_sheet(wb, wsPayroll, 'Monthly Payroll & Attendance');

  // Sheet 2: Executive Summary Sheet
  const totalEmployees = rows.length;
  const totalNormalPresent = totals['Normal Present Days'];
  const totalGovtWorked = totals['Government Holidays Worked'];
  const totalGovtGranted = totals['Government Holidays Granted by Office'];
  const totalOwnLeave = totals['Employee Unpaid Leave Days'];
  const totalAbsent = totals['Absent Days'];
  const totalOtHours = totals['Overtime Hours'];
  const totalOtPay = totals['Overtime Amount'];
  const totalDoubleDays = totals['Double-Salary Days'];
  const totalHolidayExtra = totals['Holiday Extra Salary'];
  const totalBasicPayroll = totals['Monthly Basic Salary'];
  const totalNormalSalary = totals['Normal Salary'];
  const totalUnpaidDeductions = totals['Unpaid Leave Deductions'];
  const totalOtherDeductions = totals['Other Deductions'];
  const totalFinalPayout = totals['Final Payable Salary'];
  const qualifiedStaffCount = rows.filter(r => r['Double-Salary Days'] > 0).length;

  const summaryData = [
    { 'METRIC': 'ORGANIZATION', 'VALUE': 'VELAVAN PROPERTIES' },
    { 'METRIC': 'REPORT TITLE', 'VALUE': 'MONTHLY ATTENDANCE & PAYROLL SUMMARY REPORT' },
    { 'METRIC': 'SALARY MONTH', 'VALUE': monthName },
    { 'METRIC': 'TOTAL CALENDAR DAYS IN MONTH', 'VALUE': daysInMonth },
    { 'METRIC': 'STANDARD WORKING DAYS', 'VALUE': workingDays },
    { 'METRIC': 'WEEKLY OFFS (SUNDAYS)', 'VALUE': sundaysCount },
    { 'METRIC': 'GENERATION DATE', 'VALUE': new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) },
    { 'METRIC': 'AUTHORIZED ISSUER', 'VALUE': generatedBy },
    { 'METRIC': '----------------------------------------', 'VALUE': '----------------------------------------' },
    { 'METRIC': 'TOTAL ACTIVE EMPLOYEES', 'VALUE': totalEmployees },
    { 'METRIC': 'TOTAL NORMAL PRESENT DAYS', 'VALUE': totalNormalPresent },
    { 'METRIC': 'TOTAL GOVT HOLIDAYS WORKED (DOUBLE SALARY)', 'VALUE': `${totalGovtWorked} shifts` },
    { 'METRIC': 'TOTAL GOVT HOLIDAYS OFFICE GRANTED (PAID)', 'VALUE': `${totalGovtGranted} days` },
    { 'METRIC': 'TOTAL EMPLOYEE OWN LEAVES (UNPAID)', 'VALUE': `${totalOwnLeave} days` },
    { 'METRIC': 'TOTAL OTHER ABSENT DAYS LOGGED', 'VALUE': totalAbsent },
    { 'METRIC': 'TOTAL OVERTIME HOURS', 'VALUE': `${totalOtHours} hrs` },
    { 'METRIC': 'TOTAL OVERTIME DISBURSED (INR)', 'VALUE': `Rs. ${totalOtPay.toLocaleString('en-IN')}` },
    { 'METRIC': 'TOTAL DOUBLE-SALARY / HOLIDAY EXTRA BONUS (INR)', 'VALUE': `Rs. ${totalHolidayExtra.toLocaleString('en-IN')}` },
    { 'METRIC': 'TOTAL BASIC MONTHLY PAYROLL (INR)', 'VALUE': `Rs. ${totalBasicPayroll.toLocaleString('en-IN')}` },
    { 'METRIC': 'TOTAL NORMAL SALARY (EARNED BASE) (INR)', 'VALUE': `Rs. ${totalNormalSalary.toLocaleString('en-IN')}` },
    { 'METRIC': 'TOTAL UNPAID LEAVE DEDUCTIONS (INR)', 'VALUE': `Rs. ${totalUnpaidDeductions.toLocaleString('en-IN')}` },
    { 'METRIC': 'TOTAL OTHER LOSS OF PAY DEDUCTIONS (INR)', 'VALUE': `Rs. ${totalOtherDeductions.toLocaleString('en-IN')}` },
    { 'METRIC': 'NET FINAL PAYABLE SALARY DISBURSED (INR)', 'VALUE': `Rs. ${totalFinalPayout.toLocaleString('en-IN')}` },
    { 'METRIC': '----------------------------------------', 'VALUE': '----------------------------------------' },
    { 'METRIC': 'OFFICIAL POLICY: GOVT HOLIDAY WORKED', 'VALUE': 'Double Salary: 2 × Normal Daily Salary (1× Base Pay + 1× Extra Bonus)' },
    { 'METRIC': 'OFFICIAL POLICY: GOVT HOLIDAY OFFICE GRANTED', 'VALUE': 'Paid Holiday: 1 × Normal Daily Salary (Paid by Office, No Deduction)' },
    { 'METRIC': 'OFFICIAL POLICY: EMPLOYEE OWN LEAVE', 'VALUE': 'Unpaid Leave: 1 Day Daily Salary Deducted from Monthly Salary' },
    { 'METRIC': 'OFFICIAL POLICY: SALARY BASIS', 'VALUE': '30-Day Fixed Basis (Per-Day Salary = Monthly Basic / 30)' },
    { 'METRIC': 'OFFICIAL POLICY: OVERTIME RATE', 'VALUE': '1.5x Hourly Rate (Hourly Rate = Daily Rate / 8.5)' },
    { 'METRIC': 'OFFICIAL POLICY: FULL ATTENDANCE BONUS', 'VALUE': '100% Full Attendance (0 Absences) = +2 Days Extra Salary Pay' },
    { 'METRIC': 'OFFICIAL POLICY: SHIFT TIMINGS', 'VALUE': '09:30 AM to 06:00 PM (8.5 hrs, 20 mins grace cutoff for late arrivals)' }
  ];

  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  wsSummary['!cols'] = [
    { wch: 48 },
    { wch: 60 }
  ];

  XLSX.utils.book_append_sheet(wb, wsSummary, 'Executive Summary');

  // Sheet 3: Daily Attendance Logs Sheet with Login/Logout Timings & Pending Tracking
  if (Array.isArray(attendanceData) && attendanceData.length > 0) {
    const dailyLogRows = attendanceData.map(r => {
      const isPendingCheckout = (!r.clock_out || r.clock_out === '--' || r.status === 'checked_in') && r.status !== 'absent' && r.status !== 'weekly_off' && r.holiday_type !== 'own_leave' && r.holiday_type !== 'govt_holiday_leave';
      const outDisplay = (r.clock_out && r.clock_out !== '--') ? formatTime(r.clock_out) : isPendingCheckout ? '⏳ Checkout Pending' : '--';

      let statusDisplay = 'Present';
      if (isPendingCheckout) statusDisplay = 'Checked In — Checkout Pending';
      else if (r.status === 'od' || r.status === 'login_od' || r.status === 'logout_od' || r.clock_in === 'OD' || r.clock_out === 'OD') statusDisplay = 'On Duty (OD)';
      else if (r.holiday_type === 'govt_holiday_worked') statusDisplay = 'Govt Holiday (Worked - 2× Pay)';
      else if (r.holiday_type === 'govt_holiday_leave') statusDisplay = 'Govt Holiday (Office Granted)';
      else if (r.holiday_type === 'own_leave') statusDisplay = 'Employee Own Leave (Unpaid)';
      else if (r.status === 'late') statusDisplay = 'Late Arrival';
      else if (r.status === 'half_day') statusDisplay = 'Half Day';
      else if (r.status === 'absent') statusDisplay = 'Absent';
      else if (r.status === 'weekly_off') statusDisplay = 'Weekly Off';

      return {
        'Date': r.date || '--',
        'Employee ID': r.emp_id || '--',
        'Employee Name': r.employee_name || r.name || '--',
        'Status': statusDisplay,
        'Login (Check-in)': r.clock_in ? formatTime(r.clock_in) : '--',
        'Logout (Check-out)': outDisplay,
        'Working Hours': (r.total_hours !== undefined && r.total_hours !== null && r.total_hours > 0) ? Number(r.total_hours).toFixed(2) : (isPendingCheckout ? 'In Progress' : '0.00'),
        'Overtime (Mins)': r.ot_minutes || 0,
        'Method': (r.method || 'manual').toUpperCase(),
        'Notes / Reason': r.notes || '--'
      };
    });

    const wsDaily = XLSX.utils.json_to_sheet(dailyLogRows);
    wsDaily['!cols'] = [
      { wch: 14 }, // Date
      { wch: 14 }, // Employee ID
      { wch: 24 }, // Employee Name
      { wch: 32 }, // Status
      { wch: 18 }, // Login
      { wch: 22 }, // Logout
      { wch: 16 }, // Working Hours
      { wch: 16 }, // Overtime
      { wch: 16 }, // Method
      { wch: 32 }  // Notes
    ];
    XLSX.utils.book_append_sheet(wb, wsDaily, 'Daily Attendance Logs');
  }

  // 4. Download file
  const fileNameMonth = monthName.replace(/\s+/g, '_');
  XLSX.writeFile(wb, `Velavan_Monthly_Salary_Report_${fileNameMonth}.xlsx`);
};

/**
 * Export Comprehensive Monthly Attendance & Salary Report as CSV
 */
export const exportMonthlyPayrollCSV = ({
  payrollStats = [],
  filters = {},
  generatedBy = 'Administrator'
}) => {
  let year = new Date().getFullYear();
  let monthIndex = new Date().getMonth();
  if (filters?.startDate) {
    try {
      const parts = filters.startDate.split('-').map(Number);
      year = parts[0];
      monthIndex = parts[1] - 1;
    } catch {}
  }
  const monthDateObj = new Date(year, monthIndex, 1);
  const monthName = monthDateObj.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const { sundaysCount, workingDays } = getMonthCalendarInfo(year, monthIndex);

  const headers = [
    'Employee ID',
    'Employee Name',
    'Designation',
    'Monthly Basic Salary',
    'Selected Month',
    'Total Working Days',
    'Normal Present Days',
    'Government Holidays Worked',
    'Government Holidays Granted by Office',
    'Employee Unpaid Leave Days',
    'Absent Days',
    'Half Days',
    'Paid Leave Days',
    'Weekly Offs and Holidays',
    'Overtime Hours',
    'Double-Salary Days',
    'Per-Day Salary',
    'Normal Salary',
    'Overtime Amount',
    'Holiday Extra Salary',
    'Unpaid Leave Deductions',
    'Other Deductions',
    'Total Monthly Salary',
    'Final Payable Salary'
  ];

  let csvContent = headers.map(h => `"${h}"`).join(',') + '\r\n';

  payrollStats.forEach(p => {
    const baseSalary = Number(p.baseSalary || 0);
    const dailyRate = Number(p.dailyRate || (baseSalary > 0 ? Math.round(baseSalary / 30) : 0));
    
    const normalPresent = Number(p.normalPresent !== undefined ? p.normalPresent : p.present || 0);
    const govtHolidayWorked = Number(p.govtHolidayWorked || 0);
    const govtHolidayGranted = Number(p.govtHolidayGranted || 0);
    const ownLeaveDays = Number(p.ownLeaveDays || 0);
    const otherAbsent = Number(p.otherAbsent !== undefined ? p.otherAbsent : (p.absent || 0));
    const halfday = Number(p.halfday || 0);
    const paidLeaveDays = Number(p.paidLeaveDays || 0);
    const weeklyOffs = Number(sundaysCount);

    const otHours = Number(p.otHours || (p.otMinutes ? Number((p.otMinutes / 60).toFixed(2)) : 0));
    const otAmount = Number(p.otPay || 0);
    
    const doubleSalaryDays = Number(p.doubleSalaryDays || (govtHolidayWorked + (p.isFullPresentEligible ? 2 : 0)));
    const holidayExtraSalary = Number(p.holidayExtraSalary !== undefined ? p.holidayExtraSalary : (doubleSalaryDays * dailyRate));
    
    const unpaidLeaveDeductions = Number(p.unpaidLeaveDeductions !== undefined ? p.unpaidLeaveDeductions : (ownLeaveDays * dailyRate));
    const otherDeductions = Number(p.otherDeductions !== undefined ? p.otherDeductions : Math.round(otherAbsent * dailyRate + halfday * 0.5 * dailyRate));
    const totalDeductions = unpaidLeaveDeductions + otherDeductions;
    const normalSalary = Number(p.normalSalary !== undefined ? p.normalSalary : Math.max(0, baseSalary - totalDeductions));
    const otherAllowances = Number(p.otherAllowances || 0);

    const totalMonthlySalary = baseSalary + otAmount + holidayExtraSalary + otherAllowances;
    const finalPayableSalary = Math.max(0, normalSalary + holidayExtraSalary + otAmount + otherAllowances);

    const row = [
      `"${p.emp_id || '--'}"`,
      `"${p.name || '--'}"`,
      `"${p.role || p.designation || 'Staff'}"`,
      baseSalary,
      `"${monthName}"`,
      workingDays,
      normalPresent,
      govtHolidayWorked,
      govtHolidayGranted,
      ownLeaveDays,
      otherAbsent,
      halfday,
      paidLeaveDays,
      weeklyOffs,
      otHours,
      doubleSalaryDays,
      dailyRate,
      normalSalary,
      otAmount,
      holidayExtraSalary,
      unpaidLeaveDeductions,
      otherDeductions,
      totalMonthlySalary,
      finalPayableSalary
    ];
    csvContent += row.join(',') + '\r\n';
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const fileNameMonth = monthName.replace(/\s+/g, '_');
  link.download = `Velavan_Monthly_Salary_Report_${fileNameMonth}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
