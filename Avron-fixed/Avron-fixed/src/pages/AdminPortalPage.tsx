import { useState } from 'react';
import { ArrowLeft, Eye, EyeOff, Mail, Lock, Shield, Crown, Building2, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from '../contexts/RouterContext';
import { Spinner } from '../components/ui/Spinner';
import { cn } from '../lib/utils';

type AdminType = 'super_admin' | 'md' | 'department_head';

const PORTALS: { type: AdminType; label: string; icon: typeof Crown; color: string; desc: string }[] = [
  {
    type: 'super_admin',
    label: 'Super Administrator',
    icon: Crown,
    color: 'from-purple-600 to-purple-700',
    desc: 'Full system access, user management, audit logs',
  },
  {
    type: 'md',
    label: 'Medical Director',
    icon: Shield,
    color: 'from-rose-600 to-rose-700',
    desc: 'Clinical oversight, department monitoring, reports',
  },
  {
    type: 'department_head',
    label: 'Department Head',
    icon: Building2,
    color: 'from-brand-blue-600 to-brand-blue-700',
    desc: 'Department management, staff, requisitions',
  },
];

export function AdminPortalPage() {
  const { signIn } = useAuth();
  const { navigate, goBack } = useRouter();

  const [selected, setSelected] = useState<AdminType | null>(null);
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please enter credentials.');
      return;
    }
    setLoading(true);
    setError(null);
    const { error: err } = await signIn(email.trim(), password);
    setLoading(false);
    if (err) {
      setError('Invalid credentials. Access denied.');
    } else {
      navigate('dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative w-full max-w-md animate-slide-up">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <img src="/assets/images/image copy copy.png" alt="Avron Hospitals" className="h-14 w-auto" />
              <div className="absolute -top-1 -right-1 h-4 w-4 bg-emerald-500 rounded-full
                              border-2 border-slate-950 animate-pulse" />
            </div>
          </div>
          <p className="text-white font-bold text-lg tracking-tight">AVRON HOSPITALS</p>
          <p className="text-slate-500 text-xs tracking-widest uppercase mt-1">Secure Administration Portal</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
          {!selected ? (
            /* Role selection */
            <div className="p-6">
              <div className="flex items-center gap-2 mb-5">
                <Users size={18} className="text-slate-400" />
                <h2 className="text-base font-semibold text-white">Select Access Level</h2>
              </div>
              <div className="space-y-3">
                {PORTALS.map(p => {
                  const Icon = p.icon;
                  return (
                    <button
                      key={p.type}
                      onClick={() => { setSelected(p.type); setError(null); }}
                      className="w-full flex items-center gap-4 p-4 rounded-xl
                                 border border-slate-700 hover:border-slate-500
                                 bg-slate-800/50 hover:bg-slate-800
                                 transition-all duration-200 group text-left"
                    >
                      <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center bg-gradient-to-br flex-shrink-0', p.color)}>
                        <Icon size={18} className="text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white group-hover:text-slate-100">
                          {p.label}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">{p.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Login form */
            <div>
              {/* Selected role header */}
              {(() => {
                const p = PORTALS.find(x => x.type === selected)!;
                const Icon = p.icon;
                return (
                  <div className={cn('bg-gradient-to-r p-5 flex items-center gap-3', p.color)}>
                    <button
                      onClick={() => { setSelected(null); setError(null); setEmail(''); setPassword(''); }}
                      className="p-1 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors"
                    >
                      <ArrowLeft size={16} />
                    </button>
                    <Icon size={20} className="text-white" />
                    <div>
                      <p className="text-white font-semibold text-sm">{p.label}</p>
                      <p className="text-white/70 text-xs">Enter your credentials</p>
                    </div>
                  </div>
                );
              })()}

              <form onSubmit={handleLogin} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Email</label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="admin@avronhospitals.com"
                      autoComplete="email"
                      className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg
                                 bg-slate-800 border border-slate-700 text-white
                                 placeholder-slate-600 focus:outline-none
                                 focus:ring-2 focus:ring-brand-blue-500 focus:border-transparent
                                 transition-all"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Password</label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className="w-full pl-10 pr-10 py-2.5 text-sm rounded-lg
                                 bg-slate-800 border border-slate-700 text-white
                                 placeholder-slate-600 focus:outline-none
                                 focus:ring-2 focus:ring-brand-blue-500 focus:border-transparent
                                 transition-all"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(s => !s)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500
                                 hover:text-slate-300 transition-colors"
                      tabIndex={-1}
                    >
                      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="text-xs text-brand-red-400 bg-brand-red-900/20
                                  border border-brand-red-800 rounded-lg px-3 py-2 animate-fade-in">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-10 rounded-lg bg-brand-blue-600 hover:bg-brand-blue-700
                             text-white text-sm font-semibold transition-colors
                             flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Spinner size="sm" className="text-white" /> : 'Authenticate & Enter'}
                </button>

                <button
                  type="button"
                  onClick={() => navigate('forgot-password')}
                  className="w-full text-xs text-slate-500 hover:text-brand-blue-400 transition-colors"
                >
                  Reset admin password via OTP
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Back link */}
        <div className="mt-5 text-center">
          <button
            onClick={goBack}
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-400 text-sm transition-colors"
          >
            <ArrowLeft size={14} />
            Back to staff login
          </button>
        </div>
      </div>
    </div>
  );
}
