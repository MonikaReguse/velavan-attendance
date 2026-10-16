import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  ScanFace, 
  Key, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  RefreshCw, 
  ShieldCheck, 
  Volume2, 
  Sparkles,
  UserCheck,
  Building2,
  Calendar,
  Briefcase,
  IndianRupee,
  ChevronRight,
  TrendingUp,
  XCircle,
  Eye
} from 'lucide-react';
import { api } from '../services/api';
import { 
  loadFaceModels, 
  initializeFaceMatcher, 
  recognizeFace, 
  playChime, 
  faceapi 
} from '../services/faceRecognition';
import PunchSuccessModal from '../components/PunchSuccessModal';
import PinFallbackModal from '../components/PinFallbackModal';
import { resolvePhotoUrl, handleImageError } from '../services/imageUtils';
import { formatTime } from '../services/timeUtils';

export default function OfficeFaceLockKiosk() {
  const [modelReady, setModelReady] = useState(false);
  const [modelLoading, setModelLoading] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [enrolledCount, setEnrolledCount] = useState(0);
  const [mode, setMode] = useState('auto'); // 'auto', 'in', 'out'
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
  const [todayPunches, setTodayPunches] = useState([]);
  const [summary, setSummary] = useState({ total_employees: 0, present: 0, late: 0, absent: 0 });
  
  // Feedback states
  const [scanStatus, setScanStatus] = useState('Initializing Office FaceLock Scanner...');
  const [detectedEmployee, setDetectedEmployee] = useState(null);
  const [punchModalData, setPunchModalData] = useState(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [isProcessingPunch, setIsProcessingPunch] = useState(false);
  const [autoCloseCamera, setAutoCloseCamera] = useState(true);

  // References
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameRef = useRef(null);
  const recentPunchesCooldownRef = useRef(new Map()); // emp_id -> timestamp
  const consecutiveMatchRef = useRef({ empId: null, count: 0 });

  // Live Clock updater (12-hour AM/PM format)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Initialize models and enrolled faces
  useEffect(() => {
    setupFaceLock();
    fetchAttendanceData();

    return () => {
      stopCamera();
    };
  }, []);

  const setupFaceLock = async () => {
    try {
      setModelLoading(true);
      setScanStatus('Loading AI face detection neural network...');
      await loadFaceModels();
      setModelReady(true);

      setScanStatus('Syncing enrolled office biometric database...');
      const enrolled = await api.getFaceDescriptors();
      setEnrolledCount(enrolled.length);

      const settings = await api.getSettings().catch(() => ({}));
      const threshold = parseFloat(settings.face_match_threshold || '0.55');

      initializeFaceMatcher(enrolled, threshold);

      if (enrolled.length === 0) {
        setScanStatus('No staff faces enrolled yet. Use "Add Employee Info" or "Employee List" to enroll staff.');
      } else {
        setScanStatus(`FaceLock engine active with ${enrolled.length} enrolled staff. Camera ready for daily check-in.`);
      }

      setModelLoading(false);
      startCamera();
    } catch (err) {
      console.error('FaceLock setup error:', err);
      setScanStatus('Error initializing FaceLock: ' + err.message);
      setModelLoading(false);
    }
  };

  const fetchAttendanceData = async () => {
    try {
      const [list, sum] = await Promise.all([
        api.getTodayAttendance().catch(() => []),
        api.getTodaySummary().catch(() => ({ total_employees: 0, present: 0, late: 0, absent: 0 }))
      ]);
      setTodayPunches(list || []);
      setSummary(sum || {});
    } catch (err) {
      console.error(err);
    }
  };

  // Camera Management
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        const video = videoRef.current;
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');
        video.muted = true;

        const onReady = () => {
          video.play().catch(e => console.log('Video play catch:', e));
          setCameraActive(true);
          setScanStatus('Scanning face... Look at the camera');
          startRecognitionLoop();
        };

        video.onloadedmetadata = onReady;
        if (video.readyState >= 1) {
          onReady();
        }
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setScanStatus('Camera unavailable. You can use PIN Punch fallback below.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  // Continuous Detection and Recognition Loop
  const startRecognitionLoop = () => {
    let isFrameRunning = false;
    let lastScanTime = 0;

    const loop = async (timestamp) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!video || video.paused || video.ended) {
        animFrameRef.current = requestAnimationFrame(loop);
        return;
      }

      if (isProcessingPunch || isFrameRunning) {
        animFrameRef.current = requestAnimationFrame(loop);
        return;
      }

      // Scan every 120ms to allow smooth rendering without overloading mobile browser
      if (timestamp - lastScanTime > 120) {
        lastScanTime = timestamp;

        if (canvas && video.videoWidth > 0 && video.videoHeight > 0) {
          isFrameRunning = true;
          try {
            const displaySize = {
              width: video.videoWidth,
              height: video.videoHeight
            };
            faceapi.matchDimensions(canvas, displaySize);

            const matchResult = await recognizeFace(video);
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, displaySize.width, displaySize.height);

            if (matchResult && matchResult.detection) {
              const resizedDetection = faceapi.resizeResults(matchResult.detection, displaySize);
              const box = resizedDetection.box;

              if (matchResult.matched && matchResult.employee) {
                const matchedEmpId = matchResult.emp_id || matchResult.employee?.emp_id;

                // Track consecutive frames matching this employee to avoid any false flickers
                if (consecutiveMatchRef.current.empId === matchedEmpId) {
                  consecutiveMatchRef.current.count += 1;
                } else {
                  consecutiveMatchRef.current = { empId: matchedEmpId, count: 1 };
                }

                // Green target box for recognized staff
                ctx.strokeStyle = '#10b981';
                ctx.lineWidth = 4;
                ctx.strokeRect(box.x, box.y, box.width, box.height);

                ctx.fillStyle = '#10b981';
                ctx.fillRect(box.x, Math.max(0, box.y - 28), box.width, 28);
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 13px system-ui, sans-serif';
                ctx.fillText(`${matchResult.employee?.name || matchResult.emp_id} (${matchResult.confidence}%)`, box.x + 8, Math.max(18, box.y - 8));

                setDetectedEmployee(matchResult.employee);

                // Require at least 2 consecutive matching frames to confirm genuine employee
                if (consecutiveMatchRef.current.count >= 2) {
                  consecutiveMatchRef.current = { empId: null, count: 0 };
                  setScanStatus(`Identified: ${matchResult.employee?.name} - Recording attendance...`);
                  handleEmployeeRecognized(matchResult.employee);
                } else {
                  setScanStatus(`Verifying biometric identity: ${matchResult.employee?.name}...`);
                }
              } else {
                consecutiveMatchRef.current = { empId: null, count: 0 };
                // Yellow box for unknown/unmatched face
                ctx.strokeStyle = '#f59e0b';
                ctx.lineWidth = 2.5;
                ctx.strokeRect(box.x, box.y, box.width, box.height);

                ctx.fillStyle = '#f59e0b';
                ctx.fillRect(box.x, Math.max(0, box.y - 24), box.width, 24);
                ctx.fillStyle = '#000000';
                ctx.font = 'bold 11px system-ui, sans-serif';
                ctx.fillText('Aligning Face...', box.x + 6, Math.max(16, box.y - 7));

                setDetectedEmployee(null);
                setScanStatus('Face detected. Hold still facing camera...');
              }
            } else {
              consecutiveMatchRef.current = { empId: null, count: 0 };
              setDetectedEmployee(null);
              setScanStatus('Align your face within the frame to clock in/out...');
            }
          } catch (err) {
            console.error('Scan loop error:', err);
          } finally {
            isFrameRunning = false;
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
  };

  // Capture snapshot for punch record
  const captureSnapshot = () => {
    if (!videoRef.current) return null;
    try {
      const snapCanvas = document.createElement('canvas');
      snapCanvas.width = 320;
      snapCanvas.height = 240;
      const ctx = snapCanvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0, snapCanvas.width, snapCanvas.height);
      return snapCanvas.toDataURL('image/jpeg', 0.85);
    } catch {
      return null;
    }
  };

  // Handle Punch Submission
  const handleEmployeeRecognized = async (employee) => {
    if (isProcessingPunch) return;

    const empId = employee.emp_id;
    const now = Date.now();
    const lastPunchTime = recentPunchesCooldownRef.current.get(empId) || 0;

    // Fast 3-second cooldown to avoid duplicate consecutive punches
    if (now - lastPunchTime < 3000) {
      setScanStatus(`Attendance already verified for ${employee.name}. (Cooldown active)`);
      return;
    }

    try {
      setIsProcessingPunch(true);
      recentPunchesCooldownRef.current.set(empId, now);

      const snapshot = captureSnapshot();

      // Get accurate client date and time in local IST
      const nowObj = new Date();
      const clientDate = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(nowObj);
      const clientTime = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(nowObj);

      const result = await api.punchAttendance({
        emp_id: empId,
        mode: mode,
        photoBase64: snapshot,
        method: 'facelock',
        clientTime,
        clientDate
      });

      if (result.status === 'success' || result.status === 'already_clocked_in') {
        playChime('success');
        if (autoCloseCamera) {
          stopCamera();
        }
        if (result.attendance && snapshot) {
          result.attendance.punch_photo = snapshot;
        }
        if (result.attendance) {
          try {
            const bStr = localStorage.getItem('velavan_master_database_backup');
            if (bStr) {
              const b = JSON.parse(bStr);
              if (Array.isArray(b?.attendance)) {
                const attIdx = b.attendance.findIndex(a => a.emp_id === result.attendance.emp_id && a.date === result.attendance.date);
                if (attIdx !== -1) {
                  b.attendance[attIdx] = { ...b.attendance[attIdx], ...result.attendance };
                } else {
                  b.attendance.unshift(result.attendance);
                }
                localStorage.setItem('velavan_master_database_backup', JSON.stringify(b));
              }
            }
          } catch (e) {}
        }
        setPunchModalData(result);
        fetchAttendanceData();
        setScanStatus(`Attendance recorded for ${employee.name}! Camera closed.`);
      } else {
        playChime('error');
        setScanStatus(result.message || 'Error recording attendance');
      }
    } catch (err) {
      console.error('Punch submission error:', err);
      playChime('error');
      setScanStatus('Punch failed: ' + err.message);
    } finally {
      setTimeout(() => {
        setIsProcessingPunch(false);
      }, 1000);
    }
  };

  const handlePinPunchSuccess = (result) => {
    playChime('success');
    if (result.attendance) {
      try {
        const bStr = localStorage.getItem('velavan_master_database_backup');
        if (bStr) {
          const b = JSON.parse(bStr);
          if (Array.isArray(b?.attendance)) {
            const attIdx = b.attendance.findIndex(a => a.emp_id === result.attendance.emp_id && a.date === result.attendance.date);
            if (attIdx !== -1) {
              b.attendance[attIdx] = { ...b.attendance[attIdx], ...result.attendance };
            } else {
              b.attendance.unshift(result.attendance);
            }
            localStorage.setItem('velavan_master_database_backup', JSON.stringify(b));
          }
        }
      } catch (e) {}
    }
    setPunchModalData(result);
    fetchAttendanceData();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Timing Rules Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <img 
            src="/logo.png" 
            alt="Velavan Properties" 
            className="w-12 h-12 object-contain rounded-2xl shadow-xs border border-slate-200 bg-white p-0.5 shrink-0" 
          />
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#8b0000] animate-pulse"></span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#8b0000] bg-red-50 px-2 py-0.5 rounded border border-red-200">
                Velavan Properties Attendance App
              </span>
            </div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight mt-0.5">
              Daily Office Attendance Terminal (FaceLock)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Employees daily come to office and put attendance using FaceLock camera recognition.
            </p>
          </div>
        </div>

        {/* Shift Timings & Rules Strip */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl flex items-center space-x-2">
            <Clock className="w-4 h-4 text-[#8b0000]" />
            <div>
              <span className="text-[10px] text-slate-400 block font-semibold leading-none">Office Hours</span>
              <span className="font-bold font-mono text-slate-800">09:30 AM – 06:00 PM</span>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <div>
              <span className="text-[10px] text-amber-700 block font-semibold leading-none">Late Arrival</span>
              <span className="font-bold text-amber-900">After 09:40 AM</span>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 px-3 py-2 rounded-xl flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            <div>
              <span className="text-[10px] text-blue-700 block font-semibold leading-none">Overtime (OT)</span>
              <span className="font-bold text-blue-900" title="9:30 in -> OT after 6:20; 9:40 in -> OT after 6:30; 9:50 in -> OT after 6:40 (Calculated from 6:00 PM / shifted end)">
                After 6:20 PM (From 6:00 PM)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Scanner & Right Today's Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: LIVE FACELOCK SCANNER (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden p-4 sm:p-5 text-white flex flex-col justify-between">
            {/* Top Toolbar */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-950/60 text-amber-400 flex items-center justify-center border border-red-800/50">
                  <ScanFace className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">AI FaceLock Scanner</h3>
                  <span className="text-[11px] text-slate-400">
                    {enrolledCount} Staff Biometrics Active
                  </span>
                </div>
              </div>

              {/* Digital Clock */}
              <div className="text-right">
                <div className="text-base sm:text-lg font-mono font-black text-amber-400">
                  {currentTime}
                </div>
                <div className="text-[10px] text-slate-400">
                  {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
            </div>

            {/* Mode Switcher */}
            <div className="my-3 flex items-center justify-between bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <span className="text-[11px] text-slate-400 font-semibold px-2">Punch Mode:</span>
              <div className="flex items-center space-x-1">
                {[
                  { id: 'auto', label: 'Smart Auto' },
                  { id: 'in', label: 'Clock In' },
                  { id: 'out', label: 'Clock Out' }
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${
                      mode === m.id
                        ? 'bg-[#8b0000] text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Video Viewport */}
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-4/3 flex items-center justify-center border border-slate-800 shadow-inner my-2">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100"
              />
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none transform -scale-x-100"
              />

              {/* Face Guide Target Overlay */}
              {cameraActive && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-48 h-60 sm:w-56 sm:h-72 border-2 border-dashed border-emerald-500/40 rounded-3xl relative">
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-emerald-400"></div>
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-emerald-400"></div>
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-emerald-400"></div>
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-emerald-400"></div>
                  </div>
                </div>
              )}

              {/* Camera Off / Standby State */}
              {(!cameraActive || modelLoading) && (
                <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center space-y-4">
                  {modelLoading ? (
                    <>
                      <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
                      <p className="text-xs text-slate-300 font-semibold">{scanStatus}</p>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-lg">
                        <ScanFace className="w-8 h-8" />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-white">FaceLock Camera Standby</h4>
                        <p className="text-xs text-slate-400 mt-1 max-w-xs">
                          Click below to turn on the camera. Once your face is detected, attendance is recorded and camera closes automatically.
                        </p>
                      </div>
                      <button
                        onClick={startCamera}
                        className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-950/30 flex items-center space-x-2"
                      >
                        <Camera className="w-4 h-4" />
                        <span>Turn On FaceLock Camera</span>
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Recognized Employee Floating Badge */}
              {detectedEmployee && (
                <div className="absolute bottom-3 left-3 right-3 bg-emerald-950/90 border border-emerald-500/80 rounded-xl p-2.5 flex items-center justify-between backdrop-blur-md animate-in fade-in">
                  <div className="flex items-center space-x-2.5">
                    <img
                      src={resolvePhotoUrl(detectedEmployee.avatar, detectedEmployee.name)}
                      alt={detectedEmployee.name}
                      onError={(e) => handleImageError(e, detectedEmployee.name)}
                      className="w-9 h-9 rounded-full object-cover border border-emerald-400 bg-slate-800"
                    />
                    <div>
                      <div className="font-bold text-xs text-white">{detectedEmployee.name}</div>
                      <div className="text-[10px] text-emerald-300 font-mono">{detectedEmployee.emp_id} • {detectedEmployee.role}</div>
                    </div>
                  </div>
                  <span className="text-[10px] uppercase font-black bg-emerald-500 text-black px-2 py-0.5 rounded-full">
                    Verified
                  </span>
                </div>
              )}
            </div>

            {/* Bottom Status & Fallback Controls */}
            <div className="mt-3 pt-3 border-t border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
              <div className="text-slate-300 flex items-center space-x-2 truncate">
                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="truncate">{scanStatus}</span>
              </div>

              <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                <button
                  onClick={() => setAutoCloseCamera(!autoCloseCamera)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center space-x-1.5 ${
                    autoCloseCamera 
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                  title="Auto-close camera immediately after face is recognized"
                >
                  <span>⚡ Auto-Close on Punch: {autoCloseCamera ? 'ON' : 'OFF'}</span>
                </button>
                <button
                  onClick={() => setShowPinModal(true)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-bold flex items-center space-x-1.5 transition-colors border border-slate-700"
                  title="PIN punch fallback if camera cannot detect"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>PIN Fallback</span>
                </button>
                <button
                  onClick={cameraActive ? stopCamera : startCamera}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700"
                  title="Toggle Camera"
                >
                  <Camera className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: TODAY'S LIVE OFFICE PUNCHES FEED & STATS (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Today's KPI Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs text-center">
              <span className="text-[10px] text-slate-400 font-bold block uppercase">Total Staff</span>
              <span className="text-lg font-black text-slate-800">{summary.total_employees || 0}</span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-emerald-200/80 shadow-xs text-center">
              <span className="text-[10px] text-emerald-700 font-bold block uppercase">Present</span>
              <span className="text-lg font-black text-emerald-600">{summary.present || 0}</span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-amber-200/80 shadow-xs text-center">
              <span className="text-[10px] text-amber-700 font-bold block uppercase">Late Arrivals</span>
              <span className="text-lg font-black text-amber-600">{summary.late || 0}</span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-rose-200/80 shadow-xs text-center">
              <span className="text-[10px] text-rose-700 font-bold block uppercase">Absent</span>
              <span className="text-lg font-black text-rose-600">{summary.absent || 0}</span>
            </div>
          </div>

          {/* Today's Live Attendance Feed Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col h-[520px]">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-emerald-600" />
                <h3 className="font-bold text-slate-800 text-xs">
                  Today's Office Check-Ins ({todayPunches.length})
                </h3>
              </div>
              <button
                onClick={fetchAttendanceData}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                title="Refresh live attendance feed"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* List of Today's Punches */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
              {todayPunches.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400 space-y-2">
                  <ScanFace className="w-8 h-8 text-slate-300" />
                  <p className="text-xs font-semibold text-slate-600">No Check-Ins Yet Today</p>
                  <p className="text-[11px] text-slate-400 max-w-[220px]">
                    As employees arrive at office and scan their faces, their live punch records will show here immediately.
                  </p>
                </div>
              ) : (
                todayPunches.map((item) => {
                  const isLate = item.status === 'late' || (item.clock_in && item.clock_in > '09:40:00');
                  const hasOt = item.ot_hours > 0;

                  return (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center space-x-3">
                        <img
                          src={resolvePhotoUrl(item.punch_photo || item.avatar, item.name)}
                          alt={item.name}
                          onError={(e) => handleImageError(e, item.name)}
                          className="w-9 h-9 rounded-full object-cover border border-slate-200 bg-slate-100"
                        />
                        <div>
                          <div className="font-bold text-slate-800 leading-tight">
                            {item.name}
                          </div>
                          <div className="flex items-center space-x-1.5 mt-0.5">
                            <span className="font-mono text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded font-bold">
                              {item.emp_id}
                            </span>
                            <span className="text-[10px] text-slate-400">{item.role}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right space-y-0.5">
                        <div className="font-mono font-bold text-slate-800 text-[11px]">
                          IN: {formatTime(item.clock_in)}
                          {item.clock_out && (
                            <span className="text-blue-600 ml-1.5 font-bold">
                              OUT: {formatTime(item.clock_out)}
                            </span>
                          )}
                        </div>
                        <div>
                          {isLate ? (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              Late Arrival
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              On-Time
                            </span>
                          )}
                          {hasOt && (
                            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 ml-1">
                              +{item.ot_minutes ? item.ot_minutes : Math.round(item.ot_hours * 60)} mins OT
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Notice */}
            <div className="p-3 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 text-center">
              Attendance is strictly centralized to this office terminal.
            </div>
          </div>
        </div>
      </div>

      {/* Celebratory Punch Success Modal */}
      {punchModalData && (
        <PunchSuccessModal
          punchResult={punchModalData}
          onClose={() => {
            setPunchModalData(null);
            setIsProcessingPunch(false);
            if (autoCloseCamera) {
              stopCamera();
            }
          }}
        />
      )}

      {/* PIN Fallback Keypad Modal */}
      {showPinModal && (
        <PinFallbackModal
          onClose={() => setShowPinModal(false)}
          onPunchSuccess={handlePinPunchSuccess}
        />
      )}
    </div>
  );
}
