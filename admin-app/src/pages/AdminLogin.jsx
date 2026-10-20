import React, { useState } from 'react';
import { ShieldCheck, Lock, User, ArrowRight, AlertCircle, RefreshCw } from 'lucide-react';
import { api } from '../services/api';

export default function AdminLogin({ onLoginSuccess }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please enter both username and password');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await api.adminLogin(username.trim(), password);

      if (res.success) {
        onLoginSuccess(res.user || { username: username.trim(), role: 'Administrator' });
      } else {
        setError(res.error || 'Invalid credentials');
      }
    } catch (err) {
      setError(err.message || 'Error connecting to admin authentication service');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center items-center p-4 selection:bg-emerald-500 selection:text-white">
      {/* Background ambient lighting */}
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <img 
            src="/logo.png" 
            alt="Velavan Properties" 
            className="w-20 h-20 object-contain rounded-2xl mx-auto mb-3 shadow-xl border border-slate-700/60 bg-white/5 p-1" 
          />
          <h1 className="text-2xl font-black text-white tracking-tight">Velavan Properties Attendance App</h1>
          <p className="text-xs text-slate-400 mt-1">
            Admin & HR Management Portal
          </p>
        </div>

        {/* Card */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-md">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="text-center mb-4">
              <h2 className="text-lg font-bold text-white">Administrator Login</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Sign in with your administrator credentials to access the management dashboard.
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Admin Username
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Admin Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Security Footer */}
        <div className="text-center mt-6 text-xs text-slate-500 flex items-center justify-center space-x-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Velavan Properties Enterprise Management Security</span>
        </div>
      </div>
    </div>
  );
}
