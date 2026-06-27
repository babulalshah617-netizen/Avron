import { useState } from 'react';
import { User, Mail, Phone, Building2, Shield, Clock, Save, Edit2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { cn, formatDate, getInitials } from '../lib/utils';
import { ROLE_LABELS, ROLE_COLORS } from '../types';

export function ProfilePage() {
  const { profile, refreshProfile } = useAuth();
  const { addToast } = useNotifications();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [form, setForm]       = useState({
    full_name: profile?.full_name ?? '',
    phone: profile?.phone ?? '',
  });

  if (!profile) return null;

  const handleSave = async () => {
    if (!form.full_name.trim()) {
      addToast({ type: 'error', title: 'Error', message: 'Full name is required.' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      full_name: form.full_name.trim(),
      phone: form.phone.trim() || null,
    }).eq('id', profile.id);

    if (error) {
      addToast({ type: 'error', title: 'Update failed', message: error.message });
    } else {
      await refreshProfile();
      addToast({ type: 'success', title: 'Profile updated', message: 'Your profile has been saved.' });
      setEditing(false);
    }
    setSaving(false);
  };

  const dept = profile.department as unknown as { name: string; floor: string } | null;

  return (
    <div className="max-w-2xl mx-auto space-y-5 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">My Profile</h1>
        <button
          onClick={() => {
            if (editing) handleSave();
            else { setForm({ full_name: profile.full_name, phone: profile.phone ?? '' }); setEditing(true); }
          }}
          disabled={saving}
          className={cn(editing ? 'btn-primary' : 'btn-secondary')}
        >
          {saving ? <Spinner size="sm" className="text-white" /> :
           editing ? <><Save size={15} /> Save Changes</> :
           <><Edit2 size={15} /> Edit Profile</>}
        </button>
      </div>

      {/* Avatar + summary */}
      <div className="card p-6">
        <div className="flex items-start gap-5">
          <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-brand-blue-500 to-brand-blue-700
                          flex items-center justify-center text-white text-2xl font-bold flex-shrink-0
                          shadow-lg">
            {getInitials(profile.full_name || 'U')}
          </div>
          <div className="flex-1 min-w-0">
            {editing ? (
              <input
                type="text"
                value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                className="input-field text-xl font-bold mb-2"
                placeholder="Your full name"
              />
            ) : (
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                {profile.full_name || 'Unknown User'}
              </h2>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn('badge', ROLE_COLORS[profile.role])}>
                {ROLE_LABELS[profile.role]}
              </span>
              <Badge variant={profile.is_active ? 'success' : 'neutral'} dot>
                {profile.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {profile.employee_id ? `Employee ID: ${profile.employee_id}` : 'No employee ID assigned'}
            </p>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Contact & Assignment</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { icon: Mail, label: 'Email', value: profile.email ?? '—', editable: false },
            {
              icon: Phone, label: 'Phone', value: profile.phone ?? '—', editable: true,
              editContent: (
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+91 98765 43210"
                  className="input-field text-sm"
                />
              ),
            },
            { icon: Building2, label: 'Department', value: dept ? `${dept.name} (${dept.floor})` : '—', editable: false },
            { icon: Shield, label: 'Access Role', value: ROLE_LABELS[profile.role], editable: false },
          ].map(({ icon: Icon, label, value, editable, editContent }) => (
            <div key={label} className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-700
                              flex items-center justify-center flex-shrink-0">
                <Icon size={15} className="text-slate-500 dark:text-slate-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">{label}</p>
                {editing && editable && editContent ? (
                  editContent
                ) : (
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{value}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Timestamps */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Account Activity</h3>
        <div className="space-y-3">
          {[
            { label: 'Account Created', value: formatDate(profile.created_at) },
            { label: 'Last Login', value: formatDate(profile.last_login) },
            { label: 'Profile Last Updated', value: formatDate(profile.updated_at) },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center gap-3">
              <Clock size={14} className="text-slate-400 flex-shrink-0" />
              <span className="text-sm text-slate-600 dark:text-slate-400 flex-1">{label}</span>
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {editing && (
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => setEditing(false)}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? <Spinner size="sm" className="text-white" /> : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  );
}
