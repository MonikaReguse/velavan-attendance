import React, { useState } from 'react';
import { Key, X, ArrowRight, UserCheck } from 'lucide-react';
import { api } from '../services/api';

export default function PinFallbackModal({ onClose, onPunchSuccess }) {
  const [pin, setPin] = useState('');
  const [mode, setMode] = useState('auto');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDigit = (digit) => {
    if (pin.length < 6) {
      setPin(prev => prev + digit);
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPin('');
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!pin) {
      setError('Please enter your 4-digit PIN');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const nowObj = new Date();
      const clientDate = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(nowObj);
      const clientTime = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(nowObj);

      const res = await api.punchAttendance({
        pin: pin,
        mode: mode,
        method: 'pin',
        clientTime,
        clientDate
      });

      if (res.status === 'success' || res.status === 'already_clocked_in') {
        onPunchSuccess(res);
        onClose();
      } else {
        setError(res.error || 'Invalid PIN or employee not found');
      }
    } catch (err) {
      setError(err.message || 'Error recording attendance');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl relative text-white">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-5">
          <div className="w-12 h-12 rounded-xl bg-slate-800 text-emerald-400 flex items-center justify-center mx-auto mb-2 border border-slate-700">
            <Key className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-white text-base">Office PIN Punch Fallback</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Enter your 4-digit employee PIN to mark attendance if camera is unavailable
          </p>
        </div>

        {/* Mode selector */}
        <div className="flex rounded-lg bg-slate-800 p-1 mb-4 text-xs font-semibold">
          {['auto', 'in', 'out'].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-1.5 rounded-md transition-all uppercase ${
                mode === m
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {m === 'auto' ? 'Smart Auto' : m === 'in' ? 'Clock In' : 'Clock Out'}
            </button>
          ))}
        </div>

        {/* PIN display input */}
        <div className="mb-4">
          <div className="h-12 bg-slate-950 border border-slate-700 rounded-xl flex items-center justify-center tracking-widest text-xl font-mono font-bold text-emerald-400">
            {pin ? '• '.repeat(pin.length).trim() : <span className="text-slate-600 text-sm tracking-normal">Enter PIN</span>}
          </div>
          {error && <p className="text-[11px] text-rose-400 mt-1.5 text-center font-medium">{error}</p>}
        </div>

        {/* Keypad Grid */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleDigit(String(num))}
              className="h-12 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white font-mono text-lg font-bold transition-colors border border-slate-700/60"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            className="h-12 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-rose-400 font-semibold text-xs transition-colors border border-slate-700/60"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="h-12 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white font-mono text-lg font-bold transition-colors border border-slate-700/60"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="h-12 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-amber-400 font-semibold text-xs transition-colors border border-slate-700/60"
          >
            Del
          </button>
        </div>

        <button
          type="button"
          disabled={loading || !pin}
          onClick={handleSubmit}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/30"
        >
          {loading ? (
            <span>Verifying PIN...</span>
          ) : (
            <>
              <span>Verify & Punch Attendance</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
