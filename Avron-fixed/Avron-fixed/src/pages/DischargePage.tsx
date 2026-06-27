import { useState, useEffect, useCallback } from 'react';
import { Plus, CheckCircle2, Clock, Search, RefreshCw, Activity, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { cn, formatDate } from '../lib/utils';
import type { DischargeRequest, DischargeStatus } from '../types';

const STATUS_STEPS: { key: DischargeStatus; label: string; icon: typeof Clock; color: string }[] = [
  { key: 'initiated',        label: 'Nursing Initiated', icon: Activity,     color: 'bg-blue-500' },
  { key: 'pharmacy_cleared', label: 'Pharmacy Cleared',  icon: CheckCircle2, color: 'bg-amber-500' },
  { key: 'billing_cleared',  label: 'Billing Cleared',   icon: CheckCircle2, color: 'bg-violet-500' },
  { key: 'completed',        label: 'Completed',          icon: CheckCircle2, color: 'bg-emerald-500' },
];

const NEXT_STATUS: Record<DischargeStatus, DischargeStatus | null> = {
  initiated:        'pharmacy_cleared',
  pharmacy_cleared: 'billing_cleared',
  billing_cleared:  'completed',
  completed:        null,
};

const NEXT_LABEL: Record<DischargeStatus, string> = {
  initiated:        'Mark Pharmacy Cleared',
  pharmacy_cleared: 'Mark Billing Cleared',
  billing_cleared:  'Complete Discharge',
  completed:        '',
};

const STATUS_VARIANT: Record<DischargeStatus, 'info'|'warning'|'neutral'|'success'> = {
  initiated:        'info',
  pharmacy_cleared: 'warning',
  billing_cleared:  'neutral',
  completed:        'success',
};

export function DischargePage() {
  const { profile } = useAuth();
  const { addToast } = useNotifications();

  const [discharges, setDischarges] = useState<DischargeRequest[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [statusFilter, setStatus] = useState<DischargeStatus | ''>('');
  const [createOpen, setCreate] = useState(false);
  const [detailItem, setDetail] = useState<DischargeRequest | null>(null);
  const [saving, setSaving]     = useState(false);

  const [form, setForm] = useState({
    patient_name: '', patient_uhid: '', diagnosis: '', nursing_notes: '', total_bill: '',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('discharge_requests').select('*')
      .order('created_at', { ascending: false }).limit(100);
    setDischarges(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async () => {
    if (!form.patient_name.trim()) { addToast({ type: 'error', title: 'Required', message: 'Patient name required.' }); return; }
    setSaving(true);
    const { error } = await supabase.from('discharge_requests').insert({
      patient_name: form.patient_name.trim(),
      patient_uhid: form.patient_uhid.trim() || null,
      diagnosis: form.diagnosis.trim() || null,
      nursing_notes: form.nursing_notes.trim() || null,
      total_bill: form.total_bill ? parseFloat(form.total_bill) : 0,
      initiated_by: profile?.id,
    });
    setSaving(false);
    if (!error) {
      addToast({ type: 'success', title: 'Discharge initiated', message: `Discharge for ${form.patient_name} started.` });
      setCreate(false);
      setForm({ patient_name: '', patient_uhid: '', diagnosis: '', nursing_notes: '', total_bill: '' });
    } else {
      addToast({ type: 'error', title: 'Error', message: error.message });
    }
    fetchData();
  };

  const advance = async (dr: DischargeRequest, noteKey?: string, noteValue?: string) => {
    const next = NEXT_STATUS[dr.status];
    if (!next) return;
    const now = new Date().toISOString();
    const updates: Record<string, unknown> = { status: next };
    if (next === 'pharmacy_cleared') { updates.pharmacy_by = profile?.id; updates.pharmacy_cleared_at = now; }
    if (next === 'billing_cleared')  { updates.billing_by  = profile?.id; updates.billing_cleared_at  = now; }
    if (next === 'completed')        { updates.completed_at = now; }
    if (noteKey && noteValue) updates[noteKey] = noteValue;
    await supabase.from('discharge_requests').update(updates).eq('id', dr.id);
    addToast({ type: 'success', title: 'Updated', message: `Discharge → ${STATUS_STEPS.find(s => s.key === next)?.label}` });
    setDetail(null);
    fetchData();
  };

  const filtered = discharges.filter(d => {
    const q = search.toLowerCase();
    const ms = !q || d.patient_name.toLowerCase().includes(q) || (d.patient_uhid ?? '').toLowerCase().includes(q);
    const mst = !statusFilter || d.status === statusFilter;
    return ms && mst;
  });

  const pending  = discharges.filter(d => d.status !== 'completed').length;
  const done     = discharges.filter(d => d.status === 'completed').length;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Discharge Workflow</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {pending} pending · {done} completed
          </p>
        </div>
        <button onClick={() => setCreate(true)} className="btn-primary"><Plus size={16} /> Initiate Discharge</button>
      </div>

      {/* Workflow legend */}
      <div className="card p-4">
        <p className="text-xs text-slate-500 mb-3 font-medium uppercase tracking-wider">Discharge Flow</p>
        <div className="flex items-center gap-2 overflow-x-auto">
          {STATUS_STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={s.key} className="flex items-center gap-2 flex-shrink-0">
                <div className={cn('flex items-center gap-2 px-3 py-2 rounded-xl text-white text-xs font-medium', s.color)}>
                  <Icon size={13} /> {s.label}
                </div>
                {i < STATUS_STEPS.length - 1 && <ArrowRight size={14} className="text-slate-300 flex-shrink-0" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by patient name or UHID..." className="input-field pl-9" />
        </div>
        <select value={statusFilter} onChange={e => setStatus(e.target.value as DischargeStatus | '')} className="input-field sm:w-48">
          <option value="">All Statuses</option>
          {STATUS_STEPS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <button onClick={fetchData} className="btn-secondary flex-shrink-0"><RefreshCw size={15} /></button>
      </div>

      {loading ? <div className="flex justify-center py-12"><Spinner size="lg" /></div> :
       filtered.length === 0 ? (
        <div className="card text-center py-12 text-slate-400">
          <Activity size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No discharge requests found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(dr => {
            const next = NEXT_STATUS[dr.status];
            const step = STATUS_STEPS.findIndex(s => s.key === dr.status) + 1;
            return (
              <div key={dr.id} className="card p-4 hover:shadow-card-md transition-shadow">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{dr.patient_name}</p>
                    {dr.patient_uhid && <p className="text-xs text-slate-500 font-mono">{dr.patient_uhid}</p>}
                  </div>
                  <Badge variant={STATUS_VARIANT[dr.status]}>
                    {STATUS_STEPS.find(s => s.key === dr.status)?.label}
                  </Badge>
                </div>

                {/* Progress */}
                <div className="flex gap-1 mb-3">
                  {STATUS_STEPS.map((s, i) => (
                    <div key={s.key} className={cn('flex-1 h-1.5 rounded-full transition-colors',
                      i < step ? s.color : 'bg-slate-200 dark:bg-slate-700')} />
                  ))}
                </div>

                {dr.diagnosis && (
                  <p className="text-xs text-slate-500 mb-2 line-clamp-1">Dx: {dr.diagnosis}</p>
                )}
                {dr.total_bill > 0 && (
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Bill: ₹{dr.total_bill.toLocaleString('en-IN')}
                  </p>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700">
                  <p className="text-[10px] text-slate-400">{formatDate(dr.created_at)}</p>
                  <div className="flex gap-2">
                    <button onClick={() => setDetail(dr)}
                      className="text-xs text-brand-blue-600 dark:text-brand-blue-400 hover:underline">
                      Details
                    </button>
                    {next && (
                      <button onClick={() => advance(dr)}
                        className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline">
                        {NEXT_LABEL[dr.status]}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      <Modal open={createOpen} onClose={() => setCreate(false)} title="Initiate Patient Discharge" size="md"
        footer={
          <>
            <button onClick={() => setCreate(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleCreate} disabled={saving} className="btn-primary">
              {saving ? <Spinner size="sm" className="text-white" /> : 'Initiate Discharge'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          {[
            { label: 'Patient Name *', key: 'patient_name', placeholder: 'Full name', type: 'text' },
            { label: 'UHID', key: 'patient_uhid', placeholder: 'AVRON-UHID-001', type: 'text' },
            { label: 'Diagnosis', key: 'diagnosis', placeholder: 'Primary diagnosis', type: 'text' },
            { label: 'Total Bill (₹)', key: 'total_bill', placeholder: '0.00', type: 'number' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{f.label}</label>
              <input type={f.type} value={(form as Record<string,string>)[f.key]}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.placeholder} className="input-field" />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nursing Notes</label>
            <textarea value={form.nursing_notes} onChange={e => setForm(p => ({ ...p, nursing_notes: e.target.value }))}
              rows={3} placeholder="Nursing summary and discharge instructions..." className="input-field resize-none" />
          </div>
        </div>
      </Modal>

      {/* Detail modal */}
      <Modal open={!!detailItem} onClose={() => setDetail(null)} title="Discharge Details" size="md"
        footer={
          <>
            <button onClick={() => setDetail(null)} className="btn-secondary">Close</button>
            {detailItem && NEXT_STATUS[detailItem.status] && (
              <button onClick={() => advance(detailItem!)} className="btn-primary">
                {NEXT_LABEL[detailItem!.status]}
              </button>
            )}
          </>
        }
      >
        {detailItem && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['Patient', detailItem.patient_name],
                ['UHID', detailItem.patient_uhid ?? '—'],
                ['Diagnosis', detailItem.diagnosis ?? '—'],
                ['Bill', `₹${(detailItem.total_bill ?? 0).toLocaleString('en-IN')}`],
                ['Initiated', formatDate(detailItem.created_at)],
                ['Pharmacy', formatDate(detailItem.pharmacy_cleared_at)],
                ['Billing', formatDate(detailItem.billing_cleared_at)],
                ['Completed', formatDate(detailItem.completed_at)],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-xs text-slate-500">{k}</p>
                  <p className="font-medium text-slate-800 dark:text-slate-200">{v}</p>
                </div>
              ))}
            </div>
            {detailItem.nursing_notes && (
              <div>
                <p className="text-xs text-slate-500 mb-1">Nursing Notes</p>
                <p className="text-sm bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">{detailItem.nursing_notes}</p>
              </div>
            )}
            {detailItem.pharmacy_notes && (
              <div>
                <p className="text-xs text-slate-500 mb-1">Pharmacy Notes</p>
                <p className="text-sm bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">{detailItem.pharmacy_notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
