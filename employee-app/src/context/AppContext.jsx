import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';
import { OFFICIAL_STAFF_FALLBACKS } from '../services/officialStaffProfiles';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [employees, setEmployees] = useState(() => {
    try {
      const saved = localStorage.getItem('workpulse_employee_list');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      return Object.values(OFFICIAL_STAFF_FALLBACKS);
    }
    return Object.values(OFFICIAL_STAFF_FALLBACKS);
  });
  const [activeEmployee, setActiveEmployee] = useState(() => {
    const saved = localStorage.getItem('workpulse_authenticated_employee');
    return saved ? JSON.parse(saved) : null;
  });
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!localStorage.getItem('workpulse_authenticated_employee');
  });

  const [todayAttendance, setTodayAttendance] = useState([]);
  const [todayRecord, setTodayRecord] = useState(null);
  const [officeSettings, setOfficeSettings] = useState(null);
  const [loading, setLoading] = useState(false);

  // User preferences stored in localStorage
  const [preferences, setPreferences] = useState(() => {
    const saved = localStorage.getItem('workpulse_preferences');
    return saved ? JSON.parse(saved) : {
      soundEnabled: true,
      showLandmarks: true,
      facingMode: 'user', // 'user' or 'environment'
      autoPunchMode: 'auto', // 'auto', 'in', 'out'
    };
  });

  const savePreferences = (newPrefs) => {
    setPreferences(prev => {
      const updated = { ...prev, ...newPrefs };
      localStorage.setItem('workpulse_preferences', JSON.stringify(updated));
      return updated;
    });
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [empList, todayList, settingsData] = await Promise.all([
        api.getEmployees().catch(() => null),
        api.getTodayAttendance().catch(() => null),
        api.getSettings().catch(() => ({}))
      ]);

      let effectiveEmployees = (Array.isArray(empList) && empList.length > 0) ? empList : [];
      if (effectiveEmployees.length === 0) {
        try {
          const saved = localStorage.getItem('workpulse_employee_list');
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) effectiveEmployees = parsed;
          }
        } catch (e) {}
      }
      if (effectiveEmployees.length === 0) {
        effectiveEmployees = Object.values(OFFICIAL_STAFF_FALLBACKS);
      }
      setEmployees(effectiveEmployees);
      try {
        localStorage.setItem('workpulse_employee_list', JSON.stringify(effectiveEmployees));
      } catch (e) {}
      if (Array.isArray(todayList)) {
        setTodayAttendance(todayList);
      }
      if (settingsData && Object.keys(settingsData).length > 0) {
        setOfficeSettings(settingsData);
      }

      // Verify active employee against freshly fetched list
      const saved = localStorage.getItem('workpulse_authenticated_employee');
      if (saved) {
        const parsed = JSON.parse(saved);
        const refreshed = (empList || []).find(e => e.emp_id === parsed.emp_id);
        if (refreshed) {
          setActiveEmployee(refreshed);
          setIsAuthenticated(true);
          try {
            localStorage.setItem('workpulse_authenticated_employee', JSON.stringify(refreshed));
          } catch (e) {}

          const myToday = (todayList || []).find(t => t.emp_id === refreshed.emp_id);
          setTodayRecord(myToday || null);
        } else if (Array.isArray(empList) && empList.length > 0) {
          // Employee was permanently deleted from server directory
          console.warn('Active employee deleted from office roster, terminating session.');
          logout();
        } else {
          setActiveEmployee(parsed);
          setIsAuthenticated(true);
        }
      } else {
        setIsAuthenticated(false);
        setActiveEmployee(null);
      }
    } catch (err) {
      console.error('Failed to load app data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // 1. Auto-polling every 10 seconds for real-time mobile sync
    const pollInterval = setInterval(() => {
      loadData();
    }, 10000);

    // 2. Refresh when app tab or mobile screen unlocks
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 3. Listen to local and cross-tab update events
    const handleCustomEvents = () => {
      loadData();
    };
    window.addEventListener('velavan_attendance_updated', handleCustomEvents);
    window.addEventListener('velavan_employees_updated', handleCustomEvents);

    return () => {
      clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('velavan_attendance_updated', handleCustomEvents);
      window.removeEventListener('velavan_employees_updated', handleCustomEvents);
    };
  }, []);

  const login = (employee) => {
    setActiveEmployee(employee);
    setIsAuthenticated(true);
    localStorage.setItem('workpulse_authenticated_employee', JSON.stringify(employee));
    
    // Find today's record
    const myToday = todayAttendance.find(t => t.emp_id === employee.emp_id);
    setTodayRecord(myToday || null);
  };

  const logout = () => {
    setActiveEmployee(null);
    setIsAuthenticated(false);
    localStorage.removeItem('workpulse_authenticated_employee');
    setTodayRecord(null);
  };

  return (
    <AppContext.Provider value={{
      employees,
      activeEmployee,
      isAuthenticated,
      login,
      logout,
      todayAttendance,
      todayRecord,
      officeSettings,
      preferences,
      savePreferences,
      refreshData: loadData,
      loading
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
