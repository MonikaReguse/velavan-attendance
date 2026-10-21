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
import { getLocalAttendance, mergeAttendanceWithLocal, getDeletedPunchKeys } from './services/attendanceStorage';

export default function App() {
  const [adminUser, setAdminUser] = useState(() => {
    try {
      const saved = localStorage.getItem('workpulse_admin_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Default landing page is ALWAYS Office FaceLock Attendance (Kiosk Mode = true)
  // Admin management hub is only unlocked if an authenticated admin session exists and is active
  const [isKioskMode, setIsKioskMode] = useState(() => {
    try {
      const savedUser = localStorage.getItem('workpulse_admin_user');
      const savedKiosk = localStorage.getItem('workpulse_is_kiosk');
      if (savedUser && savedKiosk === 'false') {
        return false;
      }
      return true; // Default for public landing page and visitors
    } catch {
      return true;
    }
  });
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);

  const [activeTab, setActiveTabState] = useState(() => {
    try {
      const savedUser = localStorage.getItem('workpulse_admin_user');
      if (!savedUser) return 'facelock-kiosk';
      return localStorage.getItem('workpulse_admin_tab') || 'facelock-kiosk';
    } catch {
      return 'facelock-kiosk';
    }
  });

  const setActiveTab = (tab) => {
    setActiveTabState(tab);
    try {
      localStorage.setItem('workpulse_admin_tab', tab);
      if (tab === 'facelock-kiosk') {
        localStorage.setItem('workpulse_is_kiosk', 'true');
        setIsKioskMode(true);
        if (window.location.pathname !== '/') {
          window.history.pushState(null, '', '/');
        }
      } else {
        localStorage.setItem('workpulse_is_kiosk', 'false');
        setIsKioskMode(false);
        if (window.location.pathname !== `/${tab}`) {
          window.history.pushState(null, '', `/${tab}`);
        }
      }
    } catch (e) {}
  };

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [officeName, setOfficeName] = useState('Velavan Properties');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Route & Security Enforcement:
  // Public visitors always land on Office FaceLock Attendance.
  // Direct access to admin subpaths without authentication triggers login prompt and stays on FaceLock.
  useEffect(() => {
    const syncRoute = () => {
      const path = window.location.pathname.replace(/^\/+/, '').split('/')[0];
      const adminTabs = [
        'dashboard', 
        'facelock-kiosk', 
        'manual-attendance', 
        'face-enrollment', 
        'add-employee', 
        'employees', 
        'attendance', 
        'reports', 
        'settings'
      ];

      if (!adminUser) {
        // Public visitor: ALWAYS enforce FaceLock Attendance
        setIsKioskMode(true);
        setActiveTabState('facelock-kiosk');
        if (path && path !== '' && path !== 'facelock-kiosk') {
          // If someone tried to visit an admin tab directly, prompt for admin login and return to root
          setIsUnlockModalOpen(true);
          window.history.replaceState(null, '', '/');
        }
        return;
      }

      // Authenticated admin:
      if (path && adminTabs.includes(path)) {
        setActiveTabState(path);
        setIsKioskMode(path === 'facelock-kiosk');
      } else if (!path || path === '') {
        // If an authenticated admin visits root '/', display FaceLock Attendance terminal
        setActiveTabState('facelock-kiosk');
        setIsKioskMode(true);
      }
    };

    syncRoute();
    window.addEventListener('popstate', syncRoute);
    return () => window.removeEventListener('popstate', syncRoute);
  }, [adminUser]);

  useEffect(() => {
    // Keep-Alive Warmup Ping: Prevents Render free tier from spinning down while app is active
    api.getHealth().catch(() => {});
    const warmPingInterval = setInterval(() => {
      api.getHealth().catch(() => {});
    }, 3 * 60 * 1000);

    api.getSettings().then(s => {
      if (s?.office_name) setOfficeName(s.office_name);
    }).catch(console.error);

    // Resilient Two-Way Real-time Sync between browser and server
    const runDisasterRecovery = async () => {
      try {
        const deletedKeys = getDeletedPunchKeys();
        const backupData = await api.getBackup().catch(() => null);
        const serverEmps = Array.isArray(backupData?.employees) ? backupData.employees : [];
        const serverAtts = (Array.isArray(backupData?.attendance) ? backupData.attendance : [])
          .filter(a => a && !(a.clock_in === '17:36:14' && a.date === '2026-10-15'))
          .filter(a => !deletedKeys.has(`${a.emp_id}_${a.date}`) && !(a.id && deletedKeys.has(String(a.id))));

        const localBackupStr = localStorage.getItem('velavan_master_database_backup');
        let localBackup = null;
        if (localBackupStr) {
          try {
            localBackup = JSON.parse(localBackupStr);
          } catch (e) {}
        }
        const localEmps = Array.isArray(localBackup?.employees) ? localBackup.employees : [];
        const localAtts = (Array.isArray(localBackup?.attendance) ? localBackup.attendance : [])
          .filter(a => a && !(a.clock_in === '17:36:14' && a.date === '2026-10-15'))
          .filter(a => !deletedKeys.has(`${a.emp_id}_${a.date}`) && !(a.id && deletedKeys.has(String(a.id))));

        // 1. If server is completely empty (e.g. cold restart on ephemeral server), restore from browser backup
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
          // 2. Intelligently merge serverEmps and localEmps so user changes and photos are NEVER lost
          const serverEmpMap = new Map(serverEmps.map(e => [e.emp_id, e]));
          const existingCache = JSON.parse(localStorage.getItem('velavan_employee_details_cache') || '{}');

          // Check if any local employees are missing from server (only if explicitly created offline)
          const localOnlyEmps = localEmps.filter(e => e.emp_id && !serverEmpMap.has(e.emp_id) && !deletedKeys.has(e.emp_id) && e.is_locally_created === true);
          if (localOnlyEmps.length > 0) {
            console.log(`[Disaster Recovery] Syncing ${localOnlyEmps.length} locally created employees to server...`);
            await api.restoreBackup({ employees: localOnlyEmps }).catch(console.error);
            for (const lo of localOnlyEmps) {
              serverEmps.push(lo);
              serverEmpMap.set(lo.emp_id, lo);
            }
          }

          // Server data is authoritative for all fields; merge safely without wiping user uploaded avatars or custom fields
          const mergedEmps = serverEmps.map(sEmp => {
            const lEmp = localEmps.find(e => e.emp_id === sEmp.emp_id) || existingCache[sEmp.emp_id] || {};
            return {
              ...lEmp,
              ...sEmp,
              name: sEmp.name || lEmp.name || '',
              role: sEmp.role || lEmp.role || '',
              department: sEmp.department || lEmp.department || 'Digital Marketing',
              phone: sEmp.phone || lEmp.phone || '',
              salary: (sEmp.salary !== undefined && sEmp.salary !== null && sEmp.salary !== '') ? sEmp.salary : (lEmp.salary || ''),
              avatar: sEmp.avatar || lEmp.avatar || existingCache[sEmp.emp_id]?.avatar,
              doc_photo: sEmp.doc_photo || lEmp.doc_photo || existingCache[sEmp.emp_id]?.doc_photo,
              has_face_enrolled: sEmp.has_face_enrolled !== undefined ? sEmp.has_face_enrolled : (sEmp.face_descriptor ? 1 : (lEmp.has_face_enrolled || 0))
            };
          });

          // Safely merge server attendance with local attendance to NEVER wipe unsynced local records
          const fullyMergedAtts = mergeAttendanceWithLocal(serverAtts);

          localStorage.setItem('velavan_master_database_backup', JSON.stringify({
            employees: mergedEmps,
            attendance: fullyMergedAtts,
            leave_requests: backupData?.leave_requests || []
          }));
          localStorage.setItem('velavan_employee_directory_list', JSON.stringify(mergedEmps));
          
          try {
            for (const emp of mergedEmps) {
              if (emp && emp.emp_id) {
                existingCache[emp.emp_id] = { ...(existingCache[emp.emp_id] || {}), ...emp };
              }
            }
            localStorage.setItem('velavan_employee_details_cache', JSON.stringify(existingCache));
          } catch (e) {}

          // Check if any offline punches taken on this machine need to be synced to server
          const serverAttKeys = new Set(serverAtts.map(a => `${a.emp_id}_${a.date}`));
          const serverEmpKeys = new Set(serverEmps.map(e => e.emp_id));
          const missingAtts = localAtts.filter(a => 
            a.is_offline_pending === true &&
            serverEmpKeys.has(a.emp_id) && 
            !serverAttKeys.has(`${a.emp_id}_${a.date}`) &&
            !deletedKeys.has(`${a.emp_id}_${a.date}`)
          );

          if (missingAtts.length > 0) {
            console.log(`[Disaster Recovery] Syncing ${missingAtts.length} offline attendance records to server...`);
            const cleanAtts = missingAtts.map(a => ({
              emp_id: a.emp_id,
              date: a.date,
              clock_in: a.clock_in,
              clock_out: a.clock_out,
              total_hours: a.total_hours,
              status: a.status,
              punch_photo: a.punch_photo,
              method: a.method,
              notes: a.notes,
              ot_hours: a.ot_hours,
              ot_minutes: a.ot_minutes
            }));
            await api.restoreBackup({ attendance: cleanAtts }).catch(console.error);
          }

          mergeAttendanceWithLocal(serverAtts);
          window.dispatchEvent(new CustomEvent('velavan_data_restored'));
        }
      } catch (err) {
        console.error('Disaster recovery sync failed:', err);
      }
    };

    runDisasterRecovery();
  }, []);

  const handleUnlockSuccess = (user) => {
    setAdminUser(user);
    try {
      localStorage.setItem('workpulse_admin_user', JSON.stringify(user));
      localStorage.setItem('workpulse_is_kiosk', 'false');
      localStorage.setItem('workpulse_admin_tab', 'dashboard');
    } catch (e) {}
    setIsKioskMode(false);
    setActiveTabState('dashboard');
    setIsUnlockModalOpen(false);
    if (window.location.pathname !== '/dashboard') {
      window.history.pushState(null, '', '/dashboard');
    }
  };

  const handleLockKiosk = () => {
    setIsKioskMode(true);
    try {
      localStorage.setItem('workpulse_is_kiosk', 'true');
      localStorage.setItem('workpulse_admin_tab', 'facelock-kiosk');
    } catch (e) {}
    setActiveTabState('facelock-kiosk');
    setIsMobileMenuOpen(false);
    if (window.location.pathname !== '/') {
      window.history.pushState(null, '', '/');
    }
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem('workpulse_admin_user');
      localStorage.setItem('workpulse_is_kiosk', 'true');
      localStorage.setItem('workpulse_admin_tab', 'facelock-kiosk');
    } catch (e) {}
    setAdminUser(null);
    setIsKioskMode(true);
    setActiveTabState('facelock-kiosk');
    setIsMobileMenuOpen(false);
    if (window.location.pathname !== '/') {
      window.history.replaceState(null, '', '/');
    }
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
      {adminUser && !isKioskMode && (
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
            {/* IN KIOSK / PUBLIC VISITOR MODE: ONLY Office FaceLock Attendance is rendered! */}
            {!adminUser || isKioskMode ? (
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
