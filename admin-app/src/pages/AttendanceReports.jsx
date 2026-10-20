import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, 
  Download, 
  Calendar, 
  Users, 
  Clock, 
  TrendingUp, 
  Building2,
  FileSpreadsheet,
  FileText,
  FileDown,
  IndianRupee,
  Sparkles,
  Award,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import { api } from '../services/api';
import { getLocalAttendance, mergeAttendanceWithLocal } from '../services/attendanceStorage';
import { exportAttendancePDF, exportPayrollPDF, exportSingleEmployeeSalarySlipPDF } from '../services/pdfExport';
import { exportMonthlyPayrollExcel, exportMonthlyPayrollCSV, getMonthCalendarInfo } from '../services/excelExport';
import { isLateArrival, getLateMinutes } from '../services/timeUtils';

export default function AttendanceReports() {
  const [data, setData] = useState(() => getLocalAttendance());
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
  const [loading, setLoading] = useState(false);
  
  // Salary Month Picker State (default: current YYYY-MM)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [filters, setFilters] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const startStr = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m + 1, 0).getDate();
    const endStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { startDate: startStr, endDate: endStr, department: '' };
  });

  useEffect(() => {
    // Default to current month range
    const now = new Date();
    const startStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const endStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    
    const initialFilters = { startDate: startStr, endDate: endStr, department: '' };
    setFilters(initialFilters);
    loadReport(initialFilters);

    // 1. Auto-refresh reports every 15 seconds for live multi-device sync
    const timer = setInterval(() => {
      loadReport(filters);
    }, 15000);

    // 2. Instant refresh when admin tabs back into the browser
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadReport(filters);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // 3. Real-time custom event listeners
    const handleRealtimeUpdate = () => {
      loadReport(filters);
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

  const loadReport = async (f) => {
    try {
      setLoading(true);
      const [resHistory, resEmployees] = await Promise.all([
        api.getAttendanceHistory(f),
        api.getEmployees()
      ]);
      const validEmps = Array.isArray(resEmployees) ? resEmployees : [];
      setEmployees(validEmps);

      const empMap = new Map(validEmps.map(e => [e.emp_id, e]));
      const merged = mergeAttendanceWithLocal(resHistory || []);

      // Dynamic cascade: ensure attendance record always displays the employee's live department & name
      let filtered = merged.map(r => {
        const emp = empMap.get(r.emp_id);
        if (emp) {
          return {
            ...r,
            employee_name: emp.name || r.employee_name || r.emp_id,
            department: emp.department || r.department || 'Digital Marketing',
            role: emp.role || r.role || 'Staff'
          };
        }
        return r;
      });

      if (f?.startDate) filtered = filtered.filter(a => a.date >= f.startDate);
      if (f?.endDate) filtered = filtered.filter(a => a.date <= f.endDate);
      if (f?.department) {
        filtered = filtered.filter(a => (a.department || 'Digital Marketing') === f.department);
      }
      setData(filtered);
    } catch (err) {
      console.error('Error loading report data:', err);
      setData(getLocalAttendance());
    } finally {
      setLoading(false);
    }
  };

  // Handle Month Selection
  const handleMonthChange = (monthStr) => {
    if (!monthStr) return;
    setSelectedMonth(monthStr);
    const [y, m] = monthStr.split('-').map(Number);
    const startStr = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const endStr = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    const newFilters = { ...filters, startDate: startStr, endDate: endStr };
    setFilters(newFilters);
    loadReport(newFilters);
  };

  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    handleMonthChange(prevMonthStr);
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const nextDate = new Date(y, m, 1);
    const nextMonthStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
    handleMonthChange(nextMonthStr);
  };

  const handleCurrentMonth = () => {
    const now = new Date();
    const curMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    handleMonthChange(curMonthStr);
  };

  // Formatted selected month name for headers and file names (e.g. "October 2026")
  const selectedMonthName = useMemo(() => {
    if (!selectedMonth) return '';
    try {
      const [y, m] = selectedMonth.split('-').map(Number);
      return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    } catch {
      return selectedMonth;
    }
  }, [selectedMonth]);

  // Calendar metrics for selected month (daysInMonth, sundaysCount, workingDays)
  const calendarInfo = useMemo(() => {
    if (!selectedMonth) return { daysInMonth: 30, sundaysCount: 4, workingDays: 26 };
    try {
      const [y, m] = selectedMonth.split('-').map(Number);
      return getMonthCalendarInfo(y, m - 1);
    } catch {
      return { daysInMonth: 30, sundaysCount: 4, workingDays: 26 };
    }
  }, [selectedMonth]);

  // 1. Download Comprehensive 20-Column Monthly Payroll Excel (.xlsx)
  const handleDownloadMonthlyExcel = () => {
    exportMonthlyPayrollExcel({
      payrollStats,
      attendanceData: data,
      filters,
      generatedBy: 'Administrator'
    });
  };

  // 2. Download 20-Column Monthly Payroll CSV (.csv)
  const handleDownloadMonthlyCSV = () => {
    exportMonthlyPayrollCSV({
      payrollStats,
      filters,
      generatedBy: 'Administrator'
    });
  };

  // 3. Raw Attendance Logs CSV
  const handleExportCSV = () => {
    const url = api.getExportUrl(filters);
    window.open(url, '_blank');
  };

  // Legacy Payroll CSV handler (for backward compatibility if needed)
  const handleExportPayrollCSV = handleDownloadMonthlyCSV;

  const handleDownloadAttendancePDF = () => {
    exportAttendancePDF({ data, filters });
  };

  const handleDownloadPayrollPDF = () => {
    exportPayrollPDF({ payrollStats, attendanceData: data, filters });
  };

  const handleDownloadSingleSlip = (p) => {
    const empRecords = data.filter(r => r.emp_id === p.emp_id);
    exportSingleEmployeeSalarySlipPDF({
      employee: p,
      stats: p,
      records: empRecords,
      filters
    });
  };

  // Compute analytics metrics
  const totalRecords = data.length;
  const totalHours = data.reduce((sum, r) => sum + (r.total_hours || 0), 0);
  const avgDailyHours = totalRecords ? (totalHours / totalRecords).toFixed(1) : '0';
  const lateRecords = data.filter(r => isLateArrival(r.clock_in, r.status)).length;
  const latePercent = totalRecords ? Math.round((lateRecords / totalRecords) * 100) : 0;
  const facelockPunches = data.filter(r => r.method === 'facelock').length;
  const facelockPercent = totalRecords ? Math.round((facelockPunches / totalRecords) * 100) : 0;

  // Department groupings
  const deptStats = {};
  data.forEach(r => {
    const dept = r.department || 'Digital Marketing';
    if (!deptStats[dept]) {
      deptStats[dept] = { count: 0, hours: 0, late: 0 };
    }
    deptStats[dept].count += 1;
    deptStats[dept].hours += (r.total_hours || 0);
    if (isLateArrival(r.clock_in, r.status)) deptStats[dept].late += 1;
  });

  // Calculate Employee Payroll with all 20 required report fields & Full Attendance Bonus
  const payrollStats = useMemo(() => {
    const { sundaysCount, workingDays } = calendarInfo;

    return employees.map(emp => {
      const records = data.filter(r => r.emp_id === emp.emp_id);
      let present = 0;
      let absent = 0;
      let halfday = 0;
      let paidLeaveDays = 0;
      let late = 0;
      let otMinutes = 0;

      records.forEach(r => {
        const isOD = r.status === 'od' || r.status === 'login_od' || r.status === 'logout_od' || r.clock_in === 'OD' || r.clock_out === 'OD';
        const isLeave = r.status === 'leave' || r.status === 'paid_leave';
        const isLate = !isOD && isLateArrival(r.clock_in, r.status);
        
        if (isLeave) {
          paidLeaveDays += 1;
          present += 1;
        } else if (isOD) {
          paidLeaveDays += 1;
          present += 1;
        } else if (isLate) {
          present += 1;
          late += 1;
        } else if (r.status === 'present' || (!r.status && r.clock_in && r.clock_in !== '--')) {
          present += 1;
        } else if (r.status === 'absent') {
          absent += 1;
        } else if (r.status === 'half_day') {
          halfday += 1;
        }
        if (r.ot_minutes > 0) otMinutes += r.ot_minutes;
      });

      const baseSalary = Number(emp.salary || 0);
      const dailyRate = baseSalary > 0 ? Math.round(baseSalary / 30) : 0;
      const shiftMinutes = 510; // 8.5 hours
      const otRatePerMin = dailyRate > 0 ? (dailyRate / shiftMinutes) * 1.5 : 0;
      const otPay = Math.round(otMinutes * otRatePerMin);
      const otHours = Number((otMinutes / 60).toFixed(2));

      // Deductions: Absent days + half-days
      const deductions = Math.round(absent * dailyRate + halfday * 0.5 * dailyRate);
      const earnedBase = Math.max(0, Math.round(baseSalary - deductions));

      // Policy: If 100% full present (0 absences, 0 half-days, with at least 1 shift logged),
      // employee receives 2 days extra salary bonus!
      const isFullPresentEligible = absent === 0 && halfday === 0 && present > 0;
      const doubleSalaryDays = isFullPresentEligible ? 2 : 0;
      const fullPresentBonus = Math.round(doubleSalaryDays * dailyRate);
      
      const otherAllowances = 0;
      const totalMonthlySalary = baseSalary + otPay + fullPresentBonus + otherAllowances;
      const finalPayableSalary = Math.max(0, totalMonthlySalary - deductions);
      const netTotalPayout = finalPayableSalary;

      return {
        emp_id: emp.emp_id,
        name: emp.name,
        department: emp.department || 'Digital Marketing',
        role: emp.role || emp.designation || 'Staff',
        avatar: emp.avatar,
        baseSalary,
        dailyRate,
        workingDays,
        present,
        late,
        absent,
        halfday,
        paidLeaveDays,
        weeklyOffs: sundaysCount,
        otMinutes,
        otHours,
        otPay,
        doubleSalaryDays,
        doubleSalaryAmount: fullPresentBonus,
        otherAllowances,
        deductions,
        totalMonthlySalary,
        finalPayableSalary,
        earnedBase,
        isFullPresentEligible,
        fullPresentBonus,
        netTotalPayout
      };
    });
  }, [employees, data, calendarInfo]);

  // Aggregate Payroll Totals
  const totalPayroll = payrollStats.reduce((sum, p) => sum + p.netTotalPayout, 0);
  const totalFullPresentBonuses = payrollStats.reduce((sum, p) => sum + p.fullPresentBonus, 0);
  const fullPresentCount = payrollStats.filter(p => p.isFullPresentEligible).length;
  const totalOtDisbursed = payrollStats.reduce((sum, p) => sum + p.otPay, 0);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Attendance Analytics & Monthly Salary Reports</h2>
          <p className="text-xs text-slate-500">
            Generate monthly payroll summaries, full attendance bonus (+2 Days extra salary), overtime, and export 20-column Excel (.xlsx) and CSV reports.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* 20-Column Monthly Excel Export (.xlsx) */}
          <button
            onClick={handleDownloadMonthlyExcel}
            className="flex items-center space-x-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-xs transition-colors"
            title="Download Comprehensive 20-Column Monthly Attendance & Salary Excel Report (.xlsx) with Executive Summary"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
            <span>Monthly Excel (.xlsx)</span>
          </button>

          {/* 20-Column Monthly CSV Export (.csv) */}
          <button
            onClick={handleDownloadMonthlyCSV}
            className="flex items-center space-x-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-xs transition-colors"
            title="Download Comprehensive 20-Column Monthly Attendance & Salary Report as CSV"
          >
            <Download className="w-4 h-4 text-teal-200" />
            <span>Monthly CSV (20 Cols)</span>
          </button>

          {/* PDF Format Downloads */}
          <button
            onClick={handleDownloadPayrollPDF}
            className="flex items-center space-x-1.5 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-xs transition-colors"
            title="Download Monthly Payroll & +2 Days Bonus in PDF Format"
          >
            <FileText className="w-4 h-4 text-amber-200" />
            <span>Payroll PDF</span>
          </button>

          <button
            onClick={handleDownloadAttendancePDF}
            className="flex items-center space-x-1.5 bg-[#8b0000] hover:bg-[#6b0000] text-white text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-xs transition-colors"
            title="Download Official Attendance Report in PDF Format"
          >
            <FileDown className="w-4 h-4 text-rose-200" />
            <span>Attendance PDF</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold px-3 py-2.5 rounded-xl shadow-xs transition-colors"
            title="Export Raw Attendance Punch Logs as CSV"
          >
            <Download className="w-4 h-4 text-slate-300" />
            <span>Raw Logs CSV</span>
          </button>
        </div>
      </div>

      {/* Salary Month Selector & Filter Controls Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Month Selector Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-slate-600 font-bold flex items-center space-x-1">
            <Calendar className="w-4 h-4 text-emerald-700" />
            <span>Salary Month:</span>
          </span>

          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-white rounded text-slate-700 transition-colors cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => handleMonthChange(e.target.value)}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded text-slate-900 font-mono font-bold text-xs cursor-pointer focus:ring-1 focus:ring-emerald-500"
            />
            <button
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-white rounded text-slate-700 transition-colors cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={handleCurrentMonth}
            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs transition-colors"
            title="Jump to Current Month"
          >
            Current Month
          </button>

          {/* Month Calendar Information Pill */}
          <div className="hidden md:inline-flex items-center space-x-2 px-3 py-1 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-200 font-medium">
            <span className="font-bold">{selectedMonthName}</span>
            <span>•</span>
            <span>{calendarInfo.workingDays} Working Days</span>
            <span>•</span>
            <span>{calendarInfo.sundaysCount} Weekly Offs (Sundays)</span>
          </div>
        </div>

        {/* Right side filters: Department & Live Refresh */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-500 font-medium">Dept:</span>
            <select
              value={filters.department}
              onChange={(e) => {
                const newFilters = { ...filters, department: e.target.value };
                setFilters(newFilters);
                loadReport(newFilters);
              }}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-800 text-xs"
            >
              <option value="">All Departments</option>
              <option value="Digital Marketing">Digital Marketing</option>
              <option value="Operations">Operations</option>
              <option value="Information Technology">Information Technology</option>
              <option value="Human Resources">Human Resources</option>
              <option value="Sales">Sales</option>
            </select>
          </div>

          <button
            onClick={() => loadReport(filters)}
            disabled={loading}
            className="flex items-center space-x-1 px-3 py-1.5 bg-[#8b0000] hover:bg-[#6b0000] text-white rounded-lg font-semibold transition-colors disabled:opacity-50 cursor-pointer"
            title="Refresh from Render Cloud Database"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Syncing...' : 'Sync Data'}</span>
          </button>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-slate-400 text-xs font-medium mb-1">Total Punches Logged</div>
          <div className="text-2xl font-bold text-slate-800">{totalRecords}</div>
          <span className="text-[11px] text-slate-400">In {selectedMonthName || 'selected month'}</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-slate-400 text-xs font-medium mb-1">Cumulative Work Hours</div>
          <div className="text-2xl font-bold text-emerald-600">{Math.round(totalHours)} hrs</div>
          <span className="text-[11px] text-emerald-700">~{avgDailyHours} hrs/session</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-slate-400 text-xs font-medium mb-1">Punctuality Rate</div>
          <div className="text-2xl font-bold text-blue-600">{100 - latePercent}%</div>
          <span className="text-[11px] text-blue-700">{latePercent}% late arrivals</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-slate-400 text-xs font-medium mb-1">FaceLock Adoption</div>
          <div className="text-2xl font-bold text-purple-600">{facelockPercent}%</div>
          <span className="text-[11px] text-purple-700">{facelockPunches} camera punches</span>
        </div>
      </div>

      {/* ============================================================== */}
      {/* ZERO-ABSENT DOUBLE SALARY & MONTHLY PAYROLL TRACKER            */}
      {/* ============================================================== */}
      <div className="bg-white rounded-2xl border border-amber-200/80 shadow-sm overflow-hidden">
        {/* Card Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-red-500/5 border-b border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[11px] font-bold mb-1.5 border border-amber-300">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Official Company Policy • Full Present = 2 Days Extra Salary</span>
            </div>
            <h3 className="font-black text-slate-900 text-base sm:text-lg flex items-center space-x-2">
              <Award className="w-5 h-5 text-amber-600" />
              <span>
                Monthly Attendance & Salary Report — {selectedMonthName}
              </span>
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Employees with <strong>100% full attendance (0 absences)</strong> in the month receive an <strong>extra 2 days salary bonus (+2 Days Salary)</strong> plus Overtime.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            {/* Download Monthly Excel (.xlsx) */}
            <button
              onClick={handleDownloadMonthlyExcel}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs shadow-xs transition-colors"
              title="Download 20-Column Monthly Attendance & Salary Excel (.xlsx) Report"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-200" />
              <span>Download Excel (.xlsx)</span>
            </button>

            {/* Download Monthly CSV (.csv) */}
            <button
              onClick={handleDownloadMonthlyCSV}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-bold text-xs shadow-xs transition-colors"
              title="Download 20-Column Monthly Attendance & Salary CSV Report"
            >
              <Download className="w-3.5 h-3.5 text-teal-200" />
              <span>Download CSV</span>
            </button>

            {/* Download Payroll PDF */}
            <button
              onClick={handleDownloadPayrollPDF}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs shadow-xs transition-colors"
              title="Download Monthly Payroll & +2 Days Bonus in PDF Format"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Payroll PDF</span>
            </button>

            <span className="px-3 py-1.5 bg-amber-100 text-amber-900 rounded-xl font-bold text-xs border border-amber-300 flex items-center space-x-1.5">
              <Award className="w-4 h-4 text-amber-700" />
              <span>{fullPresentCount} Qualified (+2 Days)</span>
            </span>
          </div>
        </div>

        {/* Payroll Summary KPI Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50/60 border-b border-slate-100 text-xs">
          <div className="bg-white p-3 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Total Projected Payroll</span>
            <div className="text-lg font-black text-slate-900 font-mono mt-0.5">
              ₹{totalPayroll.toLocaleString('en-IN')}
            </div>
            <span className="text-[10px] text-slate-400">All staff combined</span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-amber-200 bg-amber-50/20">
            <span className="text-[10px] text-amber-800 uppercase font-bold block">Full Present Bonuses (+2 Days)</span>
            <div className="text-lg font-black text-amber-800 font-mono mt-0.5">
              +₹{totalFullPresentBonuses.toLocaleString('en-IN')}
            </div>
            <span className="text-[10px] text-amber-700 font-semibold">{fullPresentCount} staff with 0 absences</span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Total Overtime Pay</span>
            <div className="text-lg font-black text-slate-900 font-mono mt-0.5">
              +₹{totalOtDisbursed.toLocaleString('en-IN')}
            </div>
            <span className="text-[10px] text-slate-400">Beyond 6:00 PM buffer</span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Staff Tracked</span>
            <div className="text-lg font-black text-slate-900 font-mono mt-0.5">
              {payrollStats.length} Employees
            </div>
            <span className="text-[10px] text-emerald-600 font-semibold">Active team</span>
          </div>
        </div>

        {/* Payroll & Full Attendance Bonus Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Monthly Base & Earned Salary</th>
                <th className="px-4 py-3">Attendance & Late Days</th>
                <th className="px-4 py-3">Overtime</th>
                <th className="px-4 py-3">Full Present Bonus (+2 Days)</th>
                <th className="px-4 py-3 text-right">Net Month Salary (Payout)</th>
                <th className="px-3 py-3 text-center">Single Slip</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payrollStats.map(p => (
                <tr key={p.emp_id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-2.5">
                      <img
                        src={p.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}
                        alt={p.name}
                        className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0"
                      />
                      <div>
                        <div className="font-bold text-slate-900">{p.name}</div>
                        <div className="font-mono text-[10px] text-slate-400">{p.emp_id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-700">{p.department}</span>
                    <div className="text-[10px] text-slate-400">{p.role}</div>
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-slate-800">
                    <div>₹{p.baseSalary.toLocaleString('en-IN')}</div>
                    <span className="block text-[10px] text-slate-400 font-normal">₹{p.dailyRate}/day</span>
                    <span className="block text-[11px] text-emerald-700 font-bold mt-0.5">
                      Earned: ₹{p.earnedBase.toLocaleString('en-IN')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-1.5 text-[11px] flex-wrap">
                        <span className="text-emerald-700 font-semibold">{p.present} Present</span>
                        <span>•</span>
                        <span className={p.absent > 0 ? "text-rose-600 font-bold" : "text-slate-400"}>
                          {p.absent} Absent
                        </span>
                        {p.halfday > 0 && (
                          <>
                            <span>•</span>
                            <span className="text-blue-600 font-semibold">{p.halfday} Half-Day</span>
                          </>
                        )}
                        {p.paidLeaveDays > 0 && (
                          <>
                            <span>•</span>
                            <span className="text-purple-700 font-semibold">{p.paidLeaveDays} Leave/OD</span>
                          </>
                        )}
                      </div>
                      {p.late > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          ⚠️ {p.late} {p.late === 1 ? 'Day Late' : 'Days Late'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] text-emerald-700 bg-emerald-50 font-medium">
                          ✓ 0 Late (On-Time)
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-mono font-medium text-slate-700">
                      {p.otHours > 0 ? `${p.otHours} hrs` : (p.otMinutes > 0 ? `${p.otMinutes}m` : '0 hrs')}
                    </div>
                    {p.otPay > 0 && (
                      <span className="text-[10px] text-amber-700 font-bold block">
                        +₹{p.otPay.toLocaleString('en-IN')}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {p.isFullPresentEligible ? (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 text-[10px] font-black border border-amber-300 shadow-2xs">
                        <Award className="w-3.5 h-3.5 text-amber-600" />
                        <span>🏆 +2 Days Salary (+₹{p.fullPresentBonus.toLocaleString('en-IN')})</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-medium border border-slate-200">
                        <span>Standard ({p.absent} Absents)</span>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="font-mono font-black text-sm text-[#8b0000]">
                      ₹{p.finalPayableSalary.toLocaleString('en-IN')}
                    </div>
                    {p.deductions > 0 && (
                      <span className="text-[10px] text-rose-600 font-semibold block">
                        -₹{p.deductions.toLocaleString('en-IN')} (LOP)
                      </span>
                    )}
                    <span className="text-[10px] text-slate-500 font-bold block">
                      Net Payout ({p.isFullPresentEligible ? 'Base + Bonus + OT' : 'Base - LOP + OT'})
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <button
                      onClick={() => handleDownloadSingleSlip(p)}
                      className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-[#8b0000] border border-red-200 text-[11px] font-bold transition-all shadow-2xs hover:scale-105 active:scale-95 cursor-pointer"
                      title={`Download Official Monthly Salary & Attendance Slip PDF for ${p.name}`}
                    >
                      <FileDown className="w-3.5 h-3.5 text-[#8b0000]" />
                      <span>Slip PDF</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Department Breakdown Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 text-sm">Department Performance Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Total Shifts</th>
                <th className="px-4 py-3">Total Hours</th>
                <th className="px-4 py-3">Late Occurrences</th>
                <th className="px-4 py-3">Punctuality %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Object.entries(deptStats).map(([dept, stat]) => {
                const onTimeRate = stat.count ? Math.round(((stat.count - stat.late) / stat.count) * 100) : 100;
                return (
                  <tr key={dept} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-bold text-slate-800">{dept}</td>
                    <td className="px-4 py-3 text-slate-600">{stat.count}</td>
                    <td className="px-4 py-3 text-slate-700 font-semibold">{stat.hours.toFixed(1)} hrs</td>
                    <td className="px-4 py-3 text-amber-600 font-medium">{stat.late}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-2">
                        <div className="w-20 bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-emerald-500 h-2 rounded-full"
                            style={{ width: `${onTimeRate}%` }}
                          />
                        </div>
                        <span className="font-mono text-slate-700 font-bold">{onTimeRate}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
