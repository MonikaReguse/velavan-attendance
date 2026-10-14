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

export default function AttendanceLogs() {
  const [logs, setLogs] = useState([]);
  const [employees, setEmployees] = useState([]);
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
  }, []);

  const loadEmployees = async () => {
    try {
      const data = await api.getEmployees();
      setEmployees(data);
      if (data.length > 0 && !formData.emp_id) {
        setFormData(prev => ({ ...prev, emp_id: data[0].emp_id }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const data = await api.getAttendanceHistory(filters);
      setLogs(data);
    } catch (err) {
      console.error(err);
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
      await api.recordManualAttendance(formData);
      setModalOpen(false);
      fetchLogs();
    } catch (err) {
      alert('Error saving record: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this attendance record?')) return;
    try {
      await api.deleteAttendance(id);
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
                  <td colSpan="9" className="px-4 py-8 text-center text-slate-400">
                    No attendance records found for current criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isLate = log.status === 'late';
                  const isHalfDay = log.status === 'half_day';

                  return (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono font-medium text-slate-700">
                        {log.date}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2.5">
                          <img
                            src={log.punch_photo || log.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&auto=format&fit=crop&q=80'}
                            alt={log.employee_name}
                            className="w-7 h-7 rounded-full object-cover border border-slate-200"
                          />
                          <div>
                            <span className="font-bold text-slate-800">{log.employee_name}</span>
                            <span className="text-[10px] text-slate-400 font-mono ml-1.5">({log.emp_id})</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{log.department}</td>
                      <td className="px-4 py-3 font-mono text-slate-700 font-semibold">{log.clock_in}</td>
                      <td className="px-4 py-3 font-mono text-slate-700">
                        {log.clock_out || <span className="text-emerald-600 italic">In progress...</span>}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        {log.total_hours ? `${log.total_hours}h` : '-'}
                        {(log.ot_minutes > 0 || log.ot_hours > 0) && (
                          <span className="block text-[10px] text-amber-600 font-bold">
                            +{log.ot_minutes ? log.ot_minutes : Math.round(log.ot_hours * 60)} mins OT
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isLate
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : isHalfDay
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {isLate ? 'Late Arrival' : isHalfDay ? 'Half Day' : 'Present'}
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
                            onClick={() => handleDelete(log.id)}
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
