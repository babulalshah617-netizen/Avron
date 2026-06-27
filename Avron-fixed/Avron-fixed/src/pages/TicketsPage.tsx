import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Search, Filter, RefreshCw, Clock, AlertTriangle, CheckCircle2,
  MessageSquare, ArrowUpCircle, X, Ticket, User, Upload, FileText, ImageIcon,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { cn, formatDate, getInitials } from '../lib/utils';
import {
  TICKET_PRIORITY_CONFIG, TICKET_STATUS_CONFIG,
  type Ticket as ITicket, type TicketComment, type TicketType,
  type TicketPriority, type TicketStatus, type Department, type Profile,
} from '../types';

const TICKET_TYPES: { value: TicketType; label: string; icon: string }[] = [
  { value: 'it', label: 'IT Support', icon: '💻' },
  { value: 'maintenance', label: 'Maintenance', icon: '🔧' },
  { value: 'biomedical', label: 'Biomedical', icon: '🩺' },
  { value: 'fms', label: 'FMS / Facility', icon: '🏢' },
];

const STATUS_ACTIONS: Partial<Record<TicketStatus, { next: TicketStatus; label: string }[]>> = {
  open:        [{ next: 'assigned',    label: 'Assign' }, { next: 'in_progress', label: 'Start' }],
  assigned:    [{ next: 'in_progress', label: 'Start Work' }],
  in_progress: [{ next: 'resolved', label: 'Resolve' }, { next: 'escalated', label: 'Escalate' }],
  escalated:   [{ next: 'in_progress', label: 'Re-assign' }, { next: 'resolved', label: 'Resolve' }],
  resolved:    [{ next: 'closed', label: 'Close' }, { next: 'reopened', label: 'Reopen' }],
  closed:      [{ next: 'reopened', label: 'Reopen' }],
  reopened:    [{ next: 'in_progress', label: 'Start Work' }],
};

function SLABadge({ deadline }: { deadline: string | null }) {
  if (!deadline) return null;
  const now = Date.now();
  const dl = new Date(deadline).getTime();
  const diff = dl - now;
  const overdue = diff < 0;
  const mins = Math.abs(Math.floor(diff / 60000));
  const label = overdue
    ? `Overdue ${mins < 60 ? `${mins}m` : `${Math.floor(mins/60)}h`}`
    : mins < 60 ? `${mins}m left` : `${Math.floor(mins/60)}h left`;
  return (
    <span className={cn('badge text-[10px]', overdue
      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
      : mins < 30 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400')}>
      <Clock size={9} /> {label}
    </span>
  );
}

export function TicketsPage() {
  const { profile } = useAuth();
  const { addToast } = useNotifications();

  const [tickets, setTickets]     = useState<ITicket[]>([]);
  const [depts, setDepts]         = useState<Department[]>([]);
  const [staff, setStaff]         = useState<Profile[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [typeFilter, setType]     = useState<TicketType | ''>('');
  const [statusFilter, setStatus] = useState<TicketStatus | ''>('');
  const [priorityFilter, setPrio] = useState<TicketPriority | ''>('');
  const [createOpen, setCreate]   = useState(false);
  const [detailTicket, setDetail] = useState<ITicket | null>(null);
  const [comments, setComments]   = useState<TicketComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [saving, setSaving]       = useState(false);
  const [resNotes, setResNotes]   = useState('');
  const [assignTo, setAssignTo]   = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [proofUploading, setProofUploading] = useState(false);

  const [form, setForm] = useState({
    title: '', description: '', type: 'it' as TicketType,
    priority: 'medium' as TicketPriority, department_id: '', location: '',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [tkRes, dpRes, stRes] = await Promise.all([
      supabase.from('tickets')
        .select('*, created_by_profile:profiles!created_by(id,full_name,role), assigned_to_profile:profiles!assigned_to(id,full_name,role), department:departments(id,name)')
        .order('created_at', { ascending: false }).limit(200),
      supabase.from('departments').select('id,name').eq('is_active', true).order('name'),
      supabase.from('profiles').select('id,full_name,role,is_active').eq('is_active', true).order('full_name'),
    ]);
    setTickets(tkRes.data ?? []);
    setDepts(dpRes.data ?? []);
    setStaff(stRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openDetail = async (t: ITicket) => {
    setDetail(t);
    setResNotes(t.resolution_notes ?? '');
    setAssignTo(t.assigned_to ?? '');
    setProofFile(null);
    setProofPreview(t.proof_url ?? null);
    const { data } = await supabase.from('ticket_comments')
      .select('*, profile:profiles(id,full_name,role)')
      .eq('ticket_id', t.id).order('created_at');
    setComments(data ?? []);
  };

  const handleProofChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.type)) {
      addToast({ type: 'error', title: 'Invalid file', message: 'Allowed: JPG, JPEG, PNG, WEBP, PDF' });
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      addToast({ type: 'error', title: 'File too large', message: 'Max size is 100MB' });
      return;
    }
    setProofFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => setProofPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setProofPreview(null);
    }
  };

  const uploadProof = async (ticketId: string): Promise<string | null> => {
    if (!proofFile) return null;
    const fileExt = proofFile.name.split('.').pop();
    const fileName = `proof-${ticketId}-${Date.now()}.${fileExt}`;
    const { error: uploadErr } = await supabase.storage
      .from('proof-uploads')
      .upload(fileName, proofFile);
    if (uploadErr) {
      addToast({ type: 'error', title: 'Upload failed', message: uploadErr.message });
      return null;
    }
    const { data } = supabase.storage.from('proof-uploads').getPublicUrl(fileName);
    return data.publicUrl;
  };

  const handleCreate = async () => {
    if (!form.title.trim() || !form.description.trim()) {
      addToast({ type: 'error', title: 'Required', message: 'Title and description are required.' });
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.from('tickets').insert({
      title: form.title.trim(), description: form.description.trim(),
      type: form.type, priority: form.priority,
      department_id: form.department_id || null,
      location: form.location.trim() || null,
      created_by: profile?.id,
    }).select().maybeSingle();
    setSaving(false);
    if (!error && data) {
      addToast({ type: 'success', title: 'Ticket created', message: data.ticket_number });
      setCreate(false);
      setForm({ title: '', description: '', type: 'it', priority: 'medium', department_id: '', location: '' });
      fetchData();
    } else {
      addToast({ type: 'error', title: 'Error', message: error?.message ?? 'Failed to create.' });
    }
  };

  const updateStatus = async (t: ITicket, next: TicketStatus) => {
    // Proof is mandatory for resolution
    if (next === 'resolved' && !proofFile && !t.proof_url) {
      addToast({ type: 'error', title: 'Proof Required', message: 'Upload proof (JPG/PNG/WEBP/PDF) before resolving.' });
      return;
    }
    if (next === 'resolved' && !resNotes.trim()) {
      addToast({ type: 'error', title: 'Notes Required', message: 'Resolution notes are mandatory.' });
      return;
    }

    setProofUploading(true);
    const updates: Record<string, unknown> = { status: next };
    const now = new Date().toISOString();
    if (next === 'assigned')    { updates.assigned_to = assignTo || null; updates.assigned_at = now; }
    if (next === 'in_progress') { updates.assigned_to = t.assigned_to || profile?.id; }
    if (next === 'resolved') {
      let proofUrl = t.proof_url;
      if (proofFile) {
        const uploaded = await uploadProof(t.id);
        if (!uploaded) {
          setProofUploading(false);
          return;
        }
        proofUrl = uploaded;
      }
      updates.resolved_by = profile?.id;
      updates.resolved_at = now;
      updates.resolution_notes = resNotes.trim();
      updates.proof_url = proofUrl;
      updates.proof_uploaded_at = now;
      updates.proof_uploaded_by = profile?.id;
      if (t.assigned_at) {
        const start = new Date(t.assigned_at).getTime();
        updates.resolution_duration_seconds = Math.floor((Date.now() - start) / 1000);
      }
    }
    if (next === 'closed')      { updates.closed_at = now; }

    await supabase.from('tickets').update(updates).eq('id', t.id);
    await supabase.from('ticket_comments').insert({
      ticket_id: t.id, user_id: profile?.id,
      comment: `Status changed to ${TICKET_STATUS_CONFIG[next].label}${resNotes && next === 'resolved' ? ': ' + resNotes : ''}`,
      is_internal: true,
    });
    setProofUploading(false);
    addToast({ type: 'success', title: 'Ticket updated', message: TICKET_STATUS_CONFIG[next].label });
    setDetail(null);
    fetchData();
  };

  const postComment = async () => {
    if (!newComment.trim() || !detailTicket) return;
    await supabase.from('ticket_comments').insert({
      ticket_id: detailTicket.id, user_id: profile?.id, comment: newComment.trim(),
    });
    setNewComment('');
    const { data } = await supabase.from('ticket_comments')
      .select('*, profile:profiles(id,full_name,role)')
      .eq('ticket_id', detailTicket.id).order('created_at');
    setComments(data ?? []);
  };

  const filtered = tickets.filter(t => {
    const q = search.toLowerCase();
    const ms = !q || t.title.toLowerCase().includes(q) || t.ticket_number.toLowerCase().includes(q);
    const mt = !typeFilter || t.type === typeFilter;
    const mst = !statusFilter || t.status === statusFilter;
    const mp = !priorityFilter || t.priority === priorityFilter;
    return ms && mt && mst && mp;
  });

  // Stats
  const stats = {
    open: tickets.filter(t => t.status === 'open').length,
    inProg: tickets.filter(t => t.status === 'in_progress' || t.status === 'assigned').length,
    resolved: tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length,
    critical: tickets.filter(t => t.priority === 'critical' && t.status !== 'closed' && t.status !== 'resolved').length,
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Support Tickets</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {stats.critical > 0 && <span className="text-red-500 font-medium">{stats.critical} critical · </span>}
            {stats.open} open · {stats.inProg} in progress · {stats.resolved} resolved
          </p>
        </div>
        <button onClick={() => setCreate(true)} className="btn-primary"><Plus size={16} /> New Ticket</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Open', value: stats.open, color: 'text-sky-600' },
          { label: 'In Progress', value: stats.inProg, color: 'text-amber-600' },
          { label: 'Resolved', value: stats.resolved, color: 'text-emerald-600' },
          { label: 'Critical', value: stats.critical, color: 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">{s.label}</p>
            <p className={cn('text-2xl font-bold mt-1', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search tickets..." className="input-field pl-9" />
        </div>
        <select value={typeFilter} onChange={e => setType(e.target.value as TicketType | '')} className="input-field sm:w-36">
          <option value="">All Types</option>
          {TICKET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select value={priorityFilter} onChange={e => setPrio(e.target.value as TicketPriority | '')} className="input-field sm:w-32">
          <option value="">All Priority</option>
          {Object.entries(TICKET_PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatus(e.target.value as TicketStatus | '')} className="input-field sm:w-36">
          <option value="">All Status</option>
          {Object.entries(TICKET_STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button onClick={fetchData} className="btn-secondary flex-shrink-0"><RefreshCw size={15} /></button>
      </div>

      {/* Ticket cards */}
      {loading ? <div className="flex justify-center py-12"><Spinner size="lg" /></div> :
       filtered.length === 0 ? (
        <div className="card text-center py-12 text-slate-400">
          <Ticket size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No tickets found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(t => {
            const prioConfig = TICKET_PRIORITY_CONFIG[t.priority];
            const statusConfig = TICKET_STATUS_CONFIG[t.status];
            const typeInfo = TICKET_TYPES.find(x => x.value === t.type);
            const createdBy = t.created_by_profile as unknown as Profile | null;
            const assignedTo = t.assigned_to_profile as unknown as Profile | null;
            const dept = t.department as unknown as Department | null;

            return (
              <div
                key={t.id}
                onClick={() => openDetail(t)}
                className={cn(
                  'card p-4 hover:shadow-card-md cursor-pointer transition-all border-l-4',
                  prioConfig.border,
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 flex-wrap mb-1.5">
                      <span className="text-[10px] font-mono text-slate-500">{t.ticket_number}</span>
                      <span className={cn('badge text-[10px]', prioConfig.color)}>
                        {t.priority === 'critical' && <AlertTriangle size={9} />}
                        {prioConfig.label}
                      </span>
                      <span className={cn('badge text-[10px]', statusConfig.color)}>{statusConfig.label}</span>
                      {typeInfo && <span className="text-xs">{typeInfo.icon} {typeInfo.label}</span>}
                    </div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white mb-1 truncate">{t.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">{t.description}</p>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      {dept && <span className="text-[10px] text-slate-400">{dept.name}</span>}
                      {t.location && <span className="text-[10px] text-slate-400">📍 {t.location}</span>}
                      {createdBy && <span className="text-[10px] text-slate-400">By: {createdBy.full_name}</span>}
                      {assignedTo && <span className="text-[10px] text-blue-500">→ {assignedTo.full_name}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <SLABadge deadline={t.sla_deadline} />
                    <span className="text-[10px] text-slate-400">{formatDate(t.created_at)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      <Modal open={createOpen} onClose={() => setCreate(false)} title="Create Support Ticket" size="lg"
        footer={
          <>
            <button onClick={() => setCreate(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleCreate} disabled={saving} className="btn-primary">
              {saving ? <Spinner size="sm" className="text-white" /> : 'Submit Ticket'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Title *</label>
            <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Brief summary of the issue" className="input-field" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Type *</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as TicketType }))} className="input-field">
                {TICKET_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Priority *</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as TicketPriority }))} className="input-field">
                {Object.entries(TICKET_PRIORITY_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label} (SLA: {v.sla})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Department</label>
              <select value={form.department_id} onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))} className="input-field">
                <option value="">— Select —</option>
                {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Location</label>
              <input type="text" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                placeholder="Room/area/floor" className="input-field" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description *</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={4} placeholder="Detailed description of the problem..." className="input-field resize-none" />
          </div>
          <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
            <Clock size={14} className="text-amber-600" />
            <span className="text-xs text-amber-700 dark:text-amber-400">
              SLA for {TICKET_PRIORITY_CONFIG[form.priority].label}: {TICKET_PRIORITY_CONFIG[form.priority].sla}
            </span>
          </div>
        </div>
      </Modal>

      {/* Detail modal */}
      <Modal open={!!detailTicket} onClose={() => { setDetail(null); setNewComment(''); }} title={detailTicket?.ticket_number ?? ''} size="xl"
        footer={<button onClick={() => { setDetail(null); setNewComment(''); }} className="btn-secondary">Close</button>}
      >
        {detailTicket && (() => {
          const actions = STATUS_ACTIONS[detailTicket.status] ?? [];
          const prioConfig = TICKET_PRIORITY_CONFIG[detailTicket.priority];
          const statusConfig = TICKET_STATUS_CONFIG[detailTicket.status];
          const typeInfo = TICKET_TYPES.find(x => x.value === detailTicket.type);
          const assignedToProfile = detailTicket.assigned_to_profile as unknown as Profile | null;

          return (
            <div className="space-y-5">
              {/* Header */}
              <div>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className={cn('badge', prioConfig.color)}>{prioConfig.label}</span>
                  <span className={cn('badge', statusConfig.color)}>{statusConfig.label}</span>
                  {typeInfo && <span className="text-sm">{typeInfo.icon} {typeInfo.label}</span>}
                  <SLABadge deadline={detailTicket.sla_deadline} />
                </div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">{detailTicket.title}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{detailTicket.description}</p>
              </div>

              {/* Meta */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                {[
                  ['SLA Deadline', formatDate(detailTicket.sla_deadline)],
                  ['Created', formatDate(detailTicket.created_at)],
                  ['Resolved', formatDate(detailTicket.resolved_at)],
                  ['Assigned To', assignedToProfile?.full_name ?? 'Unassigned'],
                  ['Location', detailTicket.location ?? '—'],
                ].map(([k, v]) => (
                  <div key={k}>
                    <p className="text-xs text-slate-500">{k}</p>
                    <p className="font-medium text-slate-800 dark:text-slate-200">{v}</p>
                  </div>
                ))}
              </div>

              {/* Assign to */}
              {actions.some(a => a.next === 'assigned') && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Assign To</label>
                  <select value={assignTo} onChange={e => setAssignTo(e.target.value)} className="input-field">
                    <option value="">— Select Staff —</option>
                    {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                  </select>
                </div>
              )}

              {/* Proof upload - required for resolution */}
              {actions.some(a => a.next === 'resolved') && !detailTicket.proof_url && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Upload size={14} className="text-amber-600 dark:text-amber-400" />
                    <label className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      Proof of Resolution (Required)
                    </label>
                  </div>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mb-3">
                    Upload a photo or document proving the issue has been resolved. Max 100MB.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <label className="flex-1 flex items-center justify-center gap-2 px-4 py-6 border-2 border-dashed border-amber-300 dark:border-amber-700 rounded-lg cursor-pointer hover:bg-amber-100/50 dark:hover:bg-amber-900/30 transition-colors">
                      <input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" className="hidden" onChange={handleProofChange} />
                      {proofFile ? (
                        <span className="text-sm text-amber-700 dark:text-amber-300 flex items-center gap-1">
                          {proofFile.type === 'application/pdf' ? <FileText size={14} /> : <ImageIcon size={14} />}
                          {proofFile.name}
                        </span>
                      ) : (
                        <span className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <Upload size={16} /> Choose file (JPG, PNG, WEBP, PDF)
                        </span>
                      )}
                    </label>
                    {proofPreview && proofFile?.type?.startsWith('image/') && (
                      <img src={proofPreview} alt="Proof preview" className="h-20 w-auto rounded border border-amber-200 object-cover" />
                    )}
                  </div>
                </div>
              )}

              {/* Show existing proof */}
              {detailTicket.proof_url && (
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />
                    <span className="text-sm font-medium text-emerald-800 dark:text-emerald-200">Proof Uploaded</span>
                  </div>
                  <a href={detailTicket.proof_url} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-600 dark:text-emerald-400 underline">
                    View uploaded proof
                  </a>
                </div>
              )}

              {/* Resolution notes */}
              {actions.some(a => a.next === 'resolved') && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Resolution Notes (Required)</label>
                  <textarea value={resNotes} onChange={e => setResNotes(e.target.value)}
                    rows={2} placeholder="Describe how the issue was resolved..." className="input-field resize-none" />
                </div>
              )}

              {/* Actions */}
              {actions.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {actions.map(a => (
                    <button key={a.next} onClick={() => updateStatus(detailTicket, a.next)}
                      disabled={proofUploading}
                      className={cn('btn-secondary text-sm', a.next === 'resolved' && 'text-emerald-600', a.next === 'closed' && 'text-slate-500')}>
                      {proofUploading && a.next === 'resolved' ? <Spinner size="sm" /> : a.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Comments */}
              <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                  <MessageSquare size={14} /> Comments ({comments.length})
                </h4>
                <div className="space-y-3 max-h-48 overflow-y-auto mb-3">
                  {comments.length === 0 && <p className="text-xs text-slate-400">No comments yet.</p>}
                  {comments.map(c => {
                    const cp = c.profile as unknown as Profile | null;
                    return (
                      <div key={c.id} className={cn('flex items-start gap-2', c.is_internal && 'opacity-70')}>
                        <div className="h-6 w-6 rounded-lg bg-brand-blue-100 dark:bg-brand-blue-900/30 flex items-center justify-center text-[10px] font-bold text-brand-blue-600 flex-shrink-0">
                          {getInitials(cp?.full_name ?? 'U')}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{cp?.full_name ?? 'System'}</span>
                            {c.is_internal && <span className="text-[9px] text-slate-400 bg-slate-100 dark:bg-slate-700 px-1 rounded">internal</span>}
                            <span className="text-[10px] text-slate-400">{formatDate(c.created_at)}</span>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{c.comment}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <input type="text" value={newComment} onChange={e => setNewComment(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && postComment()}
                    placeholder="Add a comment..." className="input-field flex-1 text-sm py-2" />
                  <button onClick={postComment} className="btn-primary py-2 px-4">Post</button>
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
