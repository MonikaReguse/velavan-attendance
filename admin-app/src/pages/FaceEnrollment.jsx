import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  Upload, 
  ScanFace, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Trash2, 
  UserCheck, 
  Info,
  Sparkles
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { api } from '../services/api';
import { loadFaceModels, getFaceDescriptor, faceapi } from '../services/faceService';

export default function FaceEnrollment() {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [modelLoading, setModelLoading] = useState(true);
  const [modelError, setModelError] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [detectedFace, setDetectedFace] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [enrolling, setEnrolling] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameRef = useRef(null);

  // Load employees & face models
  useEffect(() => {
    loadEmployees();
    initModels();

    return () => {
      stopCamera();
    };
  }, []);

  const loadEmployees = async () => {
    try {
      const data = await api.getEmployees();
      setEmployees(data);
      if (!selectedEmployee && data.length > 0) {
        setSelectedEmployee(data[0]);
      } else if (selectedEmployee) {
        // update current selection
        const updated = data.find(e => e.id === selectedEmployee.id);
        if (updated) setSelectedEmployee(updated);
      }
    } catch (err) {
      console.error('Failed to load employees:', err);
    }
  };

  const initModels = async () => {
    try {
      setModelLoading(true);
      await loadFaceModels();
      setModelLoading(false);
    } catch (err) {
      console.error('Failed to load models:', err);
      setModelError('Failed to load face detection neural network models.');
      setModelLoading(false);
    }
  };

  // Start webcam
  const startCamera = async () => {
    try {
      setStatusMessage('Requesting camera permission...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
          setCameraActive(true);
          setStatusMessage('Camera active. Align face inside the circle.');
          startFaceTracking();
        };
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setStatusMessage('Unable to access camera: ' + err.message);
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
    setDetectedFace(null);
  };

  // Continuous face detection loop
  const startFaceTracking = () => {
    const track = async () => {
      if (!videoRef.current || !canvasRef.current || videoRef.current.paused || videoRef.current.ended) {
        animFrameRef.current = requestAnimationFrame(track);
        return;
      }

      try {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const displaySize = { width: video.videoWidth || 640, height: video.videoHeight || 480 };
        faceapi.matchDimensions(canvas, displaySize);

        const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
        const detection = await faceapi
          .detectSingleFace(video, options)
          .withFaceLandmarks()
          .withFaceDescriptor();

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (detection) {
          const resized = faceapi.resizeResults(detection, displaySize);
          
          // Draw high-tech bounding box & landmarks
          faceapi.draw.drawDetections(canvas, resized);
          faceapi.draw.drawFaceLandmarks(canvas, resized);

          setDetectedFace({
            score: Math.round(detection.detection.score * 100),
            descriptor: Array.from(detection.descriptor),
            box: detection.detection.box
          });
          setStatusMessage(`Face detected (${Math.round(detection.detection.score * 100)}% confidence). Ready to enroll!`);
        } else {
          setDetectedFace(null);
          setStatusMessage('Align your face within the frame with adequate lighting.');
        }
      } catch (err) {
        console.error('Tracking error:', err);
      }

      animFrameRef.current = requestAnimationFrame(track);
    };

    animFrameRef.current = requestAnimationFrame(track);
  };

  // Capture and enroll face
  const handleEnrollFace = async () => {
    if (!selectedEmployee) {
      alert('Please select an employee first.');
      return;
    }

    if (!detectedFace || !detectedFace.descriptor) {
      alert('No face detected! Please ensure your face is clearly visible in the camera frame.');
      return;
    }

    try {
      setEnrolling(true);
      setStatusMessage('Extracting biometric signature and enrolling...');

      // Capture current video frame as base64 snapshot
      let snapshotBase64 = null;
      if (videoRef.current) {
        const snapCanvas = document.createElement('canvas');
        snapCanvas.width = videoRef.current.videoWidth || 640;
        snapCanvas.height = videoRef.current.videoHeight || 480;
        const ctx = snapCanvas.getContext('2d');
        ctx.drawImage(videoRef.current, 0, 0, snapCanvas.width, snapCanvas.height);
        snapshotBase64 = snapCanvas.toDataURL('image/jpeg', 0.85);
      }

      const res = await api.saveFaceDescriptor(
        selectedEmployee.id,
        detectedFace.descriptor,
        snapshotBase64
      );

      if (res.success) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
        setStatusMessage(`Successfully enrolled FaceLock for ${selectedEmployee.name}!`);
        await loadEmployees();
      } else {
        alert('Failed: ' + (res.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Enrollment error:', err);
      alert('Enrollment failed: ' + err.message);
    } finally {
      setEnrolling(false);
    }
  };

  // Remove face enrollment
  const handleRemoveEnrollment = async () => {
    if (!selectedEmployee || !selectedEmployee.has_face_enrolled) return;
    if (!confirm(`Are you sure you want to remove FaceLock biometric data for ${selectedEmployee.name}?`)) {
      return;
    }

    try {
      await api.deleteFaceDescriptor(selectedEmployee.id);
      setStatusMessage(`Face data removed for ${selectedEmployee.name}`);
      await loadEmployees();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // Handle Photo File Upload as alternate enrollment mode
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedEmployee) return;

    try {
      setEnrolling(true);
      setStatusMessage('Analyzing photo for face landmarks...');

      const img = new Image();
      img.src = URL.createObjectURL(file);
      await new Promise(res => { img.onload = res; });

      const result = await getFaceDescriptor(img);
      if (!result) {
        alert('Could not detect a clear human face in this photo. Please try a front-facing portrait.');
        setEnrolling(false);
        return;
      }

      // Convert image to base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result;
        const res = await api.saveFaceDescriptor(selectedEmployee.id, result.descriptor, base64);
        if (res.success) {
          confetti({ particleCount: 80, spread: 60 });
          setStatusMessage(`Enrolled ${selectedEmployee.name} via photo upload!`);
          await loadEmployees();
        }
        setEnrolling(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('File upload enrollment error:', err);
      alert('Photo enrollment error: ' + err.message);
      setEnrolling(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
              <ScanFace className="w-5 h-5" />
            </span>
            <h2 className="text-lg font-bold text-slate-800">Face Enrollment Studio</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Capture and register biometric facial feature embeddings for instant recognition at the Employee FaceLock Kiosk.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {modelLoading ? (
            <span className="text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 flex items-center space-x-1.5">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Loading AI Neural Models...</span>
            </span>
          ) : modelError ? (
            <span className="text-xs text-rose-600 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200 flex items-center space-x-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Model Error</span>
            </span>
          ) : (
            <span className="text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 font-medium flex items-center space-x-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>AI Face Engines Ready (TinyFace + Landmarks68)</span>
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Employee Selection List */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200/80 shadow-xs flex flex-col h-[600px]">
          <div className="p-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-800 text-sm">Select Employee to Enroll</h3>
            <p className="text-[11px] text-slate-400">Choose a staff member from the directory</p>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
            {employees.map((emp) => {
              const isSelected = selectedEmployee?.id === emp.id;
              const hasFace = !!emp.has_face_enrolled;

              return (
                <button
                  key={emp.id}
                  onClick={() => setSelectedEmployee(emp)}
                  className={`w-full text-left p-3 rounded-lg transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-emerald-50 border border-emerald-200 shadow-xs'
                      : 'hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <img
                      src={emp.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}
                      alt={emp.name}
                      className="w-10 h-10 rounded-full object-cover border border-slate-200"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-800">{emp.name}</div>
                      <div className="text-[11px] text-slate-500">{emp.role}</div>
                      <span className="text-[10px] text-slate-400 font-mono">{emp.emp_id} • {emp.department}</span>
                    </div>
                  </div>

                  <div>
                    {hasFace ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center space-x-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Enrolled</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center space-x-1">
                        <AlertCircle className="w-3 h-3 text-amber-600" />
                        <span>Pending</span>
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Camera & Enrollment Studio */}
        <div className="lg:col-span-8 space-y-6">
          {selectedEmployee ? (
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-6 space-y-5">
              {/* Selected Profile Banner */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center space-x-3.5">
                  <img
                    src={selectedEmployee.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}
                    alt={selectedEmployee.name}
                    className="w-12 h-12 rounded-full object-cover border-2 border-emerald-500 shadow-xs"
                  />
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="font-bold text-slate-900 text-base">{selectedEmployee.name}</h3>
                      <span className="text-xs font-mono px-2 py-0.5 bg-slate-100 rounded text-slate-600">
                        {selectedEmployee.emp_id}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {selectedEmployee.department} • {selectedEmployee.role}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {selectedEmployee.has_face_enrolled && (
                    <button
                      onClick={handleRemoveEnrollment}
                      className="px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg font-medium transition-colors flex items-center space-x-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Reset Biometrics</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Camera Video Viewport */}
              <div className="relative bg-slate-950 rounded-xl overflow-hidden aspect-[4/3] max-h-[380px] flex items-center justify-center border border-slate-800 shadow-inner">
                {/* Live Video */}
                <video
                  ref={videoRef}
                  className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
                  playsInline
                  muted
                />

                {/* Face Overlay Canvas */}
                <canvas
                  ref={canvasRef}
                  className={`absolute inset-0 w-full h-full pointer-events-none ${cameraActive ? 'block' : 'hidden'}`}
                />

                {/* Target Guide Ring when camera is on */}
                {cameraActive && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className={`w-52 h-64 rounded-full border-2 border-dashed transition-colors ${
                      detectedFace ? 'border-emerald-400 bg-emerald-500/10' : 'border-white/40'
                    }`}></div>
                  </div>
                )}

                {/* Placeholder when camera is inactive */}
                {!cameraActive && (
                  <div className="flex flex-col items-center justify-center text-center p-6 text-slate-400">
                    <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center mb-3 text-slate-500 border border-slate-800">
                      <Camera className="w-8 h-8" />
                    </div>
                    <h4 className="font-semibold text-slate-200 text-sm mb-1">Webcam is Inactive</h4>
                    <p className="text-xs text-slate-400 max-w-sm mb-4">
                      Turn on the camera to capture a live face biometric scan, or upload an existing photo.
                    </p>
                    <button
                      onClick={startCamera}
                      disabled={modelLoading}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg shadow-sm flex items-center space-x-2 transition-colors disabled:opacity-50"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Launch Live Camera</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Status Banner */}
              {statusMessage && (
                <div className={`p-3 rounded-lg text-xs font-medium flex items-center space-x-2 ${
                  statusMessage.includes('Successfully')
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : detectedFace
                    ? 'bg-blue-50 text-blue-800 border border-blue-200'
                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                }`}>
                  <Info className="w-4 h-4 shrink-0" />
                  <span>{statusMessage}</span>
                </div>
              )}

              {/* Action Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center space-x-2">
                  {cameraActive ? (
                    <button
                      onClick={stopCamera}
                      className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors"
                    >
                      Turn Off Camera
                    </button>
                  ) : (
                    <button
                      onClick={startCamera}
                      disabled={modelLoading}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-medium rounded-lg transition-colors flex items-center space-x-1.5"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Turn On Camera</span>
                    </button>
                  )}

                  {/* Photo File Upload alternate */}
                  <label className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer">
                    <Upload className="w-3.5 h-3.5 text-slate-500" />
                    <span>Upload Portrait Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileUpload}
                      disabled={enrolling || modelLoading}
                    />
                  </label>
                </div>

                {/* Big Enroll Face Button */}
                <button
                  onClick={handleEnrollFace}
                  disabled={!cameraActive || !detectedFace || enrolling}
                  className={`px-5 py-2.5 rounded-lg text-xs font-bold shadow-sm flex items-center space-x-2 transition-all ${
                    detectedFace
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-emerald-600/30 ring-2 ring-emerald-500/50'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{enrolling ? 'Enrolling...' : 'Enroll FaceLock Biometric'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-12 text-center text-slate-400">
              Please select an employee from the list to begin enrollment.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
