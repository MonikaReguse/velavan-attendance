import React, { useState, useEffect } from 'react';
import { 
  User, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ScanFace,
  Briefcase
} from 'lucide-react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';

export default function MyAttendance() {
  const { activeEmployee } = useApp();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeEmployee) {
      loadEmployeeData(activeEmployee.emp_id);
    }
  }, [activeEmployee]);

  const loadEmployeeData = async (emp_id) => {
    try {
      setLoading(true);
      const histRes = await api.getHistory(emp_id);
      setHistory(histRes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const totalHours = history.reduce((acc, h) => acc + (h.total_hours || 0), 0);
  const lateCount = history.filter(h => h.status === 'late').length;
  const onTimeCount = history.filter(h => h.status === 'present').length;

  return (
    <div className="space-y-6">
      {/* Employee Profile Header */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          {activeEmployee && (
            <img
              src={activeEmployee.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}
              alt={activeEmployee.name}
              className="w-12 h-12 rounded-xl object-cover border-2 border-emerald-500 shadow-lg"
            />
          )}
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-bold text-white">{activeEmployee?.name || 'My Timesheets'}</h2>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-emerald-400">
                {activeEmployee?.emp_id}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {activeEmployee?.department} • {activeEmployee?.role}
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-[11px] text-slate-400 uppercase font-semibold">Total Days Logged</span>
          <div className="text-2xl font-bold text-white mt-1">{history.length}</div>
          <span className="text-[11px] text-slate-500">This billing period</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-[11px] text-slate-400 uppercase font-semibold">Cumulative Work Hours</span>
          <div className="text-2xl font-bold text-emerald-400 mt-1">{totalHours.toFixed(1)} hrs</div>
          <span className="text-[11px] text-slate-500">Average {(history.length ? (totalHours / history.length).toFixed(1) : 0)}h / day</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-[11px] text-slate-400 uppercase font-semibold">Late Arrivals</span>
          <div className="text-2xl font-bold text-amber-400 mt-1">{lateCount}</div>
          <span className="text-[11px] text-slate-500">After grace period</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-[11px] text-slate-400 uppercase font-semibold">On-Time Punches</span>
          <div className="text-2xl font-bold text-emerald-400 mt-1">{onTimeCount}</div>
          <span className="text-[11px] text-slate-500">Punctual clock-ins</span>
        </div>
      </div>

      {/* Timesheet Logs Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800">
          <h3 className="font-bold text-white text-sm">Personal Attendance History</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Clock In</th>
                <th className="px-4 py-3">Clock Out</th>
                <th className="px-4 py-3">Hours Worked</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Verification Method</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {history.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-slate-500">
                    No attendance records logged yet for this employee.
                  </td>
                </tr>
              ) : (
                history.map((rec) => {
                  const isLate = rec.status === 'late';
                  const isHalfDay = rec.status === 'half_day';
                  return (
                    <tr key={rec.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3 font-mono font-medium text-slate-300">{rec.date}</td>
                      <td className="px-4 py-3 font-mono text-emerald-400 font-semibold">{rec.clock_in}</td>
                      <td className="px-4 py-3 font-mono text-slate-300">
                        {rec.clock_out || <span className="text-emerald-500 italic">Working...</span>}
                      </td>
                      <td className="px-4 py-3 font-bold text-white">
                        {rec.total_hours ? `${rec.total_hours} hrs` : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isLate
                            ? 'bg-amber-500/20 text-amber-300'
                            : isHalfDay
                            ? 'bg-blue-500/20 text-blue-300'
                            : 'bg-emerald-500/20 text-emerald-300'
                        }`}>
                          {isLate ? 'Late' : isHalfDay ? 'Half Day' : 'On-Time'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center space-x-1.5 text-slate-300">
                          {rec.method === 'facelock' ? (
                            <>
                              <ScanFace className="w-3.5 h-3.5 text-emerald-400" />
                              <span>FaceLock Biometric</span>
                            </>
                          ) : (
                            <span>PIN Punch</span>
                          )}
                        </span>
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
