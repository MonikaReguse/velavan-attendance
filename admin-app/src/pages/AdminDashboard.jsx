import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserCheck, 
  Clock, 
  CalendarOff, 
  UserX, 
  Building2, 
  ScanFace,
  AlertCircle,
  ArrowRight
} from 'lucide-react';
import { api } from '../services/api';
import { resolvePhotoUrl, handleImageError } from '../services/imageUtils';
import { formatTime } from '../services/timeUtils';

export default function AdminDashboard({ setActiveTab }) {
  const [summary, setSummary] = useState(() => {
    try {
      const s = localStorage.getItem('velavan_dashboard_summary');
      if (s) return JSON.parse(s);
    } catch {}
    return { total_employees: 9, present_today: 0, absent_today: 9, late_today: 0 };
  });
  const [todayAttendance, setTodayAttendance] = useState(() => {
    try {
      const a = localStorage.getItem('velavan_today_attendance');
      if (a) return JSON.parse(a);
    } catch {}
    return [];
  });
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

  const loadDashboardData = async () => {
    try {
      const [sumRes, attRes, empRes] = await Promise.all([
        api.getTodaySummary().catch(() => null),
        api.getTodayAttendance().catch(() => null),
        api.getEmployees().catch(() => null)
      ]);
      if (sumRes) {
        setSummary(sumRes);
        try { localStorage.setItem('velavan_dashboard_summary', JSON.stringify(sumRes)); } catch {}
      }
      if (attRes) {
        setTodayAttendance(attRes);
        try { localStorage.setItem('velavan_today_attendance', JSON.stringify(attRes)); } catch {}
      }
      if (Array.isArray(empRes) && empRes.length > 0) {
        setEmployees(empRes);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const unenrolledCount = employees.filter(e => !e.has_face_enrolled).length;

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-500">Loading office dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Office FaceLock Attendance Hero Banner */}
      <div className="bg-gradient-to-r from-[#8b0000] via-[#a70809] to-[#780000] border border-red-950/20 rounded-2xl p-5 sm:p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-amber-400/10 blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex items-center space-x-4">
          <img 
            src="/logo.png" 
            alt="Velavan Properties" 
            className="w-16 h-16 object-contain rounded-2xl border-2 border-amber-400 shadow-xl bg-white/10 p-1 shrink-0" 
          />
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
                Velavan Properties Attendance App
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-black text-white tracking-tight mt-0.5">
              Daily Office FaceLock Attendance
            </h3>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="inline-flex items-center space-x-1 bg-white/15 px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-white border border-white/20">
                <span>Shift: 09:30 AM – 06:00 PM</span>
              </span>
              <span className="inline-flex items-center space-x-1 bg-amber-400/20 px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-amber-200 border border-amber-300/30">
                <span>Late After: 09:40 AM</span>
              </span>
              <span className="inline-flex items-center space-x-1 bg-emerald-400/20 px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-emerald-200 border border-emerald-300/30">
                <span>OT Buffer: 20 mins</span>
              </span>
            </div>
          </div>
        </div>
        <div className="relative z-10 flex items-center space-x-3">
          <button
            onClick={() => setActiveTab('facelock-kiosk')}
            className="flex items-center space-x-2 px-5 py-3 bg-white hover:bg-slate-100 active:bg-slate-200 text-[#8b0000] text-xs font-black rounded-xl shadow-lg shadow-red-950/20 transition-all transform hover:scale-[1.02]"
          >
            <ScanFace className="w-4 h-4 text-[#8b0000]" />
            <span>Open FaceLock Terminal</span>
            <ArrowRight className="w-4 h-4 text-[#8b0000]" />
          </button>
        </div>
      </div>

      {/* Welcome Banner / Face Registration Alert */}
      {unenrolledCount > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <ScanFace className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-amber-900">
                {unenrolledCount} Employee{unenrolledCount > 1 ? 's' : ''} Pending FaceLock Enrollment
              </h4>
              <p className="text-xs text-amber-700 mt-0.5">
                Register employee face biometrics in the Studio so they can punch in with FaceLock.
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('face-enrollment')}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
          >
            <span>Enroll Face Biometrics</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* 1. Total Staff */}
        <div 
          onClick={() => setActiveTab('employees')}
          className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs cursor-pointer hover:border-emerald-500/50 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600 group-hover:text-[#8b0000] transition-colors">Total Staff</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-red-50 group-hover:text-[#8b0000] flex items-center justify-center transition-colors">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-800">{summary?.total_employees || 0}</div>
          <span className="text-[11px] text-[#8b0000] font-semibold group-hover:underline flex items-center space-x-1 mt-0.5">
            <span>View employee list &rarr;</span>
          </span>
        </div>

        {/* 2. Staff Present */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Staff Present</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <UserCheck className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <div className="text-3xl font-black text-emerald-600">{summary?.present_today || 0}</div>
          <span className="text-[11px] text-emerald-700 font-semibold">
            {summary?.total_employees ? Math.round((summary.present_today / summary.total_employees) * 100) : 0}% turn-out today
          </span>
        </div>

        {/* 3. Staff Absent */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-rose-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Staff Absent</span>
            <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center">
              <UserX className="w-4 h-4 text-rose-600" />
            </div>
          </div>
          <div className="text-3xl font-black text-rose-600">{summary?.absent_today || 0}</div>
          <span className="text-[11px] text-rose-600 font-semibold">Unaccounted staff</span>
        </div>

        {/* 4. Late Arrivals */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-amber-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Late Arrivals</span>
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
          </div>
          <div className="text-3xl font-black text-amber-600">{summary?.late_today || 0}</div>
          <span className="text-[11px] text-amber-600 font-semibold">Checked in after 09:40 AM</span>
        </div>
      </div>

      {/* Today's Attendance Roster Stream */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs flex flex-col">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Today's Attendance Roster</h3>
              <p className="text-xs text-slate-400">Live check-in events recorded via FaceLock and PIN</p>
            </div>
            <button
              onClick={() => setActiveTab('attendance')}
              className="text-xs font-semibold text-[#8b0000] hover:text-[#a70809] flex items-center space-x-1"
            >
              <span>View all records</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="divide-y divide-slate-100 overflow-y-auto max-h-[460px]">
            {todayAttendance.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                No attendance records logged for today yet.
              </div>
            ) : (
              todayAttendance.map((rec) => {
                const isLate = rec.status === 'late';
                const isHalfDay = rec.status === 'half_day';
                return (
                  <div key={rec.id} className="p-3.5 hover:bg-slate-50 transition-colors flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <img
                          src={resolvePhotoUrl(rec.punch_photo || rec.avatar, rec.employee_name)}
                          alt={rec.employee_name}
                          onError={(e) => handleImageError(e, rec.employee_name)}
                          className="w-10 h-10 rounded-full object-cover border border-slate-200 bg-slate-100"
                        />
                        {rec.method === 'facelock' && (
                          <div
                            className="absolute -bottom-1 -right-1 bg-emerald-600 text-white rounded-full p-0.5 border border-white"
                            title="Verified with FaceLock"
                          >
                            <ScanFace className="w-2.5 h-2.5" />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="text-xs font-bold text-slate-800">{rec.employee_name}</h4>
                          <span className="text-[10px] text-slate-400 font-mono">({rec.emp_id})</span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {rec.department} • {rec.role}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4 text-right">
                      <div>
                        <div className="text-xs font-semibold text-slate-700 font-mono">
                          In: {formatTime(rec.clock_in)}
                          {rec.clock_out && <span className="text-slate-400 ml-1.5 font-normal">| Out: {formatTime(rec.clock_out)}</span>}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {rec.total_hours > 0 ? (
                            <span>
                              {rec.total_hours} hrs worked
                              {(rec.ot_minutes > 0 || rec.ot_hours > 0) && (
                                <span className="text-amber-600 font-bold ml-1">
                                  (+{rec.ot_minutes ? rec.ot_minutes : Math.round(rec.ot_hours * 60)} mins OT)
                                </span>
                              )}
                            </span>
                          ) : 'Shift in progress'}
                        </div>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          isLate
                            ? 'bg-amber-100 text-amber-700 border border-amber-200'
                            : isHalfDay
                            ? 'bg-blue-100 text-blue-700 border border-blue-200'
                            : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {isLate ? 'Late Arrival' : isHalfDay ? 'Half Day' : 'On-Time'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
  );
}
