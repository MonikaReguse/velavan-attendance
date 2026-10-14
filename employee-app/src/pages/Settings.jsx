import React, { useState } from 'react';
import { 
  Settings as SettingsIcon, 
  User, 
  Camera, 
  Volume2, 
  VolumeX, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Key, 
  Server, 
  ExternalLink,
  Save,
  ScanFace,
  Sliders,
  LogOut
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function Settings() {
  const { 
    activeEmployee, 
    logout, 
    preferences, 
    savePreferences, 
    officeSettings 
  } = useApp();

  const [savedNote, setSavedNote] = useState('');

  const handleToggleSound = () => {
    savePreferences({ soundEnabled: !preferences.soundEnabled });
    triggerSaved();
  };

  const handleToggleLandmarks = () => {
    savePreferences({ showLandmarks: !preferences.showLandmarks });
    triggerSaved();
  };

  const handleFacingModeChange = (mode) => {
    savePreferences({ facingMode: mode });
    triggerSaved();
  };

  const handleAutoModeChange = (m) => {
    savePreferences({ autoPunchMode: m });
    triggerSaved();
  };

  const triggerSaved = () => {
    setSavedNote('Preferences saved!');
    setTimeout(() => setSavedNote(''), 2500);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <SettingsIcon className="w-5 h-5 text-emerald-400" />
            <span>Terminal & Employee Settings</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage your personal profile, camera preferences, audio alerts, and system connectivity.
          </p>
        </div>

        {savedNote && (
          <span className="text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 font-semibold animate-pulse">
            {savedNote}
          </span>
        )}
      </div>

      {/* 1. Employee Profile Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
        <h3 className="font-bold text-white text-sm flex items-center space-x-2">
          <User className="w-4 h-4 text-emerald-400" />
          <span>Active Employee Profile</span>
        </h3>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
          <div className="flex items-center space-x-3.5">
            <img
              src={activeEmployee?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}
              alt={activeEmployee?.name}
              className="w-14 h-14 rounded-xl object-cover border-2 border-emerald-500 shadow-md"
            />
            <div>
              <div className="flex items-center space-x-2">
                <h4 className="font-bold text-white text-base">{activeEmployee?.name}</h4>
                <span className="text-xs font-mono px-2 py-0.5 bg-slate-800 rounded text-emerald-400">
                  {activeEmployee?.emp_id}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {activeEmployee?.department} • {activeEmployee?.role}
              </p>
              <div className="flex items-center space-x-3 mt-1 text-[11px] text-slate-500">
                <span>{activeEmployee?.email}</span>
                <span>•</span>
                <span className="font-mono">PIN: {activeEmployee?.pin || '1234'}</span>
              </div>
            </div>
          </div>

          <div>
            <button
              onClick={logout}
              className="px-3.5 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold transition-colors flex items-center space-x-2"
            >
              <LogOut className="w-4 h-4" />
              <span>Log Out & Switch User</span>
            </button>
          </div>
        </div>

        {/* Biometric Enrollment Status */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/80 text-xs">
          <div className="flex items-center space-x-2.5">
            <ScanFace className="w-4 h-4 text-emerald-400" />
            <div>
              <span className="font-semibold text-slate-200">FaceLock Biometric Signature</span>
              <p className="text-[11px] text-slate-500">Required for hands-free camera attendance punch</p>
            </div>
          </div>

          <div>
            {activeEmployee?.has_face_enrolled ? (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Enrolled & Active</span>
              </span>
            ) : (
              <a
                href="http://localhost:5173"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center space-x-1.5 hover:bg-amber-500/30 transition-colors"
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Enroll in Admin App</span>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* 2. Scanner & Camera Preferences */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h3 className="font-bold text-white text-sm flex items-center space-x-2">
          <Camera className="w-4 h-4 text-emerald-400" />
          <span>FaceLock Terminal Preferences</span>
        </h3>

        <div className="space-y-3.5 text-xs">
          {/* Sound toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/40 border border-slate-800">
            <div>
              <span className="font-semibold text-slate-200 block">Audio Feedback & Chimes</span>
              <span className="text-[11px] text-slate-500">
                Play pleasant audio chime upon successful biometric identification.
              </span>
            </div>
            <button
              onClick={handleToggleSound}
              className={`p-2 rounded-lg border transition-all ${
                preferences.soundEnabled
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : 'bg-slate-800 text-slate-500 border-slate-700'
              }`}
            >
              {preferences.soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>

          {/* Landmarks toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/40 border border-slate-800">
            <div>
              <span className="font-semibold text-slate-200 block">Visual AI Landmark Reticles</span>
              <span className="text-[11px] text-slate-500">
                Display high-tech facial landmark dots and tracking bounding box.
              </span>
            </div>
            <input
              type="checkbox"
              checked={preferences.showLandmarks}
              onChange={handleToggleLandmarks}
              className="w-4 h-4 accent-emerald-500 rounded"
            />
          </div>

          {/* Camera orientation */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/40 border border-slate-800">
            <div>
              <span className="font-semibold text-slate-200 block">Camera Lens Selector</span>
              <span className="text-[11px] text-slate-500">
                Choose default camera sensor (User / Front selfie lens or Environmental).
              </span>
            </div>
            <select
              value={preferences.facingMode}
              onChange={(e) => handleFacingModeChange(e.target.value)}
              className="bg-slate-800 text-white text-xs px-3 py-1.5 rounded-lg border border-slate-700"
            >
              <option value="user">Front / Selfie Lens</option>
              <option value="environment">Rear / Desk Lens</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. System & Connectivity Info */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h3 className="font-bold text-white text-sm flex items-center space-x-2">
          <Server className="w-4 h-4 text-emerald-400" />
          <span>System & Server Status</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-slate-400 block text-[11px]">Backend REST API</span>
              <span className="font-mono font-bold text-emerald-400">http://localhost:5000</span>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
              Online
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-slate-400 block text-[11px]">AI Neural Models</span>
              <span className="font-bold text-slate-200">Local Neural Net Weights</span>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
              Offline Ready
            </span>
          </div>
        </div>

        {/* Link to Admin App */}
        <div className="pt-2 flex items-center justify-between">
          <span className="text-xs text-slate-400">Need HR admin controls or face enrollment?</span>
          <a
            href="http://localhost:5173"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center space-x-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-semibold px-3 py-1.5 bg-slate-800 hover:bg-slate-750 rounded-lg border border-slate-700 transition-colors"
          >
            <span>Launch Admin Portal (Port 5173)</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
