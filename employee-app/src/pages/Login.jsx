import React, { useState } from 'react';
import { 
  ScanFace, 
  Phone, 
  ShieldCheck, 
  ArrowRight, 
  Sparkles, 
  Key, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2,
  Building2,
  Lock,
  UserPlus,
  ArrowLeft,
  Smartphone
} from 'lucide-react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';

export default function Login() {
  const { login } = useApp();

  const [phone, setPhone] = useState('');
  const [step, setStep] = useState('phone'); // 'phone', 'register', or 'otp'
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [otpNotice, setOtpNotice] = useState(null);
  const [pendingEmployee, setPendingEmployee] = useState(null);

  // Self-Registration fields
  const [regName, setRegName] = useState('');
  const [regDept, setRegDept] = useState('Engineering');
  const [regRole, setRegRole] = useState('Team Member');

  // Handle Send OTP
  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    if (!phone.trim()) {
      setError('Please enter your registered mobile phone number');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setOtpNotice(null);

      const res = await api.sendOtp(phone.trim());

      if (res.success) {
        setPendingEmployee(res.employee);
        setOtpNotice({
          code: res.demo_otp,
          message: res.message
        });
        setOtp('');
        setStep('otp');
      } else {
        setError(res.error || 'Failed to send OTP');
      }
    } catch (err) {
      setError(err.message || 'Network error while contacting office authentication server');
    } finally {
      setLoading(false);
    }
  };

  // Handle Register New Employee
  const handleRegister = async (e) => {
    if (e) e.preventDefault();
    if (!regName.trim() || !phone.trim()) {
      setError('Please fill in your name and phone number');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const regRes = await api.register({
        name: regName.trim(),
        phone: phone.trim(),
        department: regDept,
        role: regRole
      });

      if (regRes.success) {
        // Send OTP to the newly registered number
        const otpRes = await api.sendOtp(phone.trim());
        if (otpRes.success) {
          setPendingEmployee(otpRes.employee);
          setOtpNotice({
            code: otpRes.demo_otp,
            message: otpRes.message
          });
          setOtp('');
          setStep('otp');
        } else {
          setError(otpRes.error || 'Failed to dispatch OTP');
        }
      } else {
        setError(regRes.error || 'Registration failed');
      }
    } catch (err) {
      setError(err.message || 'Error creating employee profile');
    } finally {
      setLoading(false);
    }
  };

  // Handle Verify OTP
  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    if (!otp.trim()) {
      setError('Please enter the 6-digit verification code');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const res = await api.verifyOtp(phone.trim(), otp.trim());

      if (res.success && res.employee) {
        login(res.employee);
      } else {
        setError(res.error || 'Invalid OTP code');
      }
    } catch (err) {
      setError(err.message || 'Verification failed. Please check the OTP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-center items-center p-4 sm:p-6 selection:bg-[#8b0000] selection:text-white">
      {/* Ambient background glows */}
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-red-600/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative w-full max-w-md px-1 sm:px-0">
        {/* Brand Header */}
        <div className="text-center mb-4 sm:mb-6">
          <img 
            src="/logo.png" 
            alt="Velavan Properties" 
            className="w-20 h-20 sm:w-24 sm:h-24 object-contain rounded-3xl mx-auto mb-2.5 sm:mb-3 shadow-lg border border-slate-200 bg-white p-1" 
          />
          <h1 className="text-xl sm:text-2xl font-black text-[#8b0000] tracking-tight leading-tight">
            Velavan Properties
          </h1>
          <p className="text-xs text-slate-600 mt-0.5 font-medium">
            Employee Attendance & Payroll Portal
          </p>
        </div>

        {/* Card */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-8 shadow-xl relative overflow-hidden">
          {step === 'phone' && (
            /* STEP 1: PHONE NUMBER INPUT */
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="text-center mb-4">
                <h2 className="text-lg font-bold text-slate-900">Employee Login</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Enter your registered mobile phone number to receive a secure login OTP.
                </p>
              </div>

              {error && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs space-y-2">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{error}</span>
                  </div>
                  {/* Quick Register Prompt if number not found */}
                  {error.includes('No registered employee') && (
                    <button
                      type="button"
                      onClick={() => { setStep('register'); setError(''); }}
                      className="w-full py-2 px-3 bg-red-100 hover:bg-red-200 text-[#8b0000] font-bold rounded-lg border border-red-300 flex items-center justify-center space-x-1.5 transition-colors"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Register "{phone}" as New Employee</span>
                    </button>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Mobile Phone Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    required
                    autoFocus
                    placeholder="e.g. 8754898473"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-[#8b0000] focus:ring-2 focus:ring-red-100 font-mono tracking-wide"
                  />
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  * You can also enter your Employee ID (e.g. VPDM01)
                </span>
              </div>

              <button
                type="submit"
                disabled={loading || !phone.trim()}
                className="w-full py-3 bg-gradient-to-r from-[#8b0000] to-[#c62828] hover:from-[#7b0000] hover:to-[#b71c1c] disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-red-950/20 transition-all flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying Employee Number...</span>
                  </>
                ) : (
                  <>
                    <span>Send Login OTP</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => { setStep('register'); setError(''); }}
                  className="text-xs text-slate-500 hover:text-[#8b0000] font-medium transition-colors"
                >
                  New employee? <span className="text-[#8b0000] underline font-bold">Register profile here</span>
                </button>
              </div>
            </form>
          )}

          {step === 'register' && (
            /* STEP 1B: SELF-REGISTRATION FOR NEW NUMBER */
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="text-center mb-4">
                <div className="w-12 h-12 rounded-2xl bg-red-50 text-[#8b0000] flex items-center justify-center mx-auto mb-2 border border-red-200">
                  <UserPlus className="w-6 h-6" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">Register New Employee</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Set up your profile to activate attendance tracking
                </p>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:border-[#8b0000]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Phone Number</label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 8754898473"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-mono focus:outline-none focus:border-[#8b0000]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Team / Department</label>
                  <select
                    value={regDept}
                    onChange={(e) => setRegDept(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:border-[#8b0000]"
                  >
                    <option value="Engineering">Engineering</option>
                    <option value="Product">Product</option>
                    <option value="Human Resources">HR</option>
                    <option value="Sales & Marketing">Sales</option>
                    <option value="Design">Design</option>
                    <option value="Operations">Operations</option>
                    <option value="Finance">Finance</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Job Designation</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Software Engineer"
                    value={regRole}
                    onChange={(e) => setRegRole(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:border-[#8b0000]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !regName.trim() || !phone.trim()}
                className="w-full py-3 bg-gradient-to-r from-[#8b0000] to-[#c62828] hover:from-[#7b0000] hover:to-[#b71c1c] disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-red-950/20 transition-all flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Registering & Generating OTP...</span>
                  </>
                ) : (
                  <>
                    <span>Register & Send OTP</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => { setStep('phone'); setError(''); }}
                  className="text-xs text-slate-500 hover:text-[#8b0000] flex items-center justify-center space-x-1 mx-auto font-medium"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Phone Login</span>
                </button>
              </div>
            </form>
          )}

          {step === 'otp' && (
            /* STEP 2: OTP VERIFICATION */
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="text-center mb-4">
                <div className="w-12 h-12 rounded-2xl bg-red-50 text-[#8b0000] flex items-center justify-center mx-auto mb-2 border border-red-200">
                  <Lock className="w-6 h-6" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">Enter Verification OTP</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  We sent a 6-digit login code to <strong className="text-slate-900 font-mono">{phone}</strong>
                </p>
              </div>

              {/* SMS Notification Banner (NO OTP displayed on screen) */}
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs">
                <div className="flex items-center space-x-2 font-bold mb-1 text-emerald-900">
                  <Smartphone className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>SMS Dispatched to Phone</span>
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  A 6-digit login OTP has been sent via SMS to your mobile phone. Please check your SMS inbox and enter the code below.
                </p>
                <div className="mt-2.5 pt-2 border-t border-emerald-200/80 flex items-center justify-between text-[11px] text-emerald-800 font-semibold">
                  <span>💡 You can also login with your 4-digit Employee PIN</span>
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 text-center">
                  Enter 6-Digit OTP or 4-Digit PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  autoFocus
                  placeholder="• • • • • •"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  className="w-full py-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-2xl font-mono font-bold tracking-widest text-[#8b0000] focus:outline-none focus:border-[#8b0000] focus:ring-2 focus:ring-red-100"
                />
              </div>

              <button
                type="submit"
                disabled={loading || otp.length < 4}
                className="w-full py-3 bg-gradient-to-r from-[#8b0000] to-[#c62828] hover:from-[#7b0000] hover:to-[#b71c1c] disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-red-950/20 transition-all flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying Code & Logging In...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Verify & Login</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-between text-xs pt-2">
                <button
                  type="button"
                  onClick={() => { setStep('phone'); setOtp(''); setError(''); }}
                  className="text-slate-500 hover:text-slate-800 font-medium"
                >
                  Change phone number
                </button>

                <button
                  type="button"
                  onClick={handleSendOtp}
                  className="text-[#8b0000] hover:text-red-700 font-bold"
                >
                  Resend OTP
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Security Footer */}
        <div className="text-center mt-6 text-xs text-slate-500 flex items-center justify-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Secured by Velavan Properties Biometric Infrastructure</span>
        </div>
      </div>
    </div>
  );
}
