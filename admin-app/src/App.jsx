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

        // If server is completely empty (e.g., cold restart wiped ephemeral DB), restore full backup
        if (serverEmps.length === 0 && localEmps.length > 0) {
          console.warn(`[Disaster Recovery] Empty server detected! Restoring ${localEmps.length} employees and ${localAtts.length} attendance records from browser backup...`);
          const mergedPayload = {
            employees: localEmps,
            attendance: localAtts,
            leave_requests: localBackup?.leave_requests || []
          };
          await api.restoreBackup(mergedPayload).catch(console.error);
          window.dispatchEvent(new CustomEvent('velavan_data_restored'));
        } else if (serverEmps.length > 0) {
          // Server has the authoritative staff roster (official 9 staff).
          // Check if local backup has rich employee details (bank details, salary, docs) that server might have lost on restart:
          const serverEmpKeys = new Set(serverEmps.map(e => e.emp_id));
          const localEmpMap = new Map(localEmps.map(e => [e.emp_id, e]));
          const localEmpNameMap = new Map(localEmps.filter(e => e.name).map(e => [e.name.trim().toLowerCase().replace(/[^a-z0-9]/g, ''), e]));

          let profileEnriched = false;
          const mergedServerEmps = serverEmps.map(sEmp => {
            const cleanName = (sEmp.name || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
            const lEmp = localEmpMap.get(sEmp.emp_id) || localEmpNameMap.get(cleanName);
            if (!lEmp) return sEmp;
            let updated = { ...sEmp };
            const fieldsToCheck = [
              'salary', 'bank_name', 'account_number', 'ifsc_code', 'account_holder_name',
              'branch_name', 'pan_number', 'aadhaar_number', 'address', 'phone', 'emergency_phone',
              'doc_aadhaar', 'doc_pan', 'doc_photo', 'doc_bank_passbook',
              'doc_10th', 'doc_12th', 'doc_college', 'doc_marksheet', 'avatar'
            ];
            for (const f of fieldsToCheck) {
              if ((!updated[f] || updated[f] === '') && lEmp[f] && lEmp[f] !== '') {
                updated[f] = lEmp[f];
                profileEnriched = true;
              }
            }
            return updated;
          });

          // Also check if local storage has legitimate employees that server might be missing
          const currentServerEmpKeys = new Set(mergedServerEmps.map(e => e.emp_id));
          const currentServerNames = new Set(mergedServerEmps.map(e => (e.name || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '')));
          const missingEmpsFromBackup = localEmps.filter(l => {
            if (!l || !l.name || !l.emp_id) return false;
            const cName = l.name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
            return !currentServerEmpKeys.has(l.emp_id) && !currentServerNames.has(cName);
          });

          if (missingEmpsFromBackup.length > 0) {
            console.warn(`[Disaster Recovery] Preserving ${missingEmpsFromBackup.length} employees from local storage missing on server:`, missingEmpsFromBackup.map(e => e.name));
            mergedServerEmps.push(...missingEmpsFromBackup);
            profileEnriched = true;
          }

          // Check if any attendance records punched locally are missing from server for valid staff:
          const finalEmpKeys = new Set(mergedServerEmps.map(e => e.emp_id));
          const serverAttKeys = new Set(serverAtts.map(a => `${a.emp_id}_${a.date}`));
          const missingAtts = localAtts.filter(a => finalEmpKeys.has(a.emp_id) && !serverAttKeys.has(`${a.emp_id}_${a.date}`));

          if (profileEnriched || missingAtts.length > 0) {
            console.log(`[Disaster Recovery] Syncing enriched profile details and ${missingAtts.length} attendance records to server...`);
            const payload = {
              employees: mergedServerEmps,
              attendance: [...serverAtts, ...missingAtts],
              leave_requests: backupData?.leave_requests || []
            };
            await api.restoreBackup(payload).catch(console.error);
            localStorage.setItem('velavan_master_database_backup', JSON.stringify(payload));
            window.dispatchEvent(new CustomEvent('velavan_data_restored'));
          } else {
            // Update local backup to match server
            localStorage.setItem('velavan_master_database_backup', JSON.stringify({
              ...backupData,
              employees: mergedServerEmps
            }));
          }
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
