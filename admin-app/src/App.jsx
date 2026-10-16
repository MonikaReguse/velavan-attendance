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

    // Auto-purge toxic deleted IDs
    try {
      localStorage.removeItem('velavan_deleted_ids');
    } catch (e) {}

    // Triple-Layer Disaster Recovery: Smart Two-Way Merge between browser and server
    const runDisasterRecovery = async () => {
      try {
        const backupData = await api.getBackup().catch(() => null);
        const serverEmps = Array.isArray(backupData?.employees) ? backupData.employees : [];
        const serverAtts = Array.isArray(backupData?.attendance) ? backupData.attendance : [];

        const localBackupStr = localStorage.getItem('velavan_master_database_backup');
        let localBackup = null;
        if (localBackupStr) {
          try {
            localBackup = JSON.parse(localBackupStr);
          } catch (e) {}
        }
        const localEmps = Array.isArray(localBackup?.employees) ? localBackup.employees : [];
        const localAtts = Array.isArray(localBackup?.attendance) ? localBackup.attendance : [];

        // Check if server is missing any attendance records present in local master backup
        const serverAttKeys = new Set(serverAtts.map(a => `${a.emp_id}_${a.date}`));
        const missingAtts = localAtts.filter(a => !serverAttKeys.has(`${a.emp_id}_${a.date}`));

        // Check if server is missing any employees present in local master backup
        const serverEmpKeys = new Set(serverEmps.map(e => e.emp_id));
        const missingEmps = localEmps.filter(e => !serverEmpKeys.has(e.emp_id));

        if (missingAtts.length > 0 || missingEmps.length > 0) {
          console.warn(`[Disaster Recovery] Server restart detected! Restoring ${missingEmps.length} missing employees and ${missingAtts.length} attendance records from browser backup...`);
          const mergedPayload = {
            employees: [...serverEmps, ...missingEmps],
            attendance: [...serverAtts, ...missingAtts],
            leave_requests: backupData?.leave_requests || localBackup?.leave_requests || []
          };
          await api.restoreBackup(mergedPayload).catch(console.error);
          localStorage.setItem('velavan_master_database_backup', JSON.stringify({
            timestamp: new Date().toISOString(),
            ...mergedPayload
          }));
          window.dispatchEvent(new CustomEvent('velavan_data_restored'));
        } else if (serverEmps.length > 0) {
          // Server is up to date -> save latest master backup in local storage
          localStorage.setItem('velavan_master_database_backup', JSON.stringify(backupData));
        }
      } catch (err) {
        console.error('[Disaster Recovery Sync Error]:', err);
      }
    };

    runDisasterRecovery();
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
