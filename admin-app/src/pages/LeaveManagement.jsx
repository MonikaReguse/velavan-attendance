import React, { useState, useEffect } from 'react';
import { 
  CalendarCheck, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle,
  PlusCircle,
  Calendar
} from 'lucide-react';
import { api } from '../services/api';

export default function LeaveManagement() {
  const [leaves, setLeaves] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [activeTab, setActiveTab] = useState('pending');
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    emp_id: '',
    type: 'casual',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    days: 1,
    reason: ''
  });

  useEffect(() => {
    loadLeaves();
    loadEmployees();
  }, []);

  const loadLeaves = async () => {
    try {
      const data = await api.getLeaves();
      setLeaves(data);
    } catch (err) {
      console.error(err);
    }
  };

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

  const handleStatusChange = async (id, status) => {
    const notes = prompt(`Enter notes for ${status === 'approved' ? 'approving' : 'rejecting'} this leave request (optional):`, '');
    if (notes === null) return;

    try {
      await api.updateLeaveStatus(id, status, notes);
      loadLeaves();
    } catch (err) {
      alert('Error updating leave: ' + err.message);
    }
  };

  const handleSubmitLeave = async (e) => {
    e.preventDefault();
    try {
      await fetch('/api/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      setModalOpen(false);
      loadLeaves();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const filteredLeaves = activeTab === 'all' 
    ? leaves 
    : leaves.filter(l => l.status === activeTab);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Leave Requests & Approvals</h2>
          <p className="text-xs text-slate-500">
            Review time-off applications, manage team absences, and process sick or annual leave approvals.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-sm transition-colors self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Apply Leave for Staff</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-1">
        {['pending', 'approved', 'rejected', 'all'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors capitalize ${
              activeTab === tab
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab}
            <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 text-current">
              {tab === 'all' ? leaves.length : leaves.filter(l => l.status === tab).length}
            </span>
          </button>
        ))}
      </div>

      {/* Leave List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredLeaves.length === 0 ? (
          <div className="col-span-full bg-white p-12 text-center text-slate-400 text-xs rounded-xl border border-slate-200">
            No {activeTab} leave requests found.
          </div>
        ) : (
          filteredLeaves.map((leave) => {
            const isPending = leave.status === 'pending';
            const isApproved = leave.status === 'approved';

            return (
              <div
                key={leave.id}
                className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-4 flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2.5">
                      <img
                        src={leave.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&auto=format&fit=crop&q=80'}
                        alt={leave.employee_name}
                        className="w-9 h-9 rounded-full object-cover border border-slate-200"
                      />
                      <div>
                        <h4 className="text-xs font-bold text-slate-800">{leave.employee_name}</h4>
                        <p className="text-[10px] text-slate-400 font-mono">{leave.emp_id} • {leave.department}</p>
                      </div>
                    </div>

                    <span
                      className={`uppercase text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isApproved
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : isPending
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-rose-100 text-rose-800 border border-rose-200'
                      }`}
                    >
                      {leave.status}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="font-semibold text-slate-700 capitalize">{leave.type} Leave</span>
                      <span className="font-bold text-slate-800">{leave.days} Day{leave.days > 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center space-x-1.5 text-[11px] text-slate-500 font-mono">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{leave.start_date} {leave.days > 1 && `to ${leave.end_date}`}</span>
                    </div>
                    <p className="text-slate-600 text-[11px] italic pt-1 border-t border-slate-200/50">
                      "{leave.reason}"
                    </p>
                    {leave.admin_notes && (
                      <p className="text-[10px] text-slate-500 bg-white p-1 rounded border border-slate-200">
                        Admin Note: {leave.admin_notes}
                      </p>
                    )}
                  </div>
                </div>

                {isPending && (
                  <div className="flex items-center space-x-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => handleStatusChange(leave.id, 'approved')}
                      className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg flex items-center justify-center space-x-1 transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approve</span>
                    </button>
                    <button
                      onClick={() => handleStatusChange(leave.id, 'rejected')}
                      className="flex-1 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg border border-rose-200 flex items-center justify-center space-x-1 transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal to apply leave */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-6">
            <h3 className="font-bold text-slate-900 text-base mb-4">Record Leave for Employee</h3>
            <form onSubmit={handleSubmitLeave} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Employee</label>
                <select
                  value={formData.emp_id}
                  onChange={(e) => setFormData({ ...formData, emp_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  {employees.map(e => (
                    <option key={e.id} value={e.emp_id}>{e.name} ({e.emp_id})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Leave Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="casual">Casual Leave</option>
                  <option value="sick">Sick Leave</option>
                  <option value="annual">Annual Paid Vacation</option>
                  <option value="remote">Work from Home / Remote Day</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Total Days</label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  required
                  value={formData.days}
                  onChange={(e) => setFormData({ ...formData, days: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Reason</label>
                <textarea
                  rows="2"
                  required
                  placeholder="Doctor appointment, personal errand, etc."
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
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
                  Submit Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
