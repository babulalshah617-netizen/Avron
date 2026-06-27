import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, RefreshCw, Monitor, Wrench, QrCode, AlertTriangle, Calendar, DollarSign } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { formatDate } from '../lib/utils';
import type { Asset, AssetType, AssetStatus, Department, Profile, AssetMaintenanceLog } from '../types';

const ASSET_TYPE_CONFIG: Record<AssetType, { label: string; icon: typeof Monitor }> = {
  computer:       { label: 'Computer',       icon: Monitor },
  laptop:         { label: 'Laptop',         icon: Monitor },
  printer:        { label: 'Printer',       icon: Monitor },
  cctv:           { label: 'CCTV',          icon: Monitor },
  biomedical:     { label: 'Biomedical',     icon: Monitor },
  network_device: { label: 'Network Device', icon: Monitor },
  furniture:      { label: 'Furniture',      icon: Monitor },
  vehicle:        { label: 'Vehicle',        icon: Monitor },
  other:          { label: 'Other',         icon: Monitor },
};

const STATUS_CONFIG: Record<AssetStatus, { label: string; variant: 'neutral'|'info'|'warning'|'success'|'danger' }> = {
  active:            { label: 'Active',            variant: 'success' },
  inactive:          { label: 'Inactive',          variant: 'neutral' },
  under_maintenance: { label: 'Under Maintenance', variant: 'warning' },
  disposed:          { label: 'Disposed',         variant: 'danger' },
  lost:              { label: 'Lost',             variant: 'danger' },
};

const CONDITION_OPTIONS = ['Excellent', 'Good', 'Fair', 'Poor', 'Damaged'];

export function AssetsPage() {
  const { profile } = useAuth();
  const { addToast } = useNotifications();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [staff, setStaff] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setType] = useState<AssetType | ''>('');
  const [statusFilter, setStatus] = useState<AssetStatus | ''>('');
  const [createOpen, setCreate] = useState(false);
  const [detailAsset, setDetail] = useState<Asset | null>(null);
  const [maintenanceOpen, setMaintOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '', type: 'computer' as AssetType, brand: '', model: '', serial_number: '',
    department_id: '', assigned_to: '', location: '', status: 'active' as AssetStatus,
    condition: 'Good', purchase_date: '', purchase_cost: '', warranty_expiry: '', notes: '',
  });

  const [maintForm, setMaintForm] = useState({
    asset_id: '', maintenance_type: 'routine', description: '', vendor: '',
    cost: '', scheduled_at: '', completed_at: '', next_service_date: '', parts_replaced: '', notes: '',
  });

  const fetch = useCallback(async () => {
    setLoading(true);
    const [assetRes, deptRes, staffRes] = await Promise.all([
      supabase.from('assets').select('*, department:departments(*), assigned_profile:profiles!assets_assigned_to_fkey(*)').order('created_at', { ascending: false }),
      supabase.from('departments').select('*').eq('is_active', true),
      supabase.from('profiles').select('*').eq('is_active', true),
    ]);
    setAssets(assetRes.data ?? []);
    setDepartments(deptRes.data ?? []);
    setStaff(staffRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const handleCreate = async () => {
    if (!form.name.trim()) {
      addToast({ type: 'error', title: 'Required', message: 'Asset name required.' });
      return;
    }
    setSaving(true);
    await supabase.from('assets').insert({
      name: form.name.trim(),
      type: form.type,
      brand: form.brand.trim() || null,
      model: form.model.trim() || null,
      serial_number: form.serial_number.trim() || null,
      department_id: form.department_id || null,
      assigned_to: form.assigned_to || null,
      location: form.location.trim() || null,
      status: form.status,
      condition: form.condition,
      purchase_date: form.purchase_date || null,
      purchase_cost: form.purchase_cost ? parseFloat(form.purchase_cost) : null,
      warranty_expiry: form.warranty_expiry || null,
      notes: form.notes.trim() || null,
    });
    addToast({ type: 'success', title: 'Asset created', message: form.name });
    setSaving(false);
    setCreate(false);
    setForm({ name: '', type: 'computer', brand: '', model: '', serial_number: '', department_id: '', assigned_to: '', location: '', status: 'active', condition: 'Good', purchase_date: '', purchase_cost: '', warranty_expiry: '', notes: '' });
    fetch();
  };

  const handleMaintenance = async () => {
    if (!maintForm.asset_id || !maintForm.description.trim()) {
      addToast({ type: 'error', title: 'Required', message: 'Asset and description required.' });
      return;
    }
    setSaving(true);
    await supabase.from('asset_maintenance_logs').insert({
      asset_id: maintForm.asset_id,
      maintenance_type: maintForm.maintenance_type,
      description: maintForm.description.trim(),
      vendor: maintForm.vendor.trim() || null,
      cost: maintForm.cost ? parseFloat(maintForm.cost) : null,
      scheduled_at: maintForm.scheduled_at || null,
      completed_at: maintForm.completed_at || null,
      next_service_date: maintForm.next_service_date || null,
      parts_replaced: maintForm.parts_replaced.trim() || null,
      notes: maintForm.notes.trim() || null,
      performed_by: profile?.id,
    });
    // Update asset status if under maintenance
    if (maintForm.maintenance_type !== 'routine') {
      await supabase.from('assets').update({ status: 'under_maintenance' }).eq('id', maintForm.asset_id);
    }
    addToast({ type: 'success', title: 'Maintenance logged', message: 'Maintenance record added' });
    setSaving(false);
    setMaintOpen(false);
    setMaintForm({ asset_id: '', maintenance_type: 'routine', description: '', vendor: '', cost: '', scheduled_at: '', completed_at: '', next_service_date: '', parts_replaced: '', notes: '' });
    fetch();
  };

  const updateStatus = async (a: Asset, newStatus: AssetStatus) => {
    await supabase.from('assets').update({ status: newStatus }).eq('id', a.id);
    addToast({ type: 'success', title: 'Status updated', message: `${a.asset_tag} → ${STATUS_CONFIG[newStatus].label}` });
    fetch();
  };

  const filtered = assets.filter(a => {
    const q = search.toLowerCase();
    return (!q || a.name.toLowerCase().includes(q) || a.asset_tag.toLowerCase().includes(q) || (a.serial_number ?? '').toLowerCase().includes(q))
      && (!typeFilter || a.type === typeFilter)
      && (!statusFilter || a.status === statusFilter);
  });

  const stats = {
    total: assets.length,
    active: assets.filter(a => a.status === 'active').length,
    maintenance: assets.filter(a => a.status === 'under_maintenance').length,
    totalValue: assets.reduce((sum, a) => sum + (a.purchase_cost ?? 0), 0),
  };

  const warrantyExpiring = assets.filter(a => {
    if (!a.warranty_expiry) return false;
    const expiry = new Date(a.warranty_expiry);
    const monthFromNow = new Date();
    monthFromNow.setMonth(monthFromNow.getMonth() + 1);
    return expiry <= monthFromNow && expiry >= new Date();
  });

  return (
    <div className="space-y-5 animate-fade-in">
      {warrantyExpiring.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Warranty Alert</p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
              {warrantyExpiring.length} asset(s) have warranty expiring within 30 days
            </p>
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">Asset Management</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {stats.total} assets · {stats.active} active · {stats.maintenance} in maintenance · Value: ₹{stats.totalValue.toLocaleString('en-IN')}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setMaintForm(p => ({ ...p, asset_id: '' })); setMaintOpen(true); }} className="btn-secondary"><Wrench size={16} /> Log Maintenance</button>
          <button onClick={() => setCreate(true)} className="btn-primary"><Plus size={16} /> Add Asset</button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</p>
          <p className="text-xs text-slate-500">Total Assets</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-emerald-600">{stats.active}</p>
          <p className="text-xs text-slate-500">Active</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-amber-600">{stats.maintenance}</p>
          <p className="text-xs text-slate-500">In Maintenance</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-slate-900 dark:text-white">₹{(stats.totalValue / 100000).toFixed(1)}L</p>
          <p className="text-xs text-slate-500">Total Value</p>
        </div>
      </div>

      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, tag, or serial..." className="input-field pl-9" />
        </div>
        <select value={typeFilter} onChange={e => setType(e.target.value as AssetType | '')} className="input-field sm:w-40">
          <option value="">All Types</option>
          {Object.entries(ASSET_TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatus(e.target.value as AssetStatus | '')} className="input-field sm:w-40">
          <option value="">All Status</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button onClick={fetch} className="btn-secondary flex-shrink-0"><RefreshCw size={15} /></button>
      </div>

      <div className="card overflow-hidden">
        {loading ? <div className="flex justify-center py-10"><Spinner size="lg" /></div> :
         filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400"><Monitor size={32} className="mx-auto mb-3 opacity-30" /><p className="text-sm">No assets found</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="table-header">
                <th className="px-4 py-3 text-left">Asset Tag</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Department</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">Location</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map(a => (
                  <tr key={a.id} className="table-row">
                    <td className="table-cell font-mono text-xs text-brand-blue-600 dark:text-brand-blue-400">{a.asset_tag}</td>
                    <td className="table-cell">
                      <p className="text-sm font-medium">{a.name}</p>
                      {a.brand && a.model && <p className="text-xs text-slate-500">{a.brand} {a.model}</p>}
                    </td>
                    <td className="table-cell"><Badge variant="neutral">{ASSET_TYPE_CONFIG[a.type].label}</Badge></td>
                    <td className="table-cell hidden md:table-cell text-xs text-slate-500">{a.department?.name ?? '—'}</td>
                    <td className="table-cell hidden lg:table-cell text-xs text-slate-500">{a.location ?? '—'}</td>
                    <td className="table-cell"><Badge variant={STATUS_CONFIG[a.status].variant}>{STATUS_CONFIG[a.status].label}</Badge></td>
                    <td className="table-cell text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setDetail(a)} className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">Details</button>
                        {a.status === 'active' && (
                          <button onClick={() => updateStatus(a, 'under_maintenance')} className="text-xs text-amber-600 hover:underline">To Maintenance</button>
                        )}
                        {a.status === 'under_maintenance' && (
                          <button onClick={() => updateStatus(a, 'active')} className="text-xs text-emerald-600 hover:underline">Mark Active</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Asset Modal */}
      <Modal open={createOpen} onClose={() => setCreate(false)} title="Add New Asset" size="lg"
        footer={<><button onClick={() => setCreate(false)} className="btn-secondary">Cancel</button><button onClick={handleCreate} disabled={saving} className="btn-primary">{saving ? <Spinner size="sm" className="text-white" /> : 'Add Asset'}</button></>}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Asset Name *</label>
              <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Enter asset name" className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Type *</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as AssetType }))} className="input-field">
                {Object.entries(ASSET_TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Brand</label>
              <input type="text" value={form.brand} onChange={e => setForm(p => ({ ...p, brand: e.target.value }))} placeholder="Brand name" className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Model</label>
              <input type="text" value={form.model} onChange={e => setForm(p => ({ ...p, model: e.target.value }))} placeholder="Model number" className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Serial Number</label>
              <input type="text" value={form.serial_number} onChange={e => setForm(p => ({ ...p, serial_number: e.target.value }))} placeholder="S/N" className="input-field" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Department</label>
              <select value={form.department_id} onChange={e => setForm(p => ({ ...p, department_id: e.target.value }))} className="input-field">
                <option value="">Select department</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Assigned To</label>
              <select value={form.assigned_to} onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))} className="input-field">
                <option value="">Select staff</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Location</label>
              <input type="text" value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} placeholder="Floor / Room" className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Status</label>
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as AssetStatus }))} className="input-field">
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Condition</label>
              <select value={form.condition} onChange={e => setForm(p => ({ ...p, condition: e.target.value }))} className="input-field">
                {CONDITION_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Purchase Date</label>
              <input type="date" value={form.purchase_date} onChange={e => setForm(p => ({ ...p, purchase_date: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Purchase Cost (₹)</label>
              <input type="number" value={form.purchase_cost} onChange={e => setForm(p => ({ ...p, purchase_cost: e.target.value }))} placeholder="0.00" className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Warranty Expiry</label>
              <input type="date" value={form.warranty_expiry} onChange={e => setForm(p => ({ ...p, warranty_expiry: e.target.value }))} className="input-field" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Additional notes..." className="input-field resize-none" />
          </div>
        </div>
      </Modal>

      {/* Maintenance Log Modal */}
      <Modal open={maintenanceOpen} onClose={() => setMaintOpen(false)} title="Log Maintenance" size="md"
        footer={<><button onClick={() => setMaintOpen(false)} className="btn-secondary">Cancel</button><button onClick={handleMaintenance} disabled={saving} className="btn-primary">{saving ? <Spinner size="sm" className="text-white" /> : 'Log Maintenance'}</button></>}
      >
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Asset *</label>
            <select value={maintForm.asset_id} onChange={e => setMaintForm(p => ({ ...p, asset_id: e.target.value }))} className="input-field">
              <option value="">Select asset...</option>
              {assets.map(a => <option key={a.id} value={a.id}>{a.asset_tag} - {a.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Maintenance Type</label>
              <select value={maintForm.maintenance_type} onChange={e => setMaintForm(p => ({ ...p, maintenance_type: e.target.value }))} className="input-field">
                <option value="routine">Routine</option>
                <option value="repair">Repair</option>
                <option value="preventive">Preventive</option>
                <option value="calibration">Calibration</option>
                <option value="upgrade">Upgrade</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Vendor</label>
              <input type="text" value={maintForm.vendor} onChange={e => setMaintForm(p => ({ ...p, vendor: e.target.value }))} placeholder="Service provider" className="input-field" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description *</label>
            <textarea value={maintForm.description} onChange={e => setMaintForm(p => ({ ...p, description: e.target.value }))} rows={2} placeholder="What was done?" className="input-field resize-none" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cost (₹)</label>
              <input type="number" value={maintForm.cost} onChange={e => setMaintForm(p => ({ ...p, cost: e.target.value }))} placeholder="0.00" className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Completed At</label>
              <input type="datetime-local" value={maintForm.completed_at} onChange={e => setMaintForm(p => ({ ...p, completed_at: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Next Service</label>
              <input type="date" value={maintForm.next_service_date} onChange={e => setMaintForm(p => ({ ...p, next_service_date: e.target.value }))} className="input-field" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Parts Replaced</label>
            <input type="text" value={maintForm.parts_replaced} onChange={e => setMaintForm(p => ({ ...p, parts_replaced: e.target.value }))} placeholder="List of parts" className="input-field" />
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal open={!!detailAsset} onClose={() => setDetail(null)} title={`Asset — ${detailAsset?.asset_tag}`} size="lg"
        footer={<button onClick={() => setDetail(null)} className="btn-secondary">Close</button>}
      >
        {detailAsset && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              {[
                ['Name', detailAsset.name],
                ['Type', ASSET_TYPE_CONFIG[detailAsset.type].label],
                ['Brand', detailAsset.brand ?? '—'],
                ['Model', detailAsset.model ?? '—'],
                ['Serial #', detailAsset.serial_number ?? '—'],
                ['QR Code', detailAsset.qr_code],
                ['Status', STATUS_CONFIG[detailAsset.status].label],
                ['Condition', detailAsset.condition ?? '—'],
                ['Location', detailAsset.location ?? '—'],
                ['Department', detailAsset.department?.name ?? '—'],
                ['Assigned To', detailAsset.assigned_profile?.full_name ?? '—'],
                ['Purchase Date', formatDate(detailAsset.purchase_date)],
                ['Purchase Cost', detailAsset.purchase_cost ? `₹${detailAsset.purchase_cost.toLocaleString('en-IN')}` : '—'],
                ['Warranty Expiry', formatDate(detailAsset.warranty_expiry)],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-xs text-slate-500">{k}</p>
                  <p className="font-medium">{v}</p>
                </div>
              ))}
            </div>
            {detailAsset.notes && (
              <div>
                <p className="text-xs text-slate-500 mb-1">Notes</p>
                <p className="text-sm bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">{detailAsset.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
