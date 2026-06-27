import { useState, useEffect } from 'react';
import { ArrowLeft, Eye, EyeOff, User, Mail, Lock, Phone, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useRouter } from '../contexts/RouterContext';
import { Spinner } from '../components/ui/Spinner';
import { generateEmployeeId } from '../lib/utils';
import type { HospitalRole, Department } from '../types';
import { ROLE_LABELS } from '../types';

const AVAILABLE_ROLES: HospitalRole[] = [
  'staff', 'floor_supervisor', 'it_team', 'maintenance_team', 'biomedical_team',
];

export function StaffRegistrationPage() {
  const { navigate } = useRouter();

  const [step, setStep] = useState<'form' | 'done'>('form');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdEmployee, setCreatedEmployee] = useState('');

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    confirm_password: '',
    role: 'staff' as HospitalRole,
    department_id: '',
    phone: '',
  });

  useEffect(() => {
    supabase.from('departments').select('id,name,floor').eq('is_active', true).order('name').then(({ data }) => {
      setDepartments(data ?? []);
    });
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.full_name.trim()) { setError('Full name is required.'); return; }
    if (!form.email.trim()) { setError('Email address is required.'); return; }
    if (!form.password) { setError('Password is required.'); return; }
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (form.password !== form.confirm_password) { setError('Passwords do not match.'); return; }

    setLoading(true);

    const { data: signupData, error: signupErr } = await supabase.auth.signUp({
      email: form.email.trim().toLowerCase(),
      password: form.password,
      options: {
        data: {
          full_name: form.full_name.trim(),
          role: form.role,
        },
      },
    });

    if (signupErr) {
      setLoading(false);
      if (signupErr.message.includes('already registered')) {
        setError('This email is already registered. Please sign in or use a different email.');
      } else {
        setError(signupErr.message);
      }
      return;
    }

    if (signupData.user) {
      const empId = generateEmployeeId(form.role);
      // Trigger already created the basic profile — update with full details.
      // Retry because the trigger may not have committed yet.
      const profilePayload = {
        full_name: form.full_name.trim(),
        employee_id: empId,
        role: form.role,
        department_id: form.department_id || null,
        phone: form.phone.trim() || null,
      };

      let updateErr: { message: string } | null = null;
      for (let attempt = 1; attempt <= 4; attempt++) {
        if (attempt > 1) await new Promise(r => setTimeout(r, attempt * 300));
        const { error } = await supabase.from('profiles').update(profilePayload).eq('id', signupData.user.id);
        updateErr = error;
        if (!error) break;
      }

      if (updateErr) {
        // Upsert as last resort
        await supabase.from('profiles').upsert(
          { id: signupData.user.id, ...profilePayload },
          { onConflict: 'id' }
        );
      }

      await supabase.from('audit_logs').insert({
        user_id: signupData.user.id,
        action: 'create',
        entity_type: 'user',
        entity_id: signupData.user.id,
        details: { name: form.full_name, email: form.email, role: form.role, source: 'self_registration' },
      });

      setCreatedEmployee(empId);
    }

    setLoading(false);
    setStep('done');
  };

  if (step === 'done') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-8">
            <img src="/assets/images/image copy copy.png" alt="Avron Hospitals" className="h-10 w-auto" />
            <div>
              <p className="text-slate-900 dark:text-white font-bold text-base leading-none">AVRON HOSPITALS</p>
              <p className="text-brand-blue-500 text-xs font-medium">Staff Registration</p>
            </div>
          </div>

          <div className="card p-8 text-center animate-slide-up">
            <div className="h-16 w-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={32} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Registration Successful!</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-5">
              Your account has been created. Awaiting administrator approval. You may now sign in.
            </p>
            <div className="bg-brand-blue-50 dark:bg-brand-blue-900/20 border border-brand-blue-200 dark:border-brand-blue-800 rounded-lg p-4 mb-6">
              <p className="text-xs text-slate-500 mb-1">Your Employee ID</p>
              <p className="text-lg font-mono font-bold text-brand-blue-700 dark:text-brand-blue-300">{createdEmployee}</p>
              <p className="text-xs text-slate-400 mt-1">Save this for your records</p>
            </div>
            <button onClick={() => navigate('login')} className="btn-primary w-full">
              Sign In to Your Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left branding panel */}
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
            <h1 className="text-4xl font-bold text-white leading-tight mb-4">
              Join Our<br />
              <span className="text-brand-blue-300">Healthcare Team</span>
            </h1>
            <p className="text-slate-300 text-base leading-relaxed max-w-md mb-8">
              Register your staff account to access the AVRON Hospitals ERP system. Your account will be ready immediately after registration.
            </p>
            <div className="space-y-3">
              {[
                'Access all hospital management modules',
                'Real-time bed & patient tracking',
                'Integrated ticketing & workflows',
                'Secure role-based access control',
              ].map(f => (
                <div key={f} className="flex items-center gap-3">
                  <div className="h-1.5 w-1.5 rounded-full bg-brand-blue-400 flex-shrink-0" />
                  <span className="text-slate-300 text-sm">{f}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-white/30 text-xs">© {new Date().getFullYear()} Avron Hospitals. All rights reserved.</p>
        </div>
      </div>

      {/* Right — registration form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-white dark:bg-slate-900 overflow-y-auto">
        <div className="w-full max-w-[420px] py-8">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-6 lg:hidden">
            <img src="/assets/images/image copy copy.png" alt="Logo" className="h-9 w-auto" />
            <div>
              <p className="text-slate-900 dark:text-white font-bold text-base leading-none">AVRON HOSPITALS</p>
              <p className="text-brand-blue-500 text-xs font-medium">Staff Registration</p>
            </div>
          </div>

          {/* Desktop heading */}
          <div className="mb-7">
            <div className="hidden lg:flex items-center gap-3 mb-5">
              <img src="/assets/images/image copy copy.png" alt="Logo" className="h-10 w-auto" />
              <div>
                <p className="text-slate-900 dark:text-white font-bold text-lg leading-none">AVRON HOSPITALS</p>
                <p className="text-brand-blue-500 text-xs font-medium tracking-wide">Staff Registration</p>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Create your account</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              Register as a staff member to access the ERP system.
            </p>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
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
                  placeholder="Dr. Jane Smith"
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
                  placeholder="your.email@avronhospitals.com"
                  className="input-field pl-10"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Role & Department */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Role *
                </label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value as HospitalRole }))}
                  className="input-field"
                  disabled={loading}
                >
                  {AVAILABLE_ROLES.map(r => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Department
                </label>
                <select
                  value={form.department_id}
                  onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))}
                  className="input-field"
                  disabled={loading}
                >
                  <option value="">Select...</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Phone Number
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
                  placeholder="Min. 8 characters"
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
                <span className="mt-0.5">⚠</span>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full h-11 text-base mt-2"
            >
              {loading ? <Spinner size="sm" className="text-white" /> : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Already have an account?{' '}
              <button
                onClick={() => navigate('login')}
                className="text-brand-blue-600 dark:text-brand-blue-400 font-medium hover:underline"
              >
                Sign in
              </button>
            </p>
          </div>

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
