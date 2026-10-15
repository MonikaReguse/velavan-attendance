import React, { useState, useEffect, useMemo } from 'react';
import { 
  User, 
  Briefcase, 
  Phone, 
  Calendar, 
  Clock, 
  TrendingUp, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Coffee, 
  Flame, 
  IndianRupee, 
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  Building2, 
  ShieldCheck, 
  Sparkles, 
  CreditCard, 
  Landmark, 
  Info, 
  Check, 
  ExternalLink,
  ChevronDown,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';

export default function EmployeePortal() {
  const { activeEmployee, officeSettings } = useApp();

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFormula, setShowFormula] = useState(false);
  const [viewMode, setViewMode] = useState('cards'); // 'cards' (mobile-first) or 'table'

  // Load employee's complete attendance history
  useEffect(() => {
    if (activeEmployee?.emp_id) {
      loadHistory(activeEmployee.emp_id);
    }
  }, [activeEmployee]);

  const loadHistory = async (emp_id) => {
    try {
      setLoading(true);
      const res = await api.getHistory(emp_id);
      setHistory(res || []);
    } catch (err) {
      console.error('Failed to load history:', err);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  // Selected Month & Year
  const selectedYear = selectedDate.getFullYear();
  const selectedMonth = selectedDate.getMonth(); // 0-indexed (0 = Jan, 9 = Oct)

  const selectedMonthLabel = selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const totalDaysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();

  const isCurrentMonth = useMemo(() => {
    const now = new Date();
    return now.getFullYear() === selectedYear && now.getMonth() === selectedMonth;
  }, [selectedYear, selectedMonth]);

  // Navigate Months
  const handlePrevMonth = () => {
    setSelectedDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setSelectedDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleResetToCurrentMonth = () => {
    setSelectedDate(new Date());
  };

  // Past 12 Months Options List
  const pastMonthsList = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        value: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        year: d.getFullYear(),
        month: d.getMonth()
      });
    }
    return months;
  }, []);

  // Parse Base Monthly Salary
  const baseMonthlySalary = useMemo(() => {
    if (!activeEmployee?.salary) return 25000;
    const cleanNum = parseFloat(String(activeEmployee.salary).replace(/[^0-9.]/g, ''));
    return !isNaN(cleanNum) && cleanNum > 0 ? cleanNum : 25000;
  }, [activeEmployee]);

  // Calculate Daily Records for the Selected Month
  const monthDailyRecords = useMemo(() => {
    const now = new Date();
    const recordsMap = new Map();
    (history || []).forEach(h => {
      if (h.date) recordsMap.set(h.date, h);
    });

    const items = [];

    for (let day = 1; day <= totalDaysInMonth; day++) {
      const dayDate = new Date(selectedYear, selectedMonth, day);
      const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayOfWeek = dayDate.getDay(); // 0 is Sunday
      const isSunday = dayOfWeek === 0;
      const dayName = dayDate.toLocaleDateString('en-US', { weekday: 'short' });
      const formattedDate = dayDate.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });

      const hist = recordsMap.get(dateStr);

      let status = 'Absent';
      let clockIn = hist?.clock_in || '--';
      let clockOut = hist?.clock_out || '--';
      let totalHours = hist?.total_hours || 0;

      // Dynamic OT calculation in Minutes:
      // Office regular closing: 18:00 (6:00 PM).
      // Base arrival is 09:30 AM (570 mins).
      // - 09:30 entry -> OT threshold 18:20 (6:20 PM). If out >= 18:20, OT calculates from 18:00 (6:00 PM) in minutes (20m, 30m etc).
      // - 09:35 entry -> OT threshold 18:25 (6:25 PM). If out >= 18:25, OT calculates from 18:00 (6:00 PM) in minutes (25m, 30m etc).
      // - 09:40 entry -> OT threshold 18:30 (6:30 PM). If out >= 18:30, OT calculates from 18:00 (6:00 PM) in minutes (30m etc).
      let otMinutes = 0;
      if (hist && hist.ot_minutes !== undefined && hist.ot_minutes !== null && Number(hist.ot_minutes) > 0) {
        otMinutes = Number(hist.ot_minutes);
      } else if (hist && hist.clock_out) {
        const toMins = (t) => {
          if (!t || t === '--') return 0;
          const [h, m] = t.split(':').map(Number);
          return (h || 0) * 60 + (m || 0);
        };
        const inM = toMins(hist.clock_in || '09:30');
        const startM = 9 * 60 + 30; // 09:30 = 570
        const baseEndM = 18 * 60;   // 18:00 = 1080 (Office closing 6:00 PM)
        const outM = toMins(hist.clock_out);
        const lateM = Math.max(0, inM - startM);
        const reqEndM = baseEndM + lateM;
        const threshM = reqEndM + 20; // 20-min qualification buffer

        if (outM >= threshM) {
          // OT calculated strictly starting from 6:00 PM onwards in minutes
          otMinutes = Math.max(0, outM - baseEndM);
        }
      } else if (hist && hist.ot_hours > 0) {
        otMinutes = Math.round(Number(hist.ot_hours) * 60);
      }

      const overtimeHours = Number((otMinutes / 60).toFixed(2));

      const isFutureDate = dayDate > now && !hist;

      if (isSunday) {
        status = 'Weekly Off';
      } else if (hist) {
        if (hist.status === 'half_day') {
          status = 'Half-Day';
        } else if (hist.status === 'late' || (hist.clock_in && hist.clock_in > '09:40:00')) {
          status = 'Late Arrival';
        } else {
          status = 'Present';
        }
      } else {
        if (isFutureDate) {
          status = 'Upcoming';
        } else {
          status = 'Absent';
        }
      }

      items.push({
        date: dateStr,
        dayNumber: day,
        formattedDate,
        day: dayName,
        isSunday,
        status,
        clockIn,
        clockOut,
        totalHours,
        otMinutes,
        overtime: overtimeHours
      });
    }

    return items;
  }, [selectedYear, selectedMonth, totalDaysInMonth, history]);

  // Attendance Summary: Present, Absent, Half-Day, Weekly Off, Overtime (in Minutes)
  const summaryKpis = useMemo(() => {
    let present = 0;
    let absent = 0;
    let halfday = 0;
    let weeklyoff = 0;
    let overtimeDays = 0;
    let totalOtMinutes = 0;

    monthDailyRecords.forEach(r => {
      if (r.status === 'Present' || r.status === 'Late Arrival') {
        present += 1;
      } else if (r.status === 'Absent') {
        absent += 1;
      } else if (r.status === 'Half-Day') {
        halfday += 1;
      } else if (r.status === 'Weekly Off') {
        weeklyoff += 1;
      }

      if (r.otMinutes > 0) {
        overtimeDays += 1;
        totalOtMinutes += r.otMinutes;
      }
    });

    return {
      present,
      absent,
      halfday,
      weeklyoff,
      overtimeDays,
      totalOtMinutes,
      totalOtHours: Number((totalOtMinutes / 60).toFixed(2))
    };
  }, [monthDailyRecords]);

  // Salary & Overtime Calculation (Standard 30 Days Payroll Basis, OT in Minutes)
  const salaryCalculation = useMemo(() => {
    const PAYROLL_DAYS = 30; // Salary calculated days = 30 days fixed standard

    // Daily base rate = Base Salary / 30 days
    const dailyRate = baseMonthlySalary / PAYROLL_DAYS;

    // Shift: 09:30 AM to 06:00 PM = 8h 30m = 8.5 hours = 510 working minutes / day
    const shiftHours = 8.5;
    const shiftMinutes = 510;
    const hourlyRate = dailyRate / shiftHours;
    const minuteRate = dailyRate / shiftMinutes; // Base rate per minute

    // Standard Overtime multiplier: 1.5x of rate
    const otRatePerHour = hourlyRate * 1.5;
    const otRatePerMinute = minuteRate * 1.5; // OT rate per minute

    // Loss of Pay Deductions for 30 days standard:
    const absentDeduction = Math.round(summaryKpis.absent * dailyRate);
    const halfDayDeduction = Math.round(summaryKpis.halfday * 0.5 * dailyRate);
    const totalDeductions = absentDeduction + halfDayDeduction;

    // Effective payable days on 30-day basis
    const payableDays = Math.max(0, Math.round((PAYROLL_DAYS - summaryKpis.absent - (summaryKpis.halfday * 0.5)) * 10) / 10);

    // Earned Base Salary based on 30 days standard
    const earnedBasePay = Math.max(0, Math.round(baseMonthlySalary - totalDeductions));

    // Zero-Absent Double Salary Incentive Rule:
    // If employee has 0 Absents and 0 Half-Days in the month (with at least 1 day present),
    // they qualify for 100% Attendance Double Salary (Extra 100% Base Salary bonus)!
    const isDoubleSalaryEligible = summaryKpis.absent === 0 && summaryKpis.halfday === 0 && summaryKpis.present > 0;
    const doubleSalaryBonus = isDoubleSalaryEligible ? baseMonthlySalary : 0;

    // Total Overtime Pay calculated in minutes:
    const totalOtPay = Math.round(summaryKpis.totalOtMinutes * otRatePerMinute);

    // Net Total Salary for Month = Earned Base + Double Salary Bonus + Overtime Pay
    const netTotalSalary = earnedBasePay + doubleSalaryBonus + totalOtPay;

    return {
      payrollDays: PAYROLL_DAYS,
      baseMonthlySalary,
      dailyRate: Math.round(dailyRate * 100) / 100,
      hourlyRate: Math.round(hourlyRate * 100) / 100,
      minuteRate: Math.round(minuteRate * 1000) / 1000,
      otRatePerHour: Math.round(otRatePerHour * 100) / 100,
      otRatePerMinute: Math.round(otRatePerMinute * 1000) / 1000,
      payableDays,
      earnedBasePay,
      isDoubleSalaryEligible,
      doubleSalaryBonus,
      totalOtMinutes: summaryKpis.totalOtMinutes,
      totalOtHours: summaryKpis.totalOtHours,
      totalOtPay,
      absentDeduction,
      halfDayDeduction,
      totalDeductions,
      netTotalSalary
    };
  }, [baseMonthlySalary, summaryKpis]);

  // Filtered Records for Table
  const filteredRecords = useMemo(() => {
    return monthDailyRecords.filter(r => {
      const matchesFilter = 
        statusFilter === 'All' ? true :
        statusFilter === 'Present' ? (r.status === 'Present' || r.status === 'Late Arrival') :
        statusFilter === 'Late Arrival' ? r.status === 'Late Arrival' :
        statusFilter === 'Absent' ? r.status === 'Absent' :
        statusFilter === 'Half-Day' ? r.status === 'Half-Day' :
        statusFilter === 'Weekly Off' ? r.status === 'Weekly Off' :
        statusFilter === 'Overtime' ? r.otMinutes > 0 : true;

      const matchesSearch = 
        r.formattedDate.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.day.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.status.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesFilter && matchesSearch;
    });
  }, [monthDailyRecords, statusFilter, searchTerm]);

  return (
    <div className="space-y-6 animate-in fade-in pb-12">
      {/* ============================================================== */}
      {/* 1. EMPLOYEE PROFILE HERO CARD                                  */}
      {/* Velavan Properties Executive Maroon Brand Card                 */}
      {/* ============================================================== */}
      <div className="relative bg-gradient-to-r from-[#8b0000] via-[#a70809] to-[#780000] text-white rounded-3xl p-4 sm:p-7 shadow-xl border border-red-950/20 overflow-hidden">
        {/* Ambient Brand Accent Glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-400/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5 sm:gap-6">
          {/* Left: Avatar & Identity Details */}
          <div className="flex items-center space-x-3 sm:space-x-5 min-w-0">
            <div className="relative shrink-0">
              <img
                src={activeEmployee?.avatar || activeEmployee?.doc_photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&auto=format&fit=crop&q=80'}
                alt={activeEmployee?.name}
                className="w-16 h-16 sm:w-24 sm:h-24 rounded-2xl object-cover border-2 border-amber-400 shadow-xl bg-white/10"
              />
              <span className="absolute -bottom-1 -right-1 bg-amber-400 text-slate-950 p-1 sm:p-1.5 rounded-full border-2 border-[#8b0000] shadow-md" title="Verified Staff Biometrics">
                <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </span>
            </div>

            <div className="min-w-0">
              {/* Employee ID Badge & Shift */}
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <span className="text-[11px] sm:text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-white/15 text-amber-200 border border-white/20">
                  {activeEmployee?.emp_id}
                </span>
                <span className="text-red-300">•</span>
                <span className="text-[10px] sm:text-[11px] text-red-100 font-medium truncate">
                  DOJ: <strong className="text-white">{activeEmployee?.doj || activeEmployee?.join_date || '2024'}</strong>
                </span>
              </div>

              {/* Full Name */}
              <h2 className="text-lg sm:text-3xl font-black text-white tracking-tight mt-0.5 sm:mt-1 truncate">
                {activeEmployee?.name || 'Employee Profile'}
              </h2>

              {/* Designation, Phone & Contact */}
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 mt-0.5 sm:mt-1 text-xs text-red-100">
                <div className="flex items-center space-x-1 font-semibold text-amber-200 text-[11px] sm:text-xs">
                  <Briefcase className="w-3 h-3 text-amber-300 shrink-0" />
                  <span className="truncate">{activeEmployee?.role || 'Staff Member'}</span>
                </div>
                <span className="text-red-300/80">•</span>
                <div className="flex items-center space-x-1 font-mono text-red-100 text-[11px] sm:text-xs">
                  <Phone className="w-3 h-3 text-red-200 shrink-0" />
                  <span>{activeEmployee?.phone || '--'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Allocated Monthly Salary & Office Shift Card */}
          <div className="flex flex-col sm:flex-row md:flex-col items-stretch sm:items-center md:items-end gap-2 w-full md:w-auto">
            <div className="bg-white/10 backdrop-blur-md px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-2xl border border-white/20 shadow-inner flex items-center justify-between sm:justify-start md:block w-full md:w-auto">
              <span className="text-[10px] text-red-200 uppercase font-semibold block tracking-wider">Allocated Monthly Salary</span>
              <div className="flex items-center space-x-1 sm:space-x-1.5 mt-0.5">
                <IndianRupee className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-300" />
                <span className="text-lg sm:text-2xl font-black text-amber-300 font-mono">
                  {baseMonthlySalary.toLocaleString('en-IN')}
                </span>
                <span className="text-xs text-red-100 font-medium">/ month</span>
              </div>
            </div>

            <div className="bg-white/10 px-3 py-1.5 rounded-xl border border-white/15 flex items-center justify-center sm:justify-start space-x-2 text-[11px] text-red-100 w-full sm:w-auto">
              <Clock className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span>Office Shift: <strong className="text-white">09:30 AM – 06:00 PM</strong></span>
            </div>
          </div>
        </div>

        {/* Office Policy Notice Strip */}
        <div className="mt-4 sm:mt-5 pt-3 border-t border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] sm:text-xs text-red-100">
          <div className="flex items-center space-x-2">
            <Building2 className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span>Daily attendance registered via <strong>FaceLock Terminal</strong>.</span>
          </div>
          <span className="text-[10px] sm:text-[11px] font-mono text-amber-200 font-semibold" title="9:30 in -> OT after 6:20; 9:40 in -> OT after 6:30 (Calculated from 6:00 PM in Minutes)">
            OT: After 6:20 PM Buffer (Calculated in Minutes from 6:00 PM)
          </span>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. MONTH SELECTOR TOOLBAR (PAST MONTH DETAILS ALSO SEE)        */}
      {/* Clean Light Toolbar with Velavan Maroon Accent                 */}
      {/* ============================================================== */}
      <div className="bg-white border border-slate-200 p-3 sm:p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-red-50 text-[#8b0000] flex items-center justify-center border border-red-100 shrink-0">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-xs sm:text-sm">Attendance & Salary Period</h3>
            <p className="text-[10px] sm:text-[11px] text-slate-500">
              Select any past or current month to view attendance history & calculated salary.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
          {/* Quick Month Dropdown */}
          <div className="relative flex-1 sm:flex-none">
            <select
              value={`${selectedYear}-${selectedMonth}`}
              onChange={(e) => {
                const [y, m] = e.target.value.split('-').map(Number);
                setSelectedDate(new Date(y, m, 1));
              }}
              className="w-full sm:w-auto bg-slate-50 text-slate-800 font-bold text-xs px-3 py-2 rounded-xl border border-slate-200 hover:border-slate-300 focus:ring-2 focus:ring-red-500/20 focus:border-[#8b0000] pr-7 cursor-pointer appearance-none shadow-2xs"
            >
              {pastMonthsList.map(opt => (
                <option key={opt.value} value={opt.value} className="bg-white text-slate-800">
                  {opt.label} {opt.year === new Date().getFullYear() && opt.month === new Date().getMonth() ? '(Current)' : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Prev Month */}
          <button
            onClick={handlePrevMonth}
            className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 transition-colors shadow-2xs shrink-0"
            title="Previous Month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Current Month pill */}
          <button
            onClick={handleResetToCurrentMonth}
            className={`px-2.5 sm:px-3 py-2 rounded-xl text-xs font-bold transition-colors shrink-0 ${
              isCurrentMonth
                ? 'bg-[#8b0000] text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            Current
          </button>

          {/* Next Month */}
          <button
            onClick={handleNextMonth}
            className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 transition-colors shadow-2xs shrink-0"
            title="Next Month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. MONTHLY SALARY & OVERTIME CALCULATION CARD                  */}
      {/* Light Theme Executive Payout Card with Velavan Palette        */}
      {/* ============================================================== */}
      <div className="relative bg-gradient-to-br from-white via-red-50/20 to-amber-50/30 border-2 border-red-200/80 rounded-3xl p-4 sm:p-7 shadow-md overflow-hidden">
        {/* Soft Ambient Brand Glow */}
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-red-500/5 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6 pb-4 sm:pb-6 border-b border-red-100">
          <div>
            <div className="inline-flex items-center space-x-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-red-50 text-[#8b0000] text-xs font-bold mb-1.5 sm:mb-2 border border-red-200">
              <Sparkles className="w-3.5 h-3.5 text-[#8b0000]" />
              <span>{selectedMonthLabel} • Salary & Overtime Calculation</span>
            </div>

            <h3 className="text-base sm:text-xl font-black text-slate-900 tracking-tight">
              Calculated Monthly Payout
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-600 max-w-lg mt-0.5">
              Includes base attendance earnings (Present + Weekly Offs) plus Overtime (OT) after 20-min buffer from 06:00 PM (calculated on fixed 30 days standard).
            </p>
          </div>

          {/* Payout Display */}
          <div className="bg-white border-2 border-red-200 p-3 sm:p-5 rounded-2xl flex items-center justify-between sm:justify-start sm:space-x-5 shadow-xs w-full lg:w-auto">
            <div className="min-w-0">
              <span className="text-[10px] sm:text-[11px] text-slate-500 uppercase font-bold block tracking-wider truncate">
                Total Net Salary ({selectedMonthLabel.split(' ')[0]})
              </span>
              <div className="flex items-center space-x-1 text-2xl sm:text-4xl font-black text-[#8b0000] font-mono mt-0.5">
                <IndianRupee className="w-6 h-6 sm:w-7 sm:h-7 text-[#8b0000]" />
                <span>{salaryCalculation.netTotalSalary.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[10px] sm:text-[11px] text-slate-500 mt-1 font-medium">
                <span>Base: ₹{salaryCalculation.earnedBasePay.toLocaleString('en-IN')}</span>
                {salaryCalculation.isDoubleSalaryEligible && (
                  <>
                    <span>•</span>
                    <span className="text-amber-900 font-bold bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300">
                      🏆 2× Double Salary: +₹{salaryCalculation.doubleSalaryBonus.toLocaleString('en-IN')}
                    </span>
                  </>
                )}
                <span>•</span>
                <span className="text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  +₹{salaryCalculation.totalOtPay.toLocaleString('en-IN')} OT ({summaryKpis.totalOtMinutes}m)
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowFormula(prev => !prev)}
              className="p-2 sm:p-2.5 bg-red-50 hover:bg-red-100 text-[#8b0000] rounded-xl border border-red-200 transition-colors flex flex-col items-center justify-center text-[10px] font-bold shadow-2xs shrink-0"
              title="Show Calculation Formula"
            >
              <Info className="w-4 h-4 mb-0.5" />
              <span>Formula</span>
            </button>
          </div>
        </div>

        {/* 100% Zero-Absent Double Salary Incentive Banner */}
        {salaryCalculation.isDoubleSalaryEligible ? (
          <div className="relative z-10 mt-3 sm:mt-4 p-3 sm:p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-yellow-500/20 to-emerald-500/15 border-2 border-amber-400/60 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center text-xl font-black shadow-md shrink-0">
                🏆
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-xs sm:text-sm font-black text-amber-950 tracking-tight">
                    100% Attendance Double Salary Bonus Activated!
                  </h4>
                  <span className="bg-amber-500 text-white text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider shadow-2xs">
                    2× Base Salary
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-amber-900 mt-0.5">
                  Zero absences recorded for {selectedMonthLabel} ({summaryKpis.present} days present). You earned an extra 100% base salary incentive (+₹{salaryCalculation.doubleSalaryBonus.toLocaleString('en-IN')}) giving you 2× Double Salary (+ Overtime)!
                </p>
              </div>
            </div>
            <div className="bg-white/95 border border-amber-300 px-3.5 py-1.5 rounded-xl font-mono font-black text-amber-900 text-sm sm:text-base shrink-0 shadow-2xs">
              +₹{salaryCalculation.doubleSalaryBonus.toLocaleString('en-IN')} Bonus
            </div>
          </div>
        ) : (
          <div className="relative z-10 mt-3 sm:mt-4 p-2.5 sm:p-3 rounded-2xl bg-slate-50/90 border border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="text-[11px] sm:text-xs">
                <strong>Company Attendance Incentive:</strong> Zero absences in a calendar month qualifies for <strong>2× Double Salary</strong> (+100% Base Salary bonus). Currently: <strong className="text-rose-600">{summaryKpis.absent} Absent day(s)</strong> recorded.
              </span>
            </div>
          </div>
        )}

        {/* Salary Component Breakdown Grid (5 Components: Base, Payable, 100% Bonus, OT Mins, OT Pay) */}
        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3.5 mt-4 sm:mt-5">
          {/* 1. Base Allocated Salary */}
          <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] text-slate-500 uppercase font-bold block truncate">1. Base Salary</span>
            <div className="text-sm sm:text-lg font-black text-slate-900 font-mono mt-0.5 sm:mt-1">
              ₹{baseMonthlySalary.toLocaleString('en-IN')}
            </div>
            <span className="text-[10px] text-[#8b0000] font-semibold truncate block">₹{salaryCalculation.dailyRate}/day (30 Days)</span>
          </div>

          {/* 2. Payable Days Earned */}
          <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] text-slate-500 uppercase font-bold block truncate">2. Payable Days</span>
            <div className="text-sm sm:text-lg font-black text-[#8b0000] font-mono mt-0.5 sm:mt-1">
              {salaryCalculation.payableDays} / 30 Days
            </div>
            <span className="text-[10px] text-slate-500 truncate block">
              ₹{salaryCalculation.earnedBasePay.toLocaleString('en-IN')} Base
            </span>
          </div>

          {/* 3. 100% Zero-Absent Double Salary Bonus */}
          <div className={`p-3 sm:p-3.5 rounded-2xl border shadow-2xs ${
            salaryCalculation.isDoubleSalaryEligible 
              ? 'bg-amber-50/60 border-amber-300 ring-1 ring-amber-300/50' 
              : 'bg-white border-slate-200'
          }`}>
            <span className={`text-[10px] uppercase font-bold block truncate ${
              salaryCalculation.isDoubleSalaryEligible ? 'text-amber-800' : 'text-slate-500'
            }`}>
              3. Zero-Absent Bonus
            </span>
            <div className={`text-sm sm:text-lg font-black font-mono mt-0.5 sm:mt-1 ${
              salaryCalculation.isDoubleSalaryEligible ? 'text-amber-700' : 'text-slate-400'
            }`}>
              {salaryCalculation.isDoubleSalaryEligible ? `+₹${salaryCalculation.doubleSalaryBonus.toLocaleString('en-IN')}` : '₹0'}
            </div>
            <span className={`text-[10px] truncate block ${
              salaryCalculation.isDoubleSalaryEligible ? 'text-amber-700 font-bold' : 'text-slate-400'
            }`}>
              {salaryCalculation.isDoubleSalaryEligible ? '🏆 2× Double Salary Active' : 'Requires 0 Absents'}
            </span>
          </div>

          {/* 4. Overtime Minutes */}
          <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-amber-200 shadow-2xs">
            <span className="text-[10px] text-amber-700 uppercase font-bold block truncate">4. OT Minutes</span>
            <div className="text-sm sm:text-lg font-black text-amber-700 font-mono mt-0.5 sm:mt-1">
              {summaryKpis.totalOtMinutes} mins
            </div>
            <span className="text-[10px] text-slate-500 truncate block">Past buffer (From 6:00 PM)</span>
          </div>

          {/* 5. Overtime Pay Added */}
          <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-amber-200 shadow-2xs">
            <span className="text-[10px] text-amber-700 uppercase font-bold block truncate">5. Overtime Pay</span>
            <div className="text-sm sm:text-lg font-black text-amber-700 font-mono mt-0.5 sm:mt-1">
              +₹{salaryCalculation.totalOtPay.toLocaleString('en-IN')}
            </div>
            <span className="text-[10px] text-slate-500 truncate block">@ ₹{salaryCalculation.otRatePerMinute}/min (1.5x)</span>
          </div>
        </div>

        {/* Detailed Transparent Formula Accordion */}
        {showFormula && (
          <div className="mt-4 sm:mt-5 p-3.5 sm:p-4 rounded-2xl bg-white border border-red-200 text-xs text-slate-700 space-y-2 animate-in fade-in shadow-xs">
            <div className="font-bold text-[#8b0000] uppercase text-[11px] tracking-wider flex items-center space-x-1.5">
              <Info className="w-3.5 h-3.5 shrink-0" />
              <span>Salary, Double Salary Incentive & Overtime Formula Breakdown</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px]">
              <div className="space-y-1">
                <p>• <strong>Payroll Days:</strong> Fixed 30 Days Standard</p>
                <p>• <strong>Daily Rate:</strong> ₹{baseMonthlySalary} ÷ 30 = <strong>₹{salaryCalculation.dailyRate} / day</strong></p>
                <p>• <strong>Shift Working Minutes:</strong> 8.5 hours = <strong>510 mins / day (09:30 AM to 06:00 PM)</strong></p>
                <p>• <strong>Base Rate per Minute:</strong> ₹{salaryCalculation.dailyRate} ÷ 510 = <strong>₹{salaryCalculation.minuteRate} / min</strong></p>
                <p>• <strong>OT Rate per Minute (1.5x):</strong> ₹{salaryCalculation.minuteRate} × 1.5 = <strong>₹{salaryCalculation.otRatePerMinute} / min</strong></p>
              </div>
              <div className="space-y-1">
                <p>• <strong>Zero-Absent Double Salary Rule:</strong> 0 Absents in Month $\rightarrow$ <strong>+100% Base Pay Bonus (2× Double Salary: +₹{salaryCalculation.doubleSalaryBonus.toLocaleString('en-IN')})</strong></p>
                <p>• <strong>Payable Days:</strong> 30 - {summaryKpis.absent} Absent - {summaryKpis.halfday * 0.5} Half-Days = <strong>{salaryCalculation.payableDays} days</strong></p>
                <p>• <strong>Earned Base Pay:</strong> ₹{baseMonthlySalary} - Deductions = <strong>₹{salaryCalculation.earnedBasePay.toLocaleString('en-IN')}</strong></p>
                <p>• <strong>Total OT Minutes:</strong> <strong>{summaryKpis.totalOtMinutes} mins</strong> ({summaryKpis.overtimeDays} days)</p>
                <p>• <strong>Overtime Pay:</strong> {summaryKpis.totalOtMinutes} mins × ₹{salaryCalculation.otRatePerMinute}/min = <strong>+₹{salaryCalculation.totalOtPay.toLocaleString('en-IN')}</strong></p>
              </div>
            </div>
            <div className="pt-2 border-t border-slate-200 text-[#8b0000] font-bold font-mono text-xs">
              Net Total Salary = Base Pay (₹{salaryCalculation.earnedBasePay.toLocaleString('en-IN')}) + Attendance Bonus (+₹{salaryCalculation.doubleSalaryBonus.toLocaleString('en-IN')}) + Overtime (+₹{salaryCalculation.totalOtPay.toLocaleString('en-IN')}) = <strong>₹{salaryCalculation.netTotalSalary.toLocaleString('en-IN')}</strong>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* 4. ATTENDANCE SUMMARY (5 REQUESTED KPI CARDS)                  */}
      {/* Present, Absent, Half-Day, Weekly Off, Overtime                */}
      {/* ============================================================== */}
      <div>
        <div className="flex items-center justify-between mb-2.5 sm:mb-3">
          <h3 className="font-bold text-slate-800 text-sm sm:text-base flex items-center space-x-1.5 sm:space-x-2">
            <TrendingUp className="w-4 h-4 text-[#8b0000]" />
            <span>Attendance Summary • {selectedMonthLabel}</span>
          </h3>
          <span className="text-[11px] sm:text-xs text-slate-500 font-mono">
            {totalDaysInMonth} Days
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3.5">
          {/* 1. PRESENT */}
          <div 
            onClick={() => setStatusFilter(statusFilter === 'Present' ? 'All' : 'Present')}
            className={`p-3 sm:p-4 rounded-2xl border transition-all cursor-pointer shadow-xs ${
              statusFilter === 'Present'
                ? 'bg-emerald-50 border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
                : 'bg-white border-slate-200 hover:border-emerald-500'
            }`}
          >
            <div className="flex items-center justify-between text-emerald-700 mb-0.5 sm:mb-1">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">Present</span>
              <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono mt-0.5 sm:mt-1">
              {summaryKpis.present}
            </div>
            <span className="text-[10px] sm:text-[11px] text-emerald-700 font-medium mt-0.5 block truncate">
              Full days on-duty
            </span>
          </div>

          {/* 2. ABSENT */}
          <div 
            onClick={() => setStatusFilter(statusFilter === 'Absent' ? 'All' : 'Absent')}
            className={`p-3 sm:p-4 rounded-2xl border transition-all cursor-pointer shadow-xs ${
              statusFilter === 'Absent'
                ? 'bg-rose-50 border-rose-500 shadow-md ring-2 ring-rose-500/20'
                : 'bg-white border-slate-200 hover:border-rose-500'
            }`}
          >
            <div className="flex items-center justify-between text-rose-700 mb-0.5 sm:mb-1">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">Absent</span>
              <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono mt-0.5 sm:mt-1">
              {summaryKpis.absent}
            </div>
            <span className="text-[10px] sm:text-[11px] text-rose-700 font-medium mt-0.5 block truncate">
              Loss of pay days
            </span>
          </div>

          {/* 3. HALF-DAY */}
          <div 
            onClick={() => setStatusFilter(statusFilter === 'Half-Day' ? 'All' : 'Half-Day')}
            className={`p-3 sm:p-4 rounded-2xl border transition-all cursor-pointer shadow-xs ${
              statusFilter === 'Half-Day'
                ? 'bg-amber-50 border-amber-500 shadow-md ring-2 ring-amber-500/20'
                : 'bg-white border-slate-200 hover:border-amber-500'
            }`}
          >
            <div className="flex items-center justify-between text-amber-700 mb-0.5 sm:mb-1">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">Half-Day</span>
              <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono mt-0.5 sm:mt-1">
              {summaryKpis.halfday}
            </div>
            <span className="text-[10px] sm:text-[11px] text-amber-700 font-medium mt-0.5 block truncate">
              0.5 payable credit
            </span>
          </div>

          {/* 4. WEEKLY OFF */}
          <div 
            onClick={() => setStatusFilter(statusFilter === 'Weekly Off' ? 'All' : 'Weekly Off')}
            className={`p-3 sm:p-4 rounded-2xl border transition-all cursor-pointer shadow-xs ${
              statusFilter === 'Weekly Off'
                ? 'bg-purple-50 border-purple-500 shadow-md ring-2 ring-purple-500/20'
                : 'bg-white border-slate-200 hover:border-purple-500'
            }`}
          >
            <div className="flex items-center justify-between text-purple-700 mb-0.5 sm:mb-1">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">Weekly Off</span>
              <Coffee className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono mt-0.5 sm:mt-1">
              {summaryKpis.weeklyoff}
            </div>
            <span className="text-[10px] sm:text-[11px] text-purple-700 font-medium mt-0.5 block truncate">
              Paid Sunday rest
            </span>
          </div>

          {/* 5. OVERTIME (Full width on mobile col-span-2) */}
          <div 
            onClick={() => setStatusFilter(statusFilter === 'Overtime' ? 'All' : 'Overtime')}
            className={`col-span-2 sm:col-span-1 p-3 sm:p-4 rounded-2xl border transition-all cursor-pointer shadow-xs ${
              statusFilter === 'Overtime'
                ? 'bg-red-50 border-[#8b0000] shadow-md ring-2 ring-red-500/20'
                : 'bg-white border-slate-200 hover:border-[#8b0000]'
            }`}
          >
            <div className="flex items-center justify-between text-[#8b0000] mb-0.5 sm:mb-1">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">Overtime</span>
              <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#8b0000]" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-[#8b0000] font-mono mt-0.5 sm:mt-1">
              {summaryKpis.totalOtMinutes} <span className="text-sm sm:text-base text-slate-600 font-sans">mins</span>
            </div>
            <span className="text-[10px] sm:text-[11px] text-slate-600 font-medium mt-0.5 block truncate">
              {summaryKpis.overtimeDays} days (+₹{salaryCalculation.totalOtPay.toLocaleString('en-IN')})
            </span>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 5. DAILY ATTENDANCE BREAKDOWN (MOBILE CARDS + DESKTOP TABLE)   */}
      {/* ============================================================== */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
        {/* Table Toolbar */}
        <div className="p-3.5 sm:p-5 border-b border-slate-200 flex flex-col gap-3 bg-slate-50/70">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-slate-800 text-sm sm:text-base">
                Daily Timesheet Logs • {selectedMonthLabel}
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                Day-by-day record of clock-in, clock-out, overtime minutes, and calculated pay.
              </p>
            </div>

            {/* View Mode Switcher Pills */}
            <div className="flex items-center bg-slate-200/80 p-0.5 rounded-xl text-xs shrink-0 self-start sm:self-auto">
              <button
                onClick={() => setViewMode('cards')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center space-x-1 ${
                  viewMode === 'cards'
                    ? 'bg-white text-[#8b0000] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>📱 Cards</span>
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center space-x-1 ${
                  viewMode === 'table'
                    ? 'bg-white text-[#8b0000] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>📋 Table</span>
              </button>
            </div>
          </div>

          {/* Search & Horizontal Swipeable Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="relative w-full sm:w-64 shrink-0">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search date or day..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-red-500/20 focus:border-[#8b0000] shadow-2xs"
              />
            </div>

            {/* Scrollable Filter Pills on Mobile */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none w-full">
              {['All', 'Present', 'Absent', 'Half-Day', 'Weekly Off', 'Overtime'].map(f => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    statusFilter === f
                      ? 'bg-[#8b0000] text-white shadow-xs font-bold'
                      : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200/60'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* VIEW A: MOBILE CARDS VIEW (Responsive & Touch-Friendly)         */}
        {/* ============================================================== */}
        {viewMode === 'cards' && (
          <div className="p-3 sm:p-5">
            {filteredRecords.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs font-sans">
                No matching records found for this filter.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredRecords.map((r) => {
                  let dayPay = 0;
                  if (r.status === 'Present' || r.status === 'Late Arrival') {
                    dayPay = Math.round(salaryCalculation.dailyRate + (r.otMinutes * salaryCalculation.otRatePerMinute));
                  } else if (r.status === 'Half-Day') {
                    dayPay = Math.round((salaryCalculation.dailyRate * 0.5) + (r.otMinutes * salaryCalculation.otRatePerMinute));
                  } else if (r.status === 'Weekly Off') {
                    dayPay = Math.round(salaryCalculation.dailyRate + (r.otMinutes * salaryCalculation.otRatePerMinute));
                  } else if (r.status === 'Upcoming') {
                    dayPay = null;
                  }

                  return (
                    <div 
                      key={r.date}
                      className="bg-white border border-slate-200/90 hover:border-[#8b0000]/40 rounded-2xl p-3.5 shadow-xs transition-all space-y-2.5"
                    >
                      {/* Top: Date, Day badge & Status badge */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="font-black text-slate-900 text-xs sm:text-sm">{r.formattedDate}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            r.isSunday ? 'bg-purple-100 text-purple-700 border border-purple-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}>
                            {r.day}
                          </span>
                        </div>

                        {/* Status badge */}
                        <div>
                          {r.status === 'Present' && (
                            <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Present</span>
                            </span>
                          )}
                          {r.status === 'Late Arrival' && (
                            <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              <AlertCircle className="w-3 h-3 text-amber-600" />
                              <span>Late Arrival</span>
                            </span>
                          )}
                          {r.status === 'Half-Day' && (
                            <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              <AlertCircle className="w-3 h-3 text-amber-600" />
                              <span>Half-Day</span>
                            </span>
                          )}
                          {r.status === 'Weekly Off' && (
                            <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                              <Coffee className="w-3 h-3 text-purple-600" />
                              <span>Weekly Off</span>
                            </span>
                          )}
                          {r.status === 'Absent' && (
                            <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                              <XCircle className="w-3 h-3 text-rose-600" />
                              <span>Absent (LOP)</span>
                            </span>
                          )}
                          {r.status === 'Upcoming' && (
                            <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                              Upcoming
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Middle: 3-column punch & hours strip */}
                      <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl text-center text-xs border border-slate-100">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-medium">Clock In</span>
                          <span className={`font-mono font-bold text-xs ${
                            r.clockIn !== '--' ? (r.clockIn > '09:40:00' ? 'text-amber-700' : 'text-emerald-700') : 'text-slate-400'
                          }`}>
                            {r.clockIn}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-medium">Clock Out</span>
                          <span className={`font-mono font-bold text-xs ${
                            r.clockOut !== '--' ? (r.clockOut > '18:15:00' ? 'text-amber-700' : 'text-slate-700') : 'text-slate-400'
                          }`}>
                            {r.clockOut}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-medium">Shift Total</span>
                          <span className="font-mono font-bold text-xs text-slate-700">
                            {r.totalHours > 0 ? `${r.totalHours} hrs` : '--'}
                          </span>
                        </div>
                      </div>

                      {/* Bottom: Overtime Badge & Day Earnings */}
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                        <div>
                          {r.otMinutes > 0 ? (
                            <span className="inline-flex items-center space-x-1 font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 text-[11px]">
                              <Flame className="w-3.5 h-3.5 text-amber-600" />
                              <span>+{r.otMinutes} mins OT</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">No Overtime</span>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block">Est. Day Earnings</span>
                          <span className="font-bold text-[#8b0000] font-mono text-xs sm:text-sm">
                            {dayPay !== null ? `₹${dayPay.toLocaleString('en-IN')}` : '--'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* VIEW B: FULL TABLE VIEW (Desktop / Scrollable Table)            */}
        {/* ============================================================== */}
        {viewMode === 'table' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200 text-[11px]">
                <tr>
                  <th className="px-4 py-3.5">Date & Day</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Clock In</th>
                  <th className="px-4 py-3.5">Clock Out</th>
                  <th className="px-4 py-3.5">Total Hours</th>
                  <th className="px-4 py-3.5">Overtime (OT Minutes)</th>
                  <th className="px-4 py-3.5 text-right">Est. Day Earnings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center text-slate-400 font-sans">
                      No matching records found for this filter.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((r) => {
                    let dayPay = 0;
                    if (r.status === 'Present' || r.status === 'Late Arrival') {
                      dayPay = Math.round(salaryCalculation.dailyRate + (r.otMinutes * salaryCalculation.otRatePerMinute));
                    } else if (r.status === 'Half-Day') {
                      dayPay = Math.round((salaryCalculation.dailyRate * 0.5) + (r.otMinutes * salaryCalculation.otRatePerMinute));
                    } else if (r.status === 'Weekly Off') {
                      dayPay = Math.round(salaryCalculation.dailyRate + (r.otMinutes * salaryCalculation.otRatePerMinute));
                    } else if (r.status === 'Upcoming') {
                      dayPay = null;
                    }

                    return (
                      <tr key={r.date} className="hover:bg-slate-50/80 transition-colors">
                        {/* Date & Day */}
                        <td className="px-4 py-3 font-sans">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-900 text-xs">{r.formattedDate}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              r.isSunday ? 'bg-purple-100 text-purple-700 border border-purple-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}>
                              {r.day}
                            </span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3 font-sans">
                          {r.status === 'Present' && (
                            <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Present</span>
                            </span>
                          )}
                          {r.status === 'Late Arrival' && (
                            <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                              <AlertCircle className="w-3 h-3 text-amber-600" />
                              <span>Late Arrival</span>
                            </span>
                          )}
                          {r.status === 'Half-Day' && (
                            <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                              <AlertCircle className="w-3 h-3 text-amber-600" />
                              <span>Half-Day</span>
                            </span>
                          )}
                          {r.status === 'Weekly Off' && (
                            <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
                              <Coffee className="w-3 h-3 text-purple-600" />
                              <span>Weekly Off (Paid)</span>
                            </span>
                          )}
                          {r.status === 'Absent' && (
                            <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                              <XCircle className="w-3 h-3 text-rose-600" />
                              <span>Absent (LOP)</span>
                            </span>
                          )}
                          {r.status === 'Upcoming' && (
                            <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                              Upcoming
                            </span>
                          )}
                        </td>

                        {/* Clock In */}
                        <td className="px-4 py-3 text-slate-800">
                          {r.clockIn !== '--' ? (
                            <span className={r.clockIn > '09:40:00' ? 'text-amber-700 font-bold' : 'text-emerald-700 font-semibold'}>
                              {r.clockIn}
                            </span>
                          ) : (
                            <span className="text-slate-400">--</span>
                          )}
                        </td>

                        {/* Clock Out */}
                        <td className="px-4 py-3 text-slate-800">
                          {r.clockOut !== '--' ? (
                            <span className={r.clockOut > '18:15:00' ? 'text-amber-700 font-bold' : 'text-slate-700'}>
                              {r.clockOut}
                            </span>
                          ) : (
                            <span className="text-slate-400">--</span>
                          )}
                        </td>

                        {/* Total Hours */}
                        <td className="px-4 py-3 text-slate-700">
                          {r.totalHours > 0 ? (
                            <span>{r.totalHours} hrs</span>
                          ) : (
                            <span className="text-slate-400">--</span>
                          )}
                        </td>

                        {/* Overtime in Minutes */}
                        <td className="px-4 py-3">
                          {r.otMinutes > 0 ? (
                            <span className="inline-flex items-center space-x-1 font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[11px]">
                              <Flame className="w-3 h-3 text-amber-600" />
                              <span>+{r.otMinutes} mins OT</span>
                            </span>
                          ) : (
                            <span className="text-slate-400">--</span>
                          )}
                        </td>

                        {/* Day Estimated Pay */}
                        <td className="px-4 py-3 text-right">
                          {dayPay !== null ? (
                            <span className="font-bold text-[#8b0000]">
                              ₹{dayPay.toLocaleString('en-IN')}
                            </span>
                          ) : (
                            <span className="text-slate-400">--</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Table Footer Summary */}
        <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div>
            Showing <strong>{filteredRecords.length}</strong> of <strong>{totalDaysInMonth}</strong> days in {selectedMonthLabel}.
          </div>
          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 text-slate-700">
            <span>Payable: <strong className="text-emerald-700">{salaryCalculation.payableDays}d</strong></span>
            <span>•</span>
            <span>OT: <strong className="text-amber-700">{summaryKpis.totalOtMinutes} mins</strong></span>
            <span>•</span>
            <span>Month Total: <strong className="text-[#8b0000] font-mono text-sm font-black">₹{salaryCalculation.netTotalSalary.toLocaleString('en-IN')}</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
}
