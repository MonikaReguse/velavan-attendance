import * as XLSX from 'xlsx';

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
 * Export Comprehensive 20-Column Monthly Attendance & Salary Excel Report (.xlsx)
 * with dedicated Executive Summary Sheet and All-Employee Coverage.
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

  // 2. Prepare 20-Column Data Rows
  const rows = payrollStats.map(p => {
    const baseSalary = Number(p.baseSalary || 0);
    const dailyRate = Number(p.dailyRate || (baseSalary > 0 ? Math.round(baseSalary / 30) : 0));
    const present = Number(p.present || 0);
    const absent = Number(p.absent || 0);
    const halfday = Number(p.halfday || 0);
    const paidLeaveDays = Number(p.paidLeaveDays || 0);
    const weeklyOffs = Number(sundaysCount);
    const otHours = Number(p.otHours || (p.otMinutes ? Number((p.otMinutes / 60).toFixed(2)) : 0));
    const otAmount = Number(p.otPay || 0);
    
    // Double salary policy:
    // 100% full attendance (0 absences) gets +2 days salary bonus
    const doubleSalaryDays = p.isFullPresentEligible ? 2 : (p.doubleSalaryDays || 0);
    const doubleSalaryAmount = Number(p.fullPresentBonus || (doubleSalaryDays * dailyRate));
    
    const otherAllowances = Number(p.otherAllowances || 0);
    const deductions = Number(p.deductions || Math.round(absent * dailyRate + halfday * 0.5 * dailyRate));
    
    // Total Monthly Salary = Basic + OT + Double Salary Extra + Allowances
    const totalMonthlySalary = baseSalary + otAmount + doubleSalaryAmount + otherAllowances;
    
    // Final Payable Salary = Total Monthly Salary - Deductions
    const finalPayableSalary = Math.max(0, totalMonthlySalary - deductions);

    return {
      'Employee ID': p.emp_id || '--',
      'Employee Name': p.name || '--',
      'Designation': p.role || p.designation || 'Staff',
      'Monthly Basic Salary': baseSalary,
      'Selected Month': monthName,
      'Total Working Days': workingDays,
      'Present Days': present,
      'Absent Days': absent,
      'Half Days': halfday,
      'Paid Leave Days': paidLeaveDays,
      'Weekly Offs and Holidays': weeklyOffs,
      'Overtime Hours': otHours,
      'Double-Salary Days': doubleSalaryDays,
      'Per-Day Salary': dailyRate,
      'Overtime Amount': otAmount,
      'Double-Salary Extra Amount': doubleSalaryAmount,
      'Other Allowances': otherAllowances,
      'Deductions': deductions,
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
    'Present Days': rows.reduce((s, r) => s + r['Present Days'], 0),
    'Absent Days': rows.reduce((s, r) => s + r['Absent Days'], 0),
    'Half Days': rows.reduce((s, r) => s + r['Half Days'], 0),
    'Paid Leave Days': rows.reduce((s, r) => s + r['Paid Leave Days'], 0),
    'Weekly Offs and Holidays': rows.reduce((s, r) => s + r['Weekly Offs and Holidays'], 0),
    'Overtime Hours': Number(rows.reduce((s, r) => s + r['Overtime Hours'], 0).toFixed(2)),
    'Double-Salary Days': rows.reduce((s, r) => s + r['Double-Salary Days'], 0),
    'Per-Day Salary': '',
    'Overtime Amount': rows.reduce((s, r) => s + r['Overtime Amount'], 0),
    'Double-Salary Extra Amount': rows.reduce((s, r) => s + r['Double-Salary Extra Amount'], 0),
    'Other Allowances': rows.reduce((s, r) => s + r['Other Allowances'], 0),
    'Deductions': rows.reduce((s, r) => s + r['Deductions'], 0),
    'Total Monthly Salary': rows.reduce((s, r) => s + r['Total Monthly Salary'], 0),
    'Final Payable Salary': rows.reduce((s, r) => s + r['Final Payable Salary'], 0)
  };

  const finalRows = [...rows, totals];

  // 3. Create Workbook & Sheets
  const wb = XLSX.utils.book_new();

  // Sheet 1: Main 20-Column Monthly Attendance & Salary Sheet
  const wsPayroll = XLSX.utils.json_to_sheet(finalRows);

  // Set Column Widths for clean viewing in Excel
  wsPayroll['!cols'] = [
    { wch: 14 }, // Employee ID
    { wch: 24 }, // Employee Name
    { wch: 28 }, // Designation
    { wch: 20 }, // Monthly Basic Salary
    { wch: 16 }, // Selected Month
    { wch: 18 }, // Total Working Days
    { wch: 14 }, // Present Days
    { wch: 14 }, // Absent Days
    { wch: 12 }, // Half Days
    { wch: 16 }, // Paid Leave Days
    { wch: 24 }, // Weekly Offs and Holidays
    { wch: 16 }, // Overtime Hours
    { wch: 18 }, // Double-Salary Days
    { wch: 16 }, // Per-Day Salary
    { wch: 16 }, // Overtime Amount
    { wch: 24 }, // Double-Salary Extra Amount
    { wch: 18 }, // Other Allowances
    { wch: 14 }, // Deductions
    { wch: 20 }, // Total Monthly Salary
    { wch: 20 }  // Final Payable Salary
  ];

  XLSX.utils.book_append_sheet(wb, wsPayroll, 'Monthly Payroll & Attendance');

  // Sheet 2: Executive Summary Sheet
  const totalEmployees = rows.length;
  const totalPresent = totals['Present Days'];
  const totalAbsent = totals['Absent Days'];
  const totalOtHours = totals['Overtime Hours'];
  const totalOtPay = totals['Overtime Amount'];
  const totalDoubleDays = totals['Double-Salary Days'];
  const totalDoublePay = totals['Double-Salary Extra Amount'];
  const totalBasicPayroll = totals['Monthly Basic Salary'];
  const totalDeductions = totals['Deductions'];
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
    { 'METRIC': 'TOTAL SHIFTS / PRESENT DAYS', 'VALUE': totalPresent },
    { 'METRIC': 'TOTAL ABSENT DAYS LOGGED', 'VALUE': totalAbsent },
    { 'METRIC': 'TOTAL OVERTIME HOURS', 'VALUE': `${totalOtHours} hrs` },
    { 'METRIC': 'TOTAL OVERTIME DISBURSED (INR)', 'VALUE': `Rs. ${totalOtPay.toLocaleString('en-IN')}` },
    { 'METRIC': 'FULL ATTENDANCE BONUS QUALIFIED (+2 DAYS)', 'VALUE': `${qualifiedStaffCount} employees` },
    { 'METRIC': 'TOTAL DOUBLE-SALARY / BONUS EXTRA (INR)', 'VALUE': `Rs. ${totalDoublePay.toLocaleString('en-IN')}` },
    { 'METRIC': 'TOTAL BASIC MONTHLY PAYROLL (INR)', 'VALUE': `Rs. ${totalBasicPayroll.toLocaleString('en-IN')}` },
    { 'METRIC': 'TOTAL LOSS OF PAY DEDUCTIONS (INR)', 'VALUE': `Rs. ${totalDeductions.toLocaleString('en-IN')}` },
    { 'METRIC': 'NET FINAL PAYABLE SALARY DISBURSED (INR)', 'VALUE': `Rs. ${totalFinalPayout.toLocaleString('en-IN')}` },
    { 'METRIC': '----------------------------------------', 'VALUE': '----------------------------------------' },
    { 'METRIC': 'OFFICIAL POLICY: SALARY BASIS', 'VALUE': '30-Day Fixed Basis (Per-Day Salary = Monthly Basic / 30)' },
    { 'METRIC': 'OFFICIAL POLICY: OVERTIME RATE', 'VALUE': '1.5x Hourly Rate (Hourly Rate = Daily Rate / 8.5)' },
    { 'METRIC': 'OFFICIAL POLICY: DOUBLE SALARY BONUS', 'VALUE': '100% Full Attendance (0 Absences) = +2 Days Extra Salary Pay' },
    { 'METRIC': 'OFFICIAL POLICY: SHIFT TIMINGS', 'VALUE': '09:30 AM to 06:00 PM (8.5 hrs, 20 mins grace cutoff for late arrivals)' }
  ];

  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  wsSummary['!cols'] = [
    { wch: 42 },
    { wch: 50 }
  ];

  XLSX.utils.book_append_sheet(wb, wsSummary, 'Executive Summary');

  // 4. Download file
  const fileNameMonth = monthName.replace(/\s+/g, '_');
  XLSX.writeFile(wb, `Velavan_Monthly_Salary_Report_${fileNameMonth}.xlsx`);
};

/**
 * Export 20-Column Monthly Attendance & Salary Report as CSV
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
    'Present Days',
    'Absent Days',
    'Half Days',
    'Paid Leave Days',
    'Weekly Offs and Holidays',
    'Overtime Hours',
    'Double-Salary Days',
    'Per-Day Salary',
    'Overtime Amount',
    'Double-Salary Extra Amount',
    'Other Allowances',
    'Deductions',
    'Total Monthly Salary',
    'Final Payable Salary'
  ];

  let csvContent = headers.map(h => `"${h}"`).join(',') + '\r\n';

  payrollStats.forEach(p => {
    const baseSalary = Number(p.baseSalary || 0);
    const dailyRate = Number(p.dailyRate || (baseSalary > 0 ? Math.round(baseSalary / 30) : 0));
    const present = Number(p.present || 0);
    const absent = Number(p.absent || 0);
    const halfday = Number(p.halfday || 0);
    const paidLeaveDays = Number(p.paidLeaveDays || 0);
    const weeklyOffs = Number(sundaysCount);
    const otHours = Number(p.otHours || (p.otMinutes ? Number((p.otMinutes / 60).toFixed(2)) : 0));
    const otAmount = Number(p.otPay || 0);
    
    const doubleSalaryDays = p.isFullPresentEligible ? 2 : (p.doubleSalaryDays || 0);
    const doubleSalaryAmount = Number(p.fullPresentBonus || (doubleSalaryDays * dailyRate));
    
    const otherAllowances = Number(p.otherAllowances || 0);
    const deductions = Number(p.deductions || Math.round(absent * dailyRate + halfday * 0.5 * dailyRate));
    const totalMonthlySalary = baseSalary + otAmount + doubleSalaryAmount + otherAllowances;
    const finalPayableSalary = Math.max(0, totalMonthlySalary - deductions);

    const row = [
      `"${p.emp_id || '--'}"`,
      `"${p.name || '--'}"`,
      `"${p.role || p.designation || 'Staff'}"`,
      baseSalary,
      `"${monthName}"`,
      workingDays,
      present,
      absent,
      halfday,
      paidLeaveDays,
      weeklyOffs,
      otHours,
      doubleSalaryDays,
      dailyRate,
      otAmount,
      doubleSalaryAmount,
      otherAllowances,
      deductions,
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
