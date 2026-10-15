import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, 
  Download, 
  Calendar, 
  Users, 
  Clock, 
  TrendingUp, 
  Building2,
  FileSpreadsheet,
  IndianRupee,
  Sparkles,
  Award,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { api } from '../services/api';

export default function AttendanceReports() {
  const [data, setData] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    department: ''
  });

  useEffect(() => {
    // Default to current month range
    const now = new Date();
    const startStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const endStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    
    setFilters({ startDate: startStr, endDate: endStr, department: '' });
    loadReport({ startDate: startStr, endDate: endStr, department: '' });
  }, []);

  const loadReport = async (f) => {
    try {
      setLoading(true);
      const [resHistory, resEmployees] = await Promise.all([
        api.getAttendanceHistory(f),
        api.getEmployees()
      ]);
      setData(resHistory || []);
      setEmployees(resEmployees || []);
    } catch (err) {
      console.error('Error loading report data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    const url = api.getExportUrl(filters);
    window.open(url, '_blank');
  };

  const handleExportPayrollCSV = () => {
    const url = api.getPayrollExportUrl(filters);
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
    const dept = r.department || 'Operations';
    if (!deptStats[dept]) {
      deptStats[dept] = { count: 0, hours: 0, late: 0 };
    }
    deptStats[dept].count += 1;
    deptStats[dept].hours += (r.total_hours || 0);
    if (r.status === 'late') deptStats[dept].late += 1;
  });

  // Calculate Employee Payroll & Zero-Absent Double Salary
  const payrollStats = useMemo(() => {
    return employees.map(emp => {
      const records = data.filter(r => r.emp_id === emp.emp_id);
      let present = 0;
      let absent = 0;
      let halfday = 0;
      let otMinutes = 0;

      records.forEach(r => {
        if (r.status === 'present' || r.status === 'late') present += 1;
        else if (r.status === 'absent') absent += 1;
        else if (r.status === 'half_day') halfday += 1;
        if (r.ot_minutes > 0) otMinutes += r.ot_minutes;
      });

      const baseSalary = Number(emp.salary || 20000);
      const dailyRate = baseSalary / 30;
      const shiftMinutes = 510;
      const otRatePerMin = (dailyRate / shiftMinutes) * 1.5;
      const otPay = Math.round(otMinutes * otRatePerMin);

      const deductions = Math.round(absent * dailyRate + halfday * 0.5 * dailyRate);
      const earnedBase = Math.max(0, Math.round(baseSalary - deductions));

      // 100% Zero-Absent Double Salary Qualification Rule:
      // Zero absences recorded in the month with at least 1 shift logged
      const isDoubleSalaryEligible = absent === 0 && halfday === 0 && present > 0;
      const doubleSalaryBonus = isDoubleSalaryEligible ? baseSalary : 0;
      const netTotalPayout = earnedBase + doubleSalaryBonus + otPay;

      return {
        emp_id: emp.emp_id,
        name: emp.name,
        department: emp.department || 'Operations',
        role: emp.role || 'Staff',
        avatar: emp.avatar,
        baseSalary,
        present,
        absent,
        halfday,
        otMinutes,
        otPay,
        earnedBase,
        isDoubleSalaryEligible,
        doubleSalaryBonus,
        netTotalPayout
      };
    });
  }, [employees, data]);

  // Aggregate Payroll Totals
  const totalPayroll = payrollStats.reduce((sum, p) => sum + p.netTotalPayout, 0);
  const totalDoubleBonuses = payrollStats.reduce((sum, p) => sum + p.doubleSalaryBonus, 0);
  const doubleSalaryCount = payrollStats.filter(p => p.isDoubleSalaryEligible).length;
  const totalOtDisbursed = payrollStats.reduce((sum, p) => sum + p.otPay, 0);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Attendance Analytics & Payroll Reports</h2>
          <p className="text-xs text-slate-500">
            Generate monthly timesheets, department metrics, work-hour reports, and download payroll-ready CSVs with Zero-Absent Double Salary calculations.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold px-3.5 py-2.5 rounded-xl shadow-xs transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Attendance Logs CSV</span>
          </button>
          <button
            onClick={handleExportPayrollCSV}
            className="flex items-center space-x-1.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs transition-all"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Payroll CSV (2× Double Salary)</span>
          </button>
        </div>
      </div>

      {/* Date Range Selector */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center space-x-2">
          <span className="text-slate-500 font-medium">From:</span>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-800 font-mono"
          />
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-slate-500 font-medium">To:</span>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-800 font-mono"
          />
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-slate-500 font-medium">Department:</span>
          <select
            value={filters.department}
            onChange={(e) => setFilters({ ...filters, department: e.target.value })}
            className="px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-800"
          >
            <option value="">All Departments</option>
            <option value="Digital Marketing">Digital Marketing</option>
            <option value="Operations">Operations</option>
            <option value="Information Technology">Information Technology</option>
            <option value="Human Resources">Human Resources</option>
            <option value="Sales">Sales</option>
          </select>
        </div>

        <button
          onClick={() => loadReport(filters)}
          className="px-4 py-1.5 bg-[#8b0000] text-white rounded-lg hover:bg-[#6b0000] font-semibold transition-colors"
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

      {/* ============================================================== */}
      {/* ZERO-ABSENT DOUBLE SALARY & MONTHLY PAYROLL TRACKER            */}
      {/* ============================================================== */}
      <div className="bg-white rounded-2xl border border-amber-200/80 shadow-sm overflow-hidden">
        {/* Card Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-red-500/5 border-b border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[11px] font-bold mb-1.5 border border-amber-300">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Official Company Policy • 100% Zero-Absent Double Salary</span>
            </div>
            <h3 className="font-black text-slate-900 text-base sm:text-lg flex items-center space-x-2">
              <Award className="w-5 h-5 text-amber-600" />
              <span>Monthly Payroll & Double Salary Tracker</span>
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Employees with <strong>0 absences</strong> in the month receive an <strong>extra 100% Base Salary Bonus (2× Double Salary)</strong> plus Overtime.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <span className="px-3 py-1.5 bg-amber-100 text-amber-900 rounded-xl font-bold text-xs border border-amber-300 flex items-center space-x-1.5">
              <Award className="w-4 h-4 text-amber-700" />
              <span>{doubleSalaryCount} Qualified for 2× Salary</span>
            </span>
          </div>
        </div>

        {/* Payroll Summary KPI Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50/60 border-b border-slate-100 text-xs">
          <div className="bg-white p-3 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Total Projected Payroll</span>
            <div className="text-lg font-black text-slate-900 font-mono mt-0.5">
              ₹{totalPayroll.toLocaleString('en-IN')}
            </div>
            <span className="text-[10px] text-slate-400">All staff combined</span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-amber-200 bg-amber-50/20">
            <span className="text-[10px] text-amber-800 uppercase font-bold block">Double Salary Bonuses</span>
            <div className="text-lg font-black text-amber-800 font-mono mt-0.5">
              +₹{totalDoubleBonuses.toLocaleString('en-IN')}
            </div>
            <span className="text-[10px] text-amber-700 font-semibold">{doubleSalaryCount} staff with 0 absences</span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Total Overtime Pay</span>
            <div className="text-lg font-black text-slate-900 font-mono mt-0.5">
              +₹{totalOtDisbursed.toLocaleString('en-IN')}
            </div>
            <span className="text-[10px] text-slate-400">Beyond 6:00 PM buffer</span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Staff Tracked</span>
            <div className="text-lg font-black text-slate-900 font-mono mt-0.5">
              {payrollStats.length} Employees
            </div>
            <span className="text-[10px] text-emerald-600 font-semibold">Active team</span>
          </div>
        </div>

        {/* Payroll & Double Salary Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Base Salary</th>
                <th className="px-4 py-3">Attendance</th>
                <th className="px-4 py-3">Overtime</th>
                <th className="px-4 py-3">Zero-Absent Double Salary Status</th>
                <th className="px-4 py-3 text-right">Net Estimated Payout</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payrollStats.map(p => (
                <tr key={p.emp_id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-2.5">
                      <img
                        src={p.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}
                        alt={p.name}
                        className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0"
                      />
                      <div>
                        <div className="font-bold text-slate-900">{p.name}</div>
                        <div className="font-mono text-[10px] text-slate-400">{p.emp_id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-700">{p.department}</span>
                    <div className="text-[10px] text-slate-400">{p.role}</div>
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-slate-800">
                    ₹{p.baseSalary.toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-1.5 text-[11px]">
                      <span className="text-emerald-700 font-semibold">{p.present} Present</span>
                      <span>•</span>
                      <span className={p.absent > 0 ? "text-rose-600 font-bold" : "text-slate-400"}>
                        {p.absent} Absent
                      </span>
                      {p.halfday > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-blue-600 font-semibold">{p.halfday} Half-Day</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-mono font-medium text-slate-700">
                      {p.otMinutes > 0 ? `${p.otMinutes} mins` : '0 mins'}
                    </div>
                    {p.otPay > 0 && (
                      <span className="text-[10px] text-amber-700 font-bold block">
                        +₹{p.otPay.toLocaleString('en-IN')}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {p.isDoubleSalaryEligible ? (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 text-[10px] font-black border border-amber-300 shadow-2xs">
                        <Award className="w-3.5 h-3.5 text-amber-600" />
                        <span>🏆 2× Double Salary (+₹{p.doubleSalaryBonus.toLocaleString('en-IN')})</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-medium border border-slate-200">
                        <span>Standard ({p.absent} Absents)</span>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="font-mono font-black text-sm text-[#8b0000]">
                      ₹{p.netTotalPayout.toLocaleString('en-IN')}
                    </div>
                    <span className="text-[10px] text-slate-400 block">
                      {p.isDoubleSalaryEligible ? 'Double Base + OT' : 'Base - LOP + OT'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Department Breakdown Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
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
