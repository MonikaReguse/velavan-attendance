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
  UserCheck
} from 'lucide-react';
import { api } from '../services/api';
import { resolvePhotoUrl, handleImageError } from '../services/imageUtils';
import { formatTime } from '../services/timeUtils';
import { getLocalAttendance, mergeAttendanceWithLocal, savePunchLocally, removePunchLocally } from '../services/attendanceStorage';

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

    const handleRealtimeUpdate = () => {
      fetchLogs();
    };
    window.addEventListener('velavan_attendance_updated', handleRealtimeUpdate);
    return () => window.removeEventListener('velavan_attendance_updated', handleRealtimeUpdate);
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

      let filtered = merged;
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
        const empMap = new Map(employees.map(e => [e.emp_id, e.department]));
        filtered = filtered.filter(l => empMap.get(l.emp_id) === filters.department);
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
    try {
      const res = await api.recordManualAttendance(formData);
      const savedPunch = {
        ...formData,
        method: 'manual',
        status: formData.status || 'present',
        notes: formData.notes || 'HR manual adjustment'
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
        <button
          onClick={handleOpenManual}
          className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-sm transition-colors self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Manual Punch Entry</span>
        </button>
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
            <option value="Engineering">Engineering</option>
            <option value="Product">Product</option>
            <option value="Human Resources">Human Resources</option>
            <option value="Sales & Marketing">Sales & Marketing</option>
            <option value="Design">Design</option>
            <option value="Operations">Operations</option>
            <option value="Finance">Finance</option>
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
            <option value="late">Late Arrival</option>
            <option value="half_day">Half Day</option>
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
                <th className="px-4 py-3">Clock In</th>
                <th className="px-4 py-3">Clock Out</th>
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
                  const displayDept = log.department || empInfo.department || 'Operations';
                  const displayAvatar = resolvePhotoUrl(log.punch_photo || log.avatar || empInfo.avatar, displayName);

                  const isLate = log.status === 'late';
                  const isHalfDay = log.status === 'half_day';
                  const isAbsent = log.status === 'absent';
                  const isOngoing = !log.clock_out || log.clock_out === log.clock_in;

                  return (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono font-medium text-slate-700">
                        {log.date}
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
                      <td className="px-4 py-3 font-mono text-slate-700 font-semibold">{formatTime(log.clock_in)}</td>
                      <td className="px-4 py-3 font-mono text-slate-700">
                        {!isOngoing ? (
                          formatTime(log.clock_out)
                        ) : (
                          <span className="inline-flex items-center text-emerald-600 font-medium italic">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1.5"></span>
                            In progress...
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        {log.total_hours > 0 ? (
                          `${log.total_hours}h`
                        ) : isOngoing ? (
                          <span className="text-slate-400 font-normal italic">Active</span>
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
                          {isLate ? 'Late Arrival' : isHalfDay ? 'Half Day' : isAbsent ? 'Absent' : 'Present'}
                        </span>
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
                <label className="block text-slate-700 font-semibold mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Clock In (HH:MM:SS)</label>
                  <input
                    type="time"
                    step="1"
                    disabled={formData.status === 'absent' || formData.status === 'weekly_off'}
                    value={formData.clock_in}
                    onChange={(e) => setFormData({ ...formData, clock_in: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono disabled:opacity-40"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Clock Out (HH:MM:SS)</label>
                  <input
                    type="time"
                    step="1"
                    disabled={formData.status === 'absent' || formData.status === 'weekly_off'}
                    value={formData.clock_out}
                    onChange={(e) => setFormData({ ...formData, clock_out: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono disabled:opacity-40"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="present">Present (On Time)</option>
                    <option value="late">Late Arrival</option>
                    <option value="half_day">Half Day</option>
                    <option value="absent">Absent (Loss of Pay)</option>
                    <option value="weekly_off">Weekly Off (Paid)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Adjustment Reason</label>
                  <input
                    type="text"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
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
