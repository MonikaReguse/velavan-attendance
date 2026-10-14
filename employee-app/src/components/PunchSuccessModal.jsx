import React, { useEffect } from 'react';
import { CheckCircle2, Clock, Sparkles, X, ScanFace } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function PunchSuccessModal({ punchResult, onClose }) {
  useEffect(() => {
    // Fire celebratory confetti
    confetti({
      particleCount: 90,
      spread: 60,
      origin: { y: 0.5 }
    });

    // Fast 1.2s auto-close
    const timer = setTimeout(() => {
      onClose();
    }, 1200);

    return () => clearTimeout(timer);
  }, [onClose]);

  if (!punchResult || !punchResult.employee) return null;

  const { employee, attendance, action, message, status } = punchResult;
  const isClockIn = action === 'clock_in';
  const isLate = attendance?.status === 'late';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border-2 border-emerald-500/80 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl shadow-emerald-500/20 text-center relative overflow-hidden">
        {/* Glow ambient light */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none"></div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Employee Avatar */}
        <div className="relative inline-block mx-auto mb-4">
          <img
            src={attendance?.punch_photo || employee.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&auto=format&fit=crop&q=80'}
            alt={employee.name}
            className="w-24 h-24 rounded-full object-cover border-4 border-emerald-500 shadow-lg mx-auto"
          />
          <div className="absolute bottom-0 right-0 bg-emerald-500 text-black p-1.5 rounded-full border-2 border-slate-900">
            <ScanFace className="w-4 h-4" />
          </div>
        </div>

        {/* Greeting & Name */}
        <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold mb-2 border border-emerald-500/20">
          <Sparkles className="w-3.5 h-3.5" />
          <span>FaceLock Biometric Verified</span>
        </div>

        <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
          Welcome, {employee.name}!
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">
          {employee.department} • {employee.role}
        </p>

        {/* Action badge */}
        <div className="mt-5 p-4 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-around">
          <div>
            <span className="text-[11px] text-slate-400 uppercase font-semibold block">Action</span>
            <span className="text-sm font-bold text-white capitalize flex items-center space-x-1 mt-0.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{isClockIn ? 'Clocked In' : 'Clocked Out'}</span>
            </span>
          </div>

          <div className="h-8 w-px bg-slate-700"></div>

          <div>
            <span className="text-[11px] text-slate-400 uppercase font-semibold block">Time</span>
            <span className="text-sm font-mono font-bold text-emerald-400 mt-0.5 block">
              {isClockIn ? attendance?.clock_in : attendance?.clock_out}
            </span>
          </div>

          <div className="h-8 w-px bg-slate-700"></div>

          <div>
            <span className="text-[11px] text-slate-400 uppercase font-semibold block">Status</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-md mt-0.5 inline-block ${
              isLate
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            }`}>
              {isLate ? 'Late Arrival' : 'On-Time'}
            </span>
          </div>
        </div>

        {/* Fast Auto-Close Progress Bar */}
        <div className="mt-4 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
          <div className="bg-emerald-400 h-full w-full animate-pulse"></div>
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors shadow-lg shadow-emerald-600/30 flex items-center justify-center space-x-1.5"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Verified! Auto-closing in 1.2s...</span>
        </button>
      </div>
    </div>
  );
}
