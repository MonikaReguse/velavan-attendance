import React, { useState } from 'react';
import { Lock, ShieldCheck, X, AlertCircle, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { api } from '../services/api';

export default function AdminUnlockModal({ isOpen, onClose, onUnlockSuccess }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleUnlock = async (e) => {
    e.preventDefault();
    if (!password) {
      setError('Please enter the admin password');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await api.adminLogin('admin', password.trim());

      if (res.success) {
        setPassword('');
        setError('');
        onUnlockSuccess(res.user || { username: 'admin', role: 'Administrator' });
      } else {
        setError(res.error || 'Invalid administrator password');
      }
    } catch (err) {
      setError(err.message || 'Error verifying credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-slate-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl absolute top-4 right-4 transition-colors"
          title="Cancel"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-5">
          <div className="w-12 h-12 bg-red-50 text-[#8b0000] rounded-2xl flex items-center justify-center mx-auto mb-3 border border-red-200 shadow-xs">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-black text-slate-900 tracking-tight">
            Administrator Access
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Enter admin password to unlock management features (Employee Directory, Reports & Settings).
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Unlock Form */}
        <form onSubmit={handleUnlock} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Admin Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoFocus
                placeholder="Enter password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-[#8b0000] focus:ring-2 focus:ring-red-100 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(prev => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-2.5 bg-[#8b0000] hover:bg-[#7b0000] disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center justify-center space-x-2"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Verifying...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Unlock Management Panel</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 text-xs text-slate-500 hover:text-slate-800 font-medium transition-colors"
          >
            Cancel & Stay on FaceLock Kiosk
          </button>
        </form>
      </div>
    </div>
  );
}
