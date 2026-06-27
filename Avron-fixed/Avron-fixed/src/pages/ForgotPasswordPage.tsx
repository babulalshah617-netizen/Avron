import { useState } from 'react';
import { ArrowLeft, Mail, KeyRound, CheckCircle2, Eye, EyeOff, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useRouter } from '../contexts/RouterContext';
import { Spinner } from '../components/ui/Spinner';

type Step = 'email' | 'otp' | 'password' | 'done';

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function ForgotPasswordPage() {
  const { goBack } = useRouter();

  const [step, setStep]         = useState<Step>('email');
  const [email, setEmail]       = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [newPw, setNewPw]       = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [generatedOtp, setGeneratedOtp] = useState('');

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError('Enter your email address.'); return; }
    setLoading(true);
    setError(null);

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('is_active', true)
      .maybeSingle();

    const { data: user } = await supabase.auth.getUser();
    if (!profile && !user.user) {
      const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true });
      if (count === 0) {
        setError('No account found with this email.');
        setLoading(false);
        return;
      }
    }

    const otp = generateOTP();
    setGeneratedOtp(otp);

    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await supabase.from('otp_codes').insert({
      email: email.trim().toLowerCase(),
      code: otp,
      expires_at: expires,
    });

    setLoading(false);
    setStep('otp');
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (otpInput.length !== 6) { setError('Enter the 6-digit OTP.'); return; }
    setLoading(true);

    const { data: record } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('email', email.trim().toLowerCase())
      .eq('code', otpInput.trim())
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (!record) {
      setError('Invalid or expired OTP. Please try again.');
      setLoading(false);
      return;
    }

    await supabase.from('otp_codes').update({ used: true }).eq('id', record.id);
    setLoading(false);
    setStep('password');
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPw.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (newPw !== confirmPw) { setError('Passwords do not match.'); return; }

    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password: newPw });
    setLoading(false);

    if (err) {
      setError(err.message);
    } else {
      await supabase.from('audit_logs').insert({
        action: 'reset_password',
        entity_type: 'auth',
        details: { email },
      });
      setStep('done');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-[380px]">
        {/* Brand */}
        <div className="flex items-center gap-3 mb-8">
          <img src="/assets/images/image copy copy.png" alt="Avron Hospitals" className="h-10 w-auto" />
          <div>
            <p className="text-slate-900 dark:text-white font-bold text-base leading-none">AVRON HOSPITALS</p>
            <p className="text-brand-blue-500 text-xs font-medium">Password Recovery</p>
          </div>
        </div>

        <div className="card p-6 animate-slide-up">
          {step === 'email' && (
            <>
              <div className="flex items-center gap-3 mb-5">
                <div className="h-10 w-10 rounded-xl bg-brand-blue-100 dark:bg-brand-blue-900/30 flex items-center justify-center">
                  <Mail size={20} className="text-brand-blue-600 dark:text-brand-blue-400" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">Reset Password</h2>
                  <p className="text-xs text-slate-500">We'll send a 6-digit OTP</p>
                </div>
              </div>
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="your.email@avronhospitals.com"
                      className="input-field pl-10"
                      disabled={loading}
                    />
                  </div>
                </div>
                {error && <p className="text-xs text-brand-red-600 dark:text-brand-red-400">{error}</p>}
                <button type="submit" disabled={loading} className="btn-primary w-full h-10">
                  {loading ? <Spinner size="sm" className="text-white" /> : 'Send OTP'}
                </button>
              </form>

              {/* DEV helper - shows OTP in a note */}
              {generatedOtp && (
                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200
                                dark:border-amber-800 rounded-lg text-xs text-amber-700 dark:text-amber-400">
                  <strong>Dev Note:</strong> OTP is <strong>{generatedOtp}</strong> (shown for development — remove in production)
                </div>
              )}
            </>
          )}

          {step === 'otp' && (
            <>
              <div className="flex items-center gap-3 mb-5">
                <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <KeyRound size={20} className="text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">Enter OTP</h2>
                  <p className="text-xs text-slate-500">Check your email for the 6-digit code</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                An OTP was sent to <strong className="text-slate-700 dark:text-slate-300">{email}</strong>.
                It expires in 10 minutes.
              </p>
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otpInput}
                  onChange={e => setOtpInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="input-field text-center text-2xl tracking-[0.5em] font-bold"
                  disabled={loading}
                />
                {error && <p className="text-xs text-brand-red-600 dark:text-brand-red-400">{error}</p>}
                <button type="submit" disabled={loading} className="btn-primary w-full h-10">
                  {loading ? <Spinner size="sm" className="text-white" /> : 'Verify OTP'}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep('email'); setOtpInput(''); setError(null); }}
                  className="w-full text-xs text-slate-500 hover:text-brand-blue-500 transition-colors"
                >
                  Didn't receive it? Go back
                </button>
              </form>
            </>
          )}

          {step === 'password' && (
            <>
              <div className="flex items-center gap-3 mb-5">
                <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <Lock size={20} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">New Password</h2>
                  <p className="text-xs text-slate-500">Set a strong new password</p>
                </div>
              </div>
              <form onSubmit={handleSetPassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={newPw}
                      onChange={e => setNewPw(e.target.value)}
                      placeholder="Min. 8 characters"
                      className="input-field pl-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(s => !s)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                      tabIndex={-1}
                    >
                      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmPw}
                    onChange={e => setConfirmPw(e.target.value)}
                    placeholder="Repeat password"
                    className="input-field"
                  />
                </div>
                {error && <p className="text-xs text-brand-red-600 dark:text-brand-red-400">{error}</p>}
                <button type="submit" disabled={loading} className="btn-primary w-full h-10">
                  {loading ? <Spinner size="sm" className="text-white" /> : 'Set New Password'}
                </button>
              </form>
            </>
          )}

          {step === 'done' && (
            <div className="text-center py-4">
              <CheckCircle2 size={48} className="text-emerald-500 mx-auto mb-3" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-1">Password Updated</h2>
              <p className="text-sm text-slate-500 mb-5">Your password has been reset successfully.</p>
              <button
                onClick={goBack}
                className="btn-primary w-full h-10"
              >
                Back to Login
              </button>
            </div>
          )}
        </div>

        {step !== 'done' && (
          <button
            onClick={goBack}
            className="mt-4 flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft size={14} /> Back to login
          </button>
        )}
      </div>
    </div>
  );
}
