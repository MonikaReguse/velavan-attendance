import React, { useState, useEffect } from 'react';
import { 
  ClipboardList, 
  Calendar, 
  Search, 
  Filter, 
  PlusCircle, 
  ScanFace, 
  Edit3, 
  Trash2,
  Clock,
  UserCheck,
  FileDown,
  RefreshCw
} from 'lucide-react';
import { api } from '../services/api';
import { resolvePhotoUrl, handleImageError } from '../services/imageUtils';
import { formatTime, isLateArrival, getLateMinutes } from '../services/timeUtils';
import { getLocalAttendance, mergeAttendanceWithLocal, savePunchLocally, removePunchLocally } from '../services/attendanceStorage';
import { exportAttendancePDF } from '../services/pdfExport';

export default function AttendanceLogs() {
  const [logs, setLogs] = useState(() => getLocalAttendance());
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
  const [modalOpen, setModalOpen] = useState(false);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    department: '',
    status: ''
  });

  const [formData, setFormData] = useState({
    emp_id: '',
    date: new Date().toISOString().split('T')[0],
    clock_in: '09:30:00',
    clock_out: '18:15:00',
    status: 'present',
    notes: 'HR manual adjustment'
  });

  useEffect(() => {
    loadEmployees();
    fetchLogs();

    // 1. Auto-refresh logs every 10 seconds for live updates
    const timer = setInterval(() => {
      fetchLogs();
    }, 10000);

    // 2. Instant refresh when admin tabs back into the browser
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchLogs();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // 3. In-tab custom events
    const handleRealtimeUpdate = () => {
      loadEmployees();
      fetchLogs();
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

  const loadEmployees = async () => {
    try {
      const data = await api.getEmployees();
      if (Array.isArray(data) && data.length > 0) {
        setEmployees(data);
        if (!formData.emp_id) {
          setFormData(prev => ({ ...prev, emp_id: data[0].emp_id }));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const data = await api.getAttendanceHistory(filters);
      const merged = mergeAttendanceWithLocal(Array.isArray(data) ? data : []);

      const empMap = new Map((employees || []).map(e => [e.emp_id, e]));
      let filtered = merged.map(l => {
        const emp = empMap.get(l.emp_id);
        if (emp) {
          return {
            ...l,
            employee_name: emp.name || l.employee_name || l.emp_id,
            department: emp.department || l.department || 'Digital Marketing',
            role: emp.role || l.role || 'Staff'
          };
        }
        return l;
      });

      if (filters.startDate) {
        filtered = filtered.filter(l => l.date >= filters.startDate);
      }
      if (filters.endDate) {
        filtered = filtered.filter(l => l.date <= filters.endDate);
      }
      if (filters.status) {
        filtered = filtered.filter(l => l.status === filters.status);
      }
      if (filters.department) {
        filtered = filtered.filter(l => (l.department || 'Digital Marketing') === filters.department);
      }
      setLogs(filtered);
    } catch (err) {
      console.error('Error fetching attendance history:', err);
      setLogs(getLocalAttendance());
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleApplyFilter = (e) => {
    e.preventDefault();
    fetchLogs();
  };

  const handleOpenManual = (log = null) => {
    if (log) {
      setFormData({
        id: log.id,
        emp_id: log.emp_id,
        date: log.date,
        clock_in: log.clock_in || '09:30:00',
        clock_out: log.clock_out || '18:00:00',
        status: log.status || 'present',
        notes: log.notes || 'HR manual adjustment'
      });
    } else {
      setFormData({
        id: null,
        emp_id: employees.length > 0 ? employees[0].emp_id : '',
        date: new Date().toISOString().split('T')[0],
        clock_in: '09:30:00',
        clock_out: '18:00:00',
        status: 'present',
        notes: 'HR manual entry'
      });
    }
    setModalOpen(true);
  };

  const handleSubmitManual = async (e) => {
    e.preventDefault();
    const isOD = formData.status === 'od' || formData.status === 'login_od' || formData.status === 'logout_od' || formData.clock_in === 'OD' || formData.clock_out === 'OD';
    const trimmedNotes = (formData.notes || '').trim();
    if (isOD && (!trimmedNotes || trimmedNotes === 'HR manual entry' || trimmedNotes === 'HR manual adjustment')) {
      alert('⚠️ Please enter or select a specific reason for On Duty (OD) (e.g. Client Site Visit, Registrar Office, Meeting) before saving.');
      return;
    }
    try {
      const payload = {
        ...formData,
        notes: trimmedNotes || (isOD ? 'Client Site Visit' : 'HR manual adjustment'),
        clock_in: (formData.status === 'absent' || formData.status === 'weekly_off') ? '--' : (formData.clock_in || '--'),
        clock_out: (formData.status === 'absent' || formData.status === 'weekly_off') ? '--' : (formData.clock_out || '--')
      };
      const res = await api.recordManualAttendance(payload);
      const savedPunch = {
        ...payload,
        id: res.id || formData.id || undefined,
        method: 'manual',
        status: payload.status || 'present',
        notes: payload.notes
      };
      savePunchLocally(savedPunch);
      setModalOpen(false);
      fetchLogs();
    } catch (err) {
      alert('Error saving record: ' + err.message);
    }
  };

  const handleDelete = async (id, emp_id, date) => {
    if (!confirm('Are you sure you want to delete this attendance record?')) return;
    try {
      removePunchLocally(id, emp_id, date);
      setLogs(prev => prev.filter(l => !( (id && String(l.id) === String(id)) || (emp_id && date && l.emp_id === emp_id && l.date === date) )));
      await api.deleteAttendance(id, emp_id, date).catch(console.error);
      fetchLogs();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Attendance Records & Logs</h2>
          <p className="text-xs text-slate-500">
            View full historical audit trail of employee clock-in/out records, verify FaceLock captures, and make manual corrections.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-2.5 rounded-lg border border-slate-200 transition-colors shadow-2xs cursor-pointer"
            title="Refresh Attendance Logs"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => exportAttendancePDF({ data: logs, filters })}
            className="flex items-center space-x-1.5 bg-[#8b0000] hover:bg-[#6b0000] text-white text-xs font-bold px-3.5 py-2.5 rounded-lg shadow-xs transition-colors"
            title="Download Filtered Attendance Logs as PDF"
          >
            <FileDown className="w-4 h-4" />
            <span>Download PDF</span>
          </button>
          <button
            type="button"
            onClick={handleOpenManual}
            className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-sm transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Manual Punch Entry</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <form onSubmit={handleApplyFilter} className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
        <div>
          <label className="block text-slate-500 font-medium mb-1">Start Date</label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => handleFilterChange('startDate', e.target.value)}
            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        <div>
          <label className="block text-slate-500 font-medium mb-1">End Date</label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => handleFilterChange('endDate', e.target.value)}
            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        <div>
          <label className="block text-slate-500 font-medium mb-1">Department</label>
          <select
            value={filters.department}
            onChange={(e) => handleFilterChange('department', e.target.value)}
            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="">All Departments</option>
            <option value="Digital Marketing">Digital Marketing</option>
          </select>
        </div>

        <div>
          <label className="block text-slate-500 font-medium mb-1">Attendance Status</label>
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="">All Statuses</option>
            <option value="present">Present (On Time)</option>
            <option value="od">On Duty (OD)</option>
            <option value="late">Late Arrival</option>
            <option value="half_day">Half Day</option>
            <option value="absent">Absent</option>
            <option value="weekly_off">Weekly Off</option>
          </select>
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            className="w-full px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-lg shadow-sm transition-colors flex items-center justify-center space-x-1.5"
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Apply Filters</span>
          </button>
        </div>
      </form>

      {/* Attendance Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Clock In / Login</th>
                <th className="px-4 py-3">Clock Out / Logout</th>
                <th className="px-4 py-3">Hours</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Verification</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center justify-center space-y-2 text-slate-400">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-1">
                        <ClipboardList className="w-6 h-6 stroke-1 text-slate-400" />
                      </div>
                      <p className="text-sm font-bold text-slate-700">No Attendance Marked Yet</p>
                      <p className="text-xs text-slate-400 max-w-sm">
                        Attendance records are displayed only for dates on which employees have punched in at the FaceLock terminal.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const empInfo = employees.find(e => e.emp_id === log.emp_id) || {};
                  const displayName = (log.employee_name && !log.employee_name.startsWith('[')) 
                    ? log.employee_name 
                    : (empInfo.name || log.emp_id);
                  const displayDept = empInfo.department || log.department || 'Digital Marketing';
                  const displayAvatar = resolvePhotoUrl(empInfo.avatar || log.avatar || log.punch_photo, displayName);

                  const isLate = isLateArrival(log.clock_in, log.status);
                  const lateMins = getLateMinutes(log.clock_in);
                  const isHalfDay = log.status === 'half_day';
                  const isAbsent = log.status === 'absent';
                  const isPendingCheckout = (!log.clock_out || log.clock_out === '--' || log.clock_out === '' || log.status === 'checked_in') && log.status !== 'absent' && log.status !== 'weekly_off' && log.holiday_type !== 'own_leave' && log.holiday_type !== 'govt_holiday_leave';
                  const isOngoing = isPendingCheckout || (!log.clock_out || log.clock_out === log.clock_in);

                  return (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono font-medium text-slate-700">
                        <div>{log.date}</div>
                        <div className="text-[10px] text-slate-400 font-sans font-semibold">
                          {(() => {
                            try {
                              const [y, m, d] = log.date.split('-').map(Number);
                              return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short' });
                            } catch { return ''; }
                          })()}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2.5">
                          <img
                            src={displayAvatar}
                            alt={displayName}
                            onError={(e) => handleImageError(e, displayName)}
                            className="w-7 h-7 rounded-full object-cover border border-slate-200 bg-slate-100"
                          />
                          <div>
                            <span className="font-bold text-slate-800">{displayName}</span>
                            <span className="text-[10px] text-slate-400 font-mono ml-1.5">({log.emp_id})</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{displayDept}</td>
                      <td className="px-4 py-3 font-mono text-slate-700 font-semibold">
                        {log.clock_in === 'OD' ? (
                          <span className="px-1.5 py-0.5 rounded font-bold bg-indigo-100 text-indigo-800 text-[10px] border border-indigo-200">
                            OD (On Duty)
                          </span>
                        ) : (
                          formatTime(log.clock_in)
                        )}
                        {isLate && (
                          <span className="block text-[10px] text-amber-700 font-bold">
                            (Late +${lateMins > 0 ? lateMins : 1}m)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-700">
                        {log.clock_out === 'OD' ? (
                          <span className="px-1.5 py-0.5 rounded font-bold bg-indigo-100 text-indigo-800 text-[10px] border border-indigo-200">
                            OD (On Duty)
                          </span>
                        ) : (log.clock_out && log.clock_out !== '--' && !isPendingCheckout) ? (
                          formatTime(log.clock_out)
                        ) : (
                          <span className="inline-flex items-center text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[10px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse mr-1.5"></span>
                            Checkout Pending
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        {log.total_hours > 0 ? (
                          `${log.total_hours}h`
                        ) : isPendingCheckout ? (
                          <span className="text-amber-600 font-bold text-xs italic">Shift Active</span>
                        ) : (
                          '0h'
                        )}
                        {(log.ot_minutes > 0 || log.ot_hours > 0) && (
                          <span className="block text-[10px] text-amber-600 font-bold">
                            +{log.ot_minutes ? log.ot_minutes : Math.round(log.ot_hours * 60)} mins OT
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isPendingCheckout ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                            Checked In — Checkout Pending
                          </span>
                        ) : log.status === 'od' || log.status === 'login_od' || log.status === 'logout_od' || log.clock_in === 'OD' || log.clock_out === 'OD' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                            {log.status === 'login_od' ? 'Login OD' : log.status === 'logout_od' ? 'Logout OD' : 'On Duty (OD)'}
                          </span>
                        ) : (
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              isLate
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : isHalfDay
                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                : isAbsent
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            {isLate ? `Late Arrival (+${lateMins > 0 ? lateMins : 1}m)` : isHalfDay ? 'Half Day' : isAbsent ? 'Absent' : 'Present'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center space-x-1 text-[11px] font-medium text-slate-600">
                          {log.method === 'facelock' ? (
                            <>
                              <ScanFace className="w-3.5 h-3.5 text-emerald-600" />
                              <span>FaceLock</span>
                            </>
                          ) : log.method === 'pin' ? (
                            <span>PIN Punch</span>
                          ) : (
                            <span className="italic text-slate-400">Manual Entry</span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => handleOpenManual(log)}
                            className="p-1 text-slate-400 hover:text-amber-600 rounded transition-colors"
                            title="Edit / Update Attendance"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(log.id, log.emp_id, log.date)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                            title="Delete Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Entry / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6">
            <h3 className="font-bold text-slate-900 text-base mb-4">
              {formData.id ? `Edit Attendance Record #${formData.id}` : 'Manual Attendance Entry'}
            </h3>
            <form onSubmit={handleSubmitManual} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Employee</label>
                <select
                  value={formData.emp_id}
                  disabled={!!formData.id}
                  onChange={(e) => setFormData({ ...formData, emp_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white disabled:opacity-60"
                >
                  {employees.map(e => (
                    <option key={e.id} value={e.emp_id}>{e.name} ({e.emp_id})</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-700 font-semibold">Attendance Date</label>
                  {formData.date && (() => {
                    try {
                      const [y, m, d] = formData.date.split('-').map(Number);
                      const dt = new Date(y, m - 1, d);
                      const dayName = dt.toLocaleDateString('en-US', { weekday: 'long' });
                      const isSun = dt.getDay() === 0;
                      return (
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                          isSun ? 'bg-purple-100 text-purple-800' : 'bg-red-50 text-[#8b0000]'
                        }`}>
                          📅 {dayName} {isSun ? '(Weekly Off)' : ''}
                        </span>
                      );
                    } catch { return null; }
                  })()}
                </div>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-700 font-semibold text-xs">Clock In / Login</label>
                    <button
                      type="button"
                      onClick={() => {
                        if (formData.clock_in === 'OD') {
                          setFormData({ ...formData, clock_in: '09:30:00' });
                        } else {
                          setFormData({ ...formData, clock_in: 'OD', status: formData.clock_out === 'OD' ? 'od' : 'login_od' });
                        }
                      }}
                      className="text-[10px] text-indigo-700 font-bold hover:underline"
                    >
                      {formData.clock_in === 'OD' ? 'Set Time' : '+ OD'}
                    </button>
                  </div>
                  {formData.clock_in === 'OD' ? (
                    <div className="px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-900 font-bold text-xs">
                      OD (On Duty)
                    </div>
                  ) : (
                    <input
                      type="time"
                      step="1"
                      disabled={formData.status === 'absent' || formData.status === 'weekly_off'}
                      value={formData.clock_in}
                      onChange={(e) => setFormData({ ...formData, clock_in: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono disabled:opacity-40"
                    />
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-700 font-semibold text-xs">Clock Out / Logout</label>
                    <button
                      type="button"
                      onClick={() => {
                        if (formData.clock_out === 'OD') {
                          setFormData({ ...formData, clock_out: '18:00:00' });
                        } else {
                          setFormData({ ...formData, clock_out: 'OD', status: formData.clock_in === 'OD' ? 'od' : 'logout_od' });
                        }
                      }}
                      className="text-[10px] text-indigo-700 font-bold hover:underline"
                    >
                      {formData.clock_out === 'OD' ? 'Set Time' : '+ OD'}
                    </button>
                  </div>
                  {formData.clock_out === 'OD' ? (
                    <div className="px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-900 font-bold text-xs">
                      OD (On Duty)
                    </div>
                  ) : (
                    <input
                      type="time"
                      step="1"
                      disabled={formData.status === 'absent' || formData.status === 'weekly_off'}
                      value={formData.clock_out}
                      onChange={(e) => setFormData({ ...formData, clock_out: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono disabled:opacity-40"
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1 text-xs">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => {
                      const next = e.target.value;
                      if (next === 'od') {
                        setFormData({ ...formData, status: next, clock_in: 'OD', clock_out: 'OD' });
                      } else if (next === 'login_od') {
                        setFormData({ ...formData, status: next, clock_in: 'OD', clock_out: formData.clock_out === 'OD' ? '18:00:00' : formData.clock_out });
                      } else if (next === 'logout_od') {
                        setFormData({ ...formData, status: next, clock_in: formData.clock_in === 'OD' ? '09:30:00' : formData.clock_in, clock_out: 'OD' });
                      } else {
                        setFormData({ ...formData, status: next });
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-xs"
                  >
                    <option value="present">Present (On Time)</option>
                    <option value="od">On Duty (OD - Full Day)</option>
                    <option value="login_od">Login OD (Morning Duty)</option>
                    <option value="logout_od">Logout OD (Evening Duty)</option>
                    <option value="late">Late Arrival</option>
                    <option value="half_day">Half Day</option>
                    <option value="absent">Absent (Loss of Pay)</option>
                    <option value="weekly_off">Weekly Off (Paid)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1 text-xs">
                    {(formData.status === 'od' || formData.status === 'login_od' || formData.status === 'logout_od' || formData.clock_in === 'OD' || formData.clock_out === 'OD')
                      ? 'On Duty (OD) Reason *'
                      : 'Adjustment Reason'}
                  </label>
                  <input
                    type="text"
                    required={(formData.status === 'od' || formData.status === 'login_od' || formData.status === 'logout_od' || formData.clock_in === 'OD' || formData.clock_out === 'OD')}
                    placeholder={(formData.status === 'od' || formData.status === 'login_od' || formData.status === 'logout_od' || formData.clock_in === 'OD' || formData.clock_out === 'OD') ? 'e.g. Client Site Visit / Registrar Office' : 'e.g. Regular shift / Client visit'}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                  {(formData.status === 'od' || formData.status === 'login_od' || formData.status === 'logout_od' || formData.clock_in === 'OD' || formData.clock_out === 'OD') && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {['Client Site Visit', 'Registrar Office', 'Customer Meeting', 'Field Inspection'].map(tag => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => setFormData({ ...formData, notes: tag })}
                          className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200"
                        >
                          + {tag}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-sm"
                >
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
