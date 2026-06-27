import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Filter, RefreshCw, ArrowRight, ClipboardList, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { cn, formatDate } from '../lib/utils';
import {
  WORKFLOW_STATUS_CONFIG,
  type Requisition, type RequisitionItem, type Department,
  type WorkflowStatus, type RequisitionType,
} from '../types';

const REQ_TYPES: { value: RequisitionType; label: string }[] = [
  { value: 'ot_medication', label: 'OT Medication Kit' },
  { value: 'chemo_drug',    label: 'Day Care Chemo Drug' },
  { value: 'lab',           label: 'Lab Requisition' },
  { value: 'radiology',     label: 'Radiology Requisition' },
  { value: 'bed_transfer',  label: 'Bed Transfer Request' },
  { value: 'bed_change',    label: 'Bed Change Request' },
  { value: 'general',       label: 'General Requisition' },
];

const STATUS_FLOW: Record<WorkflowStatus, WorkflowStatus | null> = {
  created:    'approved',
  approved:   'processing',
  processing: 'delivered',
  delivered:  'completed',
  completed:  null,
  rejected:   null,
};

const PRIORITY_OPTIONS = [
  { value: 'routine', label: 'Routine', color: 'bg-slate-100 text-slate-600' },
  { value: 'urgent',  label: 'Urgent',  color: 'bg-amber-100 text-amber-700' },
  { value: 'emergency', label: 'Emergency', color: 'bg-red-100 text-red-700' },
];

export function RequisitionsPage() {
  const { profile } = useAuth();
  const { addToast } = useNotifications();

  const [reqs, setReqs]       = useState<Requisition[]>([]);
  const [depts, setDepts]     = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [typeFilter, setType] = useState<RequisitionType | ''>('');
  const [statusFilter, setStatus] = useState<WorkflowStatus | ''>('');
  const [createOpen, setCreate] = useState(false);
  const [detailReq, setDetail] = useState<Requisition | null>(null);
  const [saving, setSaving]   = useState(false);

  const [form, setForm] = useState({
    type: 'general' as RequisitionType,
    priority: 'routine' as 'routine' | 'urgent' | 'emergency',
    patient_name: '', patient_uhid: '', department_id: '',
    scheduled_for: '', notes: '',
    items: [{ item_name: '', quantity: '1', unit: 'pcs' }],
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [reqsRes, deptsRes] = await Promise.all([
      supabase.from('requisitions').select('*, department:departments(id,name,floor)')
        .order('created_at', { ascending: false }).limit(100),
      supabase.from('departments').select('id,name').eq('is_active', true).order('name'),
    ]);
    setReqs(reqsRes.data ?? []);
    setDepts(deptsRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async () => {
    if (!form.items[0]?.item_name.trim()) {
      addToast({ type: 'error', title: 'Error', message: 'At least one item is required.' });
      return;
    }
    setSaving(true);
    const { data: req, error } = await supabase.from('requisitions').insert({
      type: form.type, priority: form.priority,
      patient_name: form.patient_name.trim() || null,
      patient_uhid: form.patient_uhid.trim() || null,
      department_id: form.department_id || null,
      scheduled_for: form.scheduled_for || null,
      notes: form.notes.trim() || null,
      requested_by: profile?.id,
    }).select().maybeSingle();

    if (req && !error) {
      const validItems = form.items.filter(i => i.item_name.trim());
      await supabase.from('requisition_items').insert(
        validItems.map(i => ({
          requisition_id: req.id,
          item_name: i.item_name.trim(),
          quantity: parseFloat(i.quantity) || 1,
          unit: i.unit || 'pcs',
        }))
      );
      await supabase.from('audit_logs').insert({
        user_id: profile?.id, action: 'create', entity_type: 'requisition', entity_id: req.id,
        details: { type: form.type, number: req.req_number },
      });
      addToast({ type: 'success', title: 'Requisition created', message: req.req_number });
      setCreate(false);
      setForm({ type: 'general', priority: 'routine', patient_name: '', patient_uhid: '', department_id: '', scheduled_for: '', notes: '', items: [{ item_name: '', quantity: '1', unit: 'pcs' }] });
    } else {
      addToast({ type: 'error', title: 'Error', message: error?.message ?? 'Failed to create.' });
    }
    setSaving(false);
    fetchData();
  };

  const advanceStatus = async (req: Requisition) => {
    const next = STATUS_FLOW[req.status];
    if (!next) return;
    const updates: Record<string, unknown> = { status: next };
    if (next === 'approved')   { updates.approved_by = profile?.id; updates.approved_at = new Date().toISOString(); }
    if (next === 'processing') { updates.processed_by = profile?.id; updates.processed_at = new Date().toISOString(); }
    if (next === 'delivered')  { updates.delivered_by = profile?.id; updates.delivered_at = new Date().toISOString(); }
    if (next === 'completed')  { updates.completed_at = new Date().toISOString(); }
    await supabase.from('requisitions').update(updates).eq('id', req.id);
    addToast({ type: 'success', title: 'Status updated', message: `${req.req_number} → ${WORKFLOW_STATUS_CONFIG[next].label}` });
    fetchData();
  };

  const rejectReq = async (req: Requisition) => {
    await supabase.from('requisitions').update({ status: 'rejected' }).eq('id', req.id);
    addToast({ type: 'warning', title: 'Rejected', message: req.req_number });
    fetchData();
  };

  const openDetail = async (req: Requisition) => {
    const { data: items } = await supabase.from('requisition_items').select('*').eq('requisition_id', req.id);
    setDetail({ ...req, items: items ?? [] });
  };

  const filtered = reqs.filter(r => {
    const q = search.toLowerCase();
    const ms = !q || r.req_number.toLowerCase().includes(q) || (r.patient_name ?? '').toLowerCase().includes(q);
    const mt = !typeFilter || r.type === typeFilter;
    const mst = !statusFilter || r.status === statusFilter;
    return ms && mt && mst;
  });

  const statusVariant = (s: WorkflowStatus) => {
    if (s === 'completed') return 'success';
    if (s === 'rejected')  return 'danger';
    if (s === 'delivered') return 'info';
    if (s === 'processing') return 'warning';
    return 'neutral';
  };

  const priorityColor = (p: string) => {
    if (p === 'emergency') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    if (p === 'urgent') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    return 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400';
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Requisition System</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {reqs.length} total · {reqs.filter(r => r.status === 'created' || r.status === 'approved').length} pending
          </p>
        </div>
        <button onClick={() => setCreate(true)} className="btn-primary"><Plus size={16} /> New Requisition</button>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by number or patient..." className="input-field pl-9" />
        </div>
        <select value={typeFilter} onChange={e => setType(e.target.value as RequisitionType | '')} className="input-field sm:w-44">
          <option value="">All Types</option>
          {REQ_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatus(e.target.value as WorkflowStatus | '')} className="input-field sm:w-40">
          <option value="">All Status</option>
          {Object.entries(WORKFLOW_STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button onClick={fetchData} className="btn-secondary flex-shrink-0"><RefreshCw size={15} /></button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? <div className="flex justify-center py-12"><Spinner size="lg" /></div> :
         filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <ClipboardList size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No requisitions found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 text-left">Req #</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left hidden md:table-cell">Patient</th>
                  <th className="px-4 py-3 text-left hidden sm:table-cell">Priority</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left hidden lg:table-cell">Created</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(req => {
                  const next = STATUS_FLOW[req.status];
                  const nextLabel = next ? WORKFLOW_STATUS_CONFIG[next]?.label : null;
                  const typeLabel = REQ_TYPES.find(t => t.value === req.type)?.label ?? req.type;
                  return (
                    <tr key={req.id} className="table-row">
                      <td className="table-cell font-mono text-xs text-brand-blue-600 dark:text-brand-blue-400">
                        <button onClick={() => openDetail(req)} className="hover:underline">{req.req_number}</button>
                      </td>
                      <td className="table-cell text-xs text-slate-700 dark:text-slate-300">{typeLabel}</td>
                      <td className="table-cell hidden md:table-cell text-xs">{req.patient_name ?? '—'}</td>
                      <td className="table-cell hidden sm:table-cell">
                        <span className={cn('badge text-[10px]', priorityColor(req.priority))}>
                          {req.priority}
                        </span>
                      </td>
                      <td className="table-cell">
                        <Badge variant={statusVariant(req.status)}>
                          {WORKFLOW_STATUS_CONFIG[req.status]?.label}
                        </Badge>
                      </td>
                      <td className="table-cell hidden lg:table-cell text-xs text-slate-500">
                        {formatDate(req.created_at)}
                      </td>
                      <td className="table-cell text-right">
                        <div className="flex items-center justify-end gap-1">
                          {nextLabel && (
                            <button
                              onClick={() => advanceStatus(req)}
                              className="flex items-center gap-1 text-[11px] font-medium
                                         text-brand-blue-600 dark:text-brand-blue-400 hover:underline"
                            >
                              → {nextLabel}
                            </button>
                          )}
                          {(req.status === 'created' || req.status === 'approved') && (
                            <button onClick={() => rejectReq(req)}
                              className="text-[11px] text-brand-red-500 hover:underline ml-2">
                              Reject
                            </button>
                          )}
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
      <Modal open={createOpen} onClose={() => setCreate(false)} title="New Requisition" size="lg"
        footer={
          <>
            <button onClick={() => setCreate(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleCreate} disabled={saving} className="btn-primary">
              {saving ? <Spinner size="sm" className="text-white" /> : 'Submit Requisition'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Type *</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as RequisitionType }))} className="input-field">
                {REQ_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Priority</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as typeof form.priority }))} className="input-field">
                {PRIORITY_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Patient Name</label>
              <input type="text" value={form.patient_name} onChange={e => setForm(f => ({ ...f, patient_name: e.target.value }))} placeholder="Patient name" className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">UHID</label>
              <input type="text" value={form.patient_uhid} onChange={e => setForm(f => ({ ...f, patient_uhid: e.target.value }))} placeholder="Patient UHID" className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Department</label>
              <select value={form.department_id} onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))} className="input-field">
                <option value="">— Select —</option>
                {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Scheduled For</label>
              <input type="datetime-local" value={form.scheduled_for} onChange={e => setForm(f => ({ ...f, scheduled_for: e.target.value }))} className="input-field" />
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Items *</label>
              <button type="button" onClick={() => setForm(f => ({ ...f, items: [...f.items, { item_name: '', quantity: '1', unit: 'pcs' }] }))}
                className="text-xs text-brand-blue-600 dark:text-brand-blue-400 hover:underline">
                + Add item
              </button>
            </div>
            <div className="space-y-2">
              {form.items.map((item, i) => (
                <div key={i} className="flex gap-2">
                  <input type="text" value={item.item_name} onChange={e => { const items = [...form.items]; items[i].item_name = e.target.value; setForm(f => ({ ...f, items })); }}
                    placeholder="Item name" className="input-field flex-1" />
                  <input type="number" value={item.quantity} onChange={e => { const items = [...form.items]; items[i].quantity = e.target.value; setForm(f => ({ ...f, items })); }}
                    placeholder="Qty" className="input-field w-16" />
                  <input type="text" value={item.unit} onChange={e => { const items = [...form.items]; items[i].unit = e.target.value; setForm(f => ({ ...f, items })); }}
                    placeholder="Unit" className="input-field w-16" />
                  {form.items.length > 1 && (
                    <button onClick={() => setForm(f => ({ ...f, items: f.items.filter((_, j) => j !== i) }))}
                      className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2} placeholder="Additional notes..." className="input-field resize-none" />
          </div>
        </div>
      </Modal>

      {/* Detail modal */}
      <Modal open={!!detailReq} onClose={() => setDetail(null)} title={`Requisition — ${detailReq?.req_number}`} size="lg"
        footer={<button onClick={() => setDetail(null)} className="btn-secondary">Close</button>}
      >
        {detailReq && (
          <div className="space-y-4">
            {/* Workflow steps */}
            <div className="flex items-center gap-1 overflow-x-auto">
              {(['created','approved','processing','delivered','completed'] as WorkflowStatus[]).map((s, i) => {
                const cfg = WORKFLOW_STATUS_CONFIG[s];
                const isCurrent = detailReq.status === s;
                const isDone = cfg.step < (WORKFLOW_STATUS_CONFIG[detailReq.status]?.step ?? 0);
                return (
                  <div key={s} className="flex items-center gap-1 flex-shrink-0">
                    <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium',
                      isCurrent ? 'bg-brand-blue-600 text-white' :
                      isDone ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30' :
                      'bg-slate-100 text-slate-400 dark:bg-slate-700')}>
                      {cfg.label}
                    </div>
                    {i < 4 && <ArrowRight size={12} className="text-slate-300" />}
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['Type', REQ_TYPES.find(t => t.value === detailReq.type)?.label ?? detailReq.type],
                ['Priority', detailReq.priority],
                ['Patient', detailReq.patient_name ?? '—'],
                ['UHID', detailReq.patient_uhid ?? '—'],
                ['Scheduled', formatDate(detailReq.scheduled_for)],
                ['Created', formatDate(detailReq.created_at)],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-xs text-slate-500">{k}</p>
                  <p className="font-medium text-slate-800 dark:text-slate-200">{v}</p>
                </div>
              ))}
            </div>

            {detailReq.items && detailReq.items.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Items</p>
                <div className="space-y-1.5">
                  {detailReq.items.map(item => (
                    <div key={item.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-700/50 rounded-lg px-3 py-2">
                      <span className="text-sm text-slate-700 dark:text-slate-300">{item.item_name}</span>
                      <span className="text-xs text-slate-500">{item.quantity} {item.unit}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detailReq.notes && (
              <div>
                <p className="text-xs text-slate-500 mb-1">Notes</p>
                <p className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/50 rounded-lg px-3 py-2">
                  {detailReq.notes}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
