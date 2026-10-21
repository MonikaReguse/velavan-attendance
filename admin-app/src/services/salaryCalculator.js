/**
 * Unified Official Salary & Attendance Calculation Service
 * Reused across Admin Dashboard, Attendance Reports, Excel Export, PDF Export,
 * Manual Attendance Form, and Employee Portal.
 * 
 * Supports both function signatures:
 * 1) Positional: calculateEmployeeMonthlySalary(employee, attendanceRecords, calendarInfo, settings)
 * 2) Object:     calculateEmployeeMonthlySalary({ employee, attendanceRecords, calendarInfo, settings })
 */

export const calculateEmployeeMonthlySalary = (arg1 = {}, arg2 = [], arg3 = {}, arg4 = {}) => {
  let employee = {};
  let attendanceRecords = [];
  let calendarInfo = {};
  let settings = {};

  if (arg1 && typeof arg1 === 'object' && ('employee' in arg1 || 'attendanceRecords' in arg1)) {
    employee = arg1.employee || {};
    attendanceRecords = arg1.attendanceRecords || [];
    calendarInfo = arg1.calendarInfo || arg1.filters || {};
    settings = arg1.settings || {};
  } else {
    employee = arg1 || {};
    attendanceRecords = Array.isArray(arg2) ? arg2 : [];
    calendarInfo = arg3 || {};
    settings = arg4 || {};
  }

  // Parse basic salary cleanly (handling string or numbers like "₹20,000")
  let rawSalary = employee.salary;
  if (typeof rawSalary === 'string') {
    rawSalary = parseFloat(rawSalary.replace(/[^0-9.]/g, ''));
  }
  const baseSalary = Number(rawSalary || 0);

  // Compute month metrics (working days, Sundays, total days) if not pre-computed
  let daysInMonth = Number(calendarInfo.daysInMonth || 0);
  let sundaysCount = Number(calendarInfo.sundaysCount || 0);
  let scheduledWorkingDays = Number(calendarInfo.workingDays || 0);

  if (!daysInMonth || !scheduledWorkingDays) {
    const monthStr = calendarInfo.selectedMonth || (calendarInfo.startDate ? calendarInfo.startDate.slice(0, 7) : '');
    let year = new Date().getFullYear();
    let monthIdx = new Date().getMonth();
    if (monthStr) {
      try {
        const [y, m] = monthStr.split('-').map(Number);
        year = y;
        monthIdx = m - 1;
      } catch {}
    }
    const totalDays = new Date(year, monthIdx + 1, 0).getDate();
    let sundays = 0;
    for (let day = 1; day <= totalDays; day++) {
      if (new Date(year, monthIdx, day).getDay() === 0) sundays++;
    }
    daysInMonth = totalDays;
    sundaysCount = sundays;
    scheduledWorkingDays = totalDays - sundays;
  }

  // Daily rate on standard 30-day payroll basis
  const payrollBasisDays = Number(settings.payroll_basis_days || 30);
  const dailyRate = baseSalary > 0 ? Math.round(baseSalary / payrollBasisDays) : 0;

  // Shift: 09:30 AM to 06:00 PM = 8.5 hours = 510 working minutes / day
  const shiftHours = Number(settings.shift_hours || 8.5);
  const shiftMinutes = shiftHours * 60; // 510
  const hourlyRate = shiftHours > 0 ? dailyRate / shiftHours : 0;
  const minuteRate = shiftMinutes > 0 ? dailyRate / shiftMinutes : 0;
  const otMultiplier = Number(settings.ot_multiplier || 1.5);
  const otRatePerMin = minuteRate * otMultiplier;

  // Deduplicate attendance records by date so each date is evaluated at most once
  const dateMap = new Map();
  (attendanceRecords || []).forEach(r => {
    if (!r.date) return;
    const existing = dateMap.get(r.date);
    if (!existing) {
      dateMap.set(r.date, r);
    } else {
      const hasOutExisting = existing.clock_out && existing.clock_out !== '--' && existing.clock_out !== '';
      const hasOutR = r.clock_out && r.clock_out !== '--' && r.clock_out !== '';
      const isExistingAbsent = existing.status === 'absent' || existing.holiday_type === 'own_leave';
      const isRAbsent = r.status === 'absent' || r.holiday_type === 'own_leave';

      let base = existing;
      if (isExistingAbsent && !isRAbsent) {
        base = r;
      } else if (!hasOutExisting && hasOutR) {
        base = r;
      }

      dateMap.set(r.date, {
        ...base,
        clock_in: existing.clock_in && existing.clock_in !== '--' ? existing.clock_in : r.clock_in,
        clock_out: hasOutExisting ? existing.clock_out : (hasOutR ? r.clock_out : '--'),
        ot_minutes: Math.max(Number(existing.ot_minutes || 0), Number(r.ot_minutes || 0)),
        total_hours: Math.max(Number(existing.total_hours || 0), Number(r.total_hours || 0))
      });
    }
  });

  const uniqueRecords = Array.from(dateMap.values());

  let normalPresent = 0;
  let govtHolidayWorked = 0;
  let govtHolidayGranted = 0;
  let ownLeaveDays = 0;
  let otherAbsent = 0;
  let halfday = 0;
  let paidLeaveDays = 0;
  let otMinutes = 0;

  uniqueRecords.forEach(r => {
    const isGovtWorked = r.holiday_type === 'govt_holiday_worked';
    const isGovtLeave = r.holiday_type === 'govt_holiday_leave' || r.status === 'holiday';
    const isOwnLeave = r.holiday_type === 'own_leave';

    if (isGovtWorked) {
      govtHolidayWorked += 1;
    } else if (isGovtLeave) {
      govtHolidayGranted += 1;
    } else if (isOwnLeave) {
      ownLeaveDays += 1;
    } else {
      const isOD = r.status === 'od' || r.status === 'login_od' || r.status === 'logout_od' || r.clock_in === 'OD' || r.clock_out === 'OD';
      const isLeave = r.status === 'leave' || r.status === 'paid_leave';

      if (isLeave || isOD) {
        paidLeaveDays += 1;
        normalPresent += 1;
      } else if (r.status === 'present' || r.status === 'checked_in' || r.status === 'late' || r.is_late || (!r.status && r.clock_in && r.clock_in !== '--')) {
        normalPresent += 1;
      } else if (r.status === 'absent') {
        otherAbsent += 1;
      } else if (r.status === 'half_day') {
        halfday += 1;
      }
    }

    if (r.ot_minutes > 0) {
      otMinutes += Number(r.ot_minutes);
    }
  });

  // Totals
  const presentDays = normalPresent + govtHolidayWorked + govtHolidayGranted;
  const absentDays = ownLeaveDays + otherAbsent + (halfday * 0.5);
  const unpaidLeaveDays = ownLeaveDays;

  // Overtime
  const otHours = Number((otMinutes / 60).toFixed(2));
  const otAmount = Math.round(otMinutes * otRatePerMin);

  // Government Holiday Rules:
  // Rule 1: Govt Holiday Worked = 2x daily salary (1x covered in base + 1x extra payout)
  // Rule 2: Govt Holiday Granted = 1x daily salary (covered in base salary, 0 deduction)
  // Rule 3: Employee Own Leave = Unpaid Leave (-1x daily rate deducted)
  const govtHolidaySalary = Math.round(govtHolidayGranted * dailyRate);
  const unpaidLeaveDeduction = Math.round(unpaidLeaveDays * dailyRate);
  const otherDeductions = Math.round(otherAbsent * dailyRate + halfday * 0.5 * dailyRate);
  const totalDeductions = unpaidLeaveDeduction + otherDeductions;

  // Normal salary earned (Base minus deductions)
  const normalSalary = Math.max(0, Math.round(baseSalary - totalDeductions));

  // Full attendance bonus: 0 absences, 0 half-days, and at least 1 day worked
  const isFullPresentEligible = (ownLeaveDays + otherAbsent) === 0 && halfday === 0 && presentDays > 0;
  const fullPresentBonusDays = isFullPresentEligible ? 2 : 0;
  const fullPresentBonus = Math.round(fullPresentBonusDays * dailyRate);

  // Double-Salary Days: Govt Holidays Worked + Full Attendance Bonus days
  const doubleSalaryDays = govtHolidayWorked + fullPresentBonusDays;
  const doubleSalaryExtraAmount = Math.round(govtHolidayWorked * dailyRate) + fullPresentBonus;

  const otherAllowances = Number(employee.allowance || 0);

  // Total Monthly Salary (Gross)
  const totalMonthlySalary = baseSalary + otAmount + doubleSalaryExtraAmount + otherAllowances;

  // Final Payable Salary (Net)
  const finalPayableSalary = Math.max(0, normalSalary + doubleSalaryExtraAmount + otAmount + otherAllowances);

  return {
    emp_id: employee.emp_id || '',
    name: employee.name || employee.emp_id || 'Staff',
    department: employee.department || 'Digital Marketing',
    role: employee.role || employee.designation || 'Staff',
    avatar: employee.avatar,
    baseSalary,
    dailyRate,
    workingDays: scheduledWorkingDays,
    sundaysCount,
    daysInMonth,
    present: presentDays,
    presentDays,
    normalPresent,
    absent: absentDays,
    absentDays,
    otherAbsent,
    paidLeaveDays,
    ownLeaveDays,
    unpaidLeaveDays,
    govtHolidayGranted,
    govtHolidayWorked,
    doubleSalaryDays,
    halfday,
    otMinutes,
    otHours,
    otPay: otAmount,
    otAmount,
    govtHolidaySalary,
    holidayExtraSalary: doubleSalaryExtraAmount,
    doubleSalaryExtraAmount,
    doubleSalaryAmount: doubleSalaryExtraAmount,
    unpaidLeaveDeductions: unpaidLeaveDeduction,
    unpaidLeaveDeduction,
    otherAllowances,
    otherDeductions,
    deductions: totalDeductions,
    totalDeductions,
    normalSalary,
    earnedBase: normalSalary,
    totalMonthlySalary,
    finalPayableSalary,
    netTotalPayout: finalPayableSalary,
    isFullPresentEligible,
    fullPresentBonus,
    uniqueAttendanceRecords: uniqueRecords
  };
};
