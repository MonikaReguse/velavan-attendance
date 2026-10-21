import React, { useState, useEffect, useMemo } from 'react';
import { 
  CalendarCheck, 
  Calendar, 
  Clock, 
  UserCheck, 
  Users, 
  Flame, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  Edit3, 
  Trash2, 
  RefreshCw, 
  ArrowRight, 
  Save, 
  RotateCcw,
  Coffee,
  XCircle,
  Briefcase,
  Search,
  Filter,
  PlusCircle,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  LogIn,
  LogOut
} from 'lucide-react';
import { api } from '../services/api';
import { formatTime, getCurrentTime24, getTodayDateIST } from '../services/timeUtils';
import { getLocalAttendance, mergeAttendanceWithLocal, savePunchLocally, removePunchLocally } from '../services/attendanceStorage';

export default function ManualAttendanceUpdate() {
  const [employees, setEmployees] = useState(() => {
    try {
      const b = localStorage.getItem('velavan_master_database_backup');
      if (b) {
        const p = JSON.parse(b);
        if (Array.isArray(p?.employees) && p.employees.length > 0) return p.employees;
      }
      const e = localStorage.getItem('velavan_employee_directory_list');
      if (e) return JSON.parse(e);
    } catch {}
    return [];
  });
  const [recentLogs, setRecentLogs] = useState(() => {
    return getLocalAttendance().slice(0, 50);
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: '' }

  // Form State
  const [editingId, setEditingId] = useState(null);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => getTodayDateIST());
  const [clockIn, setClockIn] = useState('09:30:00');
  const [clockOut, setClockOut] = useState('18:00:00');
  const [leaveCheckoutPending, setLeaveCheckoutPending] = useState(false); // Morning login only (checkout pending)
  const [status, setStatus] = useState('present');
  const [holidayType, setHolidayType] = useState('normal'); // 'normal' | 'govt_holiday_worked' | 'govt_holiday_leave' | 'own_leave'
  const [customOtMinutes, setCustomOtMinutes] = useState('');
  const [notes, setNotes] = useState('HR manual attendance entry');

  // Search filter for recent logs
  const [filterSearch, setFilterSearch] = useState('');

  useEffect(() => {
    loadData();

    // 1. Auto-refresh recent logs every 10 seconds
    const timer = setInterval(() => {
      loadData();
    }, 10000);

    // 2. Refresh on visibility change
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    const handleRealtimeUpdate = () => {
      loadData();
    };
    window.addEventListener('velavan_attendance_updated', handleRealtimeUpdate);
    window.addEventListener('velavan_employees_updated', handleRealtimeUpdate);
    window.addEventListener('storage', handleRealtimeUpdate);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('velavan_attendance_updated', handleRealtimeUpdate);
      window.removeEventListener('velavan_employees_updated', handleRealtimeUpdate);
      window.removeEventListener('storage', handleRealtimeUpdate);
    };
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [empList, historyList] = await Promise.all([
        api.getEmployees(),
        api.getAttendanceHistory()
      ]);
      const cleanEmpList = empList || [];
      setEmployees(cleanEmpList);
      const cleanHistory = mergeAttendanceWithLocal(historyList || []);
      setRecentLogs(cleanHistory);
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', message: 'Failed to load initial data: ' + err.message });
      setRecentLogs(getLocalAttendance());
    } finally {
      setLoading(false);
    }
  };

  // Set default employee once employees load (only on initial startup)
  useEffect(() => {
    if (employees.length > 0 && !selectedEmpId) {
      setSelectedEmpId(employees[0].emp_id);
    }
  }, [employees]);

  // Find currently selected employee object
  const currentEmployee = useMemo(() => {
    return employees.find(e => e.emp_id === selectedEmpId) || null;
  }, [employees, selectedEmpId]);

  // Set of employee IDs that have attendance marked for selectedDate
  const markedEmpIdsForSelectedDate = useMemo(() => {
    const all = getLocalAttendance();
    const set = new Set();
    all.forEach(a => {
      if (a.date === selectedDate) set.add(a.emp_id);
    });
    recentLogs.forEach(a => {
      if (a.date === selectedDate) set.add(a.emp_id);
    });
    return set;
  }, [selectedDate, recentLogs]);

  // Existing record specifically for the currently selected employee on selectedDate
  const existingRecord = useMemo(() => {
    if (!selectedEmpId || !selectedDate) return null;
    const allAttendance = getLocalAttendance();
    return allAttendance.find(a => a.emp_id === selectedEmpId && a.date === selectedDate)
      || recentLogs.find(a => a.emp_id === selectedEmpId && a.date === selectedDate)
      || null;
  }, [selectedEmpId, selectedDate, recentLogs]);

  // Live Day of the Week & Formatted Date
  const selectedDayInfo = useMemo(() => {
    if (!selectedDate) return { dayName: '', isSunday: false, formattedDate: '' };
    try {
      const [year, month, day] = selectedDate.split('-').map(Number);
      const dateObj = new Date(year, month - 1, day);
      if (isNaN(dateObj.getTime())) return { dayName: '', isSunday: false, formattedDate: '' };
      
      const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
      const formattedDate = dateObj.toLocaleDateString('en-US', { 
        weekday: 'short', 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric' 
      });
      const isSunday = dateObj.getDay() === 0;
      return { dayName, isSunday, formattedDate };
    } catch {
      return { dayName: '', isSunday: false, formattedDate: '' };
    }
  }, [selectedDate]);

  // Helper to format day name for any date string
  const formatDayName = (dateStr) => {
    if (!dateStr) return '';
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      return isNaN(dt.getTime()) ? '' : `(${dt.toLocaleDateString('en-US', { weekday: 'short' })})`;
    } catch {
      return '';
    }
  };

  // Actively query the persistent database whenever selectedDate changes
  useEffect(() => {
    if (!selectedDate) return;
    let isCancelled = false;
    api.getAttendanceHistory({ date: selectedDate })
      .then(dateLogs => {
        if (isCancelled || !Array.isArray(dateLogs)) return;
        mergeAttendanceWithLocal(dateLogs);
        setRecentLogs(prev => {
          const map = new Map(prev.map(p => [`${p.emp_id}_${p.date}`, p]));
          dateLogs.forEach(d => map.set(`${d.emp_id}_${d.date}`, d));
          return Array.from(map.values()).sort((a,b) => b.date.localeCompare(a.date));
        });
      })
      .catch(console.error);
    return () => { isCancelled = true; };
  }, [selectedDate]);

  // Helper to determine if selected employee has morning check-in recorded with checkout pending
  const isExistingCheckoutPending = useMemo(() => {
    if (!existingRecord) return false;
    const hasValidIn = existingRecord.clock_in && existingRecord.clock_in !== '--';
    const noValidOut = !existingRecord.clock_out || existingRecord.clock_out === '--' || existingRecord.clock_out === '';
    const notAbs = existingRecord.status !== 'absent' && existingRecord.status !== 'weekly_off' && existingRecord.holiday_type !== 'own_leave';
    return hasValidIn && noValidOut && notAbs;
  }, [existingRecord]);

  // Reactive form sync: Populate the form inputs with the database record for selected employee & date
  // (Only applies when user is not manually editing another row by ID)
  useEffect(() => {
    if (editingId) return;
    if (!selectedEmpId || !selectedDate) return;

    if (existingRecord) {
      const hasMorningOnly = existingRecord.clock_in && existingRecord.clock_in !== '--' && (!existingRecord.clock_out || existingRecord.clock_out === '--' || existingRecord.clock_out === '') && existingRecord.status !== 'absent' && existingRecord.status !== 'weekly_off' && existingRecord.holiday_type !== 'own_leave';

      setClockIn(existingRecord.clock_in && existingRecord.clock_in !== '--' ? existingRecord.clock_in : '09:30:00');
      
      if (hasMorningOnly) {
        // Morning login already done! In the evening, the admin wants to enter logout time.
        // Default leaveCheckoutPending to false and prefill clockOut with current IST time or 18:00:00.
        setLeaveCheckoutPending(false);
        setClockOut(getCurrentTime24());
        setNotes('Shift completed (Evening checkout recorded)');
      } else {
        setClockOut(existingRecord.clock_out && existingRecord.clock_out !== '--' ? existingRecord.clock_out : '18:00:00');
        setLeaveCheckoutPending(false);
        setNotes(existingRecord.notes || 'HR manual adjustment');
      }

      setStatus(existingRecord.status || 'present');
      setHolidayType(existingRecord.holiday_type || 'normal');
      setCustomOtMinutes((existingRecord.ot_minutes !== undefined && existingRecord.ot_minutes !== null && Number(existingRecord.ot_minutes) > 0) ? String(existingRecord.ot_minutes) : '');
    } else {
      let isSunday = false;
      try {
        const [y, m, d] = selectedDate.split('-').map(Number);
        isSunday = new Date(y, m - 1, d).getDay() === 0;
      } catch {}

      if (isSunday) {
        setClockIn('');
        setClockOut('');
        setLeaveCheckoutPending(false);
        setStatus('weekly_off');
        setHolidayType('normal');
        setCustomOtMinutes('0');
        setNotes('Weekly Off (Paid Sunday Rest)');
      } else {
        setClockIn('09:30:00');
        setClockOut('18:00:00');
        setLeaveCheckoutPending(false);
        setStatus('present');
        setHolidayType('normal');
        setCustomOtMinutes('');
        setNotes('HR manual attendance entry');
      }
    }
  }, [selectedEmpId, selectedDate, existingRecord, editingId]);

  // Handle switching employee in dropdown
  const handleSelectEmployee = (empId) => {
    if (!empId) return;
    setSelectedEmpId(empId);
    setEditingId(null);
    setFeedback(null);
  };

  // Handle switching date - automatically detects day and syncs records
  const handleSelectDate = (newDate) => {
    setSelectedDate(newDate);
    setEditingId(null);
    setFeedback(null);
  };

  // Swift Navigation: Advance to next sequential employee in list
  const goToNextEmployee = () => {
    if (!employees || employees.length === 0) return;
    const currentIdx = employees.findIndex(e => e.emp_id === selectedEmpId);
    const nextIdx = currentIdx === -1 ? 0 : (currentIdx + 1) % employees.length;
    handleSelectEmployee(employees[nextIdx].emp_id);
  };

  // Swift Navigation: Go to previous sequential employee in list
  const goToPrevEmployee = () => {
    if (!employees || employees.length === 0) return;
    const currentIdx = employees.findIndex(e => e.emp_id === selectedEmpId);
    const prevIdx = currentIdx <= 0 ? employees.length - 1 : currentIdx - 1;
    handleSelectEmployee(employees[prevIdx].emp_id);
  };

  // Live Overtime & Hours Calculator
  const calculatedStats = useMemo(() => {
    if (status === 'absent' || status === 'weekly_off' || holidayType === 'own_leave' || (!clockIn && !clockOut) || (clockIn === '--' && clockOut === '--')) {
      return { totalHours: 0, otMinutes: 0, previewStatus: status, isPending: false };
    }

    // Government Holiday (Office Granted Leave) - Paid 1x day
    if (holidayType === 'govt_holiday_leave' || status === 'holiday') {
      const toMins = (t) => {
        if (!t || t === '--' || t === 'OD') return 0;
        const [h, m] = t.split(':').map(Number);
        return (h || 0) * 60 + (m || 0);
      };
      let th = 8.5;
      if (clockIn && clockOut && clockIn !== '--' && clockOut !== '--' && clockIn !== 'OD' && clockOut !== 'OD') {
        const inM = toMins(clockIn);
        const outM = toMins(clockOut);
        let diffM = outM - inM;
        if (diffM < 0) diffM += 24 * 60;
        if (diffM > 0) th = Number((diffM / 60).toFixed(2));
      }
      let ot = 0;
      if (customOtMinutes !== '' && !isNaN(Number(customOtMinutes))) {
        ot = Number(customOtMinutes);
      }
      return { totalHours: th, otMinutes: ot, previewStatus: 'holiday', isPending: false };
    }

    // Partial Attendance: Morning Login Only (Checkout Pending)
    if (leaveCheckoutPending || !clockOut || clockOut === '--' || clockOut === '') {
      const toMins = (t) => {
        if (!t || t === '--' || t === 'OD') return 0;
        const [h, m] = t.split(':').map(Number);
        return (h || 0) * 60 + (m || 0);
      };
      const inM = toMins(clockIn);
      const isLate = inM > 580; // After 09:40 AM
      return { 
        totalHours: 0, 
        otMinutes: 0, 
        previewStatus: isLate ? 'late' : 'checked_in', 
        isPending: true 
      };
    }

    // On Duty (OD) counts as standard full working day (8.5 hrs)
    const isOD = status === 'od' || status === 'login_od' || status === 'logout_od' || clockIn === 'OD' || clockOut === 'OD';
    if (isOD) {
      let ot = 0;
      if (customOtMinutes !== '' && !isNaN(Number(customOtMinutes))) {
        ot = Number(customOtMinutes);
      }
      return { totalHours: 8.5, otMinutes: ot, previewStatus: 'od', isPending: false };
    }

    const toMins = (t) => {
      if (!t || t === '--' || t === 'OD') return 0;
      const [h, m] = t.split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };

    const inM = toMins(clockIn);
    const outM = toMins(clockOut);
    let diffM = outM - inM;
    if (diffM < 0) diffM += 24 * 60;
    const totalHours = Number((diffM / 60).toFixed(2));

    // Dynamic OT rule:
    // Office regular closing: 18:00 (1080m)
    // Base arrival: 09:30 (570m)
    // Buffer: 20m
    const lateMins = Math.max(0, inM - 570);
    const requiredEndM = 1080 + lateMins;
    const thresholdM = requiredEndM + 20;

    let otMinutes = 0;
    if (outM >= thresholdM) {
      otMinutes = Math.max(0, outM - requiredEndM);
    }

    if (customOtMinutes !== '' && !isNaN(Number(customOtMinutes))) {
      otMinutes = Number(customOtMinutes);
    }

    const isLate = inM > 580;
    let previewStatus = status;
    if (status === 'checked_in' || status === 'present' || status === 'late' || status === 'half_day') {
      previewStatus = (totalHours < 4.5 && !isLate) ? 'half_day' : (isLate ? 'late' : 'present');
    }

    return { totalHours, otMinutes, previewStatus, isPending: false };
  }, [clockIn, clockOut, status, holidayType, customOtMinutes, leaveCheckoutPending]);

  // Handle Holiday / Leave Type selection
  const handleHolidayTypeChange = (newType) => {
    setHolidayType(newType);
    if (newType === 'govt_holiday_worked') {
      setStatus('present');
      if (!clockIn || clockIn === '--' || clockIn === 'OD') setClockIn('09:30:00');
      if (!clockOut || clockOut === '--' || clockOut === 'OD') setClockOut('18:00:00');
      setNotes('Government Holiday – Worked in Office (Double Salary Day: 2× Daily Pay)');
    } else if (newType === 'govt_holiday_leave') {
      setStatus('holiday');
      if (!clockIn || clockIn === '--' || clockIn === 'OD') setClockIn('09:30:00');
      if (!clockOut || clockOut === '--' || clockOut === 'OD') setClockOut('18:00:00');
      setLeaveCheckoutPending(false);
      setCustomOtMinutes('0');
      setNotes('Government Holiday – Office Granted Leave (Paid Holiday: 1× Daily Pay)');
    } else if (newType === 'own_leave') {
      setStatus('absent');
      setClockIn('--');
      setClockOut('--');
      setCustomOtMinutes('0');
      setNotes('Employee Own Leave (Unpaid Leave: 1 Day Salary Deducted)');
    } else if (newType === 'normal') {
      if (status === 'absent' && notes.includes('Employee Own Leave')) {
        setStatus('present');
        setClockIn('09:30:00');
        setClockOut('18:00:00');
        setNotes('HR manual attendance entry');
      } else if (status === 'holiday') {
        setStatus('present');
        setClockIn('09:30:00');
        setClockOut('18:00:00');
        setNotes('HR manual attendance entry');
      }
    }
  };

  // Salary Impact & Holiday Calculation Preview
  const salaryImpactInfo = useMemo(() => {
    const baseSalary = Number(currentEmployee?.salary || 0);
    const dailyRate = baseSalary > 0 ? Math.round(baseSalary / 30) : 0;
    
    let multiplier = 1;
    let ruleName = 'Normal Working Day';
    let ruleColor = 'emerald';
    let dayAmount = dailyRate;
    let deductionAmount = 0;
    let extraBonus = 0;
    let explanation = 'Standard single-day salary earned';

    if (holidayType === 'govt_holiday_worked') {
      multiplier = 2;
      ruleName = 'Government Holiday – Worked in Office';
      ruleColor = 'amber';
      extraBonus = dailyRate;
      dayAmount = dailyRate * 2;
      explanation = 'Double Salary: 2 × Normal Daily Salary (1× Base Pay + 1× Extra Holiday Bonus)';
    } else if (holidayType === 'govt_holiday_leave' || status === 'holiday') {
      multiplier = 1;
      ruleName = 'Government Holiday – Office Granted Leave';
      ruleColor = 'blue';
      dayAmount = dailyRate;
      deductionAmount = 0;
      explanation = 'Paid Government Holiday: 1 × Normal Daily Salary (Paid by Office, No Deduction)';
    } else if (holidayType === 'own_leave') {
      multiplier = 0;
      ruleName = 'Employee Own Leave (Unpaid)';
      ruleColor = 'rose';
      deductionAmount = dailyRate;
      dayAmount = 0;
      explanation = 'Unpaid Leave: 1 Day Salary Deducted from Monthly Payout (-1× Daily Rate)';
    } else if (status === 'absent') {
      multiplier = 0;
      ruleName = 'Absent (Loss of Pay)';
      ruleColor = 'rose';
      deductionAmount = dailyRate;
      dayAmount = 0;
      explanation = 'Absent: 1 Day Salary Deducted (Loss of Pay)';
    } else if (status === 'half_day') {
      multiplier = 0.5;
      ruleName = 'Half Day (0.5× Pay)';
      ruleColor = 'sky';
      deductionAmount = Math.round(dailyRate * 0.5);
      dayAmount = Math.round(dailyRate * 0.5);
      explanation = 'Half-Day: 0.5 Day Salary Deducted';
    }

    return {
      baseSalary,
      dailyRate,
      multiplier,
      ruleName,
      ruleColor,
      dayAmount,
      deductionAmount,
      extraBonus,
      explanation
    };
  }, [currentEmployee, holidayType, status]);

  // Quick Preset Handlers
  const applyPreset = (presetName) => {
    if (presetName === 'morning_login') {
      setHolidayType('normal');
      setClockIn('09:30:00');
      setClockOut('');
      setLeaveCheckoutPending(true);
      setStatus('checked_in');
      setCustomOtMinutes('0');
      setNotes('Morning check-in (Checkout Pending)');
    } else if (presetName === 'evening_logout') {
      setHolidayType('normal');
      setLeaveCheckoutPending(false);
      if (!clockIn || clockIn === '--') setClockIn('09:30:00');
      setClockOut(getCurrentTime24());
      setStatus('present');
      setNotes('Shift completed (Evening checkout recorded)');
    } else if (presetName === 'on_time') {
      setHolidayType('normal');
      setClockIn('09:30:00');
      setClockOut('18:00:00');
      setLeaveCheckoutPending(false);
      setStatus('present');
      setCustomOtMinutes('');
      setNotes('Full Day (On-Time 09:30 AM – 06:00 PM)');
    } else if (presetName === 'govt_holiday_worked') {
      setHolidayType('govt_holiday_worked');
      setStatus('present');
      setClockIn('09:30:00');
      setClockOut('18:00:00');
      setLeaveCheckoutPending(false);
      setCustomOtMinutes('');
      setNotes('Government Holiday – Worked in Office (Double Salary Day: 2× Daily Pay)');
    } else if (presetName === 'govt_holiday_leave') {
      setHolidayType('govt_holiday_leave');
      setStatus('holiday');
      if (!clockIn || clockIn === '--' || clockIn === 'OD') setClockIn('09:30:00');
      if (!clockOut || clockOut === '--' || clockOut === 'OD') setClockOut('18:00:00');
      setLeaveCheckoutPending(false);
      setCustomOtMinutes('0');
      setNotes('Government Holiday – Office Granted Leave (Paid Holiday: 1× Daily Pay)');
    } else if (presetName === 'own_leave') {
      setHolidayType('own_leave');
      setStatus('absent');
      setClockIn('--');
      setClockOut('--');
      setLeaveCheckoutPending(false);
      setCustomOtMinutes('0');
      setNotes('Employee Own Leave (Unpaid Leave: 1 Day Salary Deducted)');
    } else if (presetName === 'od_full') {
      setHolidayType('normal');
      setClockIn('OD');
      setClockOut('OD');
      setLeaveCheckoutPending(false);
      setStatus('od');
      setCustomOtMinutes('0');
      setNotes('Full Day OD (On Duty - Official Client / Site Visit)');
    } else if (presetName === 'od_login') {
      setHolidayType('normal');
      setClockIn('OD');
      setClockOut('18:00:00');
      setLeaveCheckoutPending(false);
      setStatus('login_od');
      setCustomOtMinutes('');
      setNotes('Morning OD (Login On Duty - Client / Field Work)');
    } else if (presetName === 'od_logout') {
      setHolidayType('normal');
      setClockIn('09:30:00');
      setClockOut('OD');
      setLeaveCheckoutPending(false);
      setStatus('logout_od');
      setCustomOtMinutes('');
      setNotes('Evening OD (Logout On Duty - Client / Site Visit)');
    } else if (presetName === 'ot_20') {
      setHolidayType('normal');
      setClockIn('09:30:00');
      setClockOut('18:20:00');
      setLeaveCheckoutPending(false);
      setStatus('present');
      setCustomOtMinutes('20');
      setNotes('Regular Shift + 20 mins Overtime (Exit 06:20 PM)');
    } else if (presetName === 'ot_30') {
      setHolidayType('normal');
      setClockIn('09:30:00');
      setClockOut('18:30:00');
      setLeaveCheckoutPending(false);
      setStatus('present');
      setCustomOtMinutes('30');
      setNotes('Regular Shift + 30 mins Overtime (Exit 06:30 PM)');
    } else if (presetName === 'half_day') {
      setHolidayType('normal');
      setClockIn('09:30:00');
      setClockOut('14:00:00');
      setLeaveCheckoutPending(false);
      setStatus('half_day');
      setCustomOtMinutes('0');
      setNotes('Half-Day attendance approved by management');
    } else if (presetName === 'absent') {
      setHolidayType('normal');
      setClockIn('');
      setClockOut('');
      setLeaveCheckoutPending(false);
      setStatus('absent');
      setCustomOtMinutes('0');
      setNotes('Leave / Absent (Loss of Pay)');
    } else if (presetName === 'weekly_off') {
      setHolidayType('normal');
      setClockIn('');
      setClockOut('');
      setLeaveCheckoutPending(false);
      setStatus('weekly_off');
      setCustomOtMinutes('0');
      setNotes('Weekly Off (Paid Sunday Rest)');
    }
  };

  // Explicitly enter Edit Mode for a specific record
  const handleEditRecord = (record) => {
    if (!record) return;
    setEditingId(record.id);
    setSelectedEmpId(record.emp_id);
    setSelectedDate(record.date);
    setClockIn((record.clock_in && record.clock_in !== '--') ? record.clock_in : '09:30:00');

    const isPending = (!record.clock_out || record.clock_out === '--' || record.clock_out === '') && record.status !== 'absent' && record.status !== 'weekly_off' && record.holiday_type !== 'own_leave';

    if (isPending) {
      setLeaveCheckoutPending(false);
      setClockOut(getCurrentTime24());
      setNotes('Shift completed (Evening checkout recorded)');
      setFeedback({
        type: 'success',
        message: `☀️ Loaded morning check-in (${formatTime(record.clock_in)}) for ${record.employee_name || record.emp_id}. Enter evening logout time and click Save.`
      });
    } else {
      setClockOut((record.clock_out && record.clock_out !== '--') ? record.clock_out : '18:00:00');
      setLeaveCheckoutPending(false);
      setNotes(record.notes || 'HR manual adjustment');
      setFeedback({
        type: 'success',
        message: `Loaded record #${record.id} for ${record.employee_name || record.emp_id}. Make changes and click Update.`
      });
    }

    setStatus(record.status || 'present');
    setHolidayType(record.holiday_type || 'normal');
    setCustomOtMinutes((record.ot_minutes !== undefined && record.ot_minutes !== null && Number(record.ot_minutes) > 0) ? String(record.ot_minutes) : '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Dedicated 1-click handler to log evening logout from the recent logs list
  const handleEnterLogout = (record) => {
    if (!record) return;
    setEditingId(record.id);
    setSelectedEmpId(record.emp_id);
    setSelectedDate(record.date);
    setClockIn((record.clock_in && record.clock_in !== '--') ? record.clock_in : '09:30:00');
    setClockOut(getCurrentTime24());
    setLeaveCheckoutPending(false);
    setStatus(record.status || 'present');
    setHolidayType(record.holiday_type || 'normal');
    setNotes('Shift completed (Evening checkout recorded)');
    setFeedback({
      type: 'success',
      message: `☀️ Morning check-in (${formatTime(record.clock_in)}) loaded for ${record.employee_name || record.emp_id}. Evening logout set to ${formatTime(getCurrentTime24())}. Review and click Save!`
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Reset form to blank new entry mode
  const handleResetForm = () => {
    setEditingId(null);
    setClockIn('09:30:00');
    setClockOut('18:00:00');
    setLeaveCheckoutPending(false);
    setStatus('present');
    setHolidayType('normal');
    setCustomOtMinutes('');
    setNotes('HR manual attendance entry');
    setFeedback({
      type: 'success',
      message: 'Ready for new attendance entry.'
    });

    // Auto-select first unmarked employee if available
    const all = getLocalAttendance();
    const unmarked = employees.find(e => !all.some(a => a.emp_id === e.emp_id && a.date === selectedDate));
    if (unmarked) {
      setSelectedEmpId(unmarked.emp_id);
    }
  };

  // Submit Form
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEmpId) {
      setFeedback({ type: 'error', message: 'Please select an employee' });
      return;
    }
    if (!selectedDate) {
      setFeedback({ type: 'error', message: 'Please select an attendance date' });
      return;
    }

    // MANDATORY REASON VALIDATION FOR ON DUTY (OD):
    const isODActive = status === 'od' || status === 'login_od' || status === 'logout_od' || clockIn === 'OD' || clockOut === 'OD';
    const trimmedNotes = (notes || '').trim();
    if (isODActive && (!trimmedNotes || trimmedNotes === 'HR manual attendance entry' || trimmedNotes === 'HR manual adjustment')) {
      setFeedback({
        type: 'error',
        message: '⚠️ Please enter or select a specific reason for On Duty (OD) before saving (e.g. Client Site Visit, Registrar Office, Meeting).'
      });
      return;
    }

    try {
      setSaving(true);
      setFeedback(null);

      // SAFETY: Only pass id if editingId matches selectedEmpId & selectedDate, or if existingRecord exists for this date
      let targetId = undefined;
      if (editingId) {
        const match = recentLogs.find(l => l.id === editingId && l.emp_id === selectedEmpId && l.date === selectedDate)
          || getLocalAttendance().find(l => l.id === editingId && l.emp_id === selectedEmpId && l.date === selectedDate);
        if (match) {
          targetId = editingId;
        }
      } else if (existingRecord) {
        targetId = existingRecord.id;
      }

      // Auto-harmonize status with holiday_type and checkout state
      let finalStatus = status;
      if (holidayType === 'own_leave') {
        finalStatus = 'absent';
      } else if (holidayType === 'govt_holiday_worked' && status === 'absent') {
        finalStatus = 'present';
      } else if (holidayType === 'govt_holiday_leave' || status === 'holiday') {
        finalStatus = 'holiday';
      }

      const isCheckoutPendingNow = (leaveCheckoutPending || !clockOut || clockOut === '--' || clockOut === '') && (finalStatus !== 'absent' && finalStatus !== 'weekly_off' && holidayType !== 'own_leave' && holidayType !== 'govt_holiday_leave' && finalStatus !== 'holiday');

      const payload = {
        id: targetId,
        emp_id: selectedEmpId,
        date: selectedDate,
        clock_in: (finalStatus === 'absent' || finalStatus === 'weekly_off' || holidayType === 'own_leave') ? '--' : (clockIn || '--'),
        clock_out: (finalStatus === 'absent' || finalStatus === 'weekly_off' || holidayType === 'own_leave' || isCheckoutPendingNow) ? '--' : (clockOut || '--'),
        status: isCheckoutPendingNow ? (calculatedStats.previewStatus === 'late' ? 'late' : 'checked_in') : finalStatus,
        holiday_type: holidayType,
        notes: trimmedNotes || (isODActive ? 'Client Site Visit' : (isCheckoutPendingNow ? 'Morning check-in (Checkout Pending)' : (isExistingCheckoutPending ? 'Shift completed (Evening checkout recorded)' : (finalStatus === 'holiday' ? 'Government Holiday – Office Granted Leave (Paid Holiday: 1× Daily Pay)' : 'HR manual attendance entry')))),
        ot_minutes: isCheckoutPendingNow ? 0 : (customOtMinutes !== '' ? Number(customOtMinutes) : calculatedStats.otMinutes),
        mode: isCheckoutPendingNow ? 'morning_login' : (isExistingCheckoutPending ? 'evening_logout' : 'full'),
        leave_checkout_pending: isCheckoutPendingNow
      };

      const res = await api.recordManualAttendance(payload);

      if (res.success) {
        const finalId = res.id || targetId || undefined;
        const savedPunch = {
          ...payload,
          id: finalId,
          employee_name: currentEmployee?.name || selectedEmpId,
          department: currentEmployee?.department,
          designation: currentEmployee?.role || currentEmployee?.designation,
          punch_photo: res.attendance?.punch_photo || existingRecord?.punch_photo || undefined,
          method: res.attendance?.method || existingRecord?.method || 'manual',
          total_hours: isCheckoutPendingNow ? 0 : calculatedStats.totalHours,
          ot_hours: (isCheckoutPendingNow || calculatedStats.otMinutes <= 0) ? 0 : Number((calculatedStats.otMinutes / 60).toFixed(2)),
          ot_minutes: isCheckoutPendingNow ? 0 : calculatedStats.otMinutes,
          holiday_type: holidayType,
          status: payload.status
        };
        savePunchLocally(savedPunch);

        const empName = currentEmployee?.name || selectedEmpId;
        const wasEditing = !!editingId;

        // CRITICAL FIX: Always reset editingId to null! Never trap the user in edit mode!
        setEditingId(null);

        let successMsg = wasEditing
          ? `Attendance successfully updated for ${empName} on ${selectedDate}!`
          : `Attendance successfully recorded for ${empName} on ${selectedDate}!`;

        if (isCheckoutPendingNow) {
          successMsg = `☀️ Morning check-in recorded for ${empName} on ${selectedDate} at ${formatTime(payload.clock_in)}. (Checkout Pending)`;
        } else if (isExistingCheckoutPending) {
          successMsg = `🌙 Evening check-out recorded for ${empName} on ${selectedDate} at ${formatTime(payload.clock_out)}. Shift completed (${calculatedStats.totalHours} hrs)!`;
        }

        setFeedback({
          type: 'success',
          message: successMsg
        });

        // Refresh recent logs from database
        const updatedLogs = await api.getAttendanceHistory();
        const merged = mergeAttendanceWithLocal(updatedLogs || [savedPunch]);
        setRecentLogs(merged);

        // Intentionally keep user on currently saved employee with clear success confirmation!
        // User can click "Next Employee ▶" whenever they wish to advance.
      } else {
        let msg = res.error || 'Failed to save attendance';
        if (msg.includes('FOREIGN KEY')) {
          msg = 'Employee record was refreshed in database. Please click "Save Attendance Record" again.';
          loadData();
        }
        setFeedback({ 
          type: 'error', 
          message: `❌ ${msg}. Existing attendance records remain completely safe and untouched.` 
        });
      }
    } catch (err) {
      let friendlyMsg = err.message || 'Error communicating with attendance server';
      if (friendlyMsg.includes('Failed to fetch') || friendlyMsg.includes('NetworkError')) {
        friendlyMsg = 'Cloud server was warming up from idle mode. Please click "Save / Update Attendance Record" again — your entered data is completely safe.';
      }
      setFeedback({ 
        type: 'error', 
        message: `❌ ${friendlyMsg}` 
      });
    } finally {
      setSaving(false);
    }
  };

  // Delete attendance record
  const handleDelete = async (id, empName, recordDate, emp_id) => {
    if (!confirm(`Are you sure you want to delete attendance record for ${empName} on ${recordDate}?`)) return;
    try {
      removePunchLocally(id, emp_id, recordDate);
      setRecentLogs(prev => prev.filter(l => !( (id && String(l.id) === String(id)) || (emp_id && recordDate && l.emp_id === emp_id && l.date === recordDate) )));
      await api.deleteAttendance(id, emp_id, recordDate).catch(console.error);
      setFeedback({ type: 'success', message: 'Attendance record deleted successfully' });
      const updatedLogs = await api.getAttendanceHistory();
      const merged = mergeAttendanceWithLocal(updatedLogs || []);
      setRecentLogs(merged);
      if (editingId === id) {
        setEditingId(null);
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Error deleting record: ' + err.message });
    }
  };

  // Filtered recent logs
  const filteredLogs = useMemo(() => {
    if (!filterSearch.trim()) return recentLogs;
    const q = filterSearch.toLowerCase();
    return recentLogs.filter(l => 
      (l.employee_name && l.employee_name.toLowerCase().includes(q)) ||
      (l.emp_id && l.emp_id.toLowerCase().includes(q)) ||
      (l.date && l.date.includes(q)) ||
      (l.status && l.status.toLowerCase().includes(q))
    );
  }, [recentLogs, filterSearch]);

  const isCurrentMarked = markedEmpIdsForSelectedDate.has(selectedEmpId);
  const isOD = status === 'od' || status === 'login_od' || status === 'logout_od' || clockIn === 'OD' || clockOut === 'OD';

  return (
    <div className="space-y-6 animate-in fade-in pb-12">
      {/* Top Header Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-[#8b0000] flex items-center justify-center border border-red-200 shrink-0 shadow-xs">
            <CalendarCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#8b0000] bg-red-50 px-2 py-0.5 rounded border border-red-200">
                Velavan Properties Attendance App
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-[11px] font-semibold text-slate-500">HR Management Control</span>
            </div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight mt-0.5">
              Manual Attendance Update & Entry
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Mark daily attendance for staff or adjust existing timings, overtime, and leave records.
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center space-x-2">
          {editingId ? (
            <div className="flex items-center space-x-2 bg-amber-50 border border-amber-200 px-3.5 py-2 rounded-xl text-xs text-amber-900 font-medium">
              <Edit3 className="w-4 h-4 text-amber-700" />
              <span>Editing Record <strong>#{editingId}</strong></span>
              <button
                type="button"
                onClick={handleResetForm}
                className="ml-2 text-xs font-bold text-red-700 hover:underline bg-white px-2 py-0.5 rounded border border-amber-300"
              >
                ✕ Cancel Edit
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleResetForm}
              className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-colors flex items-center space-x-1.5 shadow-xs"
            >
              <PlusCircle className="w-4 h-4 text-emerald-600" />
              <span>+ New Blank Entry</span>
            </button>
          )}

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
            title="Refresh database records"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#8b0000]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div className={`p-4 rounded-2xl text-xs flex items-center space-x-2.5 border shadow-xs animate-in fade-in ${
          feedback.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
            : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span className="font-semibold text-sm">{feedback.message}</span>
        </div>
      )}

      {/* Main Grid: Left Entry Form & Right Recent Audit Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ========================================================== */}
        {/* LEFT COLUMN: THE MANUAL ATTENDANCE FORM (7 cols)           */}
        {/* ========================================================== */}
        <div className="lg:col-span-7">
          <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-[#8b0000]" />
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                  {(editingId || existingRecord) ? `Edit Attendance Record #${editingId || existingRecord.id}` : 'Mark Attendance (New Record)'}
                </h3>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  (editingId || existingRecord) ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'
                }`}>
                  {(editingId || existingRecord) ? `Edit Mode: Record #${editingId || existingRecord.id}` : 'New Entry Mode'}
                </span>
              </div>
            </div>

            {/* 1. Employee Selector & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Select Employee <span className="text-red-600">*</span>
                  </label>
                  {/* Quick Prev / Next navigation buttons */}
                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={goToPrevEmployee}
                      className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                      title="Previous Employee"
                    >
                      ◀ Prev
                    </button>
                    <button
                      type="button"
                      onClick={goToNextEmployee}
                      className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                      title="Next Employee"
                    >
                      Next ▶
                    </button>
                  </div>
                </div>

                <select
                  value={selectedEmpId}
                  onChange={(e) => handleSelectEmployee(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-semibold focus:outline-none focus:border-[#8b0000] focus:ring-2 focus:ring-red-100"
                  required
                >
                  {employees.map(emp => {
                    const isMarked = markedEmpIdsForSelectedDate.has(emp.emp_id);
                    return (
                      <option key={emp.emp_id} value={emp.emp_id}>
                        {isMarked ? '✓ ' : '○ '} {emp.name} ({emp.emp_id}) • {emp.role || emp.department} {isMarked ? '(Marked)' : '(Not Marked)'}
                      </option>
                    );
                  })}
                </select>

                {currentEmployee && (
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Role: <strong>{currentEmployee.role || currentEmployee.designation || 'Staff'}</strong> • Dept: <strong>{currentEmployee.department}</strong>
                  </span>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Attendance Date <span className="text-red-600">*</span>
                  </label>
                  {selectedDayInfo.dayName && (
                    <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-lg font-bold text-[11px] ${
                      selectedDayInfo.isSunday
                        ? 'bg-purple-100 text-purple-900 border border-purple-300'
                        : 'bg-red-50 text-[#8b0000] border border-red-200'
                    }`}>
                      <Calendar className="w-3 h-3 text-[#8b0000]" />
                      <span>{selectedDayInfo.dayName}</span>
                      {selectedDayInfo.isSunday && <span className="ml-1 text-[9px] bg-purple-200 text-purple-900 px-1 rounded font-black">Weekly Off</span>}
                    </span>
                  )}
                </div>

                <div className="relative">
                  <input
                    type="date"
                    required
                    value={selectedDate}
                    onChange={(e) => handleSelectDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-mono font-semibold focus:outline-none focus:border-[#8b0000] focus:ring-2 focus:ring-red-100"
                  />
                </div>

                {selectedDayInfo.dayName && (
                  <div className="flex items-center justify-between mt-1 text-[11px]">
                    <span className="font-semibold text-slate-600 flex items-center space-x-1">
                      <span>Day:</span>
                      <strong className={`font-black ${selectedDayInfo.isSunday ? 'text-purple-700' : 'text-[#8b0000]'}`}>
                        {selectedDayInfo.dayName}
                      </strong>
                      <span className="text-slate-400 font-normal">({selectedDayInfo.formattedDate})</span>
                    </span>
                    {selectedDayInfo.isSunday ? (
                      <span className="text-purple-700 font-bold text-[10px] bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                        Paid Weekly Off
                      </span>
                    ) : (
                      <span className="text-emerald-700 font-semibold text-[10px] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        Working Day
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Attendance Status Context Banner for currently selected employee */}
            {isExistingCheckoutPending ? (
              <div className="p-3.5 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950 shadow-xs">
                <div className="flex items-start space-x-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0 text-amber-800">
                    <Sun className="w-4 h-4 text-amber-700" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-1.5 flex-wrap">
                      <span className="font-black text-amber-900 text-sm">Morning Check-In Recorded:</span>
                      <span className="font-mono font-bold bg-amber-200/80 text-amber-950 px-2 py-0.5 rounded text-xs border border-amber-300">
                        {formatTime(existingRecord?.clock_in)}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-orange-100 text-orange-900 border border-orange-300 animate-pulse">
                        ⏳ Checkout Pending
                      </span>
                      {existingRecord?.method === 'facelock' && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded border border-emerald-300">
                          👤 Verified via FaceLock
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      Ready to log evening departure. Enter check-out time below to update this record and complete today's shift.
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setLeaveCheckoutPending(false);
                      setClockOut(getCurrentTime24());
                    }}
                    className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[11px] flex items-center space-x-1 transition-all shadow-xs"
                  >
                    <Moon className="w-3.5 h-3.5" />
                    <span>Set Logout to Now</span>
                  </button>
                </div>
              </div>
            ) : isCurrentMarked ? (
              editingId ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-900">
                  <div className="flex items-center space-x-2">
                    <Edit3 className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>
                      Modifying <strong>Record #{editingId}</strong> for <strong>{currentEmployee?.name}</strong> on {selectedDate} ({selectedDayInfo.dayName}).
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetForm}
                    className="px-2.5 py-1 bg-white hover:bg-amber-100 border border-amber-300 rounded-lg text-amber-800 font-bold transition-colors text-[11px]"
                  >
                    Cancel & New Entry
                  </button>
                </div>
              ) : (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-blue-900">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>
                      Attendance already recorded for <strong>{currentEmployee?.name}</strong> on {selectedDate} ({selectedDayInfo.dayName}) ({existingRecord?.status?.toUpperCase()} • {existingRecord?.clock_in || '--'} to {existingRecord?.clock_out || '--'}).
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => handleEditRecord(existingRecord)}
                      className="px-2.5 py-1 bg-white hover:bg-blue-100 border border-blue-300 text-blue-800 rounded-lg font-bold text-[11px] flex items-center space-x-1 transition-colors"
                    >
                      <Edit3 className="w-3 h-3 text-blue-700" />
                      <span>Edit This Record</span>
                    </button>
                    <button
                      type="button"
                      onClick={goToNextEmployee}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-[11px] flex items-center space-x-1 transition-colors"
                    >
                      <span>Next Employee</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )
            ) : (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center space-x-2 text-xs text-emerald-800 font-medium">
                <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  No record yet for <strong>{currentEmployee?.name}</strong> on {selectedDate} ({selectedDayInfo.dayName}). Standard timings pre-filled.
                </span>
              </div>
            )}

            {/* 2. 1-Click Quick Shift Presets */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                ⚡ 1-Click Quick Presets (Click to Auto-Fill Timings & Holiday Rules)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {/* 1. Morning Check-In Only (Checkout Pending) */}
                <button
                  type="button"
                  onClick={() => applyPreset('morning_login')}
                  className="p-2 text-left bg-amber-50 hover:bg-amber-100 border-2 border-amber-300 rounded-xl transition-all shadow-2xs hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span className="text-[11px] font-black text-amber-950 block flex items-center space-x-1">
                    <Sun className="w-3.5 h-3.5 text-amber-600" />
                    <span>☀️ Morning Login</span>
                  </span>
                  <span className="text-[10px] text-amber-800 font-mono">09:30 AM → ⏳ Pending</span>
                </button>

                {/* 2. Evening Check-Out (Complete Shift) */}
                <button
                  type="button"
                  onClick={() => applyPreset('evening_logout')}
                  className="p-2 text-left bg-orange-50 hover:bg-orange-100 border-2 border-orange-300 rounded-xl transition-all shadow-2xs hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span className="text-[11px] font-black text-orange-950 block flex items-center space-x-1">
                    <Moon className="w-3.5 h-3.5 text-orange-600" />
                    <span>🌙 Evening Logout</span>
                  </span>
                  <span className="text-[10px] text-orange-800 font-mono">Complete Shift</span>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset('on_time')}
                  className="p-2 text-left bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors"
                >
                  <span className="text-[11px] font-bold text-emerald-800 block">Full Day (On-Time)</span>
                  <span className="text-[10px] text-emerald-600 font-mono">09:30 AM – 06:00 PM</span>
                </button>

                {/* Government Holiday – Worked in Office (Double Salary) */}
                <button
                  type="button"
                  onClick={() => applyPreset('govt_holiday_worked')}
                  className="p-2 text-left bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-xl transition-colors shadow-2xs"
                >
                  <span className="text-[11px] font-bold text-amber-900 block flex items-center space-x-1">
                    <span>Govt Holiday (Worked)</span>
                    <span className="text-[9px] bg-amber-200 text-amber-900 px-1 rounded font-black">2× Pay</span>
                  </span>
                  <span className="text-[10px] text-amber-700 font-mono">Double Salary Day</span>
                </button>

                {/* Government Holiday – Office Granted Leave */}
                <button
                  type="button"
                  onClick={() => applyPreset('govt_holiday_leave')}
                  className="p-2 text-left bg-blue-50 hover:bg-blue-100 border border-blue-300 rounded-xl transition-colors shadow-2xs"
                >
                  <span className="text-[11px] font-bold text-blue-900 block flex items-center space-x-1">
                    <span>Govt Holiday (Granted)</span>
                    <span className="text-[9px] bg-blue-200 text-blue-900 px-1 rounded font-black">1× Paid</span>
                  </span>
                  <span className="text-[10px] text-blue-700 font-mono">Office Granted Leave</span>
                </button>

                {/* Employee Own Leave (Unpaid) */}
                <button
                  type="button"
                  onClick={() => applyPreset('own_leave')}
                  className="p-2 text-left bg-rose-50 hover:bg-rose-100 border border-rose-300 rounded-xl transition-colors shadow-2xs"
                >
                  <span className="text-[11px] font-bold text-rose-900 block flex items-center space-x-1">
                    <span>Employee Own Leave</span>
                    <span className="text-[9px] bg-rose-200 text-rose-900 px-1 rounded font-black">Unpaid</span>
                  </span>
                  <span className="text-[10px] text-rose-700 font-mono">-1 Day Salary Deducted</span>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset('od_full')}
                  className="p-2 text-left bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-colors"
                >
                  <span className="text-[11px] font-bold text-indigo-900 block flex items-center space-x-1">
                    <span>Full Day OD</span>
                    <span className="text-[9px] bg-indigo-200 text-indigo-800 px-1 rounded">On Duty</span>
                  </span>
                  <span className="text-[10px] text-indigo-700 font-mono">Login & Logout OD</span>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset('od_login')}
                  className="p-2 text-left bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-xl transition-colors"
                >
                  <span className="text-[11px] font-bold text-sky-900 block flex items-center space-x-1">
                    <span>Login OD</span>
                    <span className="text-[9px] bg-sky-200 text-sky-800 px-1 rounded">Morning</span>
                  </span>
                  <span className="text-[10px] text-sky-700 font-mono">OD → Exit 06:00 PM</span>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset('od_logout')}
                  className="p-2 text-left bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-xl transition-colors"
                >
                  <span className="text-[11px] font-bold text-violet-900 block flex items-center space-x-1">
                    <span>Logout OD</span>
                    <span className="text-[9px] bg-violet-200 text-violet-800 px-1 rounded">Evening</span>
                  </span>
                  <span className="text-[10px] text-violet-700 font-mono">09:30 AM → Exit OD</span>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset('ot_20')}
                  className="p-2 text-left bg-amber-50/70 hover:bg-amber-100 border border-amber-200 rounded-xl transition-colors"
                >
                  <span className="text-[11px] font-bold text-amber-900 block">+20 mins OT</span>
                  <span className="text-[10px] text-amber-700 font-mono">09:30 AM – 06:20 PM</span>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset('ot_30')}
                  className="p-2 text-left bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors"
                >
                  <span className="text-[11px] font-bold text-red-900 block">+30 mins OT</span>
                  <span className="text-[10px] text-[#8b0000] font-mono">09:30 AM – 06:30 PM</span>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset('half_day')}
                  className="p-2 text-left bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors"
                >
                  <span className="text-[11px] font-bold text-blue-900 block">Half Day (0.5)</span>
                  <span className="text-[10px] text-blue-700 font-mono">09:30 AM – 02:00 PM</span>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset('absent')}
                  className="p-2 text-left bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors"
                >
                  <span className="text-[11px] font-bold text-rose-900 block">Mark Absent</span>
                  <span className="text-[10px] text-rose-700 font-mono">Loss of Pay (LOP)</span>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset('weekly_off')}
                  className="p-2 text-left bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl transition-colors"
                >
                  <span className="text-[11px] font-bold text-purple-900 block">Weekly Off</span>
                  <span className="text-[10px] text-purple-700 font-mono">Paid Sunday</span>
                </button>
              </div>
            </div>

            {/* 3. Holiday / Leave Type, Status, Clock In, Clock Out */}
            <div className="space-y-3">
              {/* Row A: Status & Holiday / Leave Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Holiday / Leave Type Dropdown */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      <span>Holiday / Leave Type</span>
                    </label>
                    <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded ${
                      holidayType === 'govt_holiday_worked' ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                      holidayType === 'govt_holiday_leave' ? 'bg-blue-100 text-blue-900 border border-blue-300' :
                      holidayType === 'own_leave' ? 'bg-rose-100 text-rose-900 border border-rose-300' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {holidayType === 'govt_holiday_worked' ? '2× Double Pay' :
                       holidayType === 'govt_holiday_leave' ? '1× Paid Holiday' :
                       holidayType === 'own_leave' ? 'Unpaid (-1 Day)' : 'Normal'}
                    </span>
                  </div>

                  <select
                    value={holidayType}
                    onChange={(e) => handleHolidayTypeChange(e.target.value)}
                    className="w-full px-3 py-2 bg-white border-2 border-slate-200 rounded-xl text-slate-900 text-xs font-bold focus:outline-none focus:border-[#8b0000]"
                  >
                    <option value="normal">Normal Working Day</option>
                    <option value="govt_holiday_worked">Government Holiday – Worked in Office</option>
                    <option value="govt_holiday_leave">Government Holiday – Office Granted Leave</option>
                    <option value="own_leave">Employee Own Leave</option>
                  </select>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Calculates salary according to official government holiday rules
                  </span>
                </div>

                {/* Attendance Status Dropdown */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Attendance Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => {
                      const nextStatus = e.target.value;
                      setStatus(nextStatus);
                      if (nextStatus === 'od') {
                        setClockIn('OD');
                        setClockOut('OD');
                        if (!notes || notes === 'HR manual attendance entry') setNotes('Full Day OD (On Duty)');
                      } else if (nextStatus === 'login_od') {
                        setClockIn('OD');
                        if (clockOut === 'OD') setClockOut('18:00:00');
                        if (!notes || notes === 'HR manual attendance entry') setNotes('Morning OD (Login On Duty)');
                      } else if (nextStatus === 'logout_od') {
                        if (clockIn === 'OD') setClockIn('09:30:00');
                        setClockOut('OD');
                        if (!notes || notes === 'HR manual attendance entry') setNotes('Evening OD (Logout On Duty)');
                      } else if (nextStatus === 'absent' || nextStatus === 'weekly_off') {
                        setClockIn('');
                        setClockOut('');
                      } else if (nextStatus === 'holiday') {
                        setHolidayType('govt_holiday_leave');
                        if (!clockIn || clockIn === '--' || clockIn === 'OD') setClockIn('09:30:00');
                        if (!clockOut || clockOut === '--' || clockOut === 'OD') setClockOut('18:00:00');
                        setLeaveCheckoutPending(false);
                        setCustomOtMinutes('0');
                        setNotes('Government Holiday – Office Granted Leave (Paid Holiday: 1× Daily Pay)');
                      } else if (nextStatus === 'present' && holidayType === 'govt_holiday_leave') {
                        setHolidayType('normal');
                      } else if ((clockIn === 'OD' || clockOut === 'OD') && nextStatus === 'present') {
                        if (clockIn === 'OD') setClockIn('09:30:00');
                        if (clockOut === 'OD') setClockOut('18:00:00');
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-semibold focus:outline-none focus:border-[#8b0000]"
                  >
                    <option value="present">Present (On-Time)</option>
                    <option value="holiday">Paid Holiday / Office Granted Leave</option>
                    <option value="od">On Duty (OD - Full Day)</option>
                    <option value="login_od">Login OD (Morning Duty)</option>
                    <option value="logout_od">Logout OD (Evening Duty)</option>
                    <option value="late">Late Arrival</option>
                    <option value="half_day">Half Day</option>
                    <option value="absent">Absent (Loss of Pay)</option>
                    <option value="weekly_off">Weekly Off (Paid)</option>
                  </select>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Affects payroll</span>
                </div>
              </div>

              {/* Row B: Check-in Time & Check-out Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Clock In / Login */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 flex items-center space-x-1">
                      <Sun className="w-3.5 h-3.5 text-amber-600" />
                      <span>Check-in (Login) Time</span>
                    </label>
                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={() => setClockIn(getCurrentTime24())}
                        className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                        title="Set current IST time as Check-in"
                      >
                        ⏱ Now
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (clockIn === 'OD') {
                            setClockIn('09:30:00');
                            if (status === 'login_od' || (status === 'od' && clockOut !== 'OD')) setStatus('present');
                          } else {
                            setClockIn('OD');
                            if (clockOut === 'OD') setStatus('od');
                            else setStatus('login_od');
                          }
                        }}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${
                          clockIn === 'OD'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                        }`}
                        title="Click to toggle Login On Duty (OD)"
                      >
                        {clockIn === 'OD' ? '✓ Login OD' : '+ Login OD'}
                      </button>
                    </div>
                  </div>

                  {clockIn === 'OD' ? (
                    <div className="flex items-center justify-between px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900 font-bold text-xs">
                      <span className="flex items-center space-x-1.5">
                        <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
                        <span>OD (On Duty)</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setClockIn('09:30:00')}
                        className="text-[10px] text-indigo-600 hover:underline font-semibold"
                      >
                        Set Time
                      </button>
                    </div>
                  ) : (
                    <input
                      type="time"
                      step="1"
                      disabled={status === 'absent' || status === 'weekly_off' || holidayType === 'own_leave'}
                      value={clockIn}
                      onChange={(e) => setClockIn(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-mono font-bold focus:outline-none focus:border-[#8b0000] disabled:opacity-40"
                    />
                  )}
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    {clockIn === 'OD' ? 'Morning Official On Duty' : 'Standard Shift Login: 09:30:00'}
                  </span>
                </div>

                {/* Clock Out / Logout */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 flex items-center space-x-1">
                      <Moon className="w-3.5 h-3.5 text-orange-600" />
                      <span>Check-out (Logout) Time</span>
                    </label>
                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={() => {
                          setLeaveCheckoutPending(false);
                          setClockOut(getCurrentTime24());
                        }}
                        className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                        title="Set current IST time as Check-out"
                      >
                        ⏱ Now
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (clockOut === 'OD') {
                            setClockOut('18:00:00');
                            if (status === 'logout_od' || (status === 'od' && clockIn !== 'OD')) setStatus('present');
                          } else {
                            setClockOut('OD');
                            if (clockIn === 'OD') setStatus('od');
                            else setStatus('logout_od');
                          }
                        }}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${
                          clockOut === 'OD'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                        }`}
                        title="Click to toggle Logout On Duty (OD)"
                      >
                        {clockOut === 'OD' ? '✓ Logout OD' : '+ Logout OD'}
                      </button>
                    </div>
                  </div>

                  {leaveCheckoutPending ? (
                    <div className="flex items-center justify-between px-3 py-2 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 font-bold text-xs">
                      <span className="flex items-center space-x-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                        <span>⏳ Checkout Pending (Morning Login Only)</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setLeaveCheckoutPending(false);
                          setClockOut(getCurrentTime24() || '18:00:00');
                        }}
                        className="text-[10px] text-amber-800 hover:underline font-bold"
                      >
                        Set Logout Now
                      </button>
                    </div>
                  ) : clockOut === 'OD' ? (
                    <div className="flex items-center justify-between px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900 font-bold text-xs">
                      <span className="flex items-center space-x-1.5">
                        <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
                        <span>OD (On Duty)</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setClockOut('18:00:00')}
                        className="text-[10px] text-indigo-600 hover:underline font-semibold"
                      >
                        Set Time
                      </button>
                    </div>
                  ) : (
                    <input
                      type="time"
                      step="1"
                      disabled={status === 'absent' || status === 'weekly_off' || holidayType === 'own_leave' || leaveCheckoutPending}
                      value={clockOut}
                      onChange={(e) => {
                        setClockOut(e.target.value);
                        if (e.target.value) setLeaveCheckoutPending(false);
                      }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-mono font-bold focus:outline-none focus:border-[#8b0000] disabled:opacity-40"
                    />
                  )}

                  {/* Toggle: Leave checkout pending (Save morning check-in only) */}
                  <div className="mt-1 flex items-center justify-between">
                    <label className="inline-flex items-center space-x-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={leaveCheckoutPending}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setLeaveCheckoutPending(val);
                          if (val) {
                            setClockOut('');
                          } else {
                            setClockOut(getCurrentTime24() || '18:00:00');
                          }
                        }}
                        className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 w-3.5 h-3.5 cursor-pointer"
                      />
                      <span className="text-[11px] font-semibold text-slate-700">
                        Leave checkout pending (Morning check-in only)
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Live Salary Impact & Holiday Calculation Preview */}
            <div className={`p-4 rounded-2xl border transition-all ${
              holidayType === 'govt_holiday_worked'
                ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-100 text-amber-950'
                : holidayType === 'govt_holiday_leave'
                ? 'bg-blue-50/80 border-blue-300 text-blue-950'
                : holidayType === 'own_leave'
                ? 'bg-rose-50/80 border-rose-300 text-rose-950'
                : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2 mb-2 border-slate-200/60">
                <div className="flex items-center space-x-2">
                  <Sparkles className={`w-4 h-4 ${
                    holidayType === 'govt_holiday_worked' ? 'text-amber-600' :
                    holidayType === 'govt_holiday_leave' ? 'text-blue-600' :
                    holidayType === 'own_leave' ? 'text-rose-600' : 'text-emerald-600'
                  }`} />
                  <span className="font-bold text-xs uppercase tracking-wider">
                    Salary Calculation Rule: {salaryImpactInfo.ruleName}
                  </span>
                </div>
                <div className="flex items-center space-x-2 text-xs font-mono">
                  <span className="text-slate-500">Employee Basic: ₹{salaryImpactInfo.baseSalary.toLocaleString('en-IN')}/mo</span>
                  <span>•</span>
                  <span className="font-bold text-slate-700">Per-Day: ₹{salaryImpactInfo.dailyRate}/day</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Day's Calculated Earnings</span>
                  <div className="text-lg font-black font-mono">
                    {holidayType === 'govt_holiday_worked' ? (
                      <span className="text-amber-800">
                        ₹{(salaryImpactInfo.dailyRate * 2).toLocaleString('en-IN')} <span className="text-xs font-bold">(2× Double Pay)</span>
                      </span>
                    ) : holidayType === 'govt_holiday_leave' ? (
                      <span className="text-blue-800">
                        ₹{salaryImpactInfo.dailyRate.toLocaleString('en-IN')} <span className="text-xs font-bold">(1× Fully Paid)</span>
                      </span>
                    ) : holidayType === 'own_leave' ? (
                      <span className="text-rose-700">
                        ₹0 <span className="text-xs font-bold">(Unpaid)</span>
                      </span>
                    ) : (
                      <span className="text-emerald-800">
                        ₹{salaryImpactInfo.dayAmount.toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Payroll Adjustment Effect</span>
                  <div className="text-xs font-bold font-mono mt-1">
                    {holidayType === 'govt_holiday_worked' ? (
                      <span className="text-amber-700 font-extrabold">+₹{salaryImpactInfo.dailyRate} Extra Bonus Disbursed</span>
                    ) : holidayType === 'govt_holiday_leave' ? (
                      <span className="text-blue-700 font-semibold">₹0 Deduction (Standard Day Included)</span>
                    ) : holidayType === 'own_leave' ? (
                      <span className="text-rose-700 font-extrabold">-₹{salaryImpactInfo.dailyRate} Loss of Pay (Deduction)</span>
                    ) : (
                      <span className="text-slate-600">Standard Daily Shift</span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Policy Rule Summary</span>
                  <p className="text-[11px] text-slate-600 mt-0.5 font-medium leading-tight">
                    {salaryImpactInfo.explanation}
                  </p>
                </div>
              </div>
            </div>

            {/* 4. Live Overtime & Shift Preview Box */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 block font-bold uppercase">Total Hours</span>
                <span className="text-base font-black text-slate-800 font-mono">
                  {calculatedStats.totalHours > 0 ? `${calculatedStats.totalHours} hrs` : '--'}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-amber-700 block font-bold uppercase">Calculated Overtime</span>
                <span className="text-base font-black text-amber-700 font-mono flex items-center space-x-1">
                  <Flame className="w-4 h-4 text-amber-600" />
                  <span>+{calculatedStats.otMinutes} mins OT</span>
                </span>
              </div>

              <div className="col-span-2 sm:col-span-1">
                <span className="text-[10px] text-slate-400 block font-bold uppercase">Override OT (Optional)</span>
                <input
                  type="number"
                  placeholder="e.g. 25"
                  value={customOtMinutes}
                  onChange={(e) => setCustomOtMinutes(e.target.value)}
                  className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold focus:outline-none focus:border-[#8b0000]"
                />
              </div>
            </div>

            {/* 5. Notes / Reason */}
            <div className={`p-4 rounded-2xl transition-all ${
              isOD ? 'bg-indigo-50/90 border-2 border-indigo-300 ring-2 ring-indigo-100' : 'bg-transparent'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                  <Briefcase className={`w-4 h-4 ${isOD ? 'text-indigo-700' : 'text-slate-500'}`} />
                  <span>{isOD ? 'On Duty (OD) Official Reason' : 'Adjustment Reason / Official Notes'}</span>
                  {isOD && (
                    <span className="text-[10px] font-bold text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200">
                      Reason Required *
                    </span>
                  )}
                </label>
                {isOD && (
                  <span className="text-[10px] text-indigo-600 font-semibold hidden sm:inline">
                    Choose quick reason or type custom details
                  </span>
                )}
              </div>

              {/* 1-Click Quick OD Reason Buttons */}
              {isOD && (
                <div className="mb-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'Client Site Visit',
                      'Registrar Office Work',
                      'Customer Meeting',
                      'Property Field Inspection',
                      'Bank / Government Office',
                      'Document Collection / Delivery',
                      'Management Meeting'
                    ].map((reasonTag) => {
                      const isSelected = notes === reasonTag || notes.includes(reasonTag);
                      return (
                        <button
                          key={reasonTag}
                          type="button"
                          onClick={() => setNotes(reasonTag)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-white hover:bg-indigo-100 text-indigo-900 border border-indigo-200 shadow-2xs'
                          }`}
                        >
                          + {reasonTag}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <input
                type="text"
                required={isOD}
                placeholder={isOD ? 'Enter specific OD reason (e.g. Client Site Visit, Registrar Office, Meeting)' : 'e.g. Regular shift / Client site visit / Management approved'}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs focus:outline-none transition-all ${
                  isOD
                    ? 'bg-white border-2 border-indigo-400 text-indigo-950 font-semibold focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200 shadow-xs placeholder-indigo-300'
                    : 'bg-slate-50 border border-slate-200 text-slate-900 focus:border-[#8b0000]'
                }`}
              />
              {isOD && (
                <p className="text-[10px] text-indigo-700 mt-1 font-medium">
                  ℹ️ This reason will be recorded on the official attendance register and reports.
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className={`flex-1 py-3 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 ${
                  leaveCheckoutPending
                    ? 'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800'
                    : isExistingCheckoutPending && clockOut && clockOut !== '--'
                    ? 'bg-gradient-to-r from-orange-600 to-[#8b0000] hover:from-orange-700 hover:to-[#7b0000]'
                    : 'bg-[#8b0000] hover:bg-[#7b0000]'
                }`}
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Saving Attendance...</span>
                  </>
                ) : leaveCheckoutPending ? (
                  <>
                    <Sun className="w-4 h-4 text-amber-200" />
                    <span>☀️ Save Morning Check-In (Checkout Pending)</span>
                  </>
                ) : isExistingCheckoutPending && clockOut && clockOut !== '--' ? (
                  <>
                    <Moon className="w-4 h-4 text-orange-200" />
                    <span>🌙 Save Evening Check-Out & Complete Shift</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>{(editingId || existingRecord) ? 'Update Attendance Record' : 'Save Attendance Record'}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleResetForm}
                className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors flex items-center space-x-1.5"
                title="Reset form to a fresh entry"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>New Blank Entry</span>
              </button>
            </div>
          </form>
        </div>

        {/* ========================================================== */}
        {/* RIGHT COLUMN: RECENT AUDIT LIST WITH 1-CLICK EDIT (5 cols) */}
        {/* ========================================================== */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col h-[680px]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Recent Attendance Records</h3>
                <p className="text-[11px] text-slate-500">Click ✏️ Edit to modify any record.</p>
              </div>
              <button
                type="button"
                onClick={loadData}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                title="Refresh logs"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Search inside logs */}
            <div className="my-2.5 relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search name, ID or date..."
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#8b0000]"
              />
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 pr-1 space-y-1">
              {filteredLogs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400 space-y-2">
                  <CalendarCheck className="w-8 h-8 text-slate-300" />
                  <p className="text-xs font-semibold text-slate-600">No records found</p>
                  <p className="text-[11px] text-slate-400">Use the form on the left to record attendance.</p>
                </div>
              ) : (
                filteredLogs.map(item => {
                  const isLate = item.status === 'late';
                  const isHalfDay = item.status === 'half_day';
                  const isAbsent = item.status === 'absent';
                  const isPendingCheckout = (!item.clock_out || item.clock_out === '--' || item.clock_out === '' || item.status === 'checked_in') && item.status !== 'absent' && item.status !== 'weekly_off' && item.holiday_type !== 'own_leave' && item.holiday_type !== 'govt_holiday_leave' && item.status !== 'holiday';
                  const hasOt = item.ot_minutes > 0 || item.ot_hours > 0;
                  const otMins = item.ot_minutes || Math.round((item.ot_hours || 0) * 60);

                  return (
                    <div 
                      key={item.id || `${item.emp_id}_${item.date}`}
                      className={`p-3 rounded-2xl border transition-all ${
                        editingId === item.id 
                          ? 'bg-amber-50/70 border-amber-400 ring-2 ring-amber-300'
                          : 'bg-white border-slate-100 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-xs text-slate-900">{item.employee_name}</span>
                          <span className="text-[10px] font-mono text-slate-400">({item.emp_id})</span>
                        </div>
                        <span className="text-[11px] font-mono font-bold text-slate-700">
                          {item.date} <span className="text-slate-400 font-semibold text-[10px]">{formatDayName(item.date)}</span>
                        </span>
                      </div>

                      {/* Timings row */}
                      <div className="flex items-center justify-between mt-1 text-[11px]">
                        <div className="text-slate-600 font-mono flex items-center space-x-1 flex-wrap">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold">Login:</span>
                          {item.clock_in === 'OD' ? (
                            <span className="px-1.5 py-0.2 rounded font-bold bg-indigo-100 text-indigo-800 text-[10px] border border-indigo-200">OD</span>
                          ) : (
                            <span className="font-semibold text-slate-800">{item.clock_in ? formatTime(item.clock_in) : '--'}</span>
                          )}
                          <span className="text-slate-300 mx-0.5">→</span>
                          <span className="text-[10px] text-slate-400 uppercase font-semibold">Logout:</span>
                          {item.clock_out === 'OD' ? (
                            <span className="px-1.5 py-0.2 rounded font-bold bg-indigo-100 text-indigo-800 text-[10px] border border-indigo-200">OD</span>
                          ) : (item.clock_out && item.clock_out !== '--') ? (
                            <span className="font-semibold text-slate-800">{formatTime(item.clock_out)}</span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded font-black bg-amber-100 text-amber-900 text-[10px] border border-amber-300 animate-pulse">
                              ⏳ Checkout Pending
                            </span>
                          )}
                        </div>

                        {/* Status & Holiday Badge */}
                        <div className="flex items-center space-x-1 flex-wrap justify-end">
                          {item.holiday_type === 'govt_holiday_worked' && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                              Govt Holiday (2× Pay)
                            </span>
                          )}
                          {(item.holiday_type === 'govt_holiday_leave' || item.status === 'holiday') && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-300">
                              Govt Holiday (Paid)
                            </span>
                          )}
                          {item.holiday_type === 'own_leave' && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-900 border border-rose-300">
                              Own Leave (Unpaid)
                            </span>
                          )}

                          {isPendingCheckout ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 flex items-center space-x-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse"></span>
                              <span>⏳ Checkout Pending</span>
                            </span>
                          ) : item.status === 'od' || item.status === 'login_od' || item.status === 'logout_od' || item.clock_in === 'OD' || item.clock_out === 'OD' ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                              {item.status === 'login_od' ? 'Login OD' : item.status === 'logout_od' ? 'Logout OD' : 'On Duty (OD)'}
                            </span>
                          ) : item.status === 'holiday' || item.holiday_type === 'govt_holiday_leave' ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                              Paid Holiday
                            </span>
                          ) : isAbsent ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">Absent</span>
                          ) : isLate ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">Late</span>
                          ) : isHalfDay ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">Half Day</span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">Present</span>
                          )}
                        </div>
                      </div>

                      {/* OT & Actions Bottom Row */}
                      <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-50 text-[11px]">
                        <div>
                          {item.status === 'od' || item.status === 'login_od' || item.status === 'logout_od' || item.clock_in === 'OD' || item.clock_out === 'OD' ? (
                            <span className="text-[10px] text-indigo-900 font-semibold flex items-center space-x-1">
                              <span className="text-indigo-400 font-normal">Reason:</span>
                              <span className="font-bold bg-indigo-50 text-indigo-800 px-1.5 py-0.2 rounded border border-indigo-200">
                                {item.notes && item.notes !== 'HR manual attendance entry' && item.notes !== 'HR manual adjustment' ? item.notes : 'Client Site Visit'}
                              </span>
                            </span>
                          ) : hasOt ? (
                            <span className="inline-flex items-center space-x-1 font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded text-[10px] border border-amber-200">
                              <Flame className="w-3 h-3 text-amber-600" />
                              <span>+{otMins} mins OT</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">{item.notes ? item.notes : (item.method === 'manual' ? 'Manual Entry' : 'Biometric')}</span>
                          )}
                        </div>

                        <div className="flex items-center space-x-1">
                          {isPendingCheckout && (
                            <button
                              type="button"
                              onClick={() => handleEnterLogout(item)}
                              className="px-2 py-1 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-lg font-bold text-[10px] flex items-center space-x-1 shadow-2xs transition-all active:scale-95"
                              title="Enter evening logout for this employee"
                            >
                              <Moon className="w-3 h-3 text-amber-100" />
                              <span>🌙 Log Out</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleEditRecord(item)}
                            className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg font-bold text-[10px] flex items-center space-x-1 transition-colors"
                            title="Edit this attendance record"
                          >
                            <Edit3 className="w-3 h-3 text-amber-700" />
                            <span>Edit</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(item.id, item.employee_name, item.date, item.emp_id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                            title="Delete this record"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
