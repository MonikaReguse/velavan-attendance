import React from 'react';
import { Calendar, ShieldCheck, Building2, Clock } from 'lucide-react';
import MyAttendance from './MyAttendance';

export default function Attendance() {
  return (
    <div className="space-y-6">
      {/* Attendance Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                Personal Timesheet
              </span>
              <span className="text-slate-500 text-xs">•</span>
              <span className="text-xs text-slate-400">Office Attendance Terminal Only</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white mt-0.5">
              My Monthly Attendance Records
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Review your monthly timesheet, shift check-ins, working hours, and overtime records.
            </p>
          </div>
        </div>

        {/* Office Shift Notice */}
        <div className="bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 text-right self-start sm:self-auto text-xs">
          <span className="text-[10px] text-slate-500 block uppercase font-semibold">Office Shift</span>
          <span className="font-mono font-bold text-emerald-400">09:30 AM – 06:00 PM</span>
        </div>
      </div>

      {/* Office Kiosk Notice Banner */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3.5 flex items-start sm:items-center space-x-3 text-blue-300 text-xs">
        <Building2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5 sm:mt-0" />
        <span>
          <strong>Office Policy:</strong> Daily attendance is strictly recorded via the <strong>Office FaceLock Terminal</strong> when you arrive at the office entrance. Self-punching from personal devices is disabled.
        </span>
      </div>

      {/* Personal Timesheet View */}
      <MyAttendance />
    </div>
  );
}
