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
  ChevronRight
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
      const cleanEmpList = empList || [];
      setEmployees(cleanEmpList);
      const cleanHistory = mergeAttendanceWithLocal(historyList || []);
      setRecentLogs(cleanHistory.slice(0, 50));

      if (cleanEmpList.length > 0 && !selectedEmpId) {
        // Pick the first employee who does NOT have attendance for selectedDate today
        const unmarked = cleanEmpList.find(e => !cleanHistory.some(a => a.emp_id === e.emp_id && a.date === selectedDate));
        setSelectedEmpId(unmarked ? unmarked.emp_id : cleanEmpList[0].emp_id);
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

  // Handle switching employee in dropdown - NEVER keeps editingId of another employee!
  const handleSelectEmployee = (empId) => {
    setSelectedEmpId(empId);
    setEditingId(null); // Clear editing mode so other employee records are NEVER modified!

    const all = getLocalAttendance();
    const existing = all.find(a => a.emp_id === empId && a.date === selectedDate)
      || recentLogs.find(a => a.emp_id === empId && a.date === selectedDate);

    if (existing) {
      setClockIn(existing.clock_in && existing.clock_in !== '--' ? existing.clock_in : '09:30:00');
      setClockOut(existing.clock_out && existing.clock_out !== '--' ? existing.clock_out : '18:00:00');
      setStatus(existing.status || 'present');
      setCustomOtMinutes(existing.ot_minutes ? String(existing.ot_minutes) : '');
      setNotes(existing.notes || 'HR manual adjustment');
    } else {
      setClockIn('09:30:00');
      setClockOut('18:00:00');
      setStatus('present');
      setCustomOtMinutes('');
      setNotes('HR manual attendance entry');
    }
    setFeedback(null);
  };

  // Handle switching date
  const handleSelectDate = (newDate) => {
    setSelectedDate(newDate);
    setEditingId(null); // Clear editing mode when switching date

    const all = getLocalAttendance();
    const existing = all.find(a => a.emp_id === selectedEmpId && a.date === newDate)
      || recentLogs.find(a => a.emp_id === selectedEmpId && a.date === newDate);

    if (existing) {
      setClockIn(existing.clock_in && existing.clock_in !== '--' ? existing.clock_in : '09:30:00');
      setClockOut(existing.clock_out && existing.clock_out !== '--' ? existing.clock_out : '18:00:00');
      setStatus(existing.status || 'present');
      setCustomOtMinutes(existing.ot_minutes ? String(existing.ot_minutes) : '');
      setNotes(existing.notes || 'HR manual adjustment');
    } else {
      setClockIn('09:30:00');
      setClockOut('18:00:00');
      setStatus('present');
      setCustomOtMinutes('');
      setNotes('HR manual attendance entry');
    }
    setFeedback(null);
  };

  // Swift Navigation: Advance to next employee who needs attendance
  const advanceToNextEmployee = () => {
    if (!employees || employees.length === 0) return;
    const currentIdx = employees.findIndex(e => e.emp_id === selectedEmpId);
    const all = getLocalAttendance();

    let nextEmp = null;
    for (let i = 1; i <= employees.length; i++) {
      const candidate = employees[(currentIdx + i) % employees.length];
      const hasRecord = all.some(a => a.emp_id === candidate.emp_id && a.date === selectedDate);
      if (!hasRecord) {
        nextEmp = candidate;
        break;
      }
    }
    if (!nextEmp) {
      nextEmp = employees[(currentIdx + 1) % employees.length];
    }
    handleSelectEmployee(nextEmp.emp_id);
  };

  // Swift Navigation: Go to previous employee
  const goToPrevEmployee = () => {
    if (!employees || employees.length === 0) return;
    const currentIdx = employees.findIndex(e => e.emp_id === selectedEmpId);
    const prevIdx = (currentIdx - 1 + employees.length) % employees.length;
    handleSelectEmployee(employees[prevIdx].emp_id);
  };

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

  // Explicitly enter Edit Mode for a specific record
  const handleEditRecord = (record) => {
    if (!record) return;
    setEditingId(record.id);
    setSelectedEmpId(record.emp_id);
    setSelectedDate(record.date);
    setClockIn((record.clock_in && record.clock_in !== '--') ? record.clock_in : '09:30:00');
    setClockOut((record.clock_out && record.clock_out !== '--') ? record.clock_out : '18:00:00');
    setStatus(record.status || 'present');
    setCustomOtMinutes((record.ot_minutes !== undefined && record.ot_minutes !== null && Number(record.ot_minutes) > 0) ? String(record.ot_minutes) : '');
    setNotes(record.notes || 'HR manual adjustment');
    setFeedback({
      type: 'success',
      message: `Loaded record #${record.id} for ${record.employee_name || record.emp_id}. Make changes and click Update.`
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Reset form to blank new entry mode
  const handleResetForm = () => {
    setEditingId(null);
    setClockIn('09:30:00');
    setClockOut('18:00:00');
    setStatus('present');
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

      const payload = {
        id: targetId,
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
        const finalId = res.id || targetId || undefined;
        const savedPunch = {
          ...payload,
          id: finalId,
          employee_name: currentEmployee?.name || selectedEmpId,
          department: currentEmployee?.department,
          designation: currentEmployee?.role || currentEmployee?.designation,
          punch_photo: res.attendance?.punch_photo || existingRecord?.punch_photo || undefined,
          method: res.attendance?.method || existingRecord?.method || 'manual',
          total_hours: calculatedStats.totalHours,
          ot_hours: calculatedStats.otMinutes > 0 ? Number((calculatedStats.otMinutes / 60).toFixed(2)) : 0
        };
        savePunchLocally(savedPunch);

        const empName = currentEmployee?.name || selectedEmpId;
        const wasEditing = !!editingId;

        // CRITICAL FIX: Always reset editingId to null! Never trap the user in edit mode!
        setEditingId(null);

        setFeedback({
          type: 'success',
          message: wasEditing
            ? `Attendance successfully updated for ${empName} on ${selectedDate}!`
            : `Attendance successfully recorded for ${empName} on ${selectedDate}!`
        });

        // Refresh recent logs
        const updatedLogs = await api.getAttendanceHistory({ limit: 50 });
        const merged = mergeAttendanceWithLocal(updatedLogs || []);
        setRecentLogs(merged.slice(0, 50));

        // Advance to next unmarked employee for daily attendance flow
        advanceToNextEmployee();
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
      setFeedback({ 
        type: 'error', 
        message: `❌ Connection error: ${err.message || 'Error communicating with attendance server'}. Existing records remain safe.` 
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
      const updatedLogs = await api.getAttendanceHistory({ limit: 50 });
      const merged = mergeAttendanceWithLocal(updatedLogs || []);
      setRecentLogs(merged.slice(0, 50));
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
                  {editingId ? `Editing Attendance Record #${editingId}` : 'Mark Attendance (New Record)'}
                </h3>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  editingId ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'
                }`}>
                  {editingId ? `Edit Mode: Record #${editingId}` : 'New Entry Mode'}
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
                      onClick={advanceToNextEmployee}
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
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Attendance Date <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={selectedDate}
                    onChange={(e) => handleSelectDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-mono font-semibold focus:outline-none focus:border-[#8b0000] focus:ring-2 focus:ring-red-100"
                  />
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Select date to mark daily attendance or past adjustments.
                </span>
              </div>
            </div>

            {/* Attendance Status Context Banner for currently selected employee */}
            {isCurrentMarked ? (
              editingId ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-900">
                  <div className="flex items-center space-x-2">
                    <Edit3 className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>
                      Modifying <strong>Record #{editingId}</strong> for <strong>{currentEmployee?.name}</strong> on {selectedDate}.
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
                      Attendance already recorded for <strong>{currentEmployee?.name}</strong> on {selectedDate} ({existingRecord?.status?.toUpperCase()} • {existingRecord?.clock_in || '--'} to {existingRecord?.clock_out || '--'}).
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
                      onClick={advanceToNextEmployee}
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
                  No record yet for <strong>{currentEmployee?.name}</strong> on {selectedDate}. Standard 09:30 AM – 06:00 PM pre-filled.
                </span>
              </div>
            )}

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
                placeholder="e.g. Regular shift / Client site visit / Management approved"
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
                  const hasOt = item.ot_minutes > 0 || item.ot_hours > 0;
                  const otMins = item.ot_minutes || Math.round((item.ot_hours || 0) * 60);

                  return (
                    <div 
                      key={item.id}
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
