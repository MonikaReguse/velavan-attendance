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
import { OFFICIAL_STAFF_FALLBACKS, enrichWithOfficialFallbacks } from './services/officialStaffProfiles';
import { getLocalAttendance, mergeAttendanceWithLocal, getDeletedPunchKeys } from './services/attendanceStorage';

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

    // Auto-purge toxic deleted IDs, legacy mock attendance, and correct stale salary cache
    try {
      localStorage.removeItem('velavan_deleted_ids');

      // Fortified Auto-Heal: Guarantee all official staff have verified documents, avatars, face lock, and correct salaries
      const docsFixKey = 'velavan_restore_staff_docs_faces_v7';
      if (!localStorage.getItem(docsFixKey)) {
        // 1. Fix in master backup
        const bStr = localStorage.getItem('velavan_master_database_backup');
        if (bStr) {
          const b = JSON.parse(bStr);
          if (Array.isArray(b?.employees)) {
            b.employees = b.employees.map(e => {
              if (e && (e.emp_id === 'VPDM04' || e.emp_id === 'VPDM05')) {
                return enrichWithOfficialFallbacks({ ...e, avatar: OFFICIAL_STAFF_FALLBACKS[e.emp_id]?.avatar, doc_photo: OFFICIAL_STAFF_FALLBACKS[e.emp_id]?.doc_photo });
              }
              return enrichWithOfficialFallbacks(e);
            });
            localStorage.setItem('velavan_master_database_backup', JSON.stringify(b));
          }
        }
        // 2. Fix in directory list
        const dStr = localStorage.getItem('velavan_employee_directory_list');
        if (dStr) {
          const d = JSON.parse(dStr);
          if (Array.isArray(d)) {
            const updatedD = d.map(e => {
              if (e && (e.emp_id === 'VPDM04' || e.emp_id === 'VPDM05')) {
                return enrichWithOfficialFallbacks({ ...e, avatar: OFFICIAL_STAFF_FALLBACKS[e.emp_id]?.avatar, doc_photo: OFFICIAL_STAFF_FALLBACKS[e.emp_id]?.doc_photo });
              }
              return enrichWithOfficialFallbacks(e);
            });
            localStorage.setItem('velavan_employee_directory_list', JSON.stringify(updatedD));
          }
        }
        // 3. Fix in details cache
        const cStr = localStorage.getItem('velavan_employee_details_cache');
        if (cStr) {
          const c = JSON.parse(cStr);
          for (const [k, fb] of Object.entries(OFFICIAL_STAFF_FALLBACKS)) {
            const cur = c[k] || {};
            if (k === 'VPDM04' || k === 'VPDM05') {
              cur.avatar = fb.avatar;
              cur.doc_photo = fb.doc_photo;
            }
            c[k] = enrichWithOfficialFallbacks({ ...fb, ...cur, emp_id: k });
          }
          localStorage.setItem('velavan_employee_details_cache', JSON.stringify(c));
        }
        localStorage.setItem(docsFixKey, 'true');
      }

      const purgedKey = 'velavan_mock_attendance_purged_v5';
      if (!localStorage.getItem(purgedKey)) {
        localStorage.removeItem('velavan_attendance_logs_cache');
        localStorage.removeItem('velavan_today_attendance');
        localStorage.removeItem('velavan_dashboard_summary');
        const bStr = localStorage.getItem('velavan_master_database_backup');
        if (bStr) {
          const b = JSON.parse(bStr);
          if (Array.isArray(b?.attendance)) {
            // Remove mock records from dates < 2026-10-16 and test punches
            b.attendance = b.attendance.filter(a => a && a.date >= '2026-10-16' && a.clock_in !== '17:36:14');
            localStorage.setItem('velavan_master_database_backup', JSON.stringify(b));
          }
        }
        localStorage.setItem(purgedKey, 'true');
      }
    } catch (e) {}

    // Triple-Layer Disaster Recovery: Smart Two-Way Merge between browser and server
    const runDisasterRecovery = async () => {
      try {
        const deletedKeys = getDeletedPunchKeys();
        const backupData = await api.getBackup().catch(() => null);
        const serverEmps = Array.isArray(backupData?.employees) ? backupData.employees : [];
        const serverAtts = (Array.isArray(backupData?.attendance) ? backupData.attendance : [])
          .filter(a => a && a.date >= '2026-10-16' && a.clock_in !== '17:36:14')
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
          .filter(a => a && a.date >= '2026-10-16' && a.clock_in !== '17:36:14')
          .filter(a => !deletedKeys.has(`${a.emp_id}_${a.date}`) && !(a.id && deletedKeys.has(String(a.id))));

        // Also check details cache and directory list cache for richest employee records
        let localCacheList = [];
        try {
          const cacheStr = localStorage.getItem('velavan_employee_details_cache');
          if (cacheStr) {
            const parsedCache = JSON.parse(cacheStr);
            localCacheList = Object.values(parsedCache || {});
          }
        } catch (e) {}

        let localDirList = [];
        try {
          const dirStr = localStorage.getItem('velavan_employee_directory_list');
          if (dirStr) {
            const parsedDir = JSON.parse(dirStr);
            if (Array.isArray(parsedDir)) localDirList = parsedDir;
          }
        } catch (e) {}

        // Build comprehensive local employee map with merged non-empty fields
        const localPool = [...localEmps, ...localDirList, ...localCacheList];
        const localEmpMap = new Map();
        const localEmpNameMap = new Map();

        for (const item of localPool) {
          if (!item || (!item.emp_id && !item.name)) continue;
          const k = item.emp_id || '';
          const nk = (item.name || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

          const existingByEmpId = k ? localEmpMap.get(k) : null;
          const existingByName = nk ? localEmpNameMap.get(nk) : null;
          const targetItem = existingByEmpId || existingByName || {};

          const merged = { ...targetItem };
          for (const [prop, val] of Object.entries(item)) {
            if (val !== undefined && val !== null && val !== '') {
              merged[prop] = val;
            }
          }

          if (k) localEmpMap.set(k, merged);
          if (nk) localEmpNameMap.set(nk, merged);
        }

        // If server is completely empty (e.g., cold restart wiped ephemeral DB), restore full backup
        if (serverEmps.length === 0 && localPool.length > 0) {
          const distinctLocalEmps = Array.from(localEmpMap.values());
          console.warn(`[Disaster Recovery] Empty server detected! Restoring ${distinctLocalEmps.length} employees and ${localAtts.length} attendance records from browser backup...`);
          const mergedPayload = {
            employees: distinctLocalEmps,
            attendance: localAtts,
            leave_requests: localBackup?.leave_requests || []
          };
          await api.restoreBackup(mergedPayload).catch(console.error);
          window.dispatchEvent(new CustomEvent('velavan_data_restored'));
        } else if (serverEmps.length > 0) {
          // Server has the authoritative staff roster (official 9 staff).
          // Check if local sources have rich employee details (bank details, salary, docs, facelock) that server might lack:
          let profileEnriched = false;
          const mergedServerEmps = serverEmps.map(sEmp => {
            const cleanName = (sEmp.name || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
            const lEmp = localEmpMap.get(sEmp.emp_id) || localEmpNameMap.get(cleanName);
            let updated = { ...sEmp };
            if (lEmp) {
              for (const [prop, propVal] of Object.entries(lEmp)) {
                if (prop === 'id') continue;
                if (propVal !== undefined && propVal !== null && propVal !== '') {
                  if (updated[prop] === undefined || updated[prop] === null || updated[prop] === '') {
                    updated[prop] = propVal;
                    profileEnriched = true;
                  }
                }
              }
              // Explicitly preserve FaceLock enrollment
              if (!updated.has_face_enrolled && (lEmp.has_face_enrolled || lEmp.face_descriptor || lEmp.face_enrolled_at)) {
                updated.has_face_enrolled = 1;
                profileEnriched = true;
              }
              // Explicitly preserve Avatar & Documents
              if (!updated.avatar && (lEmp.avatar || lEmp.doc_photo)) {
                updated.avatar = lEmp.avatar || lEmp.doc_photo;
                profileEnriched = true;
              }
              if (!updated.doc_photo && (lEmp.doc_photo || lEmp.avatar)) {
                updated.doc_photo = lEmp.doc_photo || lEmp.avatar;
                profileEnriched = true;
              }
              if (!updated.doc_aadhaar && lEmp.doc_aadhaar) {
                updated.doc_aadhaar = lEmp.doc_aadhaar;
                profileEnriched = true;
              }
              if (!updated.doc_pan && lEmp.doc_pan) {
                updated.doc_pan = lEmp.doc_pan;
                profileEnriched = true;
              }
              if (!updated.doc_bank_passbook && lEmp.doc_bank_passbook) {
                updated.doc_bank_passbook = lEmp.doc_bank_passbook;
                profileEnriched = true;
              }
            }
            // Always guarantee authoritative official staff profiles
            const fullyEnriched = enrichWithOfficialFallbacks(updated);
            if (JSON.stringify(fullyEnriched) !== JSON.stringify(updated)) {
              profileEnriched = true;
            }
            return fullyEnriched;
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
          const missingAtts = localAtts.filter(a => 
            finalEmpKeys.has(a.emp_id) && 
            !serverAttKeys.has(`${a.emp_id}_${a.date}`) &&
            !deletedKeys.has(`${a.emp_id}_${a.date}`) &&
            !(a.id && deletedKeys.has(String(a.id)))
          );

          // Always merge server and local attendance records safely
          const finalMergedAtts = mergeAttendanceWithLocal([...serverAtts, ...missingAtts]);

          if (profileEnriched || missingAtts.length > 0) {
            console.log(`[Disaster Recovery] Syncing enriched profile details and ${missingAtts.length} attendance records to server...`);
            const payload = {
              employees: mergedServerEmps,
              attendance: finalMergedAtts,
              leave_requests: backupData?.leave_requests || []
            };
            await api.restoreBackup(payload).catch(console.error);
            localStorage.setItem('velavan_master_database_backup', JSON.stringify(payload));
            localStorage.setItem('velavan_employee_directory_list', JSON.stringify(mergedServerEmps));
            window.dispatchEvent(new CustomEvent('velavan_data_restored'));
          } else {
            // Update local backup to match server while preserving all local attendance
            localStorage.setItem('velavan_master_database_backup', JSON.stringify({
              ...backupData,
              employees: mergedServerEmps,
              attendance: finalMergedAtts
            }));
            localStorage.setItem('velavan_employee_directory_list', JSON.stringify(mergedServerEmps));
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
