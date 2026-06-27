import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, RefreshCw, Pill, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { cn, formatDate } from '../lib/utils';
import { DEPT_STATUS_CONFIG, type DrugRequest, type DeptReqStatus } from '../types';

const STATUS_NEXT: Partial<Record<DeptReqStatus, DeptReqStatus>> = {
  requested: 'approved', approved: 'processing', processing: 'dispensed', dispensed: 'delivered', delivered: 'completed',
};
const STATUS_VARIANT: Record<DeptReqStatus, 'neutral'|'info'|'warning'|'success'|'danger'> = {
  requested: 'neutral', approved: 'info', processing: 'warning', dispensed: 'info', delivered: 'neutral', completed: 'success', rejected: 'danger',
};

export function PharmacyPage() {
  const { profile } = useAuth();
  const { addToast } = useNotifications();
  const [reqs, setReqs]     = useState<DrugRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<DeptReqStatus | ''>('');
  const [createOpen, setCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    patient_name: '', patient_uhid: '', medication: '', dosage: '',
    frequency: '', quantity: '', instructions: '', is_chemo: false,
  });

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('drug_requests').select('*')
      .order('created_at', { ascending: false }).limit(100);
    setReqs(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const handleCreate = async () => {
    if (!form.patient_name.trim() || !form.medication.trim()) {
      addToast({ type: 'error', title: 'Required', message: 'Patient name and medication required.' });
      return;
    }
    setSaving(true);
    await supabase.from('drug_requests').insert({
      patient_name: form.patient_name.trim(), patient_uhid: form.patient_uhid.trim() || null,
      medication: form.medication.trim(), dosage: form.dosage.trim() || null,
      frequency: form.frequency.trim() || null, quantity: form.quantity.trim() || null,
      instructions: form.instructions.trim() || null, is_chemo: form.is_chemo,
      requested_by: profile?.id,
    });
    addToast({ type: 'success', title: 'Drug request created', message: form.medication });
    setSaving(false);
    setCreate(false);
    setForm({ patient_name: '', patient_uhid: '', medication: '', dosage: '', frequency: '', quantity: '', instructions: '', is_chemo: false });
    fetch();
  };

  const advance = async (r: DrugRequest) => {
    const next = STATUS_NEXT[r.status];
    if (!next) return;
    const updates: Record<string, unknown> = { status: next };
    if (next === 'approved')  { updates.approved_by = profile?.id; updates.approved_at = new Date().toISOString(); }
    if (next === 'dispensed') { updates.dispensed_by = profile?.id; updates.dispensed_at = new Date().toISOString(); }
    await supabase.from('drug_requests').update(updates).eq('id', r.id);
    addToast({ type: 'success', title: 'Updated', message: `${r.medication} → ${DEPT_STATUS_CONFIG[next].label}` });
    fetch();
  };

  const reject = async (r: DrugRequest) => {
    await supabase.from('drug_requests').update({ status: 'rejected' }).eq('id', r.id);
    addToast({ type: 'warning', title: 'Rejected', message: r.req_number });
    fetch();
  };

  const filtered = reqs.filter(r => {
    const q = search.toLowerCase();
    return (!q || r.patient_name.toLowerCase().includes(q) || r.medication.toLowerCase().includes(q) || r.req_number.toLowerCase().includes(q))
      && (!status || r.status === status);
  });

  const stats = { total: reqs.length, pending: reqs.filter(r => r.status === 'requested' || r.status === 'approved').length, dispensed: reqs.filter(r => r.status === 'dispensed' || r.status === 'completed').length };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Pharmacy</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{stats.total} requests · {stats.pending} pending · {stats.dispensed} dispensed</p>
        </div>
        <button onClick={() => setCreate(true)} className="btn-primary"><Plus size={16} /> Drug Request</button>
      </div>

      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patient or medication..." className="input-field pl-9" />
        </div>
        <select value={status} onChange={e => setStatus(e.target.value as DeptReqStatus | '')} className="input-field sm:w-40">
          <option value="">All Status</option>
          {Object.entries(DEPT_STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button onClick={fetch} className="btn-secondary flex-shrink-0"><RefreshCw size={15} /></button>
      </div>

      <div className="card overflow-hidden">
        {loading ? <div className="flex justify-center py-10"><Spinner size="lg" /></div> :
         filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400"><Pill size={32} className="mx-auto mb-3 opacity-30" /><p className="text-sm">No drug requests</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="table-header">
                <th className="px-4 py-3 text-left">Req #</th>
                <th className="px-4 py-3 text-left">Patient</th>
                <th className="px-4 py-3 text-left">Medication</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Dosage / Qty</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">Type</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left hidden sm:table-cell">Date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map(r => {
                  const next = STATUS_NEXT[r.status];
                  return (
                    <tr key={r.id} className="table-row">
                      <td className="table-cell font-mono text-xs text-brand-blue-600 dark:text-brand-blue-400">{r.req_number}</td>
                      <td className="table-cell"><p className="text-sm font-medium text-slate-900 dark:text-slate-100">{r.patient_name}</p>{r.patient_uhid && <p className="text-xs text-slate-500 font-mono">{r.patient_uhid}</p>}</td>
                      <td className="table-cell text-sm font-semibold text-slate-800 dark:text-slate-200">{r.medication}</td>
                      <td className="table-cell hidden md:table-cell text-xs text-slate-500">{[r.dosage, r.frequency, r.quantity].filter(Boolean).join(' · ') || '—'}</td>
                      <td className="table-cell hidden lg:table-cell">
                        {r.is_chemo ? <Badge variant="danger">Chemo</Badge> : <Badge variant="neutral">Standard</Badge>}
                      </td>
                      <td className="table-cell"><Badge variant={STATUS_VARIANT[r.status]}>{DEPT_STATUS_CONFIG[r.status].label}</Badge></td>
                      <td className="table-cell hidden sm:table-cell text-xs text-slate-500">{formatDate(r.created_at)}</td>
                      <td className="table-cell text-right">
                        <div className="flex items-center justify-end gap-2">
                          {next && <button onClick={() => advance(r)} className="text-xs text-brand-blue-600 dark:text-brand-blue-400 hover:underline font-medium">→ {DEPT_STATUS_CONFIG[next].label}</button>}
                          {(r.status === 'requested') && <button onClick={() => reject(r)} className="text-xs text-red-500 hover:underline">Reject</button>}
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

      <Modal open={createOpen} onClose={() => setCreate(false)} title="New Drug Request" size="md"
        footer={<><button onClick={() => setCreate(false)} className="btn-secondary">Cancel</button><button onClick={handleCreate} disabled={saving} className="btn-primary">{saving ? <Spinner size="sm" className="text-white" /> : 'Submit'}</button></>}
      >
        <div className="space-y-3">
          {[
            { label: 'Patient Name *', key: 'patient_name', ph: 'Full name', type: 'text' },
            { label: 'UHID', key: 'patient_uhid', ph: 'AVRON-UHID-001', type: 'text' },
            { label: 'Medication *', key: 'medication', ph: 'Drug name', type: 'text' },
            { label: 'Dosage', key: 'dosage', ph: 'e.g. 500mg', type: 'text' },
            { label: 'Frequency', key: 'frequency', ph: 'e.g. BD, TDS', type: 'text' },
            { label: 'Quantity', key: 'quantity', ph: 'e.g. 30 tabs', type: 'text' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{f.label}</label>
              <input type={f.type} value={(form as Record<string,unknown>)[f.key] as string} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.ph} className="input-field" />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Instructions</label>
            <textarea value={form.instructions} onChange={e => setForm(p => ({ ...p, instructions: e.target.value }))} rows={2} className="input-field resize-none" placeholder="Special instructions..." />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_chemo} onChange={e => setForm(p => ({ ...p, is_chemo: e.target.checked }))} className="rounded" />
            <span className="text-sm text-slate-700 dark:text-slate-300">Chemotherapy Drug</span>
          </label>
        </div>
      </Modal>
    </div>
  );
}
