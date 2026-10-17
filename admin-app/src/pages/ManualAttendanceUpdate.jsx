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
  Filter
} from 'lucide-react';
import { api } from '../services/api';
import { formatTime } from '../services/timeUtils';
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
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [clockIn, setClockIn] = useState('09:30:00');
  const [clockOut, setClockOut] = useState('18:00:00');
  const [status, setStatus] = useState('present');
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

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('velavan_attendance_updated', handleRealtimeUpdate);
      window.removeEventListener('velavan_employees_updated', handleRealtimeUpdate);
    };
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [empList, historyList] = await Promise.all([
        api.getEmployees(),
        api.getAttendanceHistory({ limit: 50 })
      ]);
      setEmployees(empList || []);
      const cleanHistory = mergeAttendanceWithLocal(historyList || []);
      setRecentLogs(cleanHistory.slice(0, 50));

      if (empList && empList.length > 0 && !selectedEmpId) {
        setSelectedEmpId(empList[0].emp_id);
      }
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', message: 'Failed to load initial data: ' + err.message });
      setRecentLogs(getLocalAttendance().slice(0, 50));
    } finally {
      setLoading(false);
    }
  };

  // Find currently selected employee object
  const currentEmployee = useMemo(() => {
    return employees.find(e => e.emp_id === selectedEmpId) || null;
  }, [employees, selectedEmpId]);

  // Live Overtime & Hours Calculator
  const calculatedStats = useMemo(() => {
    if (status === 'absent' || !clockIn || !clockOut || clockIn === '--' || clockOut === '--') {
      return { totalHours: 0, otMinutes: 0, previewStatus: status };
    }

    const toMins = (t) => {
      if (!t) return 0;
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

    return { totalHours, otMinutes, previewStatus: inM > 580 ? 'late' : status };
  }, [clockIn, clockOut, status, customOtMinutes]);

  // Quick Preset Handlers
  const applyPreset = (presetName) => {
    if (presetName === 'on_time') {
      setClockIn('09:30:00');
      setClockOut('18:00:00');
      setStatus('present');
      setCustomOtMinutes('');
      setNotes('Full Day (On-Time 09:30 AM – 06:00 PM)');
    } else if (presetName === 'ot_20') {
      setClockIn('09:30:00');
      setClockOut('18:20:00');
      setStatus('present');
      setCustomOtMinutes('20');
      setNotes('Regular Shift + 20 mins Overtime (Exit 06:20 PM)');
    } else if (presetName === 'ot_30') {
      setClockIn('09:30:00');
      setClockOut('18:30:00');
      setStatus('present');
      setCustomOtMinutes('30');
      setNotes('Regular Shift + 30 mins Overtime (Exit 06:30 PM)');
    } else if (presetName === 'half_day') {
      setClockIn('09:30:00');
      setClockOut('14:00:00');
      setStatus('half_day');
      setCustomOtMinutes('0');
      setNotes('Half-Day attendance approved by management');
    } else if (presetName === 'absent') {
      setClockIn('');
      setClockOut('');
      setStatus('absent');
      setCustomOtMinutes('0');
      setNotes('Leave / Absent (Loss of Pay)');
    } else if (presetName === 'weekly_off') {
      setClockIn('');
      setClockOut('');
      setStatus('weekly_off');
      setCustomOtMinutes('0');
      setNotes('Weekly Off (Paid Sunday Rest)');
    }
  };

  // Populate form to edit an existing record
  const handleEditRecord = (record) => {
    setEditingId(record.id);
    setSelectedEmpId(record.emp_id);
    setSelectedDate(record.date);
    setClockIn(record.clock_in || '09:30:00');
    setClockOut(record.clock_out || '18:00:00');
    setStatus(record.status || 'present');
    setCustomOtMinutes(record.ot_minutes ? String(record.ot_minutes) : '');
    setNotes(record.notes || 'HR manual adjustment');
    setFeedback(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Reset form to blank new entry
  const handleResetForm = () => {
    setEditingId(null);
    setSelectedDate(new Date().toISOString().split('T')[0]);
    setClockIn('09:30:00');
    setClockOut('18:00:00');
    setStatus('present');
    setCustomOtMinutes('');
    setNotes('HR manual attendance entry');
    setFeedback(null);
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

    try {
      setSaving(true);
      setFeedback(null);

      const payload = {
        id: editingId || undefined,
        emp_id: selectedEmpId,
        date: selectedDate,
        clock_in: (status === 'absent' || status === 'weekly_off') ? '--' : (clockIn || '--'),
        clock_out: (status === 'absent' || status === 'weekly_off') ? '--' : (clockOut || '--'),
        status: status,
        notes: notes.trim() || 'HR manual attendance entry',
        ot_minutes: customOtMinutes !== '' ? Number(customOtMinutes) : calculatedStats.otMinutes
      };

      const res = await api.recordManualAttendance(payload);

      if (res.success) {
        const savedPunch = {
          ...payload,
          employee_name: currentEmployee?.name || selectedEmpId,
          department: currentEmployee?.department,
          designation: currentEmployee?.designation,
          total_hours: calculatedStats.totalHours,
          ot_hours: calculatedStats.otMinutes > 0 ? Number((calculatedStats.otMinutes / 60).toFixed(2)) : 0
        };
        savePunchLocally(savedPunch);

        setFeedback({
          type: 'success',
          message: editingId
            ? `Attendance successfully updated for ${currentEmployee?.name || selectedEmpId} on ${selectedDate}!`
            : `Attendance successfully recorded for ${currentEmployee?.name || selectedEmpId} on ${selectedDate}!`
        });

        handleResetForm();
        const updatedLogs = await api.getAttendanceHistory({ limit: 50 });
        const merged = mergeAttendanceWithLocal(updatedLogs || []);
        setRecentLogs(merged.slice(0, 50));
      } else {
        let msg = res.error || 'Failed to save attendance';
        if (msg.includes('FOREIGN KEY')) {
          msg = 'Employee record was refreshed in database. Please click "Save Attendance Record" again.';
          loadData();
        }
        setFeedback({ type: 'error', message: msg });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Error communicating with attendance server' });
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
      const updatedLogs = await api.getAttendanceHistory({ limit: 50 });
      const merged = mergeAttendanceWithLocal(updatedLogs || []);
      setRecentLogs(merged.slice(0, 50));
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
              Manually mark or edit employee attendance, shift timings, overtime minutes, and on-duty permissions.
            </p>
          </div>
        </div>

        {editingId && (
          <div className="flex items-center space-x-2 bg-amber-50 border border-amber-200 px-3.5 py-2 rounded-xl text-xs text-amber-900 font-medium">
            <Edit3 className="w-4 h-4 text-amber-700" />
            <span>Currently Editing Record <strong>#{editingId}</strong></span>
            <button
              onClick={handleResetForm}
              className="ml-2 text-xs font-bold text-red-700 hover:underline"
            >
              Cancel Edit
            </button>
          </div>
        )}
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
                  {editingId ? 'Edit Attendance Details' : 'New Manual Attendance Record'}
                </h3>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                {editingId ? 'Record ID: #' + editingId : 'New Entry'}
              </span>
            </div>

            {/* 1. Employee Selector & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Select Employee <span className="text-red-600">*</span>
                </label>
                <select
                  value={selectedEmpId}
                  onChange={(e) => setSelectedEmpId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-semibold focus:outline-none focus:border-[#8b0000] focus:ring-2 focus:ring-red-100"
                  required
                >
                  {employees.map(emp => (
                    <option key={emp.emp_id} value={emp.emp_id}>
                      {emp.name} ({emp.emp_id}) • {emp.role || emp.department}
                    </option>
                  ))}
                </select>
                {currentEmployee && (
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Dept: <strong>{currentEmployee.department}</strong> • Base Salary: <strong>{currentEmployee.salary ? `₹${Number(currentEmployee.salary).toLocaleString('en-IN')}` : 'Not Set'}</strong>
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Attendance Date <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-mono font-semibold focus:outline-none focus:border-[#8b0000] focus:ring-2 focus:ring-red-100"
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Select current date or any past date to adjust.
                </span>
              </div>
            </div>

            {/* 2. 1-Click Quick Shift Presets */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                ⚡ 1-Click Quick Presets (Click to Auto-Fill Timings)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => applyPreset('on_time')}
                  className="p-2 text-left bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors"
                >
                  <span className="text-[11px] font-bold text-emerald-800 block">Full Day (On-Time)</span>
                  <span className="text-[10px] text-emerald-600 font-mono">09:30 AM – 06:00 PM</span>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset('ot_20')}
                  className="p-2 text-left bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-colors"
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

            {/* 3. Clock In, Clock Out & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Clock In Time
                </label>
                <input
                  type="time"
                  step="1"
                  disabled={status === 'absent' || status === 'weekly_off'}
                  value={clockIn}
                  onChange={(e) => setClockIn(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-mono font-bold focus:outline-none focus:border-[#8b0000] disabled:opacity-40"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">Base: 09:30:00</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Clock Out Time
                </label>
                <input
                  type="time"
                  step="1"
                  disabled={status === 'absent' || status === 'weekly_off'}
                  value={clockOut}
                  onChange={(e) => setClockOut(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-mono font-bold focus:outline-none focus:border-[#8b0000] disabled:opacity-40"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">Shift End: 18:00:00</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Attendance Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-semibold focus:outline-none focus:border-[#8b0000]"
                >
                  <option value="present">Present (On-Time)</option>
                  <option value="late">Late Arrival</option>
                  <option value="half_day">Half Day</option>
                  <option value="absent">Absent (Loss of Pay)</option>
                  <option value="weekly_off">Weekly Off (Paid)</option>
                </select>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Affects payroll</span>
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
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Adjustment Reason / Official Notes
              </label>
              <input
                type="text"
                placeholder="e.g. Client site visit / Forgot biometric punch / Medical emergency approved"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:border-[#8b0000]"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-3 bg-[#8b0000] hover:bg-[#7b0000] disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center justify-center space-x-2"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Saving Attendance...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>{editingId ? 'Update Attendance Record' : 'Save Attendance Record'}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleResetForm}
                className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors flex items-center space-x-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
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
                <p className="text-[11px] text-slate-500">Click ✏️ Edit on any row to quickly update.</p>
              </div>
              <button
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
                </div>
              ) : (
                filteredLogs.map(item => {
                  const isLate = item.status === 'late';
                  const isHalfDay = item.status === 'half_day';
                  const isAbsent = item.status === 'absent';
                  const hasOt = item.ot_minutes > 0 || item.ot_hours > 0;
                  const otMins = item.ot_minutes || Math.round((item.ot_hours || 0) * 60);

                  return (
                    <div 
                      key={item.id}
                      className={`p-3 rounded-2xl border transition-all ${
                        editingId === item.id 
                          ? 'bg-red-50/50 border-[#8b0000] ring-1 ring-[#8b0000]'
                          : 'bg-white border-slate-100 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-xs text-slate-900">{item.employee_name}</span>
                          <span className="text-[10px] font-mono text-slate-400">({item.emp_id})</span>
                        </div>
                        <span className="text-[11px] font-mono font-bold text-slate-700">{item.date}</span>
                      </div>

                      {/* Timings row */}
                      <div className="flex items-center justify-between mt-1 text-[11px]">
                        <div className="text-slate-600 font-mono">
                          {item.clock_in ? `${formatTime(item.clock_in)} → ${item.clock_out ? formatTime(item.clock_out) : 'In progress'}` : <span className="italic text-slate-400">No punch timings</span>}
                        </div>

                        {/* Status Badge */}
                        <div>
                          {isAbsent ? (
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
                          {hasOt ? (
                            <span className="inline-flex items-center space-x-1 font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded text-[10px] border border-amber-200">
                              <Flame className="w-3 h-3 text-amber-600" />
                              <span>+{otMins} mins OT</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">{item.method === 'manual' ? 'Manual Entry' : 'Biometric'}</span>
                          )}
                        </div>

                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => handleEditRecord(item)}
                            className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg font-bold text-[10px] flex items-center space-x-1 transition-colors"
                            title="Edit this attendance record"
                          >
                            <Edit3 className="w-3 h-3 text-amber-700" />
                            <span>Edit</span>
                          </button>

                          <button
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
