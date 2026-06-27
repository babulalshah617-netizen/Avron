import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, RefreshCw, Package, MapPin, User, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { formatDate } from '../lib/utils';
import type { Delivery, DeliveryStatus, Profile } from '../types';

const STATUS_CONFIG: Record<DeliveryStatus, { label: string; variant: 'neutral'|'info'|'warning'|'success'|'danger' }> = {
  created:    { label: 'Created',    variant: 'neutral' },
  assigned:   { label: 'Assigned',   variant: 'info' },
  picked_up:  { label: 'Picked Up',  variant: 'info' },
  in_transit: { label: 'In Transit', variant: 'warning' },
  delivered:  { label: 'Delivered',  variant: 'success' },
  failed:     { label: 'Failed',    variant: 'danger' },
};

const STATUS_NEXT: Partial<Record<DeliveryStatus, DeliveryStatus>> = {
  created: 'assigned', assigned: 'picked_up', picked_up: 'in_transit', in_transit: 'delivered',
};

export function DeliveriesPage() {
  const { profile } = useAuth();
  const { addToast } = useNotifications();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [staff, setStaff] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatus] = useState<DeliveryStatus | ''>('');
  const [createOpen, setCreate] = useState(false);
  const [assignOpen, setAssignOpen] = useState<Delivery | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState('');

  const [form, setForm] = useState({
    entity_type: 'General', entity_id: '', title: '', description: '',
    from_location: 'Ground Floor Reception', to_location: '',
  });

  const fetch = useCallback(async () => {
    setLoading(true);
    const [delRes, staffRes] = await Promise.all([
      supabase.from('deliveries').select('*, assigned_profile:profiles!deliveries_assigned_to_fkey(*)').order('created_at', { ascending: false }).limit(100),
      supabase.from('profiles').select('*').in('role', ['staff', 'maintenance_team']).eq('is_active', true),
    ]);
    setDeliveries(delRes.data ?? []);
    setStaff(staffRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const handleCreate = async () => {
    if (!form.title.trim() || !form.to_location.trim()) {
      addToast({ type: 'error', title: 'Required', message: 'Title and destination required.' });
      return;
    }
    setSaving(true);
    await supabase.from('deliveries').insert({
      entity_type: form.entity_type.trim(),
      entity_id: form.entity_id.trim() || null,
      title: form.title.trim(),
      description: form.description.trim() || null,
      from_location: form.from_location.trim(),
      to_location: form.to_location.trim(),
      created_by: profile?.id,
    });
    addToast({ type: 'success', title: 'Delivery created', message: form.title });
    setSaving(false);
    setCreate(false);
    setForm({ entity_type: 'General', entity_id: '', title: '', description: '', from_location: 'Ground Floor Reception', to_location: '' });
    fetch();
  };

  const assignStaff = async () => {
    if (!assignOpen || !selectedStaff) return;
    await supabase.from('deliveries').update({ assigned_to: selectedStaff, status: 'assigned' }).eq('id', assignOpen.id);
    addToast({ type: 'success', title: 'Assigned', message: 'Delivery assigned to staff' });
    setAssignOpen(null);
    setSelectedStaff('');
    fetch();
  };

  const advance = async (d: Delivery) => {
    const next = STATUS_NEXT[d.status];
    if (!next) return;
    const now = new Date().toISOString();
    const updates: Record<string, unknown> = { status: next };
    if (next === 'picked_up') updates.picked_up_at = now;
    if (next === 'in_transit') updates.in_transit_at = now;
    if (next === 'delivered') { updates.delivered_at = now; updates.receiver_name = prompt('Receiver name?') || 'Unknown'; }
    await supabase.from('deliveries').update(updates).eq('id', d.id);
    addToast({ type: 'success', title: 'Updated', message: `${d.delivery_number} → ${STATUS_CONFIG[next].label}` });
    fetch();
  };

  const markFailed = async (d: Delivery) => {
    const reason = prompt('Reason for failed delivery?');
    if (!reason) return;
    await supabase.from('deliveries').update({ status: 'failed', delivery_notes: reason }).eq('id', d.id);
    addToast({ type: 'error', title: 'Marked as Failed', message: d.delivery_number });
    fetch();
  };

  const filtered = deliveries.filter(d => {
    const q = search.toLowerCase();
    return (!q || d.title.toLowerCase().includes(q) || d.delivery_number.toLowerCase().includes(q))
      && (!statusFilter || d.status === statusFilter);
  });

  const stats = {
    total: deliveries.length,
    active: deliveries.filter(d => !['delivered', 'failed'].includes(d.status)).length,
    inTransit: deliveries.filter(d => d.status === 'in_transit').length,
    completed: deliveries.filter(d => d.status === 'delivered').length,
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Deliveries</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {stats.total} total · {stats.active} active · {stats.inTransit} in transit · {stats.completed} completed
          </p>
        </div>
        <button onClick={() => setCreate(true)} className="btn-primary"><Plus size={16} /> New Delivery</button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(stats).map(([k, v]) => (
          <div key={k} className="card p-3 text-center">
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{v}</p>
            <p className="text-xs text-slate-500 capitalize">{k.replace(/([A-Z])/g, ' $1')}</p>
          </div>
        ))}
      </div>

      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search deliveries..." className="input-field pl-9" />
        </div>
        <select value={statusFilter} onChange={e => setStatus(e.target.value as DeliveryStatus | '')} className="input-field sm:w-40">
          <option value="">All Status</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button onClick={fetch} className="btn-secondary flex-shrink-0"><RefreshCw size={15} /></button>
      </div>

      <div className="card overflow-hidden">
        {loading ? <div className="flex justify-center py-10"><Spinner size="lg" /></div> :
         filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400"><Package size={32} className="mx-auto mb-3 opacity-30" /><p className="text-sm">No deliveries</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="table-header">
                <th className="px-4 py-3 text-left">Delivery #</th>
                <th className="px-4 py-3 text-left">Item</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">From</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">To</th>
                <th className="px-4 py-3 text-left hidden sm:table-cell">Assigned</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map(d => {
                  const next = STATUS_NEXT[d.status];
                  return (
                    <tr key={d.id} className="table-row">
                      <td className="table-cell font-mono text-xs text-brand-blue-600 dark:text-brand-blue-400">{d.delivery_number}</td>
                      <td className="table-cell">
                        <p className="text-sm font-medium">{d.title}</p>
                        <p className="text-xs text-slate-500">{d.entity_type}</p>
                      </td>
                      <td className="table-cell hidden md:table-cell text-xs text-slate-500">{d.from_location}</td>
                      <td className="table-cell hidden md:table-cell text-xs text-slate-500">{d.to_location}</td>
                      <td className="table-cell hidden sm:table-cell">
                        {d.assigned_profile ? (
                          <span className="text-xs text-slate-700 dark:text-slate-300">{d.assigned_profile.full_name}</span>
                        ) : <span className="text-xs text-slate-400">—</span>}
                      </td>
                      <td className="table-cell"><Badge variant={STATUS_CONFIG[d.status].variant}>{STATUS_CONFIG[d.status].label}</Badge></td>
                      <td className="table-cell text-right">
                        <div className="flex items-center justify-end gap-2">
                          {d.status === 'created' && (
                            <button onClick={() => setAssignOpen(d)} className="text-xs text-brand-blue-600 hover:underline">Assign</button>
                          )}
                          {next && <button onClick={() => advance(d)} className="text-xs text-emerald-600 hover:underline">→ {STATUS_CONFIG[next].label}</button>}
                          {d.status === 'in_transit' && <button onClick={() => markFailed(d)} className="text-xs text-red-500 hover:underline">Fail</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create modal */}
      <Modal open={createOpen} onClose={() => setCreate(false)} title="New Delivery" size="md"
        footer={<><button onClick={() => setCreate(false)} className="btn-secondary">Cancel</button><button onClick={handleCreate} disabled={saving} className="btn-primary">{saving ? <Spinner size="sm" className="text-white" /> : 'Create'}</button></>}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Entity Type</label>
              <select value={form.entity_type} onChange={e => setForm(p => ({ ...p, entity_type: e.target.value }))} className="input-field">
                <option>General</option><option>Pharmacy</option><option>Lab</option><option>Radiology</option><option>Document</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Entity ID</label>
              <input type="text" value={form.entity_id} onChange={e => setForm(p => ({ ...p, entity_id: e.target.value }))} placeholder="Related ID" className="input-field" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Title *</label>
            <input type="text" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="What is being delivered?" className="input-field" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">From *</label>
              <input type="text" value={form.from_location} onChange={e => setForm(p => ({ ...p, from_location: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">To *</label>
              <input type="text" value={form.to_location} onChange={e => setForm(p => ({ ...p, to_location: e.target.value }))} placeholder="Destination" className="input-field" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} placeholder="Additional details..." className="input-field resize-none" />
          </div>
        </div>
      </Modal>

      {/* Assign modal */}
      <Modal open={!!assignOpen} onClose={() => { setAssignOpen(null); setSelectedStaff(''); }} title="Assign Delivery" size="sm"
        footer={<><button onClick={() => { setAssignOpen(null); setSelectedStaff(''); }} className="btn-secondary">Cancel</button><button onClick={assignStaff} disabled={!selectedStaff} className="btn-primary">Assign</button></>}
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-400">Select a staff member to assign this delivery:</p>
          <select value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)} className="input-field">
            <option value="">Select staff...</option>
            {staff.map(s => <option key={s.id} value={s.id}>{s.full_name} ({s.employee_id})</option>)}
          </select>
        </div>
      </Modal>
    </div>
  );
}
