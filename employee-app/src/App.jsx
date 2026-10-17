import React, { useEffect } from 'react';
import { 
  ScanFace, 
  ExternalLink,
  LogOut,
  Building2,
  ShieldCheck
} from 'lucide-react';
import { AppProvider, useApp } from './context/AppContext';
import EmployeePortal from './pages/EmployeePortal';
import Login from './pages/Login';

function MainApp() {
  const { activeEmployee, isAuthenticated, logout, loading } = useApp();

  useEffect(() => {
    try {
      const purgeKey = 'velavan_purge_old_models_v3';
      if (!localStorage.getItem(purgeKey)) {
        localStorage.removeItem('workpulse_employee_list');
        localStorage.removeItem('velavan_master_database_backup');
        localStorage.removeItem('velavan_attendance_logs_cache');
        localStorage.removeItem('velavan_today_attendance');
        localStorage.removeItem('velavan_realtime_punches');
        localStorage.setItem(purgeKey, 'true');
      }
    } catch (e) {}
  }, []);

  // If loading session
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-slate-400">Loading Velavan Properties Session...</span>
        </div>
      </div>
    );
  }

  // If not logged in, show Phone OTP Login screen
  if (!isAuthenticated || !activeEmployee) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Top Header */}
      <header className="h-14 sm:h-16 bg-white border-b border-slate-200 px-3 sm:px-6 flex items-center justify-between shrink-0 sticky top-0 z-40 shadow-xs">
        {/* Brand */}
        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
          <img 
            src="/logo.png" 
            alt="Velavan Properties" 
            className="w-8 h-8 sm:w-10 sm:h-10 object-contain rounded-xl shadow-xs border border-slate-200 bg-white p-0.5 shrink-0" 
          />
          <div className="min-w-0">
            <h1 className="font-extrabold text-[#8b0000] text-xs sm:text-base tracking-tight leading-tight truncate">
              Velavan Properties
            </h1>
            <span className="text-[10px] text-amber-700 font-bold leading-none block truncate">
              Attendance & Payroll Portal
            </span>
          </div>
        </div>

        {/* User profile chip & Logout */}
        <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
          <div 
            className="flex items-center space-x-1.5 sm:space-x-2 pl-2 border-l border-slate-200"
            title="Active Employee Profile"
          >
            <img
              src={activeEmployee.avatar || activeEmployee.doc_photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60&auto=format&fit=crop&q=80'}
              alt={activeEmployee.name}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border-2 border-[#8b0000] shrink-0"
            />
            <div className="hidden sm:block text-left">
              <span className="text-xs font-bold text-slate-800 block leading-none">{activeEmployee.name}</span>
              <span className="text-[10px] text-slate-500 font-mono leading-none">{activeEmployee.emp_id}</span>
            </div>
          </div>

          {/* Logout button */}
          <button
            onClick={logout}
            className="p-1.5 sm:p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
            title="Log out from this device"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Single-Page Main Portal Container */}
      <main className="flex-1 p-3 sm:p-6 md:p-8 max-w-7xl mx-auto w-full">
        <EmployeePortal />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
}
