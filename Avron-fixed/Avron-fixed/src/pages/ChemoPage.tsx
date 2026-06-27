import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, RefreshCw, Syringe, AlertTriangle, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { cn, formatDate } from '../lib/utils';
import { DEPT_STATUS_CONFIG, type ChemoRequest, type DeptReqStatus } from '../types';

const CHEMO_DRUGS = [
  'Cisplatin', 'Carboplatin', 'Paclitaxel', 'Docetaxel', 'Doxorubicin', 'Cyclophosphamide',
  'Fluorouracil (5-FU)', 'Methotrexate', 'Gemcitabine', 'Irinotecan', 'Oxaliplatin',
  'Bevacizumab', 'Rituximab', 'Trastuzumab', 'Other',
];

const STATUS_NEXT: Partial<Record<DeptReqStatus, DeptReqStatus>> = {
  requested: 'approved', approved: 'processing', processing: 'dispensed', dispensed: 'completed',
};
const STATUS_VARIANT: Record<DeptReqStatus, 'neutral'|'info'|'warning'|'success'|'danger'> = {
  requested: 'neutral', approved: 'info', processing: 'warning', dispensed: 'info', delivered: 'neutral', completed: 'success', rejected: 'danger',
};

export function ChemoPage() {
  const { profile } = useAuth();
  const { addToast } = useNotifications();
  const [reqs, setReqs] = useState<ChemoRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatus] = useState<DeptReqStatus | ''>('');
  const [createOpen, setCreate] = useState(false);
  const [detailItem, setDetail] = useState<ChemoRequest | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    patient_name: '', patient_uhid: '', drug_name: 'Cisplatin',
    cycle_number: 1, dose: '', protocol: '', scheduled_date: '', notes: '',
  });

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('chemo_requests').select('*')
      .order('created_at', { ascending: false }).limit(100);
    setReqs(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const handleCreate = async () => {
    if (!form.patient_name.trim()) {
      addToast({ type: 'error', title: 'Required', message: 'Patient name required.' });
      return;
    }
    setSaving(true);
    await supabase.from('chemo_requests').insert({
      patient_name: form.patient_name.trim(),
      patient_uhid: form.patient_uhid.trim() || null,
      drug_name: form.drug_name,
      cycle_number: form.cycle_number,
      dose: form.dose.trim() || null,
      protocol: form.protocol.trim() || null,
      scheduled_date: form.scheduled_date || null,
      notes: form.notes.trim() || null,
      requested_by: profile?.id,
    });
    addToast({ type: 'success', title: 'Chemo request created', message: `${form.drug_name} Cycle ${form.cycle_number}` });
    setSaving(false);
    setCreate(false);
    setForm({ patient_name: '', patient_uhid: '', drug_name: 'Cisplatin', cycle_number: 1, dose: '', protocol: '', scheduled_date: '', notes: '' });
    fetch();
  };

  const advance = async (r: ChemoRequest) => {
    const next = STATUS_NEXT[r.status];
    if (!next) return;
    const now = new Date().toISOString();
    const updates: Record<string, unknown> = { status: next };
    if (next === 'approved') { updates.approved_by = profile?.id; updates.approved_at = now; }
    if (next === 'dispensed') { updates.dispensed_by = profile?.id; updates.dispensed_at = now; }
    await supabase.from('chemo_requests').update(updates).eq('id', r.id);
    addToast({ type: 'success', title: 'Updated', message: `${r.req_number} → ${DEPT_STATUS_CONFIG[next].label}` });
    fetch();
  };

  const reject = async (r: ChemoRequest) => {
    await supabase.from('chemo_requests').update({ status: 'rejected' }).eq('id', r.id);
    addToast({ type: 'warning', title: 'Rejected', message: r.req_number });
    fetch();
  };

  const filtered = reqs.filter(r => {
    const q = search.toLowerCase();
    return (!q || r.patient_name.toLowerCase().includes(q) || r.drug_name.toLowerCase().includes(q) || r.req_number.toLowerCase().includes(q))
      && (!statusFilter || r.status === statusFilter);
  });

  const stats = {
    total: reqs.length,
    pending: reqs.filter(r => r.status === 'requested' || r.status === 'approved').length,
    inProgress: reqs.filter(r => r.status === 'processing' || r.status === 'dispensed').length,
    completed: reqs.filter(r => r.status === 'completed').length,
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Warning Banner */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-start gap-3">
        <AlertTriangle className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" size={20} />
        <div>
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Chemotherapy Safety Notice</p>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">All chemotherapy drugs require MD approval before dispensing. Follow strict PPE protocols and handling guidelines.</p>
        </div>
      </div>

      <div className="page-header">
        <div>
          <h1 className="page-title">Chemotherapy Management</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {stats.total} regimens · {stats.pending} pending · {stats.inProgress} in progress · {stats.completed} completed
          </p>
        </div>
        <button onClick={() => setCreate(true)} className="btn-primary"><Plus size={16} /> Chemo Request</button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(stats).map(([k, v]) => (
          <div key={k} className={cn('card p-3 text-center', k === 'pending' && stats.pending > 0 && 'ring-2 ring-amber-400')}>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{v}</p>
            <p className="text-xs text-slate-500 capitalize">{k.replace(/([A-Z])/g, ' $1')}</p>
          </div>
        ))}
      </div>

      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patient or drug..." className="input-field pl-9" />
        </div>
        <select value={statusFilter} onChange={e => setStatus(e.target.value as DeptReqStatus | '')} className="input-field sm:w-40">
          <option value="">All Status</option>
          {Object.entries(DEPT_STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button onClick={fetch} className="btn-secondary flex-shrink-0"><RefreshCw size={15} /></button>
      </div>

      <div className="card overflow-hidden">
        {loading ? <div className="flex justify-center py-10"><Spinner size="lg" /></div> :
         filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400"><Syringe size={32} className="mx-auto mb-3 opacity-30" /><p className="text-sm">No chemotherapy requests</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="table-header">
                <th className="px-4 py-3 text-left">Req #</th>
                <th className="px-4 py-3 text-left">Patient</th>
                <th className="px-4 py-3 text-left">Drug</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Cycle</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">Scheduled</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map(r => {
                  const next = STATUS_NEXT[r.status];
                  return (
                    <tr key={r.id} className="table-row">
                      <td className="table-cell font-mono text-xs text-brand-blue-600 dark:text-brand-blue-400">{r.req_number}</td>
                      <td className="table-cell"><p className="text-sm font-medium">{r.patient_name}</p>{r.patient_uhid && <p className="text-xs text-slate-500 font-mono">{r.patient_uhid}</p>}</td>
                      <td className="table-cell"><Badge variant="danger">{r.drug_name}</Badge></td>
                      <td className="table-cell hidden md:table-cell text-sm">
                        <span className="font-medium">Cycle {r.cycle_number}</span>
                        {r.dose && <span className="text-xs text-slate-500 ml-1">({r.dose})</span>}
                      </td>
                      <td className="table-cell hidden lg:table-cell text-xs text-slate-500">{formatDate(r.scheduled_date)}</td>
                      <td className="table-cell"><Badge variant={STATUS_VARIANT[r.status]}>{DEPT_STATUS_CONFIG[r.status].label}</Badge></td>
                      <td className="table-cell text-right">
                        <div className="flex items-center justify-end gap-2">
                          {next && <button onClick={() => advance(r)} className="text-xs text-brand-blue-600 hover:underline">→ {DEPT_STATUS_CONFIG[next].label}</button>}
                          {r.status === 'requested' && <button onClick={() => reject(r)} className="text-xs text-red-500 hover:underline">Reject</button>}
                          <button onClick={() => setDetail(r)} className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">Details</button>
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
      <Modal open={createOpen} onClose={() => setCreate(false)} title="New Chemotherapy Request" size="md"
        footer={<><button onClick={() => setCreate(false)} className="btn-secondary">Cancel</button><button onClick={handleCreate} disabled={saving} className="btn-primary">{saving ? <Spinner size="sm" className="text-white" /> : 'Submit'}</button></>}
      >
        <div className="space-y-3">
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-3">
            <p className="text-xs text-amber-800 dark:text-amber-200">
              <AlertTriangle size={12} className="inline mr-1" />
              Ensure all safety protocols are verified before submission.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Patient Name *</label>
            <input type="text" value={form.patient_name} onChange={e => setForm(p => ({ ...p, patient_name: e.target.value }))} placeholder="Full name" className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">UHID</label>
            <input type="text" value={form.patient_uhid} onChange={e => setForm(p => ({ ...p, patient_uhid: e.target.value }))} placeholder="AVRON-UHID-001" className="input-field" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Drug *</label>
              <select value={form.drug_name} onChange={e => setForm(p => ({ ...p, drug_name: e.target.value }))} className="input-field">
                {CHEMO_DRUGS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cycle Number</label>
              <input type="number" min={1} max={24} value={form.cycle_number} onChange={e => setForm(p => ({ ...p, cycle_number: parseInt(e.target.value) || 1 }))} className="input-field" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Dose</label>
              <input type="text" value={form.dose} onChange={e => setForm(p => ({ ...p, dose: e.target.value }))} placeholder="e.g. 75 mg/m2" className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Scheduled Date</label>
              <input type="date" value={form.scheduled_date} onChange={e => setForm(p => ({ ...p, scheduled_date: e.target.value }))} className="input-field" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Protocol</label>
            <input type="text" value={form.protocol} onChange={e => setForm(p => ({ ...p, protocol: e.target.value }))} placeholder="e.g. FOLFOX, ABVD, R-CHOP" className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Patient-specific notes..." className="input-field resize-none" />
          </div>
        </div>
      </Modal>

      {/* Detail modal */}
      <Modal open={!!detailItem} onClose={() => setDetail(null)} title={`Chemo Details — ${detailItem?.req_number}`} size="lg"
        footer={<>
          <button onClick={() => setDetail(null)} className="btn-secondary">Close</button>
          {detailItem && STATUS_NEXT[detailItem.status] && (
            <button onClick={() => { advance(detailItem!); setDetail(null); }} className="btn-primary">
              → {DEPT_STATUS_CONFIG[STATUS_NEXT[detailItem.status]!].label}
            </button>
          )}
        </>}
      >
        {detailItem && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['Patient', detailItem.patient_name],
                ['UHID', detailItem.patient_uhid ?? '—'],
                ['Drug', detailItem.drug_name],
                ['Cycle', `Cycle ${detailItem.cycle_number}`],
                ['Dose', detailItem.dose ?? '—'],
                ['Protocol', detailItem.protocol ?? '—'],
                ['Scheduled', formatDate(detailItem.scheduled_date)],
                ['Status', DEPT_STATUS_CONFIG[detailItem.status].label],
                ['Requested', formatDate(detailItem.created_at)],
                ['Approved', formatDate(detailItem.approved_at)],
                ['Dispensed', formatDate(detailItem.dispensed_at)],
              ].map(([k, v]) => (
                <div key={k}><p className="text-xs text-slate-500">{k}</p><p className="font-medium">{v}</p></div>
              ))}
            </div>
            {detailItem.notes && (
              <div>
                <p className="text-xs text-slate-500 mb-1">Notes</p>
                <p className="text-sm bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">{detailItem.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
