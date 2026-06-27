import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Edit2, Building2, MapPin, RefreshCw, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { cn } from '../lib/utils';
import { FLOORS, type Department, type Profile } from '../types';

const FLOOR_COLORS: Record<string, string> = {
  'Basement':     'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  'Ground Floor': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  '1st Floor':    'bg-brand-blue-100 text-brand-blue-700 dark:bg-brand-blue-900/30 dark:text-brand-blue-400',
  '2nd Floor':    'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  '3rd Floor':    'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  '4th Floor':    'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  '5th Floor':    'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  '6th Floor':    'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  '7th Floor':    'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  '8th Floor':    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  'Terrace':      'bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-400',
};

const EMPTY_FORM = {
  name: '', floor: 'Ground Floor', description: '', head_id: '', is_active: true,
};

export function DepartmentManagementPage() {
  const { profile: currentUser, hasRole } = useAuth();
  const { addToast } = useNotifications();

  const [depts, setDepts]           = useState<Department[]>([]);
  const [profiles, setProfiles]     = useState<Profile[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [floorFilter, setFloorFilter] = useState('');
  const [modalOpen, setModalOpen]   = useState(false);
  const [editDept, setEditDept]     = useState<Department | null>(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [formError, setFormError]   = useState<string | null>(null);
  const [view, setView]             = useState<'grid' | 'list'>('grid');

  const canManage = hasRole('super_admin', 'md');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [deptsRes, profilesRes] = await Promise.all([
      supabase.from('departments')
        .select('*, head:profiles!head_id(id,full_name,role)')
        .order('floor').order('name'),
      supabase.from('profiles')
        .select('id,full_name,role,is_active')
        .eq('is_active', true)
        .in('role', ['department_head', 'md', 'super_admin'])
        .order('full_name'),
    ]);
    setDepts(deptsRes.data ?? []);
    setProfiles(profilesRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => {
    setEditDept(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (d: Department) => {
    setEditDept(d);
    setForm({
      name: d.name,
      floor: d.floor,
      description: d.description ?? '',
      head_id: d.head_id ?? '',
      is_active: d.is_active,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setFormError('Department name is required.'); return; }
    if (!form.floor) { setFormError('Floor is required.'); return; }

    setSaving(true);
    setFormError(null);

    try {
      const payload = {
        name: form.name.trim(),
        floor: form.floor,
        description: form.description.trim() || null,
        head_id: form.head_id || null,
        is_active: form.is_active,
      };

      if (editDept) {
        const { error } = await supabase.from('departments').update(payload).eq('id', editDept.id);
        if (error) throw error;
        await supabase.from('audit_logs').insert({
          user_id: currentUser?.id,
          action: 'update',
          entity_type: 'department',
          entity_id: editDept.id,
          details: { name: form.name },
        });
        addToast({ type: 'success', title: 'Department updated', message: `${form.name} has been updated.` });
      } else {
        const { data, error } = await supabase.from('departments').insert(payload).select().maybeSingle();
        if (error) throw error;
        if (data) {
          await supabase.from('audit_logs').insert({
            user_id: currentUser?.id,
            action: 'create',
            entity_type: 'department',
            entity_id: data.id,
            details: { name: form.name, floor: form.floor },
          });
        }
        addToast({ type: 'success', title: 'Department created', message: `${form.name} has been added.` });
      }

      setModalOpen(false);
      fetchData();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to save department.');
    } finally {
      setSaving(false);
    }
  };

  const filtered = depts.filter(d => {
    const q = search.toLowerCase();
    const matchSearch = !q || d.name.toLowerCase().includes(q) || d.floor.toLowerCase().includes(q);
    const matchFloor = !floorFilter || d.floor === floorFilter;
    return matchSearch && matchFloor;
  });

  const grouped = FLOORS.reduce<Record<string, Department[]>>((acc, floor) => {
    const items = filtered.filter(d => d.floor === floor);
    if (items.length > 0) acc[floor] = items;
    return acc;
  }, {});

  const floorColorClass = (floor: string) =>
    FLOOR_COLORS[floor] ?? 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300';

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Department Management</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {depts.length} departments · {depts.filter(d => d.is_active).length} operational
          </p>
        </div>
        {canManage && (
          <button onClick={openCreate} className="btn-primary">
            <Plus size={16} /> Add Department
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search departments..."
            className="input-field pl-10"
          />
        </div>
        <select
          value={floorFilter}
          onChange={e => setFloorFilter(e.target.value)}
          className="input-field sm:w-48"
        >
          <option value="">All Floors</option>
          {FLOORS.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
          {(['grid', 'list'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize',
                view === v
                  ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400',
              )}
            >
              {v}
            </button>
          ))}
        </div>
        <button onClick={fetchData} className="btn-secondary flex-shrink-0">
          <RefreshCw size={15} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16 text-slate-500">
          <Building2 size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No departments found</p>
        </div>
      ) : view === 'grid' ? (
        /* Grid view – grouped by floor */
        <div className="space-y-6">
          {Object.entries(grouped).map(([floor, items]) => (
            <div key={floor}>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-slate-400" />
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{floor}</h3>
                </div>
                <div className="flex-1 border-t border-slate-200 dark:border-slate-700" />
                <span className="text-xs text-slate-400">{items.length} dept{items.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {items.map(d => (
                  <div
                    key={d.id}
                    className={cn(
                      'card p-4 hover:shadow-card-md transition-all duration-200 group',
                      !d.is_active && 'opacity-60',
                    )}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className={cn('badge', floorColorClass(d.floor))}>
                        <MapPin size={10} /> {d.floor}
                      </div>
                      {canManage && (
                        <button
                          onClick={() => openEdit(d)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg
                                     text-slate-400 hover:text-brand-blue-600 hover:bg-brand-blue-50
                                     dark:hover:bg-brand-blue-900/20 transition-all"
                        >
                          <Edit2 size={13} />
                        </button>
                      )}
                    </div>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                      {d.name}
                    </h4>
                    {d.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-2 line-clamp-2">
                        {d.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Users size={11} />
                        <span className="truncate">
                          {(d.head as unknown as Profile)?.full_name
                            ? `Head: ${(d.head as unknown as Profile).full_name}`
                            : 'No head assigned'}
                        </span>
                      </div>
                      <Badge variant={d.is_active ? 'success' : 'neutral'} dot>
                        {d.is_active ? 'Active' : 'Off'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List view */
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 text-left">Department</th>
                  <th className="px-4 py-3 text-left">Floor</th>
                  <th className="px-4 py-3 text-left hidden md:table-cell">Head</th>
                  <th className="px-4 py-3 text-left hidden lg:table-cell">Description</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  {canManage && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(d => (
                  <tr key={d.id} className="table-row">
                    <td className="table-cell">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-brand-blue-100 dark:bg-brand-blue-900/30
                                        flex items-center justify-center flex-shrink-0">
                          <Building2 size={15} className="text-brand-blue-600 dark:text-brand-blue-400" />
                        </div>
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{d.name}</span>
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className={cn('badge', floorColorClass(d.floor))}>{d.floor}</span>
                    </td>
                    <td className="table-cell hidden md:table-cell text-xs text-slate-600 dark:text-slate-400">
                      {(d.head as unknown as Profile)?.full_name ?? '—'}
                    </td>
                    <td className="table-cell hidden lg:table-cell text-xs text-slate-500 max-w-xs truncate">
                      {d.description ?? '—'}
                    </td>
                    <td className="table-cell text-center">
                      <Badge variant={d.is_active ? 'success' : 'neutral'} dot>
                        {d.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    {canManage && (
                      <td className="table-cell text-right">
                        <button
                          onClick={() => openEdit(d)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-brand-blue-600
                                     hover:bg-brand-blue-50 dark:hover:bg-brand-blue-900/20 transition-colors"
                        >
                          <Edit2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editDept ? 'Edit Department' : 'Add New Department'}
        size="md"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? <Spinner size="sm" className="text-white" /> : editDept ? 'Update' : 'Create Department'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Department Name *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Cardiology"
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Floor *
            </label>
            <select
              value={form.floor}
              onChange={e => setForm(f => ({ ...f, floor: e.target.value }))}
              className="input-field"
            >
              {FLOORS.map(floor => <option key={floor} value={floor}>{floor}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Department Head
            </label>
            <select
              value={form.head_id}
              onChange={e => setForm(f => ({ ...f, head_id: e.target.value }))}
              className="input-field"
            >
              <option value="">— Select Head —</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Brief description of this department..."
              rows={3}
              className="input-field resize-none"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2
                              peer-focus:ring-brand-blue-500 dark:bg-slate-600 rounded-full peer
                              peer-checked:after:translate-x-full peer-checked:after:border-white
                              after:content-[''] after:absolute after:top-[2px] after:left-[2px]
                              after:bg-white after:border-slate-300 after:border after:rounded-full
                              after:h-4 after:w-4 after:transition-all
                              peer-checked:bg-brand-blue-600" />
            </label>
            <span className="text-sm text-slate-700 dark:text-slate-300">Active / Operational</span>
          </div>
          {formError && (
            <div className="text-xs text-brand-red-600 dark:text-brand-red-400 bg-brand-red-50
                            dark:bg-brand-red-900/20 border border-brand-red-200 dark:border-brand-red-800
                            rounded-lg px-3 py-2">
              {formError}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
