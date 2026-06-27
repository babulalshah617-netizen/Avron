import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, RefreshCw, FileImage, FileVideo, FileText, File, ExternalLink, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { formatDate } from '../lib/utils';

type MediaFileType = 'image' | 'video' | 'pdf' | 'document';

interface MediaFile {
  id: string;
  entity_type: string;
  entity_id: string | null;
  file_type: MediaFileType;
  file_name: string;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
  description: string | null;
  uploaded_by: string | null;
  created_at: string;
}

const FILE_TYPE_CONFIG: Record<MediaFileType, { icon: typeof File; color: string; variant: 'neutral'|'info'|'warning'|'success'|'danger' }> = {
  image:    { icon: FileImage, color: 'text-blue-500',    variant: 'info' },
  video:    { icon: FileVideo, color: 'text-purple-500',  variant: 'warning' },
  pdf:      { icon: FileText,  color: 'text-red-500',     variant: 'danger' },
  document: { icon: File,      color: 'text-slate-500',   variant: 'neutral' },
};

const ENTITY_TYPES = ['Patient', 'Radiology', 'Lab', 'Ticket', 'Asset', 'Delivery', 'Other'];

export function MediaFilesPage() {
  const { profile } = useAuth();
  const { addToast } = useNotifications();
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<MediaFileType | ''>('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    entity_type: 'Patient', entity_id: '', file_type: 'image' as MediaFileType,
    file_name: '', file_url: '', description: '',
  });

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('media_files').select('*')
      .order('created_at', { ascending: false }).limit(100);
    setFiles(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const handleUpload = async () => {
    if (!form.file_name.trim() || !form.file_url.trim()) {
      addToast({ type: 'error', title: 'Required', message: 'File name and URL required.' });
      return;
    }
    setSaving(true);
    await supabase.from('media_files').insert({
      entity_type: form.entity_type,
      entity_id: form.entity_id.trim() || null,
      file_type: form.file_type,
      file_name: form.file_name.trim(),
      file_url: form.file_url.trim(),
      description: form.description.trim() || null,
      uploaded_by: profile?.id,
    });
    addToast({ type: 'success', title: 'File uploaded', message: form.file_name });
    setSaving(false);
    setUploadOpen(false);
    setForm({ entity_type: 'Patient', entity_id: '', file_type: 'image', file_name: '', file_url: '', description: '' });
    fetch();
  };

  const handleDelete = async (f: MediaFile) => {
    if (!confirm(`Delete "${f.file_name}"?`)) return;
    await supabase.from('media_files').delete().eq('id', f.id);
    addToast({ type: 'warning', title: 'File deleted', message: f.file_name });
    fetch();
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return '—';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes, i = 0;
    while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
    return `${size.toFixed(1)} ${units[i]}`;
  };

  const filtered = files.filter(f => {
    const q = search.toLowerCase();
    return (!q || f.file_name.toLowerCase().includes(q) || f.entity_type.toLowerCase().includes(q))
      && (!typeFilter || f.file_type === typeFilter);
  });

  const stats = {
    total: files.length,
    images: files.filter(f => f.file_type === 'image').length,
    videos: files.filter(f => f.file_type === 'video').length,
    documents: files.filter(f => f.file_type === 'pdf' || f.file_type === 'document').length,
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Media Files</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {stats.total} files · {stats.images} images · {stats.videos} videos · {stats.documents} documents
          </p>
        </div>
        <button onClick={() => setUploadOpen(true)} className="btn-primary"><Plus size={16} /> Add File</button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(stats).map(([k, v]) => (
          <div key={k} className="card p-3 text-center">
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{v}</p>
            <p className="text-xs text-slate-500 capitalize">{k}</p>
          </div>
        ))}
      </div>

      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search files..." className="input-field pl-9" />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as MediaFileType | '')} className="input-field sm:w-40">
          <option value="">All Types</option>
          {Object.keys(FILE_TYPE_CONFIG).map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={fetch} className="btn-secondary flex-shrink-0"><RefreshCw size={15} /></button>
      </div>

      {loading ? <div className="flex justify-center py-10"><Spinner size="lg" /></div> :
       filtered.length === 0 ? (
        <div className="card text-center py-12 text-slate-400"><FileImage size={32} className="mx-auto mb-3 opacity-30" /><p className="text-sm">No media files</p></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(f => {
            const config = FILE_TYPE_CONFIG[f.file_type];
            const Icon = config.icon;
            return (
              <div key={f.id} className="card p-4 hover:shadow-card-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className={`p-2 rounded-lg bg-slate-100 dark:bg-slate-700 ${config.color}`}>
                    <Icon size={20} />
                  </div>
                  <div className="flex gap-1">
                    <a href={f.file_url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                      <ExternalLink size={14} />
                    </a>
                    <button onClick={() => handleDelete(f)} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{f.file_name}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant={config.variant}>{f.file_type}</Badge>
                  <span className="text-xs text-slate-400">{f.entity_type}</span>
                </div>
                {f.description && <p className="text-xs text-slate-500 mt-2 line-clamp-2">{f.description}</p>}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                  <span className="text-[10px] text-slate-400">{formatSize(f.file_size)}</span>
                  <span className="text-[10px] text-slate-400">{formatDate(f.created_at)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload modal */}
      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="Add Media File" size="md"
        footer={<><button onClick={() => setUploadOpen(false)} className="btn-secondary">Cancel</button><button onClick={handleUpload} disabled={saving} className="btn-primary">{saving ? <Spinner size="sm" className="text-white" /> : 'Add File'}</button></>}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Entity Type *</label>
              <select value={form.entity_type} onChange={e => setForm(p => ({ ...p, entity_type: e.target.value }))} className="input-field">
                {ENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">File Type *</label>
              <select value={form.file_type} onChange={e => setForm(p => ({ ...p, file_type: e.target.value as MediaFileType }))} className="input-field">
                {Object.keys(FILE_TYPE_CONFIG).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Entity ID</label>
            <input type="text" value={form.entity_id} onChange={e => setForm(p => ({ ...p, entity_id: e.target.value }))} placeholder="Related record ID" className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">File Name *</label>
            <input type="text" value={form.file_name} onChange={e => setForm(p => ({ ...p, file_name: e.target.value }))} placeholder="Enter file name" className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">File URL *</label>
            <input type="url" value={form.file_url} onChange={e => setForm(p => ({ ...p, file_url: e.target.value }))} placeholder="https://..." className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} placeholder="Optional description..." className="input-field resize-none" />
          </div>
        </div>
      </Modal>
    </div>
  );
}
