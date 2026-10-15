import React, { useState, useEffect, useMemo } from 'react';
import { 
  ScanFace, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  ArrowRight, 
  Users, 
  TrendingUp, 
  ShieldCheck, 
  Building2, 
  Sparkles, 
  Key,
  Coffee,
  Briefcase,
  Flame,
  Search,
  Filter,
  Check
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';

export default function Home({ setActiveTab }) {
  const { 
    employees,
    activeEmployee, 
    switchActiveEmployee,
    todayRecord, 
    todayAttendance, 
    officeSettings, 
    refreshData 
  } = useApp();

  const [currentTime, setCurrentTime] = useState(new Date());
  const [elapsedTimer, setElapsedTimer] = useState('00:00:00');
  const [myHistory, setMyHistory] = useState([]);
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  // Digital clock update
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Calculate elapsed work time if currently clocked in
  useEffect(() => {
    if (!todayRecord || !todayRecord.clock_in || todayRecord.clock_out) {
      setElapsedTimer('00:00:00');
      return;
    }

    const updateElapsed = () => {
      const [h, m, s = 0] = todayRecord.clock_in.split(':').map(Number);
      const clockInDate = new Date();
      clockInDate.setHours(h, m, s, 0);

      const diffMs = Math.max(0, new Date() - clockInDate);
      const hrs = Math.floor(diffMs / 3600000).toString().padStart(2, '0');
      const mins = Math.floor((diffMs % 3600000) / 60000).toString().padStart(2, '0');
      const secs = Math.floor((diffMs % 60000) / 1000).toString().padStart(2, '0');
      setElapsedTimer(`${hrs}:${mins}:${secs}`);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [todayRecord]);

  // Load employee's personal history
  useEffect(() => {
    if (activeEmployee) {
      api.getHistory(activeEmployee.emp_id)
        .then(histRes => setMyHistory(histRes || []))
        .catch(() => setMyHistory([]));
    }
  }, [activeEmployee]);

  // Compute daily calendar attendance records from 1st of month to today
  const dailyAttendanceRecords = useMemo(() => {
    if (!activeEmployee) return [];

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysUpToToday = now.getDate();
    const items = [];

    // Map database history by YYYY-MM-DD
    const histMap = new Map();
    (myHistory || []).forEach(r => histMap.set(r.date, r));

    for (let day = daysUpToToday; day >= 1; day--) {
      const curDate = new Date(year, month, day);
      const dateStr = curDate.toISOString().split('T')[0];
      const dayName = curDate.toLocaleDateString('en-US', { weekday: 'long' });
      const formattedDate = curDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const isSunday = curDate.getDay() === 0;

      const hist = histMap.get(dateStr);

      let status = 'Absent';
      let clockIn = '--';
      let clockOut = '--';
      let totalHours = 0;
      let overtime = 0;

      if (isSunday) {
        status = 'Weekly Off';
      } else if (hist) {
        clockIn = hist.clock_in || '--';
        clockOut = hist.clock_out || (dateStr === now.toISOString().split('T')[0] ? 'In Progress' : '--');
        totalHours = hist.total_hours || 0;

        // Calculate overtime past 6:15 PM (18:15)
        if (hist.ot_hours !== undefined && hist.ot_hours !== null && Number(hist.ot_hours) > 0) {
          overtime = Number(Number(hist.ot_hours).toFixed(2));
        } else if (hist.clock_out && hist.clock_out !== '--' && hist.clock_out !== 'In Progress') {
          const parts = hist.clock_out.split(':');
          if (parts.length >= 2) {
            const outMinutes = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
            const endThreshold = 18 * 60 + 15; // 18:15 (6:15 PM)
            if (outMinutes > endThreshold) {
              overtime = Number(((outMinutes - endThreshold) / 60).toFixed(2));
            }
          }
        }

        // Late arrival mention: morning after 09:40 AM
        if (hist.status === 'half_day') {
          status = 'Half-Day';
        } else if (hist.status === 'late' || (hist.clock_in && hist.clock_in > '09:40:00')) {
          status = 'Late Arrival';
        } else {
          status = 'Present';
        }
      } else {
        if (dateStr === now.toISOString().split('T')[0]) {
          status = 'Pending Check-in';
        } else {
          status = 'Absent';
        }
      }

      items.push({
        date: dateStr,
        formattedDate,
        day: dayName,
        status,
        team: activeEmployee.department,
        clockIn,
        clockOut,
        totalHours,
        overtime
      });
    }

    return items;
  }, [activeEmployee, myHistory]);

  // Compute the 5 specific KPIs requested by user:
  // present, absent, halfday, weeklyoff, overtime
  const summaryKpis = useMemo(() => {
    let present = 0;
    let absent = 0;
    let halfday = 0;
    let weeklyoff = 0;
    let overtimeDays = 0;
    let totalOvertimeHours = 0;

    dailyAttendanceRecords.forEach(r => {
      if (r.status === 'Present' || r.status === 'Late Arrival' || r.status === 'Present (Late)') {
        present += 1;
      } else if (r.status === 'Absent') {
        absent += 1;
      } else if (r.status === 'Half-Day') {
        halfday += 1;
      } else if (r.status === 'Weekly Off') {
        weeklyoff += 1;
      }

      if (r.overtime > 0) {
        overtimeDays += 1;
        totalOvertimeHours += r.overtime;
      }
    });

    return {
      present,
      absent,
      halfday,
      weeklyoff,
      overtimeDays,
      totalOvertimeHours: Number(totalOvertimeHours.toFixed(2))
    };
  }, [dailyAttendanceRecords]);

  // Filtered list for detailed attendance summary
  const filteredDailyRecords = useMemo(() => {
    return dailyAttendanceRecords.filter(r => {
      const matchesSearch = 
        r.date.includes(searchTerm) ||
        r.day.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.team.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      if (statusFilter === 'All') return true;
      if (statusFilter === 'Present') return r.status === 'Present' || r.status === 'Late Arrival' || r.status.includes('Present');
      if (statusFilter === 'Late Arrival') return r.status === 'Late Arrival' || r.status.includes('Late');
      if (statusFilter === 'Absent') return r.status === 'Absent';
      if (statusFilter === 'Half-Day') return r.status === 'Half-Day';
      if (statusFilter === 'Weekly Off') return r.status === 'Weekly Off';
      if (statusFilter === 'Overtime') return r.overtime > 0;
      return true;
    });
  }, [dailyAttendanceRecords, statusFilter, searchTerm]);

  const greetingTime = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const isClockedIn = !!todayRecord?.clock_in && !todayRecord?.clock_out;
  const isClockedOut = !!todayRecord?.clock_out;
  const isLate = todayRecord?.status === 'late' || (todayRecord?.clock_in && todayRecord.clock_in > '09:45:00');

  return (
    <div className="space-y-6">
      {/* 1. EMPLOYEE PROFILE HERO CARD */}
      <div className="relative bg-gradient-to-r from-slate-900 via-slate-900 to-slate-850 border border-slate-800 rounded-2xl p-6 sm:p-7 shadow-xl overflow-hidden">
        {/* Glow ambient background */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Employee Avatar & Details */}
          <div className="flex items-center space-x-4 sm:space-x-5">
            <div className="relative">
              <img
                src={activeEmployee?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=140&auto=format&fit=crop&q=80'}
                alt={activeEmployee?.name}
                className="w-18 h-18 sm:w-22 sm:h-22 rounded-2xl object-cover border-2 border-emerald-500 shadow-xl"
              />
              {activeEmployee?.has_face_enrolled ? (
                <div
                  className="absolute -bottom-1 -right-1 bg-emerald-500 text-black p-1.5 rounded-full border-2 border-slate-900 shadow-md"
                  title="FaceLock Biometric Enrolled"
                >
                  <ScanFace className="w-3.5 h-3.5" />
                </div>
              ) : null}
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[11px] uppercase font-bold text-emerald-400 tracking-wider">
                  {greetingTime()}
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {activeEmployee?.emp_id}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1">
                {activeEmployee?.name || 'Employee Profile'}
              </h2>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-300">
                <span className="font-semibold text-emerald-300">{activeEmployee?.role}</span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-400 font-medium">Team: <strong className="text-white">{activeEmployee?.department}</strong></span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-400 font-mono">{activeEmployee?.phone}</span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-400">{activeEmployee?.email}</span>
              </div>
            </div>
          </div>

          {/* Real-Time Digital Clock & Personal Status */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="bg-slate-950/80 backdrop-blur-md px-4 py-3 rounded-2xl border border-slate-800 text-right shadow-inner">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Live Time</div>
              <div className="text-xl sm:text-2xl font-mono font-black text-emerald-400">
                {currentTime.toLocaleTimeString()}
              </div>
              <div className="text-[10px] text-slate-500">
                {currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800 text-xs space-y-1">
              <div className="flex items-center space-x-1.5 text-slate-300 font-semibold">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Verified Session</span>
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                ID: <span className="text-white font-bold">{activeEmployee?.emp_id}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Today's Punch Live Indicator Bar */}
        <div className="mt-5 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-300">
              Today's Status:{' '}
              {isClockedIn ? (
                <strong className={isLate ? "text-amber-400" : "text-emerald-400"}>
                  Clocked In at {todayRecord.clock_in} {isLate ? '(Late Arrival)' : ''} ({elapsedTimer} elapsed) • Recorded at Office Terminal
                </strong>
              ) : isClockedOut ? (
                <strong className="text-blue-400">
                  Shift Completed at {todayRecord.clock_out} ({todayRecord.total_hours} hrs
                  {todayRecord.ot_minutes > 0 ? `, +${todayRecord.ot_minutes} mins OT` : todayRecord.ot_hours > 0 ? `, +${Math.round(todayRecord.ot_hours * 60)} mins OT` : ''}) • Recorded at Office Terminal
                </strong>
              ) : (
                <strong className="text-amber-400">
                  Not Clocked In Yet — Please mark attendance at the Office FaceLock terminal upon arrival
                </strong>
              )}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-1 bg-slate-950 text-emerald-400 text-[11px] font-bold rounded-lg border border-slate-800 flex items-center space-x-1.5">
              <Building2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Office Terminal Only</span>
            </span>
            <button
              onClick={() => setActiveTab('attendance')}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 flex items-center space-x-1.5 transition-colors"
            >
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              <span>View Timesheet</span>
            </button>
          </div>
        </div>
      </div>

      {/* Office Attendance Policy Banner */}
      <div className="bg-slate-900 border border-emerald-500/30 rounded-xl p-3.5 flex items-center justify-between text-xs">
        <div className="flex items-center space-x-2.5 text-slate-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            <strong>Daily Office Attendance Policy:</strong> Employees must mark daily attendance at the office entrance using the <strong>FaceLock Terminal</strong> (Shift: 09:30 AM – 06:15 PM). Self-punching from this employee app is disabled.
          </span>
        </div>
      </div>

      {/* 2. ATTENDANCE KPI COUNTERS: PRESENT, ABSENT, HALFDAY, WEEKLYOFF, OVERTIME */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-white text-sm sm:text-base flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span>Monthly Attendance Summary ({currentTime.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })})</span>
          </h3>
          <span className="text-xs text-slate-400 font-mono">
            {dailyAttendanceRecords.length} Days Tracked
          </span>
        </div>

        {/* Zero-Absent Double Salary Incentive Status Banner */}
        {summaryKpis.absent === 0 && summaryKpis.halfday === 0 && summaryKpis.present > 0 ? (
          <div className="mb-4 bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-emerald-500/20 border border-amber-400/50 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black text-xl shadow-md shrink-0">
                🏆
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-amber-300 font-bold text-sm">100% Attendance: Double Salary Active!</span>
                  <span className="bg-amber-400/20 text-amber-300 text-[10px] px-2 py-0.5 rounded-full border border-amber-400/30 uppercase font-black tracking-wider">
                    2× Pay Qualified
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  Zero absences recorded this month ({summaryKpis.present} days present). You qualify for an extra 100% base salary bonus!
                </p>
              </div>
            </div>
            <button 
              onClick={() => setActiveTab('attendance')}
              className="px-4 py-2 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-500 hover:to-yellow-600 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all shrink-0 flex items-center space-x-1.5"
            >
              <span>View Payout Details</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="mb-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center space-x-2.5">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>Velavan Attendance Policy:</strong> Zero absences in a month unlocks <strong>2× Double Salary</strong>. Currently: <span className="text-rose-400 font-bold">{summaryKpis.absent} Absent</span>, <span className="text-blue-400 font-bold">{summaryKpis.halfday} Half-Day</span>.
              </span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {/* 1. Present */}
          <div 
            onClick={() => setStatusFilter(statusFilter === 'Present' ? 'All' : 'Present')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              statusFilter === 'Present'
                ? 'bg-emerald-950/60 border-emerald-500 ring-2 ring-emerald-500/40 shadow-lg shadow-emerald-500/10'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between text-emerald-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Present</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
            </div>
            <div className="text-3xl font-black text-white font-mono">{summaryKpis.present}</div>
            <div className="text-[11px] text-emerald-400 font-semibold mt-1 flex items-center space-x-1">
              <span>Days on-duty</span>
            </div>
          </div>

          {/* 2. Absent */}
          <div 
            onClick={() => setStatusFilter(statusFilter === 'Absent' ? 'All' : 'Absent')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              statusFilter === 'Absent'
                ? 'bg-rose-950/60 border-rose-500 ring-2 ring-rose-500/40 shadow-lg shadow-rose-500/10'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between text-rose-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Absent</span>
              <div className="w-7 h-7 rounded-lg bg-rose-500/20 flex items-center justify-center">
                <XCircle className="w-4 h-4 text-rose-400" />
              </div>
            </div>
            <div className="text-3xl font-black text-white font-mono">{summaryKpis.absent}</div>
            <div className="text-[11px] text-rose-400 font-semibold mt-1">
              <span>Days absent</span>
            </div>
          </div>

          {/* 3. Half-Day */}
          <div 
            onClick={() => setStatusFilter(statusFilter === 'Half-Day' ? 'All' : 'Half-Day')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              statusFilter === 'Half-Day'
                ? 'bg-blue-950/60 border-blue-500 ring-2 ring-blue-500/40 shadow-lg shadow-blue-500/10'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between text-blue-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Half-Day</span>
              <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Clock className="w-4 h-4 text-blue-400" />
              </div>
            </div>
            <div className="text-3xl font-black text-white font-mono">{summaryKpis.halfday}</div>
            <div className="text-[11px] text-blue-400 font-semibold mt-1">
              <span>Short shifts (&lt;4.5h)</span>
            </div>
          </div>

          {/* 4. Weekly Off */}
          <div 
            onClick={() => setStatusFilter(statusFilter === 'Weekly Off' ? 'All' : 'Weekly Off')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              statusFilter === 'Weekly Off'
                ? 'bg-purple-950/60 border-purple-500 ring-2 ring-purple-500/40 shadow-lg shadow-purple-500/10'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between text-purple-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Weekly Off</span>
              <div className="w-7 h-7 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Coffee className="w-4 h-4 text-purple-400" />
              </div>
            </div>
            <div className="text-3xl font-black text-white font-mono">{summaryKpis.weeklyoff}</div>
            <div className="text-[11px] text-purple-400 font-semibold mt-1">
              <span>Weekends / Sundays</span>
            </div>
          </div>

          {/* 5. Overtime */}
          <div 
            onClick={() => setStatusFilter(statusFilter === 'Overtime' ? 'All' : 'Overtime')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              statusFilter === 'Overtime'
                ? 'bg-amber-950/60 border-amber-500 ring-2 ring-amber-500/40 shadow-lg shadow-amber-500/10'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between text-amber-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Overtime</span>
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <Flame className="w-4 h-4 text-amber-400" />
              </div>
            </div>
            <div className="text-3xl font-black text-white font-mono">
              {summaryKpis.totalOvertimeHours} <span className="text-sm font-sans font-bold text-slate-400">hrs</span>
            </div>
            <div className="text-[11px] text-amber-400 font-semibold mt-1">
              <span>{summaryKpis.overtimeDays} day{summaryKpis.overtimeDays !== 1 ? 's' : ''} extra hours</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. DETAILED DAILY ATTENDANCE SUMMARY TABLE */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-md">
        {/* Table Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-white text-sm sm:text-base flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <span>Daily Attendance Log & Verification Feed</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Breakdown of daily check-ins, days, present/absent status, assigned team, and work hours.
            </p>
          </div>

          {/* Quick Filters */}
          <div className="flex items-center space-x-2 self-start sm:self-auto">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search date or day..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-950 text-white text-xs rounded-lg border border-slate-800 focus:outline-none focus:border-emerald-500 w-36 sm:w-44"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950 text-white text-xs px-2.5 py-1.5 rounded-lg border border-slate-800 font-semibold"
            >
              <option value="All">All Statuses</option>
              <option value="Present">Present Only</option>
              <option value="Late Arrival">Late Arrival Only</option>
              <option value="Absent">Absent Only</option>
              <option value="Half-Day">Half-Day Only</option>
              <option value="Weekly Off">Weekly Off Only</option>
              <option value="Overtime">Overtime Only</option>
            </select>
          </div>
        </div>

        {/* Detailed Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3.5">Date</th>
                <th className="px-4 py-3.5">Day</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Team</th>
                <th className="px-4 py-3.5">Time (Clock In → Out)</th>
                <th className="px-4 py-3.5">Total Hours</th>
                <th className="px-4 py-3.5">Overtime</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {filteredDailyRecords.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-10 text-center text-slate-500">
                    No attendance records match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredDailyRecords.map((item) => {
                  const isPresent = item.status === 'Present' || item.status === 'Late Arrival' || item.status === 'Present (Late)';
                  const isAbsent = item.status === 'Absent';
                  const isHalfDay = item.status === 'Half-Day';
                  const isWeeklyOff = item.status === 'Weekly Off';
                  const isLate = item.status === 'Late Arrival' || item.status === 'Present (Late)';

                  return (
                    <tr 
                      key={item.date} 
                      className={`hover:bg-slate-850/60 transition-colors ${
                        isWeeklyOff ? 'bg-slate-950/30' : isAbsent ? 'bg-rose-950/10' : ''
                      }`}
                    >
                      {/* Date */}
                      <td className="px-4 py-3.5 font-mono text-slate-200">
                        <div className="font-bold">{item.formattedDate}</div>
                        <span className="text-[10px] text-slate-500 font-mono">{item.date}</span>
                      </td>

                      {/* Day */}
                      <td className="px-4 py-3.5 text-slate-300 font-semibold">
                        {item.day}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          isPresent
                            ? isLate
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : isAbsent
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : isHalfDay
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            : isWeeklyOff
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}>
                          {isPresent && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                          {isAbsent && <XCircle className="w-3.5 h-3.5 shrink-0" />}
                          {isHalfDay && <Clock className="w-3.5 h-3.5 shrink-0" />}
                          {isWeeklyOff && <Coffee className="w-3.5 h-3.5 shrink-0" />}
                          <span>{item.status}</span>
                        </span>
                      </td>

                      {/* Team / Department */}
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 text-[11px] font-semibold border border-slate-700/60">
                          <Building2 className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span>{item.team}</span>
                        </span>
                      </td>

                      {/* Time */}
                      <td className="px-4 py-3.5 font-mono text-slate-300">
                        {isPresent || isHalfDay ? (
                          <div className="flex items-center space-x-1.5">
                            <span className="text-emerald-400 font-bold">{item.clockIn}</span>
                            <span className="text-slate-500">→</span>
                            <span className="text-slate-200">{item.clockOut}</span>
                          </div>
                        ) : (
                          <span className="text-slate-600">-- : --</span>
                        )}
                      </td>

                      {/* Total Hours */}
                      <td className="px-4 py-3.5 font-bold text-white font-mono">
                        {item.totalHours > 0 ? (
                          <span>{item.totalHours} hrs</span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>

                      {/* Overtime */}
                      <td className="px-4 py-3.5">
                        {item.overtime > 0 ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            <Flame className="w-3 h-3 text-amber-400" />
                            <span>+{item.overtime} hrs OT</span>
                          </span>
                        ) : (
                          <span className="text-slate-600 text-[11px]">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
