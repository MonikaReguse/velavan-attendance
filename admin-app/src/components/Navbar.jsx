import React from 'react';
import { Bell, RefreshCw, Calendar, Clock, LogOut, Shield, Menu, Lock, ShieldCheck } from 'lucide-react';

export default function Navbar({ 
  onRefresh, 
  isRefreshing, 
  officeName, 
  adminUser, 
  isKioskMode,
  onOpenAdminUnlock,
  onLockKiosk,
  onLogout, 
  onToggleMobileMenu 
}) {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-3 sm:px-6 flex items-center justify-between z-10 shrink-0 shadow-2xs">
      {/* Brand & Terminal Mode */}
      <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
        {/* Mobile Hamburger Button (Only shown in full admin mode on small screens) */}
        {!isKioskMode && (
          <button
            onClick={onToggleMobileMenu}
            className="p-1.5 text-slate-600 hover:text-slate-900 md:hidden rounded-xl hover:bg-slate-100 shrink-0"
            title="Open Management Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <img 
          src="/logo.png" 
          alt="Velavan Properties" 
          className="w-8 h-8 sm:w-9 sm:h-9 object-contain rounded-xl border border-slate-200 bg-white p-0.5 shadow-xs shrink-0" 
        />
        <div className="min-w-0">
          <h2 className="text-xs sm:text-base font-black text-slate-800 leading-tight truncate">
            {officeName || 'Velavan Properties'}
          </h2>
          <div className="flex items-center space-x-1.5">
            {isKioskMode ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                <span className="text-[10px] font-bold text-[#8b0000] uppercase tracking-wider block truncate">
                  FaceLock Attendance Terminal
                </span>
              </>
            ) : (
              <span className="text-[10px] font-bold text-amber-700 leading-none block truncate">
                Admin & HR Management Hub
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
        {/* Date display */}
        <div className="hidden md:flex items-center space-x-2 text-xs font-medium text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>{today}</span>
        </div>

        {/* Refresh button */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200"
          title="Refresh Data"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-600' : ''}`} />
        </button>

        {/* KIOSK MODE: Show Admin Unlock Button */}
        {isKioskMode ? (
          <button
            onClick={onOpenAdminUnlock}
            className="px-3 sm:px-3.5 py-1.5 sm:py-2 bg-[#8b0000] hover:bg-[#7b0000] text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all"
            title="Administrator / HR login to access settings, directory & reports"
          >
            <Lock className="w-3.5 h-3.5 text-amber-300" />
            <span>Admin Login</span>
          </button>
        ) : (
          /* UNLOCKED ADMIN MODE: Admin profile & Logout */
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* User chip */}
            <div className="flex items-center space-x-2 pl-2 border-l border-slate-200">
              <div className="w-7 h-7 rounded-full bg-[#8b0000] text-white flex items-center justify-center font-bold text-xs uppercase shadow-xs">
                {adminUser?.username ? adminUser.username.slice(0, 2) : 'AD'}
              </div>
              <span className="text-xs font-bold text-slate-700">
                {adminUser?.username || 'Admin'}
              </span>
            </div>

            {/* Logout button */}
            {onLogout && (
              <button
                onClick={onLogout}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                title="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
