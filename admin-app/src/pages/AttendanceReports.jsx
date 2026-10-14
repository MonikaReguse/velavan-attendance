import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Download, 
  Calendar, 
  Users, 
  Clock, 
  TrendingUp, 
  Building2,
  FileSpreadsheet
} from 'lucide-react';
import { api } from '../services/api';

export default function AttendanceReports() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    department: ''
  });

  useEffect(() => {
    // Default to last 30 days
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];
    setFilters({ startDate: startStr, endDate: endStr, department: '' });
    loadReport({ startDate: startStr, endDate: endStr, department: '' });
  }, []);

  const loadReport = async (f) => {
    try {
      setLoading(true);
      const res = await api.getAttendanceHistory(f);
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    const url = api.getExportUrl(filters);
    window.open(url, '_blank');
  };

  // Compute analytics metrics
  const totalRecords = data.length;
  const totalHours = data.reduce((sum, r) => sum + (r.total_hours || 0), 0);
  const avgDailyHours = totalRecords ? (totalHours / totalRecords).toFixed(1) : '0';
  const lateRecords = data.filter(r => r.status === 'late').length;
  const latePercent = totalRecords ? Math.round((lateRecords / totalRecords) * 100) : 0;
  const facelockPunches = data.filter(r => r.method === 'facelock').length;
  const facelockPercent = totalRecords ? Math.round((facelockPunches / totalRecords) * 100) : 0;

  // Department groupings
  const deptStats = {};
  data.forEach(r => {
    if (!deptStats[r.department]) {
      deptStats[r.department] = { count: 0, hours: 0, late: 0 };
    }
    deptStats[r.department].count += 1;
    deptStats[r.department].hours += (r.total_hours || 0);
    if (r.status === 'late') deptStats[r.department].late += 1;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Attendance Analytics & Reports</h2>
          <p className="text-xs text-slate-500">
            Generate monthly timesheets, department metrics, work-hour reports, and download payroll-ready CSVs.
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-sm transition-colors self-start sm:self-auto"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Export CSV Report</span>
        </button>
      </div>

      {/* Date Range Selector */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center space-x-2">
          <span className="text-slate-500 font-medium">From:</span>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            className="px-3 py-1.5 border border-slate-200 rounded-lg"
          />
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-slate-500 font-medium">To:</span>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            className="px-3 py-1.5 border border-slate-200 rounded-lg"
          />
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-slate-500 font-medium">Department:</span>
          <select
            value={filters.department}
            onChange={(e) => setFilters({ ...filters, department: e.target.value })}
            className="px-3 py-1.5 border border-slate-200 rounded-lg bg-white"
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

        <button
          onClick={() => loadReport(filters)}
          className="px-4 py-1.5 bg-slate-800 text-white rounded-lg hover:bg-slate-900 font-semibold"
        >
          Generate Report
        </button>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-slate-400 text-xs font-medium mb-1">Total Punches Logged</div>
          <div className="text-2xl font-bold text-slate-800">{totalRecords}</div>
          <span className="text-[11px] text-slate-400">In selected period</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-slate-400 text-xs font-medium mb-1">Cumulative Work Hours</div>
          <div className="text-2xl font-bold text-emerald-600">{Math.round(totalHours)} hrs</div>
          <span className="text-[11px] text-emerald-700">~{avgDailyHours} hrs/session</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-slate-400 text-xs font-medium mb-1">Punctuality Rate</div>
          <div className="text-2xl font-bold text-blue-600">{100 - latePercent}%</div>
          <span className="text-[11px] text-blue-700">{latePercent}% late arrivals</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-slate-400 text-xs font-medium mb-1">FaceLock Adoption</div>
          <div className="text-2xl font-bold text-purple-600">{facelockPercent}%</div>
          <span className="text-[11px] text-purple-700">{facelockPunches} camera punches</span>
        </div>
      </div>

      {/* Department Breakdown Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 text-sm">Department Performance Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Total Shifts</th>
                <th className="px-4 py-3">Total Hours</th>
                <th className="px-4 py-3">Late Occurrences</th>
                <th className="px-4 py-3">Punctuality %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Object.entries(deptStats).map(([dept, stat]) => {
                const onTimeRate = stat.count ? Math.round(((stat.count - stat.late) / stat.count) * 100) : 100;
                return (
                  <tr key={dept} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-bold text-slate-800">{dept}</td>
                    <td className="px-4 py-3 text-slate-600">{stat.count}</td>
                    <td className="px-4 py-3 text-slate-700 font-semibold">{stat.hours.toFixed(1)} hrs</td>
                    <td className="px-4 py-3 text-amber-600 font-medium">{stat.late}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-2">
                        <div className="w-20 bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-emerald-500 h-2 rounded-full"
                            style={{ width: `${onTimeRate}%` }}
                          />
                        </div>
                        <span className="font-mono text-slate-700 font-bold">{onTimeRate}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
