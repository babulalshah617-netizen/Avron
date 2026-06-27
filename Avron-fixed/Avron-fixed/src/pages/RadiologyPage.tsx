import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, RefreshCw, Scan, ExternalLink, Upload } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { cn, formatDate } from '../lib/utils';
import { DEPT_STATUS_CONFIG, type RadiologyRequest, type DeptReqStatus, type RadiologyModality } from '../types';

const MODALITIES: { value: RadiologyModality; label: string }[] = [
  { value: 'xray', label: 'X-Ray' }, { value: 'ct', label: 'CT Scan' },
  { value: 'mri', label: 'MRI' }, { value: 'usg', label: 'Ultrasound (USG)' },
  { value: 'mammography', label: 'Mammography' }, { value: 'doppler', label: 'Doppler' },
  { value: 'fluoroscopy', label: 'Fluoroscopy' },
];

const STATUS_NEXT: Partial<Record<DeptReqStatus, DeptReqStatus>> = {
  requested: 'approved', approved: 'processing', processing: 'completed',
};
const STATUS_VARIANT: Record<DeptReqStatus, 'neutral'|'info'|'warning'|'success'|'danger'> = {
  requested: 'neutral', approved: 'info', processing: 'warning', dispensed: 'info', delivered: 'neutral', completed: 'success', rejected: 'danger',
};

export function RadiologyPage() {
  const { profile } = useAuth();
  const { addToast } = useNotifications();
  const [reqs, setReqs]     = useState<RadiologyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatus] = useState<DeptReqStatus | ''>('');
  const [createOpen, setCreate] = useState(false);
  const [detailItem, setDetail] = useState<RadiologyRequest | null>(null);
  const [saving, setSaving] = useState(false);
  const [reportText, setReportText] = useState('');
  const [imageUrl, setImageUrl]     = useState('');

  const [form, setForm] = useState({
    patient_name: '', patient_uhid: '', modality: 'xray' as RadiologyModality,
    body_part: '', clinical_notes: '', contrast: false,
    scheduled_at: '',
  });

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('radiology_requests').select('*')
      .order('created_at', { ascending: false }).limit(100);
    setReqs(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const handleCreate = async () => {
    if (!form.patient_name.trim()) { addToast({ type: 'error', title: 'Required', message: 'Patient name required.' }); return; }
    setSaving(true);
    await supabase.from('radiology_requests').insert({
      patient_name: form.patient_name.trim(), patient_uhid: form.patient_uhid.trim() || null,
      modality: form.modality, body_part: form.body_part.trim() || null,
      clinical_notes: form.clinical_notes.trim() || null, contrast: form.contrast,
      scheduled_at: form.scheduled_at || null, requested_by: profile?.id,
    });
    addToast({ type: 'success', title: 'Radiology request created', message: MODALITIES.find(m => m.value === form.modality)?.label });
    setSaving(false);
    setCreate(false);
    setForm({ patient_name: '', patient_uhid: '', modality: 'xray', body_part: '', clinical_notes: '', contrast: false, scheduled_at: '' });
    fetch();
  };

  const advance = async (r: RadiologyRequest) => {
    const next = STATUS_NEXT[r.status];
    if (!next) return;
    await supabase.from('radiology_requests').update({ status: next, completed_at: next === 'completed' ? new Date().toISOString() : null }).eq('id', r.id);
    addToast({ type: 'success', title: 'Updated', message: `${r.req_number} → ${DEPT_STATUS_CONFIG[next].label}` });
    fetch();
  };

  const saveReport = async () => {
    if (!detailItem) return;
    const updates: Record<string, unknown> = { report_text: reportText };
    if (imageUrl.trim()) updates.image_urls = [...(detailItem.image_urls ?? []), imageUrl.trim()];
    await supabase.from('radiology_requests').update(updates).eq('id', detailItem.id);
    addToast({ type: 'success', title: 'Report saved', message: detailItem.req_number });
    setDetail(null);
    setReportText(''); setImageUrl('');
    fetch();
  };

  const filtered = reqs.filter(r => {
    const q = search.toLowerCase();
    return (!q || r.patient_name.toLowerCase().includes(q) || r.req_number.toLowerCase().includes(q))
      && (!statusFilter || r.status === statusFilter);
  });

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div><h1 className="page-title">Radiology & Imaging</h1><p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{reqs.length} requests</p></div>
        <button onClick={() => setCreate(true)} className="btn-primary"><Plus size={16} /> New Request</button>
      </div>

      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patient or number..." className="input-field pl-9" /></div>
        <select value={statusFilter} onChange={e => setStatus(e.target.value as DeptReqStatus | '')} className="input-field sm:w-40">
          <option value="">All Status</option>
          {Object.entries(DEPT_STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button onClick={fetch} className="btn-secondary flex-shrink-0"><RefreshCw size={15} /></button>
      </div>

      <div className="card overflow-hidden">
        {loading ? <div className="flex justify-center py-10"><Spinner size="lg" /></div> :
         filtered.length === 0 ? <div className="text-center py-12 text-slate-400"><Scan size={32} className="mx-auto mb-3 opacity-30" /><p className="text-sm">No radiology requests</p></div> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="table-header">
                <th className="px-4 py-3 text-left">Req #</th>
                <th className="px-4 py-3 text-left">Patient</th>
                <th className="px-4 py-3 text-left">Modality</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Body Part</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">Scheduled</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map(r => {
                  const next = STATUS_NEXT[r.status];
                  const modLabel = MODALITIES.find(m => m.value === r.modality)?.label ?? r.modality;
                  return (
                    <tr key={r.id} className="table-row">
                      <td className="table-cell font-mono text-xs text-brand-blue-600 dark:text-brand-blue-400">{r.req_number}</td>
                      <td className="table-cell"><p className="text-sm font-medium">{r.patient_name}</p>{r.patient_uhid && <p className="text-xs text-slate-500 font-mono">{r.patient_uhid}</p>}</td>
                      <td className="table-cell"><div className="flex items-center gap-1"><Badge variant="info">{modLabel}</Badge>{r.contrast && <span className="text-[10px] text-amber-600">+Contrast</span>}</div></td>
                      <td className="table-cell hidden md:table-cell text-xs text-slate-500">{r.body_part ?? '—'}</td>
                      <td className="table-cell hidden lg:table-cell text-xs text-slate-500">{formatDate(r.scheduled_at)}</td>
                      <td className="table-cell"><Badge variant={STATUS_VARIANT[r.status]}>{DEPT_STATUS_CONFIG[r.status].label}</Badge></td>
                      <td className="table-cell text-right">
                        <div className="flex items-center justify-end gap-2">
                          {next && <button onClick={() => advance(r)} className="text-xs text-brand-blue-600 hover:underline">→ {DEPT_STATUS_CONFIG[next].label}</button>}
                          <button onClick={() => { setDetail(r); setReportText(r.report_text ?? ''); setImageUrl(''); }} className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">Report</button>
                          {r.image_urls && r.image_urls.length > 0 && (
                            <span className="text-xs text-emerald-600">{r.image_urls.length} img</span>
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
      <Modal open={createOpen} onClose={() => setCreate(false)} title="New Radiology Request" size="md"
        footer={<><button onClick={() => setCreate(false)} className="btn-secondary">Cancel</button><button onClick={handleCreate} disabled={saving} className="btn-primary">{saving ? <Spinner size="sm" className="text-white" /> : 'Submit'}</button></>}
      >
        <div className="space-y-3">
          {[
            { label: 'Patient Name *', key: 'patient_name', ph: 'Full name', type: 'text' },
            { label: 'UHID', key: 'patient_uhid', ph: 'AVRON-UHID-001', type: 'text' },
            { label: 'Body Part', key: 'body_part', ph: 'Chest, Abdomen, Brain...', type: 'text' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{f.label}</label>
              <input type={f.type} value={(form as Record<string,unknown>)[f.key] as string} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.ph} className="input-field" />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Modality *</label>
              <select value={form.modality} onChange={e => setForm(p => ({ ...p, modality: e.target.value as RadiologyModality }))} className="input-field">
                {MODALITIES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Scheduled At</label>
              <input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(p => ({ ...p, scheduled_at: e.target.value }))} className="input-field" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Clinical Notes</label>
            <textarea value={form.clinical_notes} onChange={e => setForm(p => ({ ...p, clinical_notes: e.target.value }))} rows={2} className="input-field resize-none" placeholder="Clinical indication..." />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.contrast} onChange={e => setForm(p => ({ ...p, contrast: e.target.checked }))} className="rounded" />
            <span className="text-sm text-slate-700 dark:text-slate-300">With Contrast</span>
          </label>
        </div>
      </Modal>

      {/* Report modal */}
      <Modal open={!!detailItem} onClose={() => { setDetail(null); setReportText(''); setImageUrl(''); }} title={`Report — ${detailItem?.req_number}`} size="lg"
        footer={<><button onClick={() => { setDetail(null); }} className="btn-secondary">Close</button><button onClick={saveReport} className="btn-primary"><Upload size={14} /> Save Report</button></>}
      >
        {detailItem && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[['Patient', detailItem.patient_name], ['Modality', MODALITIES.find(m => m.value === detailItem.modality)?.label ?? detailItem.modality], ['Body Part', detailItem.body_part ?? '—'], ['Scheduled', formatDate(detailItem.scheduled_at)]].map(([k, v]) => (
                <div key={k}><p className="text-xs text-slate-500">{k}</p><p className="font-medium">{v}</p></div>
              ))}
            </div>
            {detailItem.image_urls && detailItem.image_urls.length > 0 && (
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Image URLs ({detailItem.image_urls.length})</p>
                <div className="space-y-1">{detailItem.image_urls.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-brand-blue-600 hover:underline">
                    <ExternalLink size={11} /> {url.length > 60 ? url.slice(0, 60) + '...' : url}
                  </a>
                ))}</div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Add Image/Video URL</label>
              <input type="url" value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Radiologist Report</label>
              <textarea value={reportText} onChange={e => setReportText(e.target.value)} rows={6} placeholder="Enter radiologist findings and report..." className="input-field resize-none" />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
