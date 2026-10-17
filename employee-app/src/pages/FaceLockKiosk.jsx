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
  ChevronRight
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
import { getLocalAttendance, mergeAttendanceWithLocal, savePunchLocally } from '../services/attendanceStorage';

export default function FaceLockKiosk() {
  const [modelReady, setModelReady] = useState(false);
  const [modelLoading, setModelLoading] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [enrolledCount, setEnrolledCount] = useState(0);
  const [mode, setMode] = useState('auto'); // 'auto', 'in', 'out'
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
  const [todayPunches, setTodayPunches] = useState(() => {
    try {
      const todayStr = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      return getLocalAttendance().filter(a => a.date === todayStr).slice(0, 8);
    } catch {
      return [];
    }
  });
  
  // Feedback states
  const [scanStatus, setScanStatus] = useState('Initializing FaceLock Scanner...');
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

  // Live Clock updater
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Initialize models and enrolled faces
  useEffect(() => {
    setupFaceLock();
    fetchRecentPunches();

    const handleRealtimeUpdate = () => {
      fetchRecentPunches();
    };
    window.addEventListener('velavan_attendance_updated', handleRealtimeUpdate);
    window.addEventListener('velavan_employees_updated', handleRealtimeUpdate);

    // Auto-polling every 10s for real-time multi-device sync
    const pollTimer = setInterval(() => {
      fetchRecentPunches();
    }, 10000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchRecentPunches();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stopCamera();
      clearInterval(pollTimer);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('velavan_attendance_updated', handleRealtimeUpdate);
      window.removeEventListener('velavan_employees_updated', handleRealtimeUpdate);
    };
  }, []);

  const setupFaceLock = async () => {
    try {
      setModelLoading(true);
      setScanStatus('Loading AI face detection models...');
      await loadFaceModels();
      setModelReady(true);

      setScanStatus('Syncing enrolled office biometric database...');
      const enrolled = await api.getFaceDescriptors();
      setEnrolledCount(enrolled.length);

      const settings = await api.getSettings().catch(() => ({}));
      const threshold = parseFloat(settings.face_match_threshold || '0.55');

      initializeFaceMatcher(enrolled, threshold);

      if (enrolled.length === 0) {
        setScanStatus('No employee faces enrolled yet. Use Admin App to enroll staff.');
      } else {
        setScanStatus(`FaceLock engine ready (${enrolled.length} enrolled staff). Turn on camera to scan.`);
      }

      setModelLoading(false);
      // Auto-start camera
      startCamera();
    } catch (err) {
      console.error('FaceLock setup error:', err);
      setScanStatus('Error initializing FaceLock: ' + err.message);
      setModelLoading(false);
    }
  };

  const fetchRecentPunches = async () => {
    try {
      const list = await api.getTodayAttendance().catch(() => []);
      const merged = mergeAttendanceWithLocal(Array.isArray(list) ? list : []);
      const todayStr = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      setTodayPunches(merged.filter(a => a.date === todayStr).slice(0, 8));
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
          video.play().catch(e => console.log('play catch', e));
          setCameraActive(true);
          setScanStatus('Camera active. Looking for faces...');
          startContinuousScan();
        };

        video.onloadedmetadata = onReady;
        if (video.readyState >= 1) {
          onReady();
        }
      }
    } catch (err) {
      console.error('Camera access failed:', err);
      setScanStatus('Camera permission denied or camera unavailable. You can use PIN Punch instead.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  // Continuous Face Scan Loop
  const startContinuousScan = () => {
    let lastScanTime = 0;
    let isFrameRunning = false;

    const loop = async (timestamp) => {
      if (!videoRef.current || !canvasRef.current || videoRef.current.paused || videoRef.current.ended) {
        animFrameRef.current = requestAnimationFrame(loop);
        return;
      }

      // Throttle scanning to fast 100ms cycles with frame concurrency guard
      if (timestamp - lastScanTime > 100 && !isProcessingPunch && !isFrameRunning) {
        lastScanTime = timestamp;
        isFrameRunning = true;
        try {
          await performScanCycle();
        } finally {
          isFrameRunning = false;
        }
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
  };

  const performScanCycle = async () => {
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      const displaySize = { width: video.videoWidth || 640, height: video.videoHeight || 480 };
      faceapi.matchDimensions(canvas, displaySize);

      const matchResult = await recognizeFace(video);
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (matchResult && matchResult.detection) {
        const resized = faceapi.resizeResults(matchResult, displaySize);

        if (matchResult.matched && matchResult.employee) {
          const emp = matchResult.employee;
          const matchedEmpId = emp.emp_id;

          // Track consecutive matching frames to prevent false matches
          if (consecutiveMatchRef.current.empId === matchedEmpId) {
            consecutiveMatchRef.current.count += 1;
          } else {
            consecutiveMatchRef.current = { empId: matchedEmpId, count: 1 };
          }

          setDetectedEmployee(emp);
          setScanStatus(`Identified: ${emp.name} (${matchResult.confidence}% confidence)`);

          // Draw custom green cyber box & name tag
          const box = resized.detection.box;
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 3;
          ctx.strokeRect(box.x, box.y, box.width, box.height);

          // Name banner on video
          ctx.fillStyle = '#10b981';
          ctx.fillRect(box.x, box.y - 28, box.width, 28);
          ctx.fillStyle = '#000000';
          ctx.font = 'bold 13px sans-serif';
          ctx.fillText(` ${emp.name} (${matchResult.confidence}%)`, box.x + 4, box.y - 9);

          // Check cooldown (3 seconds) and require 2 consecutive frames
          const now = Date.now();
          const lastPunch = recentPunchesCooldownRef.current.get(emp.emp_id) || 0;
          if (now - lastPunch > 3000 && consecutiveMatchRef.current.count >= 2) {
            consecutiveMatchRef.current = { empId: null, count: 0 };
            // Trigger automatic punch!
            handleFaceLockPunch(emp);
          }
        } else if (matchResult.reason === 'unknown_face') {
          consecutiveMatchRef.current = { empId: null, count: 0 };
          setDetectedEmployee(null);
          setScanStatus('Face detected, but not recognized in employee directory.');
          // Draw amber box
          const box = resized.detection.box;
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 2;
          ctx.strokeRect(box.x, box.y, box.width, box.height);
        }
      } else {
        consecutiveMatchRef.current = { empId: null, count: 0 };
        setDetectedEmployee(null);
        setScanStatus('Align your face within the scanner frame to clock in/out.');
      }
    } catch (err) {
      console.error('Scan cycle exception:', err);
    }
  };

  // Perform FaceLock Attendance Punch
  const handleFaceLockPunch = async (employee) => {
    if (isProcessingPunch) return;
    setIsProcessingPunch(true);
    recentPunchesCooldownRef.current.set(employee.emp_id, Date.now());

    try {
      // Capture punch snapshot
      let photoBase64 = null;
      if (videoRef.current) {
        const snapCanvas = document.createElement('canvas');
        snapCanvas.width = videoRef.current.videoWidth || 640;
        snapCanvas.height = videoRef.current.videoHeight || 480;
        const ctx = snapCanvas.getContext('2d');
        ctx.drawImage(videoRef.current, 0, 0, snapCanvas.width, snapCanvas.height);
        photoBase64 = snapCanvas.toDataURL('image/jpeg', 0.8);
      }

      const nowObj = new Date();
      const clientDate = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(nowObj);
      const clientTime = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(nowObj);

      const res = await api.punch({
        emp_id: employee.emp_id,
        mode: mode,
        photoBase64: photoBase64,
        method: 'facelock',
        clientTime,
        clientDate
      });

      if (res.status === 'success' || res.status === 'already_clocked_in') {
        playChime('success');
        if (autoCloseCamera) {
          stopCamera();
        }
        if (res.attendance && photoBase64) {
          res.attendance.punch_photo = photoBase64;
        }
        if (!res.employee && employee) {
          res.employee = employee;
        }
        if (res.attendance) {
          savePunchLocally(res.attendance);
        }
        setPunchModalData(res);
        fetchRecentPunches();
        setScanStatus(`Attendance recorded for ${employee.name}! Camera closed.`);
      } else {
        playChime('error');
        alert(res.message || res.error || 'Attendance punch failed');
      }
    } catch (err) {
      console.error('Punch execution error:', err);
    } finally {
      // Fast re-enable scanning after 1 second
      setTimeout(() => {
        setIsProcessingPunch(false);
      }, 1000);
    }
  };

  const handleManualPunchSuccess = (data) => {
    playChime('success');
    if (data?.attendance) {
      savePunchLocally(data.attendance);
    }
    setPunchModalData(data);
    fetchRecentPunches();
  };

  return (
    <div className="space-y-6">
      {/* Kiosk Hero Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-xl">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-black font-black shadow-lg shadow-emerald-500/20">
            <ScanFace className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-black text-white tracking-tight">WorkPulse FaceLock Kiosk</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                LIVE TERMINAL
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Stand in front of the lens. Attendance is verified and recorded instantly via biometric face-matching.
            </p>
          </div>
        </div>

        {/* Live Digital Clock & Status */}
        <div className="flex items-center space-x-4">
          <div className="bg-slate-950 px-4 py-2 rounded-xl border border-slate-800 text-right">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Terminal Clock</div>
            <div className="text-xl font-mono font-black text-emerald-400">{currentTime}</div>
          </div>

          <button
            onClick={() => setShowPinModal(true)}
            className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors flex items-center space-x-1.5"
          >
            <Key className="w-4 h-4 text-emerald-400" />
            <span>Enter PIN</span>
          </button>
        </div>
      </div>

      {/* Main Terminal Viewport */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left / Center: Camera Video HUD */}
        <div className="lg:col-span-8 space-y-4">
          <div className="relative bg-slate-950 rounded-2xl overflow-hidden aspect-[4/3] border-2 border-slate-800 shadow-2xl flex items-center justify-center group">
            {/* Live Camera Stream */}
            <video
              ref={videoRef}
              className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
              playsInline
              muted
            />

            {/* Face Tracking Canvas Overlay */}
            <canvas
              ref={canvasRef}
              className={`absolute inset-0 w-full h-full pointer-events-none ${cameraActive ? 'block' : 'hidden'}`}
            />

            {/* High-Tech Futuristic Target HUD */}
            {cameraActive && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                {/* Outer guide ring */}
                <div className={`w-64 h-80 rounded-3xl border-2 transition-all ${
                  detectedEmployee 
                    ? 'border-emerald-400 bg-emerald-500/5 shadow-2xl shadow-emerald-500/20' 
                    : 'border-white/30 border-dashed animate-pulse-ring'
                }`}></div>

                {/* Laser scan line animation */}
                <div className="absolute inset-x-8 top-12 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-lg shadow-emerald-400/80 animate-scanline"></div>

                {/* Corner bracket reticles */}
                <div className="absolute top-8 left-8 w-6 h-6 border-t-2 border-l-2 border-emerald-400"></div>
                <div className="absolute top-8 right-8 w-6 h-6 border-t-2 border-r-2 border-emerald-400"></div>
                <div className="absolute bottom-8 left-8 w-6 h-6 border-b-2 border-l-2 border-emerald-400"></div>
                <div className="absolute bottom-8 right-8 w-6 h-6 border-b-2 border-r-2 border-emerald-400"></div>
              </div>
            )}

            {/* Offline / Standby view */}
            {!cameraActive && (
              <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg">
                  <ScanFace className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-white font-bold text-base">FaceLock Camera Standby</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    Click below to turn on the camera. Once your face is detected, attendance is recorded and camera closes automatically.
                  </p>
                </div>
                <div className="flex items-center space-x-3 pt-1">
                  <button
                    onClick={startCamera}
                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center space-x-2"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Turn On FaceLock Camera</span>
                  </button>
                  <button
                    onClick={() => setShowPinModal(true)}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl border border-slate-700 transition-colors"
                  >
                    Use PIN Fallback
                  </button>
                </div>
              </div>
            )}

            {/* Top Bar on Video: Mode Pill */}
            <div className="absolute top-4 left-4 z-20 flex items-center space-x-2">
              <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-[11px] font-bold text-slate-200 flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>Mode: {mode === 'auto' ? 'Smart Auto (In/Out)' : mode === 'in' ? 'Clock In Only' : 'Clock Out Only'}</span>
              </div>
            </div>

            {/* Processing banner */}
            {isProcessingPunch && (
              <div className="absolute inset-x-4 bottom-4 z-20 bg-emerald-600/90 backdrop-blur-md text-white p-3 rounded-xl flex items-center justify-center space-x-2 font-bold text-sm shadow-xl">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Recording Attendance Punch...</span>
              </div>
            )}
          </div>

          {/* Real-time Status Bar */}
          <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2.5 truncate">
              <div className={`w-3 h-3 rounded-full shrink-0 ${
                detectedEmployee ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
              }`}></div>
              <span className="text-slate-300 font-medium truncate">{scanStatus}</span>
            </div>

            <div className="flex items-center space-x-2 shrink-0 pl-3">
              <button
                onClick={() => setAutoCloseCamera(!autoCloseCamera)}
                className={`px-2 py-1 rounded text-[11px] font-bold border transition-colors ${
                  autoCloseCamera
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
                title="Auto-close camera immediately after face is recognized"
              >
                ⚡ Auto-Close: {autoCloseCamera ? 'ON' : 'OFF'}
              </button>
              <span className="text-[11px] text-slate-500 font-mono">
                {enrolledCount} enrolled
              </span>
              {cameraActive ? (
                <button
                  onClick={stopCamera}
                  className="text-[11px] text-slate-400 hover:text-white px-2 py-1 bg-slate-800 rounded border border-slate-700"
                >
                  Turn Off Camera
                </button>
              ) : (
                <button
                  onClick={startCamera}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 px-2 py-1 bg-emerald-950/60 rounded border border-emerald-800"
                >
                  Turn On Camera
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Mode Controls & Today's Attendance Stream */}
        <div className="lg:col-span-4 space-y-4">
          {/* Mode Selector Panel */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3">
            <h3 className="font-bold text-white text-xs uppercase tracking-wider text-slate-400">
              Punch Direction
            </h3>

            <div className="grid grid-cols-3 gap-2 text-xs font-semibold">
              <button
                onClick={() => setMode('auto')}
                className={`py-2 rounded-lg transition-all border ${
                  mode === 'auto'
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                }`}
              >
                Smart Auto
              </button>
              <button
                onClick={() => setMode('in')}
                className={`py-2 rounded-lg transition-all border ${
                  mode === 'in'
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                }`}
              >
                Clock In
              </button>
              <button
                onClick={() => setMode('out')}
                className={`py-2 rounded-lg transition-all border ${
                  mode === 'out'
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                }`}
              >
                Clock Out
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              * Smart Auto automatically clocks in first arrivals and clocks out exiting staff.
            </p>
          </div>

          {/* Today's Recent Punches Live Ticker */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col h-[400px]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-white text-xs">Today's Recorded Punches</h3>
              </div>
              <button
                onClick={fetchRecentPunches}
                className="text-[11px] text-slate-400 hover:text-white"
              >
                Refresh
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {todayPunches.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  No attendance punches recorded yet today.
                </div>
              ) : (
                todayPunches.map((p) => {
                  const isLate = p.status === 'late';
                  return (
                    <div
                      key={p.id}
                      className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center space-x-2.5">
                        <img
                          src={resolvePhotoUrl(p.avatar || p.punch_photo, p.employee_name)}
                          alt={p.employee_name}
                          onError={(e) => handleImageError(e, p.employee_name)}
                          className="w-8 h-8 rounded-full object-cover border border-slate-700 bg-slate-800"
                        />
                        <div>
                          <div className="font-bold text-white leading-tight">{p.employee_name}</div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {p.clock_in} {p.clock_out && `→ ${p.clock_out}`}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isLate
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-emerald-500/20 text-emerald-300'
                        }`}>
                          {isLate ? 'Late' : 'On-Time'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Success Modal */}
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

      {/* Manual PIN Modal */}
      {showPinModal && (
        <PinFallbackModal
          onClose={() => setShowPinModal(false)}
          onPunchSuccess={handleManualPunchSuccess}
        />
      )}
    </div>
  );
}
