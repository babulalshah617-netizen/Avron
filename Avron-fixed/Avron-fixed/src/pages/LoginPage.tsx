import { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, Lock, Mail, ArrowRight, Shield, UserPlus, ChevronDown, Copy, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from '../contexts/RouterContext';
import { Spinner } from '../components/ui/Spinner';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';

const AVRON_BUILDING = '/assets/images/image copy copy copy.png';

const DEMO_CREDENTIALS = [
  { role: 'Medical Director', email: 'md@avronhospitals.com', password: 'MD@Avron2024', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' },
  { role: 'Super Admin', email: 'admin@avronhospitals.com', password: 'Admin@Avron2024', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  { role: 'Department Head', email: 'depthead@avronhospitals.com', password: 'Dept@Avron2024', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  { role: 'Floor Supervisor', email: 'supervisor@avronhospitals.com', password: 'Super@Avron2024', color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300' },
  { role: 'Staff / Nurse', email: 'staff@avronhospitals.com', password: 'Staff@Avron2024', color: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300' },
  { role: 'IT Team', email: 'it@avronhospitals.com', password: 'IT@Avron2024', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  { role: 'Maintenance', email: 'maintenance@avronhospitals.com', password: 'Maint@Avron2024', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  { role: 'Biomedical', email: 'biomedical@avronhospitals.com', password: 'Bio@Avron2024', color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300' },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button onClick={copy} className="ml-1 p-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors" title="Copy">
      {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
    </button>
  );
}

export function LoginPage() {
  const { signIn } = useAuth();
  const { navigate } = useRouter();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [mdExists, setMdExists] = useState<boolean | null>(null);
  const [showDemo, setShowDemo] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from('profiles').select('id').eq('role', 'md').eq('is_active', true).limit(1).then(({ data }) => {
      setMdExists(!!data && data.length > 0);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    setError(null);
    const { error: err } = await signIn(email.trim(), password);
    setLoading(false);
    if (err) {
      setError(
        err.includes('Invalid login credentials')
          ? 'Invalid email or password. Please try again.'
          : err,
      );
    } else {
      navigate('dashboard');
    }
  };

  const fillDemo = (cred: typeof DEMO_CREDENTIALS[0]) => {
    setEmail(cred.email);
    setPassword(cred.password);
    setError(null);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel – AVRON hospital building image */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden">
        <img
          src={AVRON_BUILDING}
          alt="Avron Hospitals Building"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/80 via-brand-blue-900/60 to-slate-900/40" />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo + brand */}
          <div className="flex items-center gap-3">
            <img src="/assets/images/image copy copy.png" alt="Avron Hospitals Logo" className="h-12 w-auto" />
            <div>
              <p className="text-white font-bold text-xl tracking-tight leading-none">AVRON</p>
              <p className="text-brand-blue-300 font-semibold text-sm tracking-widest">HOSPITALS</p>
            </div>
          </div>

          {/* Hero text */}
          <div>
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm
                            border border-white/20 rounded-full px-4 py-2 mb-6">
              <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-white/90 text-sm font-medium">AVRON ERP — Enterprise Resource Planning</span>
            </div>

            <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-4">
              Your Trusted<br />
              <span className="text-brand-blue-300">Family Hospital</span>
            </h1>

            <p className="text-slate-200 text-base leading-relaxed max-w-md">
              Integrated hospital management for seamless patient care, streamlined
              operations, and complete clinical oversight — all in one secure platform.
            </p>

            <div className="flex flex-wrap gap-3 mt-8">
              {['Patient Management', 'Bed & Ward Tracking', 'OT Scheduling', 'Pharmacy & Billing'].map(f => (
                <span
                  key={f}
                  className="bg-white/10 backdrop-blur-sm border border-white/20
                             text-white/80 text-xs font-medium px-3 py-1.5 rounded-full"
                >
                  {f}
                </span>
              ))}
            </div>
          </div>

          <p className="text-white/40 text-xs">
            © {new Date().getFullYear()} Avron Hospitals. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right panel – login form */}
      <div className="flex-1 flex flex-col justify-between bg-white dark:bg-slate-900 overflow-y-auto">
        {/* Mobile brand */}
        <div className="flex items-center gap-2 p-5 lg:hidden border-b border-slate-100 dark:border-slate-800">
          <img src="/assets/images/image copy copy.png" alt="Logo" className="h-9 w-auto" />
          <div>
            <p className="text-slate-900 dark:text-white font-bold text-base leading-none">AVRON HOSPITALS</p>
            <p className="text-brand-blue-500 text-xs font-medium">Your Trusted Family Hospital</p>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-[400px]">
            {/* Heading */}
            <div className="mb-8">
              <div className="hidden lg:flex items-center gap-3 mb-6">
                <img src="/assets/images/image copy copy.png" alt="Logo" className="h-10 w-auto" />
                <div>
                  <p className="text-slate-900 dark:text-white font-bold text-lg leading-none">AVRON HOSPITALS</p>
                  <p className="text-brand-blue-500 text-xs font-medium tracking-wide">Your Trusted Family Hospital</p>
                </div>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Welcome back</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                Sign in to access the hospital management portal.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    ref={emailRef}
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="staff@avronhospitals.com"
                    autoComplete="email"
                    className="input-field pl-10"
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => navigate('forgot-password')}
                    className="text-xs text-brand-blue-600 dark:text-brand-blue-400 hover:text-brand-blue-700 font-medium transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className="input-field pl-10 pr-10"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(s => !s)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 bg-brand-red-50 dark:bg-brand-red-900/20
                                border border-brand-red-200 dark:border-brand-red-800
                                text-brand-red-700 dark:text-brand-red-400
                                text-sm rounded-lg px-4 py-3 animate-fade-in">
                  <span className="mt-0.5">⚠</span>
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className={cn('btn-primary w-full mt-2 h-11 text-base', loading && 'cursor-not-allowed')}
              >
                {loading ? <Spinner size="sm" className="text-white" /> : <><span>Sign In</span> <ArrowRight size={16} /></>}
              </button>
            </form>

            {/* Register link */}
            <div className="mt-5 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                New staff member?{' '}
                <button
                  type="button"
                  onClick={() => navigate('register')}
                  className="text-brand-blue-600 dark:text-brand-blue-400 font-medium hover:underline"
                >
                  Create an account
                </button>
              </p>
            </div>

            {/* Security note */}
            <div className="mt-4 flex items-center gap-2 text-slate-400 dark:text-slate-600 text-xs">
              <Lock size={12} />
              <span>Secured with 256-bit SSL encryption. All activity is monitored and logged.</span>
            </div>

            {/* MD Initialization - only shown when no MD exists */}
            {mdExists === false && (
              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserPlus size={16} className="text-amber-600 dark:text-amber-400" />
                    <div>
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">MD Not Initialized</p>
                      <p className="text-xs text-amber-600 dark:text-amber-400">Set up the Medical Director account first</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('initialize-md')}
                    className="text-xs font-medium px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-md transition-colors"
                  >
                    Initialize
                  </button>
                </div>
              </div>
            )}

            {/* Demo Credentials — only visible in non-production */}
            {import.meta.env.DEV && (
              <div className="mt-4 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowDemo(s => !s)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Demo Credentials</span>
                    <span className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded">Dev Only</span>
                  </div>
                  <ChevronDown size={14} className={cn('text-slate-400 transition-transform', showDemo && 'rotate-180')} />
                </button>

                {showDemo && (
                  <div className="divide-y divide-slate-100 dark:divide-slate-700/50 max-h-72 overflow-y-auto">
                    {DEMO_CREDENTIALS.map((cred) => (
                      <button
                        key={cred.email}
                        type="button"
                        onClick={() => fillDemo(cred)}
                        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left group"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0', cred.color)}>
                            {cred.role}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-0.5">
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{cred.email}</span>
                              <CopyButton text={cred.email} />
                            </div>
                            <div className="flex items-center gap-0.5">
                              <span className="text-[11px] text-slate-400 font-mono">{cred.password}</span>
                              <CopyButton text={cred.password} />
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] text-brand-blue-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2">
                          Fill
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer with admin portal link */}
        <div className="py-4 flex justify-center border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => navigate('admin-portal')}
            className="flex items-center gap-1.5 text-xs text-slate-300 dark:text-slate-700
                       hover:text-brand-blue-500 dark:hover:text-brand-blue-500
                       transition-colors duration-200 group select-none"
          >
            <Shield size={11} className="group-hover:scale-110 transition-transform" />
            <span>Administration Portal</span>
          </button>
        </div>
      </div>
    </div>
  );
}
