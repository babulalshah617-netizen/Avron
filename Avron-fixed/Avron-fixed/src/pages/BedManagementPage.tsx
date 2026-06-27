import { useState, useEffect, useCallback } from 'react';
import {
  BedDouble, RefreshCw, Search, UserPlus, UserMinus,
  ArrowRightLeft, Wrench, CheckCircle2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { Modal } from '../components/ui/Modal';
import { Spinner } from '../components/ui/Spinner';
import { cn, formatDate } from '../lib/utils';
import { BED_STATUS_CONFIG, type Room, type Bed, type BedStatus } from '../types';

const FLOOR_OPTIONS = ['2nd Floor', '3rd Floor', '4th Floor', '5th Floor', '6th Floor', '7th Floor'];

interface AvailableBed {
  id: string;
  bed_number: string;
  room_id: string;
  room_number: string;
  floor: string;
  room_type: string;
}

export function BedManagementPage() {
  const { profile } = useAuth();
  const { addToast } = useNotifications();

  const [rooms, setRooms]           = useState<Room[]>([]);
  const [loading, setLoading]       = useState(true);
  const [floorFilter, setFloor]     = useState('2nd Floor');
  const [search, setSearch]         = useState('');
  const [selectedBed, setSelBed]    = useState<Bed | null>(null);
  const [allocModal, setAllocModal] = useState(false);
  const [releaseModal, setRelModal] = useState(false);
  const [maintModal, setMaintModal] = useState(false);
  const [transferModal, setTransfer] = useState(false);
  const [saving, setSaving]         = useState(false);

  const [allocForm, setAllocForm] = useState({
    patient_name: '', patient_uhid: '', age: '', gender: 'Male', diagnosis: '', notes: '',
  });

  const [availableBeds, setAvailableBeds] = useState<AvailableBed[]>([]);
  const [targetBedId, setTargetBedId]     = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [bedsLoading, setBedsLoading]     = useState(false);

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('rooms')
      .select('*, beds(*)')
      .eq('is_active', true)
      .eq('floor', floorFilter)
      .order('room_number');
    setRooms(data ?? []);
    setLoading(false);
  }, [floorFilter]);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  const openAllocate  = (bed: Bed) => { setSelBed(bed); setAllocModal(true); };
  const openRelease   = (bed: Bed) => { setSelBed(bed); setRelModal(true); };
  const openMaint     = (bed: Bed) => { setSelBed(bed); setMaintModal(true); };

  const openTransfer = async (bed: Bed) => {
    setSelBed(bed);
    setTargetBedId('');
    setTransferReason('');
    setTransfer(true);
    setBedsLoading(true);
    const { data } = await supabase
      .from('beds')
      .select('id, bed_number, room_id, rooms:rooms(room_number, floor, room_type)')
      .eq('status', 'available')
      .neq('id', bed.id)
      .order('bed_number');
    const formatted: AvailableBed[] = (data ?? []).map((b: Record<string, unknown>) => {
      const room = b.rooms as Record<string, string> | null;
      return {
        id: b.id as string,
        bed_number: b.bed_number as string,
        room_id: b.room_id as string,
        room_number: room?.room_number ?? '',
        floor: room?.floor ?? '',
        room_type: room?.room_type ?? '',
      };
    });
    setAvailableBeds(formatted);
    setBedsLoading(false);
  };

  const handleAllocate = async () => {
    if (!selectedBed || !allocForm.patient_name.trim()) {
      addToast({ type: 'error', title: 'Required', message: 'Patient name is required.' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('beds').update({
      status: 'occupied',
      patient_name: allocForm.patient_name.trim(),
      patient_uhid: allocForm.patient_uhid.trim() || null,
      admitted_at: new Date().toISOString(),
      notes: allocForm.notes.trim() || null,
    }).eq('id', selectedBed.id);

    if (!error) {
      await supabase.from('bed_allocations').insert({
        bed_id: selectedBed.id,
        room_id: selectedBed.room_id,
        patient_name: allocForm.patient_name.trim(),
        patient_uhid: allocForm.patient_uhid.trim() || null,
        age: allocForm.age ? parseInt(allocForm.age) : null,
        gender: allocForm.gender,
        diagnosis: allocForm.diagnosis.trim() || null,
        allocated_by: profile?.id,
        notes: allocForm.notes.trim() || null,
      });
      await supabase.from('audit_logs').insert({
        user_id: profile?.id,
        action: 'assign',
        entity_type: 'bed',
        entity_id: selectedBed.id,
        details: { patient: allocForm.patient_name, bed: selectedBed.bed_number },
      });
      addToast({ type: 'success', title: 'Bed allocated', message: `Bed ${selectedBed.bed_number} → ${allocForm.patient_name}` });
    } else {
      addToast({ type: 'error', title: 'Error', message: error.message });
    }
    setSaving(false);
    setAllocModal(false);
    setAllocForm({ patient_name: '', patient_uhid: '', age: '', gender: 'Male', diagnosis: '', notes: '' });
    fetchRooms();
  };

  const handleRelease = async () => {
    if (!selectedBed) return;
    setSaving(true);
    await supabase.from('beds').update({
      status: 'available', patient_name: null, patient_uhid: null, admitted_at: null, notes: null,
    }).eq('id', selectedBed.id);
    await supabase.from('bed_allocations')
      .update({ discharged_at: new Date().toISOString(), discharged_by: profile?.id })
      .eq('bed_id', selectedBed.id).is('discharged_at', null);
    await supabase.from('audit_logs').insert({
      user_id: profile?.id, action: 'transfer', entity_type: 'bed', entity_id: selectedBed.id,
      details: { action: 'released', patient: selectedBed.patient_name },
    });
    addToast({ type: 'success', title: 'Bed released', message: `Bed ${selectedBed.bed_number} is now available.` });
    setSaving(false);
    setRelModal(false);
    fetchRooms();
  };

  const handleMaintenance = async (status: BedStatus) => {
    if (!selectedBed) return;
    setSaving(true);
    await supabase.from('beds').update({ status }).eq('id', selectedBed.id);
    addToast({ type: 'info', title: 'Bed updated', message: `Bed ${selectedBed.bed_number} → ${status}.` });
    setSaving(false);
    setMaintModal(false);
    fetchRooms();
  };

  const handleTransfer = async () => {
    if (!selectedBed || !targetBedId) {
      addToast({ type: 'error', title: 'Required', message: 'Please select a target bed.' });
      return;
    }
    setSaving(true);
    const now = new Date().toISOString();

    // Set current bed to available
    await supabase.from('beds').update({
      status: 'available', patient_name: null, patient_uhid: null, admitted_at: null, notes: null,
    }).eq('id', selectedBed.id);

    // Set target bed to occupied with patient info
    await supabase.from('beds').update({
      status: 'occupied',
      patient_name: selectedBed.patient_name,
      patient_uhid: selectedBed.patient_uhid,
      admitted_at: selectedBed.admitted_at,
      notes: selectedBed.notes,
    }).eq('id', targetBedId);

    // Close current allocation
    await supabase.from('bed_allocations')
      .update({ discharged_at: now, discharged_by: profile?.id })
      .eq('bed_id', selectedBed.id).is('discharged_at', null);

    // Get target bed room info
    const target = availableBeds.find(b => b.id === targetBedId);

    // Create new allocation for target bed
    await supabase.from('bed_allocations').insert({
      bed_id: targetBedId,
      room_id: target?.room_id ?? null,
      patient_name: selectedBed.patient_name ?? '',
      patient_uhid: selectedBed.patient_uhid,
      allocated_by: profile?.id,
      notes: transferReason ? `Transferred from bed ${selectedBed.bed_number}. Reason: ${transferReason}` : `Transferred from bed ${selectedBed.bed_number}`,
    });

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: profile?.id,
      action: 'transfer',
      entity_type: 'bed',
      entity_id: selectedBed.id,
      details: {
        action: 'bed_transfer',
        patient: selectedBed.patient_name,
        from_bed: selectedBed.bed_number,
        to_bed: target?.bed_number,
        to_room: target?.room_number,
        to_floor: target?.floor,
        reason: transferReason,
        performed_by: profile?.full_name,
        transfer_date: now,
      },
    });

    addToast({
      type: 'success',
      title: 'Bed Transfer Complete',
      message: `${selectedBed.patient_name} moved to Bed ${target?.bed_number} (${target?.floor})`,
    });
    setSaving(false);
    setTransfer(false);
    fetchRooms();
  };

  const allBeds = rooms.flatMap(r => (r.beds ?? []) as Bed[]);
  const stats = {
    total: allBeds.length,
    available: allBeds.filter(b => b.status === 'available').length,
    occupied: allBeds.filter(b => b.status === 'occupied').length,
    maintenance: allBeds.filter(b => b.status === 'maintenance').length,
    reserved: allBeds.filter(b => b.status === 'reserved').length,
  };
  const occupancyPct = stats.total > 0 ? Math.round((stats.occupied / stats.total) * 100) : 0;
  const filteredRooms = rooms.filter(r =>
    !search || r.room_number.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Bed & Room Management</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Real-time occupancy tracking</p>
        </div>
        <button onClick={fetchRooms} className="btn-secondary"><RefreshCw size={15} /></button>
      </div>

      {/* Floor selector */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FLOOR_OPTIONS.map(f => (
          <button key={f} onClick={() => setFloor(f)}
            className={cn('flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              floorFilter === f
                ? 'bg-brand-blue-600 text-white shadow-md'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50',
            )}>{f}</button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Beds', value: stats.total, color: 'text-slate-700 dark:text-slate-300' },
          { label: 'Available', value: stats.available, color: 'text-emerald-600' },
          { label: 'Occupied', value: stats.occupied, color: 'text-brand-red-600' },
          { label: 'Maintenance', value: stats.maintenance, color: 'text-amber-600' },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">{s.label}</p>
            <p className={cn('text-2xl font-bold mt-1', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Occupancy bar */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Occupancy Rate — {floorFilter}</span>
          <span className={cn('text-sm font-bold', occupancyPct > 80 ? 'text-red-600' : occupancyPct > 60 ? 'text-amber-600' : 'text-emerald-600')}>
            {occupancyPct}%
          </span>
        </div>
        <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500',
              occupancyPct > 80 ? 'bg-brand-red-500' : occupancyPct > 60 ? 'bg-amber-500' : 'bg-emerald-500')}
            style={{ width: `${occupancyPct}%` }}
          />
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
          {[
            { label: 'Available', pct: stats.total > 0 ? Math.round((stats.available/stats.total)*100) : 0, color: 'bg-emerald-400' },
            { label: 'Reserved', pct: stats.total > 0 ? Math.round((stats.reserved/stats.total)*100) : 0, color: 'bg-blue-400' },
          ].map(i => (
            <div key={i.label} className="flex items-center gap-1">
              <div className={cn('h-2 w-2 rounded-full', i.color)} />
              <span>{i.label}: {i.pct}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search rooms..." className="input-field pl-9 py-2 text-sm" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>
      ) : filteredRooms.length === 0 ? (
        <div className="card text-center py-12 text-slate-400">
          <BedDouble size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No rooms found for {floorFilter}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRooms.map(room => {
            const beds = (room.beds ?? []) as Bed[];
            return (
              <div key={room.id} className="card overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30">
                  <div className="flex items-center gap-3">
                    <BedDouble size={16} className="text-brand-blue-500" />
                    <div>
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">
                        Room {room.room_number}
                      </span>
                      <span className="ml-2 text-xs text-slate-500 capitalize">
                        {room.room_type.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="text-emerald-600 font-medium">{beds.filter(b => b.status === 'available').length} free</span>
                    <span>/</span>
                    <span>{beds.length} total</span>
                  </div>
                </div>
                <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {beds.map(bed => {
                    const cfg = BED_STATUS_CONFIG[bed.status];
                    return (
                      <div
                        key={bed.id}
                        className={cn(
                          'relative rounded-xl border-2 p-3 transition-all duration-200',
                          bed.status === 'occupied'
                            ? 'border-brand-red-200 dark:border-brand-red-800 bg-brand-red-50 dark:bg-brand-red-900/10'
                            : bed.status === 'maintenance'
                            ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10'
                            : bed.status === 'reserved'
                            ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10'
                            : 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10',
                        )}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{bed.bed_number}</span>
                          <span className={cn('h-2 w-2 rounded-full', cfg.dot)} />
                        </div>

                        {bed.status === 'occupied' && bed.patient_name && (
                          <div className="mb-2">
                            <p className="text-[11px] font-medium text-slate-800 dark:text-slate-200 truncate">{bed.patient_name}</p>
                            {bed.patient_uhid && (
                              <p className="text-[10px] text-slate-500 font-mono truncate">{bed.patient_uhid}</p>
                            )}
                            {bed.admitted_at && (
                              <p className="text-[9px] text-slate-400 mt-0.5">
                                Since {formatDate(bed.admitted_at, { dateStyle: 'short', timeStyle: undefined })}
                              </p>
                            )}
                          </div>
                        )}

                        {bed.status !== 'occupied' && (
                          <p className={cn('text-[11px] font-medium mb-2', cfg.color.split(' ')[1])}>
                            {cfg.label}
                          </p>
                        )}

                        {/* Actions */}
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {bed.status === 'available' && (
                            <button onClick={() => openAllocate(bed)}
                              className="flex items-center gap-0.5 text-[10px] font-medium text-emerald-700 hover:text-emerald-800 transition-colors">
                              <UserPlus size={11} /> Admit
                            </button>
                          )}
                          {bed.status === 'occupied' && (
                            <>
                              <button onClick={() => openRelease(bed)}
                                className="flex items-center gap-0.5 text-[10px] font-medium text-brand-red-600 hover:text-brand-red-700 transition-colors">
                                <UserMinus size={11} /> Release
                              </button>
                              <button onClick={() => openTransfer(bed)}
                                className="flex items-center gap-0.5 text-[10px] font-medium text-brand-blue-600 hover:text-brand-blue-700 transition-colors">
                                <ArrowRightLeft size={11} /> Transfer
                              </button>
                            </>
                          )}
                          {bed.status !== 'maintenance' && (
                            <button onClick={() => openMaint(bed)}
                              className="flex items-center gap-0.5 text-[10px] font-medium text-amber-600 hover:text-amber-700 transition-colors ml-auto">
                              <Wrench size={11} />
                            </button>
                          )}
                          {bed.status === 'maintenance' && (
                            <button onClick={() => { setSelBed(bed); handleMaintenance('available'); }}
                              className="flex items-center gap-0.5 text-[10px] font-medium text-emerald-600 hover:text-emerald-700 transition-colors">
                              <CheckCircle2 size={11} /> Done
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Admit modal */}
      <Modal open={allocModal} onClose={() => setAllocModal(false)} title="Admit Patient" size="md"
        footer={
          <>
            <button onClick={() => setAllocModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleAllocate} disabled={saving} className="btn-primary">
              {saving ? <Spinner size="sm" className="text-white" /> : 'Admit Patient'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-700 rounded-lg px-3 py-2">
            Bed: <strong>{selectedBed?.bed_number}</strong>
          </p>
          {[
            { label: 'Patient Name *', key: 'patient_name', placeholder: 'Full name', type: 'text' },
            { label: 'UHID', key: 'patient_uhid', placeholder: 'AVRON-UHID-001', type: 'text' },
            { label: 'Age', key: 'age', placeholder: '35', type: 'number' },
            { label: 'Diagnosis', key: 'diagnosis', placeholder: 'Primary diagnosis', type: 'text' },
            { label: 'Notes', key: 'notes', placeholder: 'Additional notes', type: 'text' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{f.label}</label>
              <input type={f.type} value={(allocForm as Record<string, string>)[f.key]}
                onChange={e => setAllocForm(p => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.placeholder} className="input-field" />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Gender</label>
            <select value={allocForm.gender} onChange={e => setAllocForm(p => ({ ...p, gender: e.target.value }))} className="input-field">
              {['Male', 'Female', 'Other'].map(g => <option key={g}>{g}</option>)}
            </select>
          </div>
        </div>
      </Modal>

      {/* Release modal */}
      <Modal open={releaseModal} onClose={() => setRelModal(false)} title="Release Bed" size="sm"
        footer={
          <>
            <button onClick={() => setRelModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleRelease} disabled={saving} className="btn-danger">
              {saving ? <Spinner size="sm" className="text-white" /> : 'Release Bed'}
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Release bed <strong className="text-slate-900 dark:text-white">{selectedBed?.bed_number}</strong>?
          {selectedBed?.patient_name && <> Patient <strong className="text-slate-900 dark:text-white">{selectedBed.patient_name}</strong> will be discharged from this bed.</>}
        </p>
      </Modal>

      {/* Maintenance modal */}
      <Modal open={maintModal} onClose={() => setMaintModal(false)} title="Change Bed Status" size="sm"
        footer={<button onClick={() => setMaintModal(false)} className="btn-secondary">Close</button>}
      >
        <div className="space-y-2">
          {(['maintenance', 'reserved', 'available'] as BedStatus[]).map(s => {
            const cfg = BED_STATUS_CONFIG[s];
            return (
              <button key={s} onClick={() => handleMaintenance(s)}
                className={cn('w-full flex items-center gap-3 p-3 rounded-xl border transition-all',
                  'hover:border-brand-blue-300 hover:bg-brand-blue-50 dark:hover:bg-brand-blue-900/10')}>
                <div className={cn('h-3 w-3 rounded-full', cfg.dot)} />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{cfg.label}</span>
              </button>
            );
          })}
        </div>
      </Modal>

      {/* Bed Transfer modal */}
      <Modal
        open={transferModal}
        onClose={() => setTransfer(false)}
        title="Transfer Patient to Another Bed"
        size="lg"
        footer={
          <>
            <button onClick={() => setTransfer(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleTransfer} disabled={saving || !targetBedId} className="btn-primary">
              {saving ? <Spinner size="sm" className="text-white" /> : 'Confirm Transfer'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Current bed info */}
          <div className="flex items-center gap-3 bg-brand-red-50 dark:bg-brand-red-900/20 border border-brand-red-200 dark:border-brand-red-800 rounded-lg px-4 py-3">
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Transferring from</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Bed {selectedBed?.bed_number}</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">{selectedBed?.patient_name}</p>
              {selectedBed?.patient_uhid && (
                <p className="text-xs text-slate-500 font-mono">{selectedBed.patient_uhid}</p>
              )}
            </div>
          </div>

          {/* Reason for transfer */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Reason for Transfer
            </label>
            <input
              type="text"
              value={transferReason}
              onChange={e => setTransferReason(e.target.value)}
              placeholder="e.g., ICU upgrade, room preference, medical requirement..."
              className="input-field"
            />
          </div>

          {/* Available beds list */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Select Destination Bed *
            </label>
            {bedsLoading ? (
              <div className="flex justify-center py-8"><Spinner size="md" /></div>
            ) : availableBeds.length === 0 ? (
              <div className="text-center py-8 text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                <BedDouble size={24} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">No vacant beds available for transfer</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                {availableBeds.map(bed => (
                  <button
                    key={bed.id}
                    type="button"
                    onClick={() => setTargetBedId(bed.id)}
                    className={cn(
                      'text-left p-3 rounded-xl border-2 transition-all',
                      targetBedId === bed.id
                        ? 'border-brand-blue-500 bg-brand-blue-50 dark:bg-brand-blue-900/20'
                        : 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10 hover:border-brand-blue-300',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">{bed.bed_number}</span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-1.5 py-0.5 rounded-full">Vacant</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">Room {bed.room_number}</p>
                    <p className="text-xs text-slate-500">{bed.floor}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {targetBedId && (() => {
            const dest = availableBeds.find(b => b.id === targetBedId);
            return dest ? (
              <div className="flex items-center gap-3 bg-brand-blue-50 dark:bg-brand-blue-900/20 border border-brand-blue-200 dark:border-brand-blue-800 rounded-lg px-4 py-3 text-sm">
                <ArrowRightLeft size={16} className="text-brand-blue-500 flex-shrink-0" />
                <span className="text-slate-700 dark:text-slate-300">
                  <strong>{selectedBed?.patient_name}</strong> will be transferred to Bed <strong>{dest.bed_number}</strong>, Room {dest.room_number} ({dest.floor})
                </span>
              </div>
            ) : null;
          })()}
        </div>
      </Modal>
    </div>
  );
}
