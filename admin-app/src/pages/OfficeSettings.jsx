import React, { useState, useEffect } from 'react';
import { Settings, Save, CheckCircle2, Shield, Clock, Sliders, Lock, User, Database, Download, Upload, AlertTriangle, RefreshCw } from 'lucide-react';
import { api } from '../services/api';

export default function OfficeSettings({ onUpdateOfficeName }) {
  const [settings, setSettings] = useState({
    office_name: 'Velavan Properties',
    office_start_time: '09:30',
    office_end_time: '18:00',
    grace_period_minutes: '15',
    ot_buffer_minutes: '20',
    half_day_threshold_hours: '4.5',
    face_match_threshold: '0.55',
    allow_pin_fallback: 'true',
    admin_username: 'admin',
    admin_password: 'admin123'
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupMessage, setBackupMessage] = useState(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await api.getSettings();
      setSettings(prev => ({ ...prev, ...data }));
    } catch (err) {
      console.error(err);
    }
  };

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.updateSettings(settings);
      setSaved(true);
      if (onUpdateOfficeName) onUpdateOfficeName(settings.office_name);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert('Error saving settings: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadBackup = async () => {
    try {
      setBackupLoading(true);
      setBackupMessage(null);
      const data = await api.getBackup();
      if (!data.success) throw new Error(data.error || 'Failed to download backup');

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      link.download = `velavan_attendance_backup_${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setBackupMessage({
        type: 'success',
        text: `Backup exported! (${data.data?.employees?.length || 0} employees, ${data.data?.attendance?.length || 0} attendance records)`
      });
    } catch (err) {
      setBackupMessage({ type: 'error', text: 'Backup failed: ' + err.message });
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRestoreBackup = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm('Warning: Restoring will overwrite matching records and insert missing employees/attendance. Do you want to proceed?')) {
      e.target.value = '';
      return;
    }

    try {
      setBackupLoading(true);
      setBackupMessage(null);
      const text = await file.text();
      const jsonData = JSON.parse(text);

      const res = await api.restoreBackup(jsonData);
      if (!res.success) throw new Error(res.error || 'Failed to restore database');

      setBackupMessage({
        type: 'success',
        text: `Database restored! (${res.restored?.employees || 0} employees, ${res.restored?.attendance || 0} attendance records)`
      });
      loadSettings();
    } catch (err) {
      setBackupMessage({ type: 'error', text: 'Restore failed: ' + err.message });
    } finally {
      setBackupLoading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
        <h2 className="text-lg font-bold text-slate-800">Office & FaceLock System Policies</h2>
        <p className="text-xs text-slate-500">
          Configure work shifts, late arrival thresholds, half-day calculations, and AI facial recognition tolerance.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Office Details */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-800 text-sm flex items-center space-x-2">
            <Settings className="w-4 h-4 text-emerald-600" />
            <span>Organization Profile</span>
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Office / Company Name</label>
            <input
              type="text"
              value={settings.office_name}
              onChange={(e) => handleChange('office_name', e.target.value)}
              className="w-full max-w-md px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
        </div>

        {/* Admin Login Credentials */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-800 text-sm flex items-center space-x-2">
            <Shield className="w-4 h-4 text-emerald-600" />
            <span>Administrator Login Credentials</span>
          </h3>
          <p className="text-xs text-slate-500">
            Configure the master username and password required to log into the Admin & HR Portal.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Admin Username</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={settings.admin_username || ''}
                  onChange={(e) => handleChange('admin_username', e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="admin"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Username used for administrator sign-in.</p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Admin Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={settings.admin_password || ''}
                  onChange={(e) => handleChange('admin_password', e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 font-mono"
                  placeholder="admin123"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Secret password for admin authentication.</p>
            </div>
          </div>
        </div>

        {/* Working Hours & Shift Timings */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-800 text-sm flex items-center space-x-2">
            <Clock className="w-4 h-4 text-emerald-600" />
            <span>Shift Timings & Grace Period Rules</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Standard Work Shift Start Time</label>
              <input
                type="time"
                value={settings.office_start_time}
                onChange={(e) => handleChange('office_start_time', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
              />
              <p className="text-[11px] text-slate-400 mt-1">Official work shift starts at 09:30 AM.</p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Standard Work Shift End Time</label>
              <input
                type="time"
                value={settings.office_end_time}
                onChange={(e) => handleChange('office_end_time', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
              />
              <p className="text-[11px] text-emerald-600 font-medium mt-1">
                Office shift ends at 18:00 (6:00 PM). Overtime buffer is 20 minutes (OT starts past 6:20 PM from 6:00 PM).
              </p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Overtime (OT) Qualification Buffer (Minutes)</label>
              <input
                type="number"
                min="0"
                max="120"
                value={settings.ot_buffer_minutes || 20}
                onChange={(e) => handleChange('ot_buffer_minutes', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
              />
              <p className="text-[11px] text-blue-600 font-medium mt-1">
                20 mins buffer: 9:30 AM arrival qualifies for OT after 6:20 PM; 9:40 AM qualifies after 6:30 PM; 9:50 AM qualifies after 6:40 PM.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Late Arrival Grace Period (Minutes)</label>
              <input
                type="number"
                min="0"
                max="120"
                value={settings.grace_period_minutes}
                onChange={(e) => handleChange('grace_period_minutes', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
              />
              <p className="text-[11px] text-amber-600 font-medium mt-1">
                15 mins grace period: Clocking in after 09:45 AM will be flagged as "Late Arrival".
              </p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Half-Day Threshold (Hours)</label>
              <input
                type="number"
                step="0.5"
                min="1"
                max="8"
                value={settings.half_day_threshold_hours}
                onChange={(e) => handleChange('half_day_threshold_hours', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Shifts under this duration are marked as Half-Day.
              </p>
            </div>
          </div>
        </div>

        {/* FaceLock Biometric AI Configuration */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-800 text-sm flex items-center space-x-2">
            <Sliders className="w-4 h-4 text-emerald-600" />
            <span>FaceLock Biometric Sensitivity</span>
          </h3>

          <div className="space-y-4 text-xs">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-slate-700">
                  Euclidean Distance Threshold (Match Strictness)
                </label>
                <span className="font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {settings.face_match_threshold}
                </span>
              </div>
              <input
                type="range"
                min="0.40"
                max="0.65"
                step="0.01"
                value={settings.face_match_threshold}
                onChange={(e) => handleChange('face_match_threshold', e.target.value)}
                className="w-full accent-emerald-600"
              />
              <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                <span>0.40 (Extremely Strict)</span>
                <span>0.55 (Recommended Office Default)</span>
                <span>0.65 (Lenient / Higher Tolerance)</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-800 block">Allow PIN Backup Check-in</span>
                <span className="text-[11px] text-slate-400">
                  Allow staff to punch in using 4-digit PIN if camera is faulty or lighting is low.
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.allow_pin_fallback === 'true'}
                onChange={(e) => handleChange('allow_pin_fallback', e.target.checked ? 'true' : 'false')}
                className="w-4 h-4 text-emerald-600 rounded"
              />
            </div>
          </div>
        </div>

        {/* Database Backup & Disaster Recovery */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-sm flex items-center space-x-2">
              <Database className="w-4 h-4 text-emerald-600" />
              <span>Cloud Database Backup & Disaster Recovery</span>
            </h3>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              Zero Data Loss
            </span>
          </div>

          <p className="text-xs text-slate-500">
            Download a full snapshot of all registered employees, face recognition data, attendance history, and office settings. You can re-upload this file anytime to restore everything in seconds.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Download Backup */}
            <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/50 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center space-x-2 text-xs font-bold text-slate-800">
                  <Download className="w-4 h-4 text-emerald-600" />
                  <span>Download Full Database Backup</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Saves employees, face profiles, attendance records, and office settings into a secure JSON backup file.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadBackup}
                disabled={backupLoading}
                className="inline-flex items-center justify-center space-x-2 w-full py-2 px-3 text-xs font-bold text-emerald-700 bg-emerald-100/80 hover:bg-emerald-200 border border-emerald-300 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                {backupLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                <span>{backupLoading ? 'Exporting...' : 'Export & Download .json'}</span>
              </button>
            </div>

            {/* Restore Backup */}
            <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/50 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center space-x-2 text-xs font-bold text-slate-800">
                  <Upload className="w-4 h-4 text-blue-600" />
                  <span>Restore Database from File</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Upload a previously downloaded <code className="font-mono bg-slate-200 px-1 py-0.5 rounded">.json</code> backup to restore all employees and records instantly.
                </p>
              </div>
              <label className="inline-flex items-center justify-center space-x-2 w-full py-2 px-3 text-xs font-bold text-blue-700 bg-blue-100/80 hover:bg-blue-200 border border-blue-300 rounded-lg transition-colors cursor-pointer">
                {backupLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                <span>Upload & Restore Backup</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleRestoreBackup}
                  disabled={backupLoading}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {backupMessage && (
            <div className={`p-3 rounded-lg text-xs font-medium flex items-center space-x-2 ${
              backupMessage.type === 'success' 
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {backupMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              )}
              <span>{backupMessage.text}</span>
            </div>
          )}
        </div>

        {/* Save button and status */}
        <div className="flex items-center justify-between pt-2">
          {saved && (
            <div className="flex items-center space-x-1.5 text-xs text-emerald-700 font-bold bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Office settings updated successfully!</span>
            </div>
          )}
          {!saved && <div />}

          <button
            type="submit"
            disabled={loading}
            className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-6 py-2.5 rounded-lg shadow-sm transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>{loading ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
