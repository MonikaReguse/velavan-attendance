import React, { useState, useEffect, useRef } from 'react';
import { 
  UserPlus, 
  Camera, 
  Upload, 
  ScanFace, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  User, 
  Briefcase, 
  Calendar, 
  Phone, 
  Mail, 
  Heart, 
  Users, 
  MapPin, 
  CreditCard, 
  Sparkles, 
  ArrowRight, 
  ShieldCheck, 
  Check, 
  IndianRupee,
  Landmark,
  Building2,
  FileText,
  FileCheck,
  Eye,
  X,
  GraduationCap,
  Image as ImageIcon,
  Paperclip,
  Trash2,
  ExternalLink
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { api } from '../services/api';
import { loadFaceModels, getFaceDescriptor } from '../services/faceService';

export default function AddEmployeeInfo({ setActiveTab }) {
  const [formData, setFormData] = useState({
    emp_id: '', // Employee ID (Format: VP + Designation Code + Serial Number e.g. VPDM01)
    name: '',
    role: '', // Employee Designation
    doj: new Date().toISOString().split('T')[0], // Employee Date of Joining
    salary: '', // Salary Allocated (e.g. ₹25,000 / month)
    phone: '', // Employee Phone Number
    emergency_phone: '', // Emergency Phone Number
    father_name: '', // Father Name
    mother_name: '', // Mother Name
    spouse_name: '', // Spouses Name
    gender: 'Male', // Gender
    email: '', // Mail (Optional)
    dob: '1995-01-01', // Date of Birth
    blood_group: 'O+', // Blood Group
    marital_status: 'Single', // Marital Status
    address: '', // Address (Required)
    aadhaar_number: '', // Aadhaar Number (Required)
    avatar: '', // Photo
    face_descriptor: '', // Face Recognition Biometric Vector

    // Bank Details
    bank_name: '',
    account_number: '',
    ifsc_code: '',
    account_holder_name: '',
    branch_name: '',
    pan_number: '',

    // Employee Documents (4 REQUIRED: Aadhaar, PAN, Photo, Bank First Page)
    doc_aadhaar: '',
    doc_pan: '',
    doc_photo: '',
    doc_bank_passbook: '',

    // Academic & Qualification Documents (10th, 12th, College, Marksheet)
    doc_10th: '',
    doc_12th: '',
    doc_college: '',
    doc_marksheet: ''
  });

  const [cameraActive, setCameraActive] = useState(false);
  const [modelLoading, setModelLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [scanStatus, setScanStatus] = useState('');
  const [faceEnrolled, setFaceEnrolled] = useState(false);
  const [uploadingDocKey, setUploadingDocKey] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  // Initialize face recognition models on mount
  useEffect(() => {
    initModels();
    return () => {
      stopCamera();
    };
  }, []);

  const initModels = async () => {
    try {
      setModelLoading(true);
      await loadFaceModels();
      setModelLoading(false);
    } catch (err) {
      console.error('Error loading AI face models:', err);
      setModelLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Automatically update Designation and generate Employee ID: VP + Designation Code + Serial (e.g. VPDM01)
  const updateDesignationAndId = async (designation) => {
    setFormData(prev => ({ ...prev, role: designation }));
    if (!designation || !designation.trim()) {
      setFormData(prev => ({ ...prev, role: designation, emp_id: '' }));
      return;
    }
    try {
      const res = await api.getNextEmployeeId(designation);
      if (res && res.emp_id) {
        setFormData(prev => ({ ...prev, role: designation, emp_id: res.emp_id }));
      }
    } catch (err) {
      const clean = designation.trim().replace(/[^a-zA-Z0-9\s]/g, '');
      const words = clean.split(/\s+/).filter(Boolean);
      const code = words.length >= 2 
        ? words.map(w => w[0].toUpperCase()).join('').slice(0, 4)
        : (words[0]?.slice(0, 2).toUpperCase() || 'EM');
      setFormData(prev => ({ ...prev, role: designation, emp_id: `VP${code}01` }));
    }
  };

  // Camera Management
  const startCamera = async () => {
    try {
      setScanStatus('Starting camera...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
          setCameraActive(true);
          setScanStatus('Camera ready. Look directly into the lens and click "Capture Face & Photo".');
        };
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setScanStatus('Could not access camera: ' + err.message);
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  // Capture Photo & Face Recognition Biometrics from Webcam
  const handleCaptureFace = async () => {
    if (!videoRef.current) return;
    try {
      setScanStatus('Scanning facial biometrics with AI...');
      const result = await getFaceDescriptor(videoRef.current);

      if (!result) {
        setScanStatus('No face detected. Please ensure your face is well-lit and centered.');
        return;
      }

      // Create photo snapshot from video canvas
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 400;
      const ctx = canvas.getContext('2d');

      // Crop center square
      const vw = videoRef.current.videoWidth;
      const vh = videoRef.current.videoHeight;
      const size = Math.min(vw, vh);
      const sx = (vw - size) / 2;
      const sy = (vh - size) / 2;

      ctx.drawImage(videoRef.current, sx, sy, size, size, 0, 0, 400, 400);
      const photoUrl = canvas.toDataURL('image/jpeg', 0.9);

      setFormData(prev => ({
        ...prev,
        avatar: photoUrl,
        doc_photo: photoUrl,
        face_descriptor: JSON.stringify(result.descriptor)
      }));

      setFaceEnrolled(true);
      setScanStatus('Face recognition registered successfully! 128-D facial vector extracted.');
      stopCamera();

      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 }
      });
    } catch (err) {
      console.error('Face capture error:', err);
      setScanStatus('Error extracting facial biometrics: ' + err.message);
    }
  };

  // Photo File Upload with automatic Face Recognition extraction
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result;
      if (!dataUrl) return;

      setFormData(prev => ({ ...prev, avatar: dataUrl, doc_photo: dataUrl }));
      setScanStatus('Analyzing uploaded image for facial biometrics...');

      // Attempt AI face detection on uploaded photo
      const img = new Image();
      img.src = dataUrl;
      img.onload = async () => {
        try {
          const result = await getFaceDescriptor(img);
          if (result) {
            setFormData(prev => ({
              ...prev,
              face_descriptor: JSON.stringify(result.descriptor)
            }));
            setFaceEnrolled(true);
            setScanStatus('Face biometrics extracted from uploaded photo successfully!');
          } else {
            setScanStatus('Photo uploaded. No clear face detected for automatic FaceLock (You can still take a live camera scan).');
          }
        } catch (err) {
          console.error('Face descriptor error on uploaded image:', err);
          setScanStatus('Photo attached.');
        }
      };
    };
    reader.readAsDataURL(file);
  };

  // Upload any Employee Document (Aadhaar, PAN, Bank Passbook, Academic Docs)
  const handleDocUpload = (docKey, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingDocKey(docKey);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result;
      if (!dataUrl) {
        setUploadingDocKey(null);
        return;
      }

      try {
        const res = await api.uploadDocument(dataUrl, file.name, docKey);
        const fileUrl = res?.url || dataUrl;
        setFormData(prev => ({
          ...prev,
          [docKey]: fileUrl,
          ...(docKey === 'doc_photo' ? { avatar: fileUrl } : {})
        }));
      } catch (err) {
        setFormData(prev => ({
          ...prev,
          [docKey]: dataUrl,
          ...(docKey === 'doc_photo' ? { avatar: dataUrl } : {})
        }));
      } finally {
        setUploadingDocKey(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveDoc = (docKey) => {
    setFormData(prev => ({
      ...prev,
      [docKey]: '',
      ...(docKey === 'doc_photo' && prev.avatar === prev.doc_photo ? { avatar: '' } : {})
    }));
  };

  // Form Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!formData.name.trim()) {
      setErrorMsg('Please enter the employee name.');
      return;
    }
    if (!formData.role.trim()) {
      setErrorMsg('Please enter the employee designation.');
      return;
    }
    if (!formData.phone.trim()) {
      setErrorMsg('Please enter the employee phone number.');
      return;
    }
    if (!formData.aadhaar_number.trim()) {
      setErrorMsg('Please enter the Aadhaar Number (Required).');
      return;
    }
    if (!formData.address.trim()) {
      setErrorMsg('Please enter the residential address (Required).');
      return;
    }

    // Bank Details Validation
    if (!formData.bank_name.trim()) {
      setErrorMsg('Please enter Employee Bank Name.');
      return;
    }
    if (!formData.account_number.trim()) {
      setErrorMsg('Please enter Bank Account Number.');
      return;
    }
    if (!formData.ifsc_code.trim()) {
      setErrorMsg('Please enter Bank IFSC Code (e.g. SBIN0001234).');
      return;
    }

    // Required 4 Documents Validation: Aadhaar card, PAN card, Photo, Bank first page
    const missingDocs = [];
    if (!formData.doc_aadhaar) missingDocs.push('Aadhar Card');
    if (!formData.doc_pan) missingDocs.push('PAN Card');
    if (!formData.doc_photo && !formData.avatar) missingDocs.push('Official Photo');
    if (!formData.doc_bank_passbook) missingDocs.push('Bank First Page (Passbook / Cheque)');

    if (missingDocs.length > 0) {
      setErrorMsg(`Required Documents Missing: Please upload ${missingDocs.join(', ')} (All 4 mandatory documents are required).`);
      return;
    }

    try {
      setSubmitting(true);
      const finalEmpId = formData.emp_id && formData.emp_id.trim()
        ? formData.emp_id.trim().toUpperCase()
        : null;

      const finalPhoto = formData.doc_photo || formData.avatar || null;

      const payload = {
        ...formData,
        emp_id: finalEmpId,
        avatar: finalPhoto,
        doc_photo: finalPhoto,
        account_holder_name: formData.account_holder_name.trim() || formData.name.trim()
      };

      const res = await api.createEmployee(payload);

      if (res.success || res.id) {
        setSuccessData({
          emp_id: res.emp_id || finalEmpId || 'Registered',
          name: formData.name,
          role: formData.role,
          doj: formData.doj,
          salary: formData.salary,
          bank_name: formData.bank_name,
          account_number: formData.account_number,
          avatar: finalPhoto,
          hasFace: !!formData.face_descriptor
        });

        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      } else {
        setErrorMsg(res.error || 'Failed to create employee profile.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error communicating with backend server.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setFormData({
      emp_id: '',
      name: '',
      role: '',
      doj: new Date().toISOString().split('T')[0],
      salary: '',
      phone: '',
      emergency_phone: '',
      father_name: '',
      mother_name: '',
      spouse_name: '',
      gender: 'Male',
      email: '',
      dob: '1995-01-01',
      blood_group: 'O+',
      marital_status: 'Single',
      address: '',
      aadhaar_number: '',
      avatar: '',
      face_descriptor: '',
      bank_name: '',
      account_number: '',
      ifsc_code: '',
      account_holder_name: '',
      branch_name: '',
      pan_number: '',
      doc_aadhaar: '',
      doc_pan: '',
      doc_photo: '',
      doc_bank_passbook: '',
      doc_10th: '',
      doc_12th: '',
      doc_college: '',
      doc_marksheet: ''
    });
    setSuccessData(null);
    setFaceEnrolled(false);
    setScanStatus('');
    setErrorMsg('');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Page Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800">Add Employee Info</h2>
              <p className="text-xs text-slate-500">
                Register complete employee credentials, personal data, family details, and FaceLock AI biometrics.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setActiveTab('employees')}
          className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3.5 py-2 rounded-xl transition-colors self-start sm:self-auto flex items-center space-x-1.5"
        >
          <Users className="w-3.5 h-3.5" />
          <span>View Employee Directory</span>
        </button>
      </div>

      {/* Success Notification Modal / Card */}
      {successData && (
        <div className="bg-emerald-50 border-2 border-emerald-500/30 rounded-2xl p-6 shadow-xl animate-in fade-in slide-in-from-top-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <img
                  src={successData.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                  alt={successData.name}
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-emerald-500 shadow-md"
                />
                {successData.hasFace && (
                  <div className="absolute -bottom-1 -right-1 bg-emerald-600 text-white rounded-full p-1 border-2 border-white shadow-xs" title="FaceLock Enrolled">
                    <ScanFace className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
              <div>
                <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 mb-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Employee Successfully Enrolled!</span>
                </div>
                <h3 className="text-lg font-black text-slate-800">
                  {successData.name} <span className="text-xs font-mono text-emerald-700 bg-emerald-200/50 px-2 py-0.5 rounded">({successData.emp_id})</span>
                </h3>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-600">
                  <span className="font-semibold text-slate-800">{successData.role}</span>
                  <span className="text-slate-400">•</span>
                  <span>DOJ: <strong>{successData.doj}</strong></span>
                  {successData.salary && (
                    <>
                      <span className="text-slate-400">•</span>
                      <span className="text-emerald-700 font-bold">Salary: {successData.salary}</span>
                    </>
                  )}
                </div>
                <p className="text-[11px] text-emerald-700 mt-1">
                  {successData.hasFace 
                    ? '✓ FaceLock AI biometrics enrolled! Employee can now clock in via camera kiosk.'
                    : '⚠ Photo added without biometric descriptor (can clock in via PIN fallback).'
                  }
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 shrink-0">
              <button
                onClick={handleResetForm}
                className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl shadow-xs transition-colors"
              >
                Add Another Employee
              </button>
              <button
                onClick={() => setActiveTab('employees')}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center space-x-1.5"
              >
                <span>Open Directory</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Registration Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {errorMsg && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Section 1: Photo & Facial Recognition Enrollment */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <ScanFace className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Photo & Face Recognition (FaceLock AI)</h3>
                <p className="text-[11px] text-slate-400">Capture biometric facial descriptors so employee can mark attendance using the camera.</p>
              </div>
            </div>
            {faceEnrolled && (
              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>FaceLock Ready</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {/* Photo / Avatar Preview */}
            <div className="flex flex-col items-center justify-center text-center p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
              <div className="relative mb-3">
                <img
                  src={formData.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80'}
                  alt="Employee Preview"
                  className="w-28 h-28 rounded-2xl object-cover border-4 border-white shadow-lg bg-white"
                />
                {faceEnrolled && (
                  <div className="absolute -bottom-2 -right-2 bg-emerald-600 text-white rounded-full p-1.5 shadow-md border-2 border-white">
                    <Check className="w-4 h-4" />
                  </div>
                )}
              </div>
              <span className="text-xs font-bold text-slate-700">Official Profile Photo</span>
              <span className="text-[11px] text-slate-400 mt-0.5">
                {formData.avatar ? 'Photo configured' : 'Using default placeholder'}
              </span>
            </div>

            {/* Live Camera Scanner Box */}
            <div className="md:col-span-2 space-y-4">
              <div className="relative rounded-2xl bg-slate-900 overflow-hidden min-h-[220px] flex items-center justify-center border border-slate-800">
                {cameraActive ? (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      className="w-full h-56 object-cover"
                    />
                    {/* Face alignment overlay guide */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="w-36 h-48 border-2 border-dashed border-emerald-400 rounded-full opacity-70 animate-pulse"></div>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-400 space-y-2">
                    <Camera className="w-10 h-10 text-slate-500 mx-auto" />
                    <p className="text-xs text-slate-300 font-medium">Camera is currently turned off</p>
                    <p className="text-[11px] text-slate-500 max-w-sm">
                      Start webcam to take a live photo and automatically enroll employee's 128-D facial recognition vector.
                    </p>
                  </div>
                )}
              </div>

              {/* Camera & Upload Controls */}
              <div className="flex flex-wrap items-center gap-3">
                {!cameraActive ? (
                  <button
                    type="button"
                    onClick={startCamera}
                    disabled={modelLoading}
                    className="flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
                  >
                    <Camera className="w-4 h-4" />
                    <span>{modelLoading ? 'Loading AI Models...' : 'Start Live Camera Scanner'}</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleCaptureFace}
                      className="flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Capture Photo & Facial Recognition</span>
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-colors"
                    >
                      Turn Off Camera
                    </button>
                  </>
                )}

                {/* Upload Photo Button */}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center space-x-1.5 px-3.5 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl shadow-xs transition-colors"
                >
                  <Upload className="w-4 h-4 text-slate-500" />
                  <span>Upload Photo File</span>
                </button>
              </div>

              {scanStatus && (
                <p className="text-xs text-emerald-700 font-medium bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200/60">
                  {scanStatus}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Official Employment Details */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center space-x-2.5 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Briefcase className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Employment & Professional Details</h3>
              <p className="text-[11px] text-slate-400">Designation, joining date, and contact numbers.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                Employee Full Name <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 text-slate-800 font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                Employee Designation <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Briefcase className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Digital Marketing, Software Engineer"
                  value={formData.role}
                  onChange={(e) => updateDesignationAndId(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 text-slate-800 font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                <span>
                  Employee ID <span className="text-rose-500">*</span>
                </span>
                <span className="text-[10px] text-emerald-600 font-mono font-medium">
                  VP + Designation + Serial (e.g. VPDM01)
                </span>
              </label>
              <div className="relative">
                <CreditCard className="w-4 h-4 text-emerald-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="e.g. VPDM01"
                  value={formData.emp_id}
                  onChange={(e) => handleChange('emp_id', e.target.value.toUpperCase())}
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 font-mono font-bold text-emerald-700 bg-emerald-50/40"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                Employee Date of Joining (DOJ) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="date"
                  required
                  value={formData.doj}
                  onChange={(e) => handleChange('doj', e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 font-mono text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                Salary Allocated <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <IndianRupee className="w-4 h-4 text-emerald-600 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="e.g. ₹25,000 / month or ₹3,50,000 / year"
                  value={formData.salary}
                  onChange={(e) => handleChange('salary', e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 text-slate-800 font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                Employee Phone Number <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  required
                  placeholder="e.g. 9876543210"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 font-mono text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                Emergency Phone Number <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-rose-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  required
                  placeholder="e.g. 9876543211"
                  value={formData.emergency_phone}
                  onChange={(e) => handleChange('emergency_phone', e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 font-mono text-slate-800"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Personal & Identification Details */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center space-x-2.5 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Personal, Medical & Identity Details</h3>
              <p className="text-[11px] text-slate-400">Gender, date of birth, blood group, marital status, email, and Aadhaar card.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                Email Address (Mail) <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  placeholder="john.doe@company.com (optional)"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 text-slate-800 font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">Gender</label>
              <select
                value={formData.gender}
                onChange={(e) => handleChange('gender', e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 text-slate-800 font-medium bg-white"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">Date of Birth (DOB)</label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="date"
                  value={formData.dob}
                  onChange={(e) => handleChange('dob', e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 font-mono text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">Blood Group</label>
              <select
                value={formData.blood_group}
                onChange={(e) => handleChange('blood_group', e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 text-slate-800 font-medium bg-white"
              >
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">Marital Status</label>
              <select
                value={formData.marital_status}
                onChange={(e) => handleChange('marital_status', e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 text-slate-800 font-medium bg-white"
              >
                <option value="Single">Single</option>
                <option value="Married">Married</option>
                <option value="Divorced">Divorced</option>
                <option value="Widowed">Widowed</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                Aadhaar Number <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <CreditCard className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  maxLength={14}
                  placeholder="XXXX XXXX XXXX"
                  value={formData.aadhaar_number}
                  onChange={(e) => handleChange('aadhaar_number', e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 font-mono text-slate-800"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Family Details & Residential Address */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center space-x-2.5 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Family Information & Residential Address</h3>
              <p className="text-[11px] text-slate-400">Father's name, mother's name, spouse name, and permanent address.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">Father Name</label>
              <input
                type="text"
                placeholder="Father's full name"
                value={formData.father_name}
                onChange={(e) => handleChange('father_name', e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 text-slate-800"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">Mother Name</label>
              <input
                type="text"
                placeholder="Mother's full name"
                value={formData.mother_name}
                onChange={(e) => handleChange('mother_name', e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 text-slate-800"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">Spouse Name</label>
              <input
                type="text"
                placeholder="Spouse full name (if married)"
                value={formData.spouse_name}
                onChange={(e) => handleChange('spouse_name', e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 text-slate-800"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block font-semibold text-slate-700 mb-1.5">
                Residential Address (Address) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <textarea
                  rows={2}
                  required
                  placeholder="Door No, Street Name, Landmark, City, State, PIN Code"
                  value={formData.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 text-slate-800"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 5: Employee Bank Details */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center space-x-2.5 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Landmark className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Employee Bank Account Details</h3>
              <p className="text-[11px] text-slate-400">Official banking details for monthly salary crediting & financial verification.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {/* Bank Name */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                Bank Name <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="e.g. State Bank of India, HDFC, ICICI"
                  value={formData.bank_name}
                  onChange={(e) => handleChange('bank_name', e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 text-slate-800 font-medium"
                />
              </div>
            </div>

            {/* Account Number */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                Bank Account Number <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <CreditCard className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="e.g. 100023456789"
                  value={formData.account_number}
                  onChange={(e) => handleChange('account_number', e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 font-mono text-slate-800 font-semibold"
                />
              </div>
            </div>

            {/* IFSC Code */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                IFSC Code <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. SBIN0001234"
                value={formData.ifsc_code}
                onChange={(e) => handleChange('ifsc_code', e.target.value.toUpperCase())}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 font-mono uppercase text-slate-800 font-bold"
              />
            </div>

            {/* Account Holder Name */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                Account Holder Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Name as per Bank Passbook"
                value={formData.account_holder_name}
                onChange={(e) => handleChange('account_holder_name', e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 text-slate-800"
              />
            </div>

            {/* Branch Name */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">Branch Name</label>
              <input
                type="text"
                placeholder="e.g. Anna Nagar, Chennai"
                value={formData.branch_name}
                onChange={(e) => handleChange('branch_name', e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 text-slate-800"
              />
            </div>

            {/* PAN Card Number */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                PAN Card Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={10}
                placeholder="e.g. ABCDE1234F"
                value={formData.pan_number}
                onChange={(e) => handleChange('pan_number', e.target.value.toUpperCase())}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 font-mono uppercase text-slate-800 font-bold"
              />
            </div>
          </div>
        </div>

        {/* Section 6: Employee Documents (4 REQUIRED + Academic Documents) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <FileCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Employee Documents Verification</h3>
                <p className="text-[11px] text-slate-400">
                  Upload certificates, identity proof, and banking documents (Supports JPG, PNG, WebP, PDF).
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 self-start sm:self-auto">
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                4 Required: Aadhaar, PAN, Photo, Bank First Page
              </span>
            </div>
          </div>

          {/* Sub-section 1: The 4 MANDATORY Documents */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              <h4 className="text-xs font-bold uppercase tracking-wider text-rose-900">
                Mandatory Verification Documents (4 Required)
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 1. Aadhaar Card (Required) */}
              <div className={`p-4 rounded-xl border transition-all ${
                formData.doc_aadhaar 
                  ? 'bg-emerald-50/50 border-emerald-300 shadow-xs' 
                  : 'bg-slate-50 border-slate-200 hover:border-slate-300'
              }`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
                      <CreditCard className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                        <span>1. Aadhaar Card</span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-rose-100 text-rose-700">
                          REQUIRED
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500">Front and back copy of government Aadhaar card</p>
                    </div>
                  </div>

                  {formData.doc_aadhaar && (
                    <span className="flex items-center space-x-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      <Check className="w-3 h-3" />
                      <span>Uploaded</span>
                    </span>
                  )}
                </div>

                {formData.doc_aadhaar ? (
                  <div className="flex items-center justify-between pt-2 border-t border-emerald-200/60">
                    <button
                      type="button"
                      onClick={() => setPreviewDoc({ title: 'Aadhaar Card', url: formData.doc_aadhaar })}
                      className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center space-x-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Preview File</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveDoc('doc_aadhaar')}
                      className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center space-x-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  </div>
                ) : (
                  <label className="mt-2 flex items-center justify-center space-x-2 px-3 py-2 bg-white border border-dashed border-rose-300 hover:border-rose-500 rounded-lg cursor-pointer text-xs font-semibold text-slate-700 hover:text-rose-700 transition-colors">
                    <Upload className="w-3.5 h-3.5 text-rose-500" />
                    <span>{uploadingDocKey === 'doc_aadhaar' ? 'Uploading...' : 'Upload Aadhaar Card (PDF/Image)'}</span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => handleDocUpload('doc_aadhaar', e)}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* 2. PAN Card (Required) */}
              <div className={`p-4 rounded-xl border transition-all ${
                formData.doc_pan 
                  ? 'bg-emerald-50/50 border-emerald-300 shadow-xs' 
                  : 'bg-slate-50 border-slate-200 hover:border-slate-300'
              }`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                        <span>2. PAN Card</span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-rose-100 text-rose-700">
                          REQUIRED
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500">Official PAN card copy for tax and payroll</p>
                    </div>
                  </div>

                  {formData.doc_pan && (
                    <span className="flex items-center space-x-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      <Check className="w-3 h-3" />
                      <span>Uploaded</span>
                    </span>
                  )}
                </div>

                {formData.doc_pan ? (
                  <div className="flex items-center justify-between pt-2 border-t border-emerald-200/60">
                    <button
                      type="button"
                      onClick={() => setPreviewDoc({ title: 'PAN Card', url: formData.doc_pan })}
                      className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center space-x-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Preview File</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveDoc('doc_pan')}
                      className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center space-x-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  </div>
                ) : (
                  <label className="mt-2 flex items-center justify-center space-x-2 px-3 py-2 bg-white border border-dashed border-rose-300 hover:border-rose-500 rounded-lg cursor-pointer text-xs font-semibold text-slate-700 hover:text-rose-700 transition-colors">
                    <Upload className="w-3.5 h-3.5 text-rose-500" />
                    <span>{uploadingDocKey === 'doc_pan' ? 'Uploading...' : 'Upload PAN Card (PDF/Image)'}</span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => handleDocUpload('doc_pan', e)}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* 3. Official Photo (Required) */}
              <div className={`p-4 rounded-xl border transition-all ${
                (formData.doc_photo || formData.avatar)
                  ? 'bg-emerald-50/50 border-emerald-300 shadow-xs' 
                  : 'bg-slate-50 border-slate-200 hover:border-slate-300'
              }`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
                      <ImageIcon className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                        <span>3. Official Photo</span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-rose-100 text-rose-700">
                          REQUIRED
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500">Passport photo (auto-synced with Section 1 photo)</p>
                    </div>
                  </div>

                  {(formData.doc_photo || formData.avatar) && (
                    <span className="flex items-center space-x-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      <Check className="w-3 h-3" />
                      <span>Uploaded</span>
                    </span>
                  )}
                </div>

                {(formData.doc_photo || formData.avatar) ? (
                  <div className="flex items-center justify-between pt-2 border-t border-emerald-200/60">
                    <button
                      type="button"
                      onClick={() => setPreviewDoc({ title: 'Employee Photo', url: formData.doc_photo || formData.avatar })}
                      className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center space-x-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Preview Photo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveDoc('doc_photo')}
                      className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center space-x-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  </div>
                ) : (
                  <label className="mt-2 flex items-center justify-center space-x-2 px-3 py-2 bg-white border border-dashed border-rose-300 hover:border-rose-500 rounded-lg cursor-pointer text-xs font-semibold text-slate-700 hover:text-rose-700 transition-colors">
                    <Upload className="w-3.5 h-3.5 text-rose-500" />
                    <span>{uploadingDocKey === 'doc_photo' ? 'Uploading...' : 'Upload Official Photo (JPG/PNG)'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleDocUpload('doc_photo', e)}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* 4. Bank First Page (Passbook / Cancelled Cheque) (Required) */}
              <div className={`p-4 rounded-xl border transition-all ${
                formData.doc_bank_passbook 
                  ? 'bg-emerald-50/50 border-emerald-300 shadow-xs' 
                  : 'bg-slate-50 border-slate-200 hover:border-slate-300'
              }`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
                      <Landmark className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                        <span>4. Bank First Page</span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-rose-100 text-rose-700">
                          REQUIRED
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500">Passbook 1st page or Cancelled Cheque leaf</p>
                    </div>
                  </div>

                  {formData.doc_bank_passbook && (
                    <span className="flex items-center space-x-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      <Check className="w-3 h-3" />
                      <span>Uploaded</span>
                    </span>
                  )}
                </div>

                {formData.doc_bank_passbook ? (
                  <div className="flex items-center justify-between pt-2 border-t border-emerald-200/60">
                    <button
                      type="button"
                      onClick={() => setPreviewDoc({ title: 'Bank First Page / Passbook', url: formData.doc_bank_passbook })}
                      className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center space-x-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Preview File</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveDoc('doc_bank_passbook')}
                      className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center space-x-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  </div>
                ) : (
                  <label className="mt-2 flex items-center justify-center space-x-2 px-3 py-2 bg-white border border-dashed border-rose-300 hover:border-rose-500 rounded-lg cursor-pointer text-xs font-semibold text-slate-700 hover:text-rose-700 transition-colors">
                    <Upload className="w-3.5 h-3.5 text-rose-500" />
                    <span>{uploadingDocKey === 'doc_bank_passbook' ? 'Uploading...' : 'Upload Bank First Page (PDF/Image)'}</span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => handleDocUpload('doc_bank_passbook', e)}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* Sub-section 2: Academic & Qualification Documents */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Educational & Academic Qualification Documents
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              {/* 5. 10th Marksheet */}
              <div className={`p-3.5 rounded-xl border transition-all ${
                formData.doc_10th ? 'bg-blue-50/50 border-blue-300' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-slate-800">10th Marksheet</span>
                  {formData.doc_10th && <span className="text-[10px] font-bold text-blue-700">✓ Uploaded</span>}
                </div>
                <p className="text-[10px] text-slate-400 mb-2">SSLC / 10th Board Certificate</p>
                {formData.doc_10th ? (
                  <div className="flex items-center justify-between text-[11px]">
                    <button
                      type="button"
                      onClick={() => setPreviewDoc({ title: '10th Marksheet', url: formData.doc_10th })}
                      className="text-blue-700 hover:underline font-bold"
                    >
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveDoc('doc_10th')}
                      className="text-rose-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center space-x-1.5 py-1.5 bg-white border border-dashed border-slate-300 hover:border-blue-400 rounded-lg cursor-pointer text-[11px] text-slate-600">
                    <Paperclip className="w-3 h-3 text-slate-400" />
                    <span>Upload 10th</span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => handleDocUpload('doc_10th', e)}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* 6. 12th Marksheet */}
              <div className={`p-3.5 rounded-xl border transition-all ${
                formData.doc_12th ? 'bg-blue-50/50 border-blue-300' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-slate-800">12th Marksheet</span>
                  {formData.doc_12th && <span className="text-[10px] font-bold text-blue-700">✓ Uploaded</span>}
                </div>
                <p className="text-[10px] text-slate-400 mb-2">HSC / 12th Board Certificate</p>
                {formData.doc_12th ? (
                  <div className="flex items-center justify-between text-[11px]">
                    <button
                      type="button"
                      onClick={() => setPreviewDoc({ title: '12th Marksheet', url: formData.doc_12th })}
                      className="text-blue-700 hover:underline font-bold"
                    >
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveDoc('doc_12th')}
                      className="text-rose-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center space-x-1.5 py-1.5 bg-white border border-dashed border-slate-300 hover:border-blue-400 rounded-lg cursor-pointer text-[11px] text-slate-600">
                    <Paperclip className="w-3 h-3 text-slate-400" />
                    <span>Upload 12th</span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => handleDocUpload('doc_12th', e)}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* 7. College Degree */}
              <div className={`p-3.5 rounded-xl border transition-all ${
                formData.doc_college ? 'bg-blue-50/50 border-blue-300' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-slate-800">College Degree</span>
                  {formData.doc_college && <span className="text-[10px] font-bold text-blue-700">✓ Uploaded</span>}
                </div>
                <p className="text-[10px] text-slate-400 mb-2">Graduation / Degree Certificate</p>
                {formData.doc_college ? (
                  <div className="flex items-center justify-between text-[11px]">
                    <button
                      type="button"
                      onClick={() => setPreviewDoc({ title: 'College Degree Certificate', url: formData.doc_college })}
                      className="text-blue-700 hover:underline font-bold"
                    >
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveDoc('doc_college')}
                      className="text-rose-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center space-x-1.5 py-1.5 bg-white border border-dashed border-slate-300 hover:border-blue-400 rounded-lg cursor-pointer text-[11px] text-slate-600">
                    <GraduationCap className="w-3 h-3 text-slate-400" />
                    <span>Upload Degree</span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => handleDocUpload('doc_college', e)}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* 8. Marksheet */}
              <div className={`p-3.5 rounded-xl border transition-all ${
                formData.doc_marksheet ? 'bg-blue-50/50 border-blue-300' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-slate-800">College Marksheet</span>
                  {formData.doc_marksheet && <span className="text-[10px] font-bold text-blue-700">✓ Uploaded</span>}
                </div>
                <p className="text-[10px] text-slate-400 mb-2">Consolidated / Semester Grade Sheet</p>
                {formData.doc_marksheet ? (
                  <div className="flex items-center justify-between text-[11px]">
                    <button
                      type="button"
                      onClick={() => setPreviewDoc({ title: 'College Marksheet', url: formData.doc_marksheet })}
                      className="text-blue-700 hover:underline font-bold"
                    >
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveDoc('doc_marksheet')}
                      className="text-rose-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center space-x-1.5 py-1.5 bg-white border border-dashed border-slate-300 hover:border-blue-400 rounded-lg cursor-pointer text-[11px] text-slate-600">
                    <FileText className="w-3 h-3 text-slate-400" />
                    <span>Upload Marksheet</span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => handleDocUpload('doc_marksheet', e)}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Document Preview Modal */}
        {previewDoc && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <h4 className="font-bold text-slate-800 text-sm">{previewDoc.title}</h4>
                </div>
                <div className="flex items-center space-x-2">
                  <a
                    href={previewDoc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold flex items-center space-x-1 px-2.5 py-1 bg-white rounded-lg border border-slate-200"
                  >
                    <span>Open in New Tab</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    type="button"
                    onClick={() => setPreviewDoc(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="p-4 flex-1 overflow-auto flex items-center justify-center bg-slate-950/5 min-h-[350px]">
                {previewDoc.url.toLowerCase().endsWith('.pdf') ? (
                  <iframe
                    src={previewDoc.url}
                    title={previewDoc.title}
                    className="w-full h-[500px] rounded-lg border border-slate-200"
                  />
                ) : (
                  <img
                    src={previewDoc.url}
                    alt={previewDoc.title}
                    className="max-h-[500px] max-w-full rounded-lg object-contain shadow-sm border border-slate-200 bg-white"
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Submit Bar */}
        <div className="flex items-center justify-end space-x-3 pt-2">
          <button
            type="button"
            onClick={handleResetForm}
            className="px-5 py-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-colors"
          >
            Clear Form
          </button>

          <button
            type="submit"
            disabled={submitting}
            className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center space-x-2 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Registering Employee...</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>Save & Register Employee</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
