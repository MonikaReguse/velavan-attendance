import React from 'react';
import { 
  LayoutDashboard, 
  UserPlus, 
  Users, 
  ClipboardList, 
  BarChart3, 
  Settings,
  ExternalLink,
  ShieldCheck,
  ScanFace,
  X,
  Lock,
  CalendarCheck
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, isMobileMenuOpen, setIsMobileMenuOpen, onLockKiosk }) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'facelock-kiosk', label: 'Office FaceLock Attendance', icon: ScanFace, live: true },
    { id: 'manual-attendance', label: 'Manual Attendance Update', icon: CalendarCheck },
    { id: 'add-employee', label: 'Add Employee Info', icon: UserPlus },
    { id: 'employees', label: 'Employee List', icon: Users },
    { id: 'attendance', label: 'Attendance Records', icon: ClipboardList },
    { id: 'reports', label: 'Reports & Export', icon: BarChart3 },
    { id: 'settings', label: 'Office Settings', icon: Settings },
  ];

  const handleSelectTab = (tabId) => {
    setActiveTab(tabId);
    if (setIsMobileMenuOpen) {
      setIsMobileMenuOpen(false);
    }
  };

  const handleLock = () => {
    if (setIsMobileMenuOpen) {
      setIsMobileMenuOpen(false);
    }
    if (onLockKiosk) {
      onLockKiosk();
    }
  };

  const renderContent = (isMobile = false) => (
    <>
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center space-x-3">
          <img 
            src="/logo.png" 
            alt="Velavan Properties" 
            className="w-10 h-10 object-contain rounded-xl shadow-xs border border-slate-200 bg-white p-0.5 shrink-0" 
          />
          <div>
            <h1 className="font-black text-slate-900 text-sm leading-tight tracking-tight">Velavan Properties</h1>
            <span className="text-[10px] font-bold text-[#8b0000] uppercase tracking-wider block">Attendance App</span>
          </div>
        </div>
        {isMobile && (
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Lock Kiosk Button */}
      <div className="p-3 border-b border-slate-100 bg-amber-50/40">
        <button
          onClick={handleLock}
          className="w-full flex items-center justify-center space-x-2 px-3 py-2.5 rounded-xl bg-amber-100/80 hover:bg-amber-200/90 text-amber-900 border border-amber-300 font-bold text-xs shadow-2xs transition-all"
          title="Switch screen to FaceLock only for staff attendance"
        >
          <Lock className="w-4 h-4 text-amber-800" />
          <span>Lock to Employee FaceLock</span>
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="px-3 py-2 text-[11px] font-bold uppercase text-slate-400 tracking-wider">
          Management
        </div>

        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleSelectTab(item.id)}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-[#8b0000] text-white shadow-sm shadow-red-950/20 font-bold'
                  : 'text-slate-600 hover:bg-red-50/70 hover:text-[#8b0000]'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : item.live ? 'text-[#8b0000] animate-pulse' : 'text-slate-400'}`} />
              <span className="flex-1 text-left">{item.label}</span>
              {item.live && !isActive && (
                <span className="px-1.5 py-0.5 text-[9px] uppercase font-black bg-red-100 text-[#8b0000] rounded font-mono border border-red-200">
                  LIVE
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Link to Employee Self-Service Portal */}
      <div className="p-4 border-t border-slate-200 bg-slate-50/50">
        <div className="rounded-xl bg-gradient-to-br from-red-50/80 via-white to-amber-50/50 p-3.5 border border-red-200/60 text-xs shadow-2xs">
          <div className="font-bold text-slate-800 flex items-center justify-between mb-1">
            <span>Employee Portal</span>
            <span className="flex h-2 w-2 relative">
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#8b0000]"></span>
            </span>
          </div>
          <p className="text-slate-500 text-[11px] mb-2.5">Staff portal for viewing timesheets & profile (Port 5174)</p>
          <a
            href="http://localhost:5174"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center space-x-1.5 text-[#8b0000] hover:text-[#a70809] font-bold text-[11px]"
          >
            <span>Open Employee Portal</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex w-64 bg-white text-slate-700 flex-col shrink-0 border-r border-slate-200 shadow-xs h-full">
        {renderContent(false)}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] bg-white h-full flex flex-col z-10 shadow-2xl animate-in slide-in-from-left">
            {renderContent(true)}
          </div>
        </div>
      )}
    </>
  );
}
