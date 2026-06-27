import { Sun, Moon, Shield, Bell, Database, Globe, ChevronRight } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';

export function SettingsPage() {
  const { theme, toggleTheme, isDark } = useTheme();
  const { profile } = useAuth();

  if (!profile || profile.role !== 'super_admin') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500">
        <Shield size={40} className="mb-3 opacity-30" />
        <p className="text-sm font-medium">Access Restricted</p>
        <p className="text-xs mt-1 text-slate-400">System settings are only accessible to Super Administrators.</p>
      </div>
    );
  }

  const sections = [
    {
      title: 'Appearance',
      icon: Sun,
      items: [
        {
          label: 'Color Theme',
          description: 'Toggle between light and dark mode',
          control: (
            <button
              onClick={toggleTheme}
              className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700
                         rounded-lg p-1 transition-colors"
            >
              <div className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                !isDark ? 'bg-white dark:bg-slate-600 text-slate-900 shadow-sm' : 'text-slate-500',
              )}>
                <Sun size={13} /> Light
              </div>
              <div className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                isDark ? 'bg-white/10 text-white' : 'text-slate-500',
              )}>
                <Moon size={13} /> Dark
              </div>
            </button>
          ),
        },
      ],
    },
    {
      title: 'Notifications',
      icon: Bell,
      items: [
        { label: 'In-App Notifications', description: 'Real-time alerts in the dashboard', control: <Toggle defaultOn /> },
        { label: 'Email Notifications', description: 'Send notifications via email', control: <Toggle defaultOn /> },
        { label: 'SMS Alerts', description: 'Critical alerts via SMS (Phase 7)', control: <Toggle disabled /> },
        { label: 'WhatsApp Integration', description: 'Staff notifications via WhatsApp (Phase 7)', control: <Toggle disabled /> },
      ],
    },
    {
      title: 'Security',
      icon: Shield,
      items: [
        { label: 'Two-Factor Authentication', description: 'Require OTP for admin logins', control: <Toggle defaultOn /> },
        { label: 'Session Timeout', description: 'Auto-logout after 8 hours of inactivity', control: <Toggle defaultOn /> },
        { label: 'Audit Logging', description: 'Log all user actions (always enabled)', control: <Toggle defaultOn disabled /> },
        { label: 'IP Whitelisting', description: 'Restrict access by IP address (Phase 8)', control: <Toggle disabled /> },
      ],
    },
    {
      title: 'System',
      icon: Database,
      items: [
        { label: 'Database Backups', description: 'Automated daily backups (Phase 8)', control: <Toggle disabled /> },
        { label: 'Maintenance Mode', description: 'Take the system offline for maintenance', control: <Toggle /> },
        { label: 'API Access', description: 'External API integrations (Phase 8)', control: <Toggle disabled /> },
      ],
    },
    {
      title: 'Hospital Configuration',
      icon: Globe,
      items: [
        { label: 'Hospital Name', description: 'AVRON HOSPITALS', control: <span className="text-xs text-slate-500 font-mono bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">Read-only</span> },
        { label: 'Tagline', description: 'Your Trusted Family Hospital', control: <span className="text-xs text-slate-500 font-mono bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">Read-only</span> },
        { label: 'ERP Phase', description: 'Currently active: Phase 1 — Core & Auth', control: <span className="badge bg-brand-blue-100 text-brand-blue-700 dark:bg-brand-blue-900/30 dark:text-brand-blue-400">Phase 1</span> },
      ],
    },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">System Settings</h1>
      </div>

      {sections.map(section => {
        const Icon = section.icon;
        return (
          <div key={section.title} className="card overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-700
                            bg-slate-50 dark:bg-slate-700/30">
              <div className="h-8 w-8 rounded-lg bg-brand-blue-100 dark:bg-brand-blue-900/30
                              flex items-center justify-center">
                <Icon size={16} className="text-brand-blue-600 dark:text-brand-blue-400" />
              </div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{section.title}</h2>
            </div>
            <div>
              {section.items.map((item, i) => (
                <div
                  key={item.label}
                  className={cn(
                    'flex items-center justify-between px-5 py-4',
                    i < section.items.length - 1 && 'border-b border-slate-100 dark:border-slate-700',
                  )}
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{item.label}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{item.description}</p>
                  </div>
                  {item.control}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Toggle({ defaultOn = false, disabled = false }: { defaultOn?: boolean; disabled?: boolean }) {
  return (
    <label className={cn('relative inline-flex items-center', disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer')}>
      <input type="checkbox" defaultChecked={defaultOn} disabled={disabled} className="sr-only peer" />
      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2
                      peer-focus:ring-brand-blue-500 dark:bg-slate-600 rounded-full peer
                      peer-checked:after:translate-x-full peer-checked:after:border-white
                      after:content-[''] after:absolute after:top-[2px] after:left-[2px]
                      after:bg-white after:border-slate-300 after:border after:rounded-full
                      after:h-4 after:w-4 after:transition-all
                      peer-checked:bg-brand-blue-600" />
    </label>
  );
}
