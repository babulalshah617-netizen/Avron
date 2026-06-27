import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, RefreshCw, FlaskConical, FileText, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { cn, formatDate } from '../lib/utils';
import type { LabRequest, LabStatus } from '../types';

const SAMPLE_TYPES = ['Blood', 'Urine', 'Swab', 'Tissue', 'Sputum', 'CSF', 'Stool', 'Other'];
const TEST_PANELS = ['CBC', 'LFT', 'KFT', 'Lipid Profile', 'Thyroid Panel', 'HbA1c', 'Blood Culture', 'Urine Culture', 'COVID RT-PCR', 'Histopathology', 'Other'];

const STATUS_CONFIG: Record<LabStatus, { label: string; color: string; variant: 'neutral'|'info'|'warning'|'success' }> = {
  sample_pending:   { label: 'Sample Pending',   color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400', variant: 'neutral' },
  sample_collected: { label: 'Sample Collected', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',    variant: 'info' },
  processing:       { label: 'Processing',       color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', variant: 'warning' },
  report_ready:     { label: 'Report Ready',     color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',   variant: 'info' },
  delivered:        { label: 'Delivered',        color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', variant: 'success' },
};

const STATUS_NEXT: Partial<Record<LabStatus, LabStatus>> = {
  sample_pending: 'sample_collected',
  sample_collected: 'processing',
  processing: 'report_ready',
  report_ready: 'delivered',
};

export function LabPage() {
  const { profile } = useAuth();
  const { addToast } = useNotifications();
  const [reqs, setReqs] = useState<LabRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatus] = useState<LabStatus | ''>('');
  const [createOpen, setCreate] = useState(false);
  const [detailItem, setDetail] = useState<LabRequest | null>(null);
  const [saving, setSaving] = useState(false);
  const [reportText, setReportText] = useState('');
  const [reportUrl, setReportUrl] = useState('');

  const [form, setForm] = useState({
    patient_name: '', patient_uhid: '', test_panel: 'CBC',
    test_details: '', sample_type: 'Blood', notes: '',
  });

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('lab_requests').select('*')
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
    await supabase.from('lab_requests').insert({
      patient_name: form.patient_name.trim(),
      patient_uhid: form.patient_uhid.trim() || null,
      test_panel: form.test_panel,
      test_details: form.test_details.trim() || null,
      sample_type: form.sample_type,
      notes: form.notes.trim() || null,
      requested_by: profile?.id,
    });
    addToast({ type: 'success', title: 'Lab request created', message: form.test_panel });
    setSaving(false);
    setCreate(false);
    setForm({ patient_name: '', patient_uhid: '', test_panel: 'CBC', test_details: '', sample_type: 'Blood', notes: '' });
    fetch();
  };

  const advance = async (r: LabRequest) => {
    const next = STATUS_NEXT[r.status];
    if (!next) return;
    const now = new Date().toISOString();
    const updates: Record<string, unknown> = { status: next };
    if (next === 'sample_collected') { updates.collected_by = profile?.id; updates.collected_at = now; }
    if (next === 'processing') { updates.processed_by = profile?.id; updates.processed_at = now; }
    if (next === 'report_ready') { updates.report_ready_at = now; }
    await supabase.from('lab_requests').update(updates).eq('id', r.id);
    addToast({ type: 'success', title: 'Updated', message: `${r.req_number} → ${STATUS_CONFIG[next].label}` });
    fetch();
  };

  const saveReport = async () => {
    if (!detailItem) return;
    await supabase.from('lab_requests').update({
      report_text: reportText,
      report_url: reportUrl.trim() || null,
      status: 'report_ready',
      report_ready_at: new Date().toISOString(),
    }).eq('id', detailItem.id);
    addToast({ type: 'success', title: 'Report saved', message: detailItem.req_number });
    setDetail(null);
    setReportText('');
    setReportUrl('');
    fetch();
  };

  const filtered = reqs.filter(r => {
    const q = search.toLowerCase();
    return (!q || r.patient_name.toLowerCase().includes(q) || r.req_number.toLowerCase().includes(q))
      && (!statusFilter || r.status === statusFilter);
  });

  const stats = {
    total: reqs.length,
    pending: reqs.filter(r => r.status === 'sample_pending' || r.status === 'sample_collected').length,
    processing: reqs.filter(r => r.status === 'processing').length,
    ready: reqs.filter(r => r.status === 'report_ready').length,
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Laboratory</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {stats.total} tests · {stats.pending} pending · {stats.processing} processing · {stats.ready} ready
          </p>
        </div>
        <button onClick={() => setCreate(true)} className="btn-primary"><Plus size={16} /> Lab Request</button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(stats).map(([k, v]) => (
          <div key={k} className="card p-3 text-center">
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{v}</p>
            <p className="text-xs text-slate-500 capitalize">{k.replace('_', ' ')}</p>
          </div>
        ))}
      </div>

      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patient or request..." className="input-field pl-9" />
        </div>
        <select value={statusFilter} onChange={e => setStatus(e.target.value as LabStatus | '')} className="input-field sm:w-44">
          <option value="">All Status</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button onClick={fetch} className="btn-secondary flex-shrink-0"><RefreshCw size={15} /></button>
      </div>

      <div className="card overflow-hidden">
        {loading ? <div className="flex justify-center py-10"><Spinner size="lg" /></div> :
         filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400"><FlaskConical size={32} className="mx-auto mb-3 opacity-30" /><p className="text-sm">No lab requests</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="table-header">
                <th className="px-4 py-3 text-left">Req #</th>
                <th className="px-4 py-3 text-left">Patient</th>
                <th className="px-4 py-3 text-left">Test Panel</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Sample</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">Sample ID</th>
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
                      <td className="table-cell"><Badge variant="info">{r.test_panel}</Badge></td>
                      <td className="table-cell hidden md:table-cell text-xs text-slate-500">{r.sample_type}</td>
                      <td className="table-cell hidden lg:table-cell text-xs text-slate-500 font-mono">{r.sample_id ?? '—'}</td>
                      <td className="table-cell"><Badge variant={STATUS_CONFIG[r.status].variant}>{STATUS_CONFIG[r.status].label}</Badge></td>
                      <td className="table-cell text-right">
                        <div className="flex items-center justify-end gap-2">
                          {next && <button onClick={() => advance(r)} className="text-xs text-brand-blue-600 hover:underline">→ {STATUS_CONFIG[next].label}</button>}
                          <button onClick={() => { setDetail(r); setReportText(r.report_text ?? ''); setReportUrl(r.report_url ?? ''); }} className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">Report</button>
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
      <Modal open={createOpen} onClose={() => setCreate(false)} title="New Lab Request" size="md"
        footer={<><button onClick={() => setCreate(false)} className="btn-secondary">Cancel</button><button onClick={handleCreate} disabled={saving} className="btn-primary">{saving ? <Spinner size="sm" className="text-white" /> : 'Submit'}</button></>}
      >
        <div className="space-y-3">
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
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Test Panel *</label>
              <select value={form.test_panel} onChange={e => setForm(p => ({ ...p, test_panel: e.target.value }))} className="input-field">
                {TEST_PANELS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Sample Type *</label>
              <select value={form.sample_type} onChange={e => setForm(p => ({ ...p, sample_type: e.target.value }))} className="input-field">
                {SAMPLE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Test Details</label>
            <input type="text" value={form.test_details} onChange={e => setForm(p => ({ ...p, test_details: e.target.value }))} placeholder="Specific tests if any" className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Clinical notes..." className="input-field resize-none" />
          </div>
        </div>
      </Modal>

      {/* Report modal */}
      <Modal open={!!detailItem} onClose={() => { setDetail(null); setReportText(''); setReportUrl(''); }} title={`Lab Report — ${detailItem?.req_number}`} size="lg"
        footer={<><button onClick={() => { setDetail(null); }} className="btn-secondary">Close</button><button onClick={saveReport} className="btn-primary"><FileText size={14} /> Save Report</button></>}
      >
        {detailItem && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[['Patient', detailItem.patient_name], ['Test Panel', detailItem.test_panel], ['Sample Type', detailItem.sample_type], ['Sample ID', detailItem.sample_id ?? '—'], ['Collected', formatDate(detailItem.collected_at)], ['Processed', formatDate(detailItem.processed_at)]].map(([k, v]) => (
                <div key={k}><p className="text-xs text-slate-500">{k}</p><p className="font-medium">{v}</p></div>
              ))}
            </div>
            {detailItem.report_url && (
              <div>
                <p className="text-xs text-slate-500 mb-1">Report URL</p>
                <a href={detailItem.report_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-brand-blue-600 hover:underline">
                  <ExternalLink size={14} /> {detailItem.report_url}
                </a>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Report URL</label>
              <input type="url" value={reportUrl} onChange={e => setReportUrl(e.target.value)} placeholder="https://..." className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Lab Report</label>
              <textarea value={reportText} onChange={e => setReportText(e.target.value)} rows={8} placeholder="Enter lab findings and report..." className="input-field resize-none font-mono text-sm" />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
