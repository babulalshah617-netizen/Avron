import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Edit2, UserCheck, UserX, Filter, RefreshCw, Shield } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { cn, formatDate, generateEmployeeId, getInitials } from '../lib/utils';
import { ROLE_LABELS, ROLE_COLORS, type Profile, type Department, type HospitalRole } from '../types';

const ROLES: HospitalRole[] = [
  'super_admin','md','department_head','floor_supervisor',
  'staff','it_team','maintenance_team','biomedical_team',
];

const EMPTY_FORM = {
  full_name: '', email: '', employee_id: '', role: 'staff' as HospitalRole,
  department_id: '', phone: '', password: '',
};

export function UserManagementPage() {
  const { profile: currentUser, hasRole } = useAuth();
  const { addToast } = useNotifications();

  const [users, setUsers]           = useState<Profile[]>([]);
  const [departments, setDepts]     = useState<Department[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [roleFilter, setRoleFilter] = useState<HospitalRole | ''>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [modalOpen, setModalOpen]   = useState(false);
  const [editUser, setEditUser]     = useState<Profile | null>(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [formError, setFormError]   = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const canManage = hasRole('super_admin', 'md');
  const isMD = hasRole('md');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [usersRes, deptsRes] = await Promise.all([
      supabase.from('profiles')
        .select('*, department:departments(id,name,floor)')
        .order('created_at', { ascending: false }),
      supabase.from('departments')
        .select('id,name,floor')
        .eq('is_active', true)
        .order('floor'),
    ]);
    setUsers(usersRes.data ?? []);
    setDepts(deptsRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => {
    setEditUser(null);
    setForm({ ...EMPTY_FORM, employee_id: generateEmployeeId('staff') });
    setFormError(null);
    setShowPassword(false);
    setModalOpen(true);
  };

  const openEdit = (u: Profile) => {
    if (u.role === 'md' && !isMD) {
      addToast({ type: 'error', title: 'Permission Denied', message: 'Only MD can edit MD accounts.' });
      return;
    }
    setEditUser(u);
    setForm({
      full_name: u.full_name,
      email: u.email ?? '',
      employee_id: u.employee_id ?? '',
      role: u.role,
      department_id: u.department_id ?? '',
      phone: u.phone ?? '',
      password: '',
    });
    setFormError(null);
    setShowPassword(false);
    setModalOpen(true);
  };

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSave = async () => {
    if (!form.full_name.trim()) { setFormError('Full name is required.'); return; }
    if (!editUser) {
      if (!form.email.trim()) { setFormError('Email is required.'); return; }
      if (!validateEmail(form.email)) { setFormError('Please enter a valid email address.'); return; }
      if (!form.password) { setFormError('Password is required for new users.'); return; }
      if (form.password.length < 8) { setFormError('Password must be at least 8 characters.'); return; }
      if (!/[A-Z]/.test(form.password)) { setFormError('Password must contain at least one uppercase letter.'); return; }
      if (!/[0-9]/.test(form.password)) { setFormError('Password must contain at least one number.'); return; }
    }
    if (form.role === 'md' && !isMD) {
      setFormError('Only a Medical Director can create another MD account.');
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      if (editUser) {
        const { error } = await supabase.from('profiles').update({
          full_name: form.full_name.trim(),
          employee_id: form.employee_id.trim() || null,
          role: form.role,
          department_id: form.department_id || null,
          phone: form.phone.trim() || null,
        }).eq('id', editUser.id);

        if (error) throw new Error(error.message);

        await supabase.from('audit_logs').insert({
          user_id: currentUser?.id,
          action: 'update',
          entity_type: 'user',
          entity_id: editUser.id,
          details: { name: form.full_name, updated_by: currentUser?.full_name },
        });

        addToast({ type: 'success', title: 'User updated', message: `${form.full_name} updated.` });
      } else {
        const empId = form.employee_id.trim() || generateEmployeeId(form.role);

        // Use Edge Function to create user without replacing the admin's session
        const { data: { session } } = await supabase.auth.getSession();
        const res = await supabase.functions.invoke('create-user', {
          body: {
            email: form.email.trim().toLowerCase(),
            password: form.password,
            full_name: form.full_name.trim(),
            role: form.role,
            employee_id: empId,
            department_id: form.department_id || null,
            phone: form.phone.trim() || null,
          },
          headers: session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {},
        });

        if (res.error) throw new Error(res.error.message ?? 'Failed to create user.');
        const body = res.data as { error?: string; user?: { id: string } };
        if (body?.error) throw new Error(body.error);
        if (!body?.user?.id) throw new Error('Failed to create user account.');

        await supabase.from('audit_logs').insert({
          user_id: currentUser?.id,
          action: 'create',
          entity_type: 'user',
          entity_id: body.user.id,
          details: { name: form.full_name, email: form.email, role: form.role, created_by: currentUser?.full_name },
        });

        addToast({ type: 'success', title: 'User created', message: `${form.full_name} · ID: ${empId}` });
      }

      setModalOpen(false);
      fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save user.';
      setFormError(msg.includes('already registered') ? 'This email is already registered.' : msg);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (u: Profile) => {
    if (u.role === 'md' && !isMD) {
      addToast({ type: 'error', title: 'Permission Denied', message: 'Cannot deactivate MD accounts.' });
      return;
    }
    if (u.id === currentUser?.id) {
      addToast({ type: 'error', title: 'Not Allowed', message: 'You cannot deactivate your own account.' });
      return;
    }
    const next = !u.is_active;
    const { error } = await supabase.from('profiles').update({ is_active: next }).eq('id', u.id);
    if (error) { addToast({ type: 'error', title: 'Error', message: error.message }); return; }
    await supabase.from('audit_logs').insert({
      user_id: currentUser?.id,
      action: 'update',
      entity_type: 'user',
      entity_id: u.id,
      details: { action: next ? 'activated' : 'deactivated', name: u.full_name, by: currentUser?.full_name },
    });
    addToast({ type: next ? 'success' : 'warning', title: next ? 'User activated' : 'User deactivated', message: u.full_name });
    fetchData();
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchSearch = !q || u.full_name.toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q) || (u.employee_id ?? '').toLowerCase().includes(q);
    const matchRole = !roleFilter || u.role === roleFilter;
    const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? u.is_active : !u.is_active);
    return matchSearch && matchRole && matchStatus;
  });

  const stats = { total: users.length, active: users.filter(u => u.is_active).length, inactive: users.filter(u => !u.is_active).length };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {stats.total} staff · {stats.active} active · {stats.inactive} inactive
          </p>
        </div>
        {canManage && (
          <button onClick={openCreate} className="btn-primary"><Plus size={16} /> Add Staff</button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Staff', value: stats.total, color: 'text-brand-blue-600' },
          { label: 'Active', value: stats.active, color: 'text-emerald-600' },
          { label: 'Inactive', value: stats.inactive, color: 'text-slate-500' },
        ].map(s => (
          <div key={s.label} className="card p-4 text-center">
            <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, or employee ID..." className="input-field pl-10" />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={15} className="text-slate-400 flex-shrink-0" />
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value as HospitalRole | '')} className="input-field py-2.5 pr-8 text-sm">
            <option value="">All Roles</option>
            {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)} className="input-field py-2.5 pr-8 text-sm sm:w-36">
          <option value="all">All Status</option>
          <option value="active">Active Only</option>
          <option value="inactive">Inactive Only</option>
        </select>
        <button onClick={fetchData} className="btn-secondary flex-shrink-0" title="Refresh"><RefreshCw size={15} /></button>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <Shield size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No users found</p>
            <p className="text-xs mt-1 text-slate-400">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 text-left">Staff Member</th>
                  <th className="px-4 py-3 text-left hidden md:table-cell">Employee ID</th>
                  <th className="px-4 py-3 text-left">Role</th>
                  <th className="px-4 py-3 text-left hidden lg:table-cell">Department</th>
                  <th className="px-4 py-3 text-left hidden xl:table-cell">Last Login</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  {canManage && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => {
                  const dept = u.department as unknown as Department | undefined;
                  const canEditUser = u.role !== 'md' || isMD;
                  const isSelf = u.id === currentUser?.id;
                  return (
                    <tr key={u.id} className="table-row">
                      <td className="table-cell">
                        <div className="flex items-center gap-3">
                          <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0',
                            u.is_active ? 'bg-brand-blue-600' : 'bg-slate-300 dark:bg-slate-600')}>
                            {getInitials(u.full_name || 'U')}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                              {u.full_name || '—'}
                              {isSelf && <span className="ml-1.5 text-[10px] text-brand-blue-500">(You)</span>}
                            </p>
                            <p className="text-xs text-slate-500">{u.email || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="table-cell hidden md:table-cell">
                        <span className="font-mono text-xs text-slate-600 dark:text-slate-400">{u.employee_id || '—'}</span>
                      </td>
                      <td className="table-cell">
                        <span className={cn('badge', ROLE_COLORS[u.role])}>{ROLE_LABELS[u.role]}</span>
                      </td>
                      <td className="table-cell hidden lg:table-cell text-xs text-slate-600 dark:text-slate-400">
                        {dept?.name ?? '—'}
                      </td>
                      <td className="table-cell hidden xl:table-cell text-xs text-slate-500">
                        {formatDate(u.last_login)}
                      </td>
                      <td className="table-cell text-center">
                        <Badge variant={u.is_active ? 'success' : 'neutral'} dot>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      {canManage && (
                        <td className="table-cell text-right">
                          <div className="flex items-center justify-end gap-1">
                            {canEditUser && (
                              <button onClick={() => openEdit(u)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-brand-blue-600 hover:bg-brand-blue-50 dark:hover:bg-brand-blue-900/20 transition-colors" title="Edit">
                                <Edit2 size={14} />
                              </button>
                            )}
                            {canEditUser && !isSelf && (
                              <button onClick={() => toggleActive(u)}
                                className={cn('p-1.5 rounded-lg transition-colors',
                                  u.is_active ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                                             : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20')}
                                title={u.is_active ? 'Deactivate' : 'Activate'}>
                                {u.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editUser ? `Edit: ${editUser.full_name}` : 'Add New Staff Member'} size="lg"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? <Spinner size="sm" className="text-white" /> : editUser ? 'Save Changes' : 'Create Account'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Full Name *</label>
              <input type="text" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Dr. Jane Smith" className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email Address {!editUser && '*'}</label>
              <input type="email" value={form.email} onChange={e => !editUser && setForm(f => ({ ...f, email: e.target.value }))}
                disabled={!!editUser} placeholder="staff@avronhospitals.com"
                className={cn('input-field', editUser && 'opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-800')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Employee ID</label>
              <input type="text" value={form.employee_id} onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))} placeholder="AVR-ST-12345" className="input-field font-mono" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Role *</label>
              <select value={form.role} onChange={e => {
                const r = e.target.value as HospitalRole;
                setForm(f => ({ ...f, role: r, employee_id: generateEmployeeId(r) }));
              }} className="input-field">
                {ROLES.filter(r => r !== 'md' || isMD).map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Department</label>
              <select value={form.department_id} onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))} className="input-field">
                <option value="">— Select Department —</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name} ({d.floor})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Phone Number</label>
              <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91 98765 43210" className="input-field" />
            </div>
            {!editUser && (
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Password *</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Min. 8 chars with uppercase & number" className="input-field pr-16" />
                  <button type="button" onClick={() => setShowPassword(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 transition-colors">
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Min. 8 characters, 1 uppercase letter, 1 number required</p>
              </div>
            )}
          </div>
          {formError && (
            <div className="text-xs text-brand-red-600 dark:text-brand-red-400 bg-brand-red-50 dark:bg-brand-red-900/20 border border-brand-red-200 dark:border-brand-red-800 rounded-lg px-3 py-2.5">
              {formError}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
