import { useState, useEffect } from 'react';
import { ArrowLeft, Eye, EyeOff, User, Mail, Lock, Phone, Calendar, Upload, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useRouter } from '../contexts/RouterContext';
import { Spinner } from '../components/ui/Spinner';
import { generateEmployeeId } from '../lib/utils';

type Gender = 'male' | 'female' | 'other';

export function InitializeMDPage() {
  const { navigate } = useRouter();
  const [checking, setChecking] = useState(true);
  const [mdExists, setMdExists] = useState(false);
  const [step, setStep] = useState<'form' | 'done'>('form');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [createdEmployee, setCreatedEmployee] = useState('');

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    dob: '',
    gender: '' as Gender | '',
    password: '',
    confirm_password: '',
  });

  useEffect(() => {
    const checkMD = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'md')
        .eq('is_active', true)
        .limit(1);

      if (!error && data && data.length > 0) {
        setMdExists(true);
      }
      setChecking(false);
    };
    checkMD();
  }, []);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Profile photo must be less than 5MB');
        return;
      }
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setAvatarPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const uploadAvatar = async (userId: string): Promise<string | null> => {
    if (!avatarFile) return null;
    const fileExt = avatarFile.name.split('.').pop();
    const fileName = `${userId}-${Date.now()}.${fileExt}`;
    const { error: uploadErr } = await supabase.storage
      .from('proof-uploads')
      .upload(`avatars/${fileName}`, avatarFile);
    if (uploadErr) return null;
    const { data } = supabase.storage.from('proof-uploads').getPublicUrl(`avatars/${fileName}`);
    return data.publicUrl;
  };

  const validatePassword = (pw: string): string | null => {
    if (pw.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(pw)) return 'Password must contain at least one uppercase letter';
    if (!/[0-9]/.test(pw)) return 'Password must contain at least one number';
    return null;
  };

  const handleInitialize = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.full_name.trim()) { setError('Full name is required.'); return; }
    if (!form.email.trim()) { setError('Email address is required.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) { setError('Please enter a valid email address.'); return; }
    if (!form.phone.trim()) { setError('Mobile number is required.'); return; }
    if (!form.dob) { setError('Date of birth is required.'); return; }
    if (!form.gender) { setError('Gender is required.'); return; }

    const pwErr = validatePassword(form.password);
    if (pwErr) { setError(pwErr); return; }
    if (form.password !== form.confirm_password) { setError('Passwords do not match.'); return; }

    setLoading(true);

    const empId = generateEmployeeId('md');

    const { data: signupData, error: signupErr } = await supabase.auth.signUp({
      email: form.email.trim().toLowerCase(),
      password: form.password,
      options: {
        data: {
          full_name: form.full_name.trim(),
          role: 'md',
        },
      },
    });

    if (signupErr) {
      setLoading(false);
      if (signupErr.message.includes('already registered')) {
        setError('This email is already registered.');
      } else {
        setError(signupErr.message);
      }
      return;
    }

    if (signupData.user) {
      let avatarUrl: string | null = null;
      try {
        avatarUrl = await uploadAvatar(signupData.user.id);
      } catch {
        // Avatar upload failed, continue without
      }

      // Trigger already created the basic profile — update with full details.
      // Retry a few times because the trigger may not have committed yet.
      const profilePayload = {
        full_name: form.full_name.trim(),
        employee_id: empId,
        role: 'md' as const,
        department_id: null,
        phone: form.phone.trim(),
        avatar_url: avatarUrl,
        is_active: true,
      };

      let profileErr: { message: string } | null = null;
      for (let attempt = 1; attempt <= 4; attempt++) {
        if (attempt > 1) await new Promise(r => setTimeout(r, attempt * 300));
        const { error } = await supabase.from('profiles').update(profilePayload).eq('id', signupData.user.id);
        profileErr = error;
        if (!error) break;
      }

      if (profileErr) {
        // Last resort: upsert
        const { error: upsertErr } = await supabase.from('profiles').upsert(
          { id: signupData.user.id, ...profilePayload },
          { onConflict: 'id' }
        );
        if (upsertErr) {
          console.error('InitializeMD profile upsert failed:', upsertErr.message);
          setLoading(false);
          setError(`Account created but profile setup failed: ${upsertErr.message}. Please contact IT support.`);
          return;
        }
      }

      await supabase.from('audit_logs').insert({
        user_id: signupData.user.id,
        action: 'create',
        entity_type: 'user',
        entity_id: signupData.user.id,
        details: {
          name: form.full_name,
          email: form.email,
          role: 'md',
          source: 'md_initialization',
          employee_id: empId,
        },
      });

      setCreatedEmployee(empId);
      setLoading(false);
      setStep('done');
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (mdExists) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center">
          <div className="card p-8">
            <div className="h-16 w-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <User size={32} className="text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">MD Already Initialized</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
              A Medical Director account already exists in the system. This one-time setup cannot be repeated.
            </p>
            <button onClick={() => navigate('login')} className="btn-primary w-full">
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-8">
            <img src="/assets/images/image copy copy.png" alt="Avron Hospitals" className="h-10 w-auto" />
            <div>
              <p className="text-slate-900 dark:text-white font-bold text-base leading-none">AVRON HOSPITALS</p>
              <p className="text-brand-blue-500 text-xs font-medium">MD Initialization</p>
            </div>
          </div>

          <div className="card p-8 text-center animate-slide-up">
            <div className="h-16 w-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={32} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">MD Account Created!</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-5">
              The Medical Director account has been successfully initialized. You may now sign in.
            </p>
            <div className="bg-brand-blue-50 dark:bg-brand-blue-900/20 border border-brand-blue-200 dark:border-brand-blue-800 rounded-lg p-4 mb-6">
              <p className="text-xs text-slate-500 mb-1">Employee ID</p>
              <p className="text-lg font-mono font-bold text-brand-blue-700 dark:text-brand-blue-300">{createdEmployee}</p>
            </div>
            <button onClick={() => navigate('login')} className="btn-primary w-full">
              Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden bg-gradient-to-br from-slate-900 via-brand-blue-950 to-slate-900">
        <div className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'radial-gradient(circle at 25% 25%, #0ea5e9 0%, transparent 50%), radial-gradient(circle at 75% 75%, #dc2626 0%, transparent 50%)',
          }}
        />
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div className="flex items-center gap-3">
            <img src="/assets/images/image copy copy.png" alt="Avron Hospitals" className="h-12 w-auto" />
            <div>
              <p className="text-white font-bold text-xl tracking-tight leading-none">AVRON</p>
              <p className="text-brand-blue-300 font-semibold text-sm tracking-widest">HOSPITALS</p>
            </div>
          </div>

          <div>
            <div className="inline-flex items-center gap-2 bg-amber-500/20 backdrop-blur-sm border border-amber-400/30 rounded-full px-4 py-2 mb-6">
              <User size={14} className="text-amber-400" />
              <span className="text-amber-200 text-sm font-medium">One-Time Setup</span>
            </div>
            <h1 className="text-4xl font-bold text-white leading-tight mb-4">
              Initialize<br />
              <span className="text-brand-blue-300">Medical Director</span>
            </h1>
            <p className="text-slate-300 text-base leading-relaxed max-w-md mb-8">
              This one-time setup creates the Medical Director account with full administrative authority. Complete this process to activate the system.
            </p>
            <div className="space-y-3">
              {[
                'Full system administrative access',
                'Authority over all roles including Super Admin',
                'Complete audit trail and compliance',
                'Secure credential management',
              ].map(f => (
                <div key={f} className="flex items-center gap-3">
                  <div className="h-1.5 w-1.5 rounded-full bg-brand-blue-400 flex-shrink-0" />
                  <span className="text-slate-300 text-sm">{f}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-white/30 text-xs">Secured initialization. This process can only be performed once.</p>
        </div>
      </div>

      {/* Right - form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-white dark:bg-slate-900 overflow-y-auto">
        <div className="w-full max-w-[420px] py-8">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-6 lg:hidden">
            <img src="/assets/images/image copy copy.png" alt="Logo" className="h-9 w-auto" />
            <div>
              <p className="text-slate-900 dark:text-white font-bold text-base leading-none">AVRON HOSPITALS</p>
              <p className="text-brand-blue-500 text-xs font-medium">MD Initialization</p>
            </div>
          </div>

          <div className="mb-7">
            <div className="hidden lg:flex items-center gap-3 mb-5">
              <img src="/assets/images/image copy copy.png" alt="Logo" className="h-10 w-auto" />
              <div>
                <p className="text-slate-900 dark:text-white font-bold text-lg leading-none">AVRON HOSPITALS</p>
                <p className="text-brand-blue-500 text-xs font-medium tracking-wide">MD Initialization</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Create MD Account</h2>
              <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium px-2 py-0.5 rounded-full">One-Time</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Initialize the Medical Director account. This can only be done once.
            </p>
          </div>

          <form onSubmit={handleInitialize} className="space-y-4">
            {/* Profile Photo */}
            <div className="flex items-center gap-4">
              <div className="relative">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar" className="h-16 w-16 rounded-full object-cover border-2 border-brand-blue-200" />
                ) : (
                  <div className="h-16 w-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-600">
                    <User size={24} className="text-slate-400" />
                  </div>
                )}
                <label className="absolute -bottom-1 -right-1 h-6 w-6 bg-brand-blue-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-brand-blue-600 transition-colors shadow-sm">
                  <Upload size={12} className="text-white" />
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} disabled={loading} />
                </label>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Profile Photo</p>
                <p className="text-xs text-slate-400">Optional, max 5MB</p>
              </div>
            </div>

            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Full Name *
              </label>
              <div className="relative">
                <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  placeholder="Dr. John Doe"
                  className="input-field pl-10"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Email Address *
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="md@avronhospitals.com"
                  className="input-field pl-10"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Mobile Number *
              </label>
              <div className="relative">
                <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+91 98765 43210"
                  className="input-field pl-10"
                  disabled={loading}
                />
              </div>
            </div>

            {/* DOB & Gender */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Date of Birth *
                </label>
                <div className="relative">
                  <Calendar size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="date"
                    value={form.dob}
                    onChange={e => setForm(f => ({ ...f, dob: e.target.value }))}
                    className="input-field pl-10"
                    disabled={loading}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Gender *
                </label>
                <select
                  value={form.gender}
                  onChange={e => setForm(f => ({ ...f, gender: e.target.value as Gender }))}
                  className="input-field"
                  disabled={loading}
                >
                  <option value="">Select...</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Password *
              </label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Min 8 chars, 1 uppercase, 1 number"
                  className="input-field pl-10 pr-10"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(s => !s)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Confirm Password *
              </label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={form.confirm_password}
                  onChange={e => setForm(f => ({ ...f, confirm_password: e.target.value }))}
                  placeholder="Repeat password"
                  className="input-field pl-10"
                  disabled={loading}
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-brand-red-50 dark:bg-brand-red-900/20
                              border border-brand-red-200 dark:border-brand-red-800
                              text-brand-red-700 dark:text-brand-red-400
                              text-sm rounded-lg px-4 py-3">
                <span className="mt-0.5">!</span>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full h-11 text-base mt-2"
            >
              {loading ? <Spinner size="sm" className="text-white" /> : 'Initialize MD Account'}
            </button>
          </form>

          <button
            onClick={() => navigate('login')}
            className="mt-4 flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors mx-auto"
          >
            <ArrowLeft size={14} /> Back to login
          </button>
        </div>
      </div>
    </div>
  );
}
