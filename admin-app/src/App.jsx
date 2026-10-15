import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import AdminDashboard from './pages/AdminDashboard';
import OfficeFaceLockKiosk from './pages/OfficeFaceLockKiosk';
import AddEmployeeInfo from './pages/AddEmployeeInfo';
import EmployeeDirectory from './pages/EmployeeDirectory';
import AttendanceLogs from './pages/AttendanceLogs';
import AttendanceReports from './pages/AttendanceReports';
import OfficeSettings from './pages/OfficeSettings';
import ManualAttendanceUpdate from './pages/ManualAttendanceUpdate';
import FaceEnrollment from './pages/FaceEnrollment';
import AdminUnlockModal from './components/AdminUnlockModal';
import { api } from './services/api';

export default function App() {
  // Default to Kiosk Mode (Employee FaceLock Only)
  // Ensures employees ONLY see the FaceLock camera and punch screen!
  const [isKioskMode, setIsKioskMode] = useState(() => {
    try {
      const savedUser = localStorage.getItem('workpulse_admin_user');
      const savedKiosk = localStorage.getItem('workpulse_is_kiosk');
      if (savedKiosk !== null) return savedKiosk === 'true';
      return !savedUser;
    } catch {
      return true;
    }
  });
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);
  const [adminUser, setAdminUser] = useState(() => {
    try {
      const saved = localStorage.getItem('workpulse_admin_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [activeTab, setActiveTabState] = useState(() => {
    try {
      return localStorage.getItem('workpulse_admin_tab') || 'dashboard';
    } catch {
      return 'dashboard';
    }
  });

  const setActiveTab = (tab) => {
    setActiveTabState(tab);
    try {
      localStorage.setItem('workpulse_admin_tab', tab);
    } catch (e) {}
  };

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [officeName, setOfficeName] = useState('Velavan Properties');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    api.getSettings().then(s => {
      if (s?.office_name) setOfficeName(s.office_name);
    }).catch(console.error);
  }, []);

  const handleUnlockSuccess = (user) => {
    setAdminUser(user);
    try {
      localStorage.setItem('workpulse_admin_user', JSON.stringify(user));
      localStorage.setItem('workpulse_is_kiosk', 'false');
    } catch (e) {}
    setIsKioskMode(false);
    setIsUnlockModalOpen(false);
  };

  const handleLockKiosk = () => {
    setIsKioskMode(true);
    try {
      localStorage.setItem('workpulse_is_kiosk', 'true');
    } catch (e) {}
    setActiveTabState('facelock-kiosk');
    setIsMobileMenuOpen(false);
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem('workpulse_admin_user');
      localStorage.setItem('workpulse_is_kiosk', 'true');
    } catch (e) {}
    setAdminUser(null);
    handleLockKiosk();
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 font-sans">
      {/* Admin Unlock Modal (Password Prompt for HR/Manager) */}
      <AdminUnlockModal
        isOpen={isUnlockModalOpen}
        onClose={() => setIsUnlockModalOpen(false)}
        onUnlockSuccess={handleUnlockSuccess}
      />

      {/* Sidebar Navigation: ONLY visible when HR/Admin unlocks the app! */}
      {!isKioskMode && (
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
          onLockKiosk={handleLockKiosk}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <Navbar
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          officeName={officeName}
          adminUser={adminUser}
          isKioskMode={isKioskMode}
          onOpenAdminUnlock={() => setIsUnlockModalOpen(true)}
          onLockKiosk={handleLockKiosk}
          onLogout={handleLogout}
          onToggleMobileMenu={() => setIsMobileMenuOpen(prev => !prev)}
        />

        {/* Scrollable Page Container */}
        <main className="flex-1 overflow-y-auto p-3.5 sm:p-6 md:p-8">
          <div className="max-w-7xl mx-auto">
            {/* IN KIOSK MODE: ONLY Office FaceLock Attendance is rendered! */}
            {isKioskMode ? (
              <OfficeFaceLockKiosk />
            ) : (
              /* IN UNLOCKED ADMIN MODE: HR/Manager can view all management options */
              <>
                {activeTab === 'facelock-kiosk' && <OfficeFaceLockKiosk />}
                {activeTab === 'manual-attendance' && <ManualAttendanceUpdate />}
                {activeTab === 'dashboard' && <AdminDashboard setActiveTab={setActiveTab} />}
                {activeTab === 'face-enrollment' && <FaceEnrollment />}
                {activeTab === 'add-employee' && <AddEmployeeInfo setActiveTab={setActiveTab} />}
                {activeTab === 'employees' && <EmployeeDirectory setActiveTab={setActiveTab} />}
                {activeTab === 'attendance' && <AttendanceLogs />}
                {activeTab === 'reports' && <AttendanceReports />}
                {activeTab === 'settings' && <OfficeSettings onUpdateOfficeName={setOfficeName} />}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
