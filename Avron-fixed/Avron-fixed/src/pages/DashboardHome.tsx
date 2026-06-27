import { useState, useEffect, useCallback } from 'react';
import { Users, Building2, BedDouble, Activity, Clock, ArrowUpRight, Layers, Ticket, FileImage, Package, Truck, FlaskConical, Radio, Pill } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from '../contexts/RouterContext';
import { ROLE_LABELS, FLOORS } from '../types';
import { formatDate } from '../lib/utils';

interface DashboardStats {
  total_users: number;
  active_users: number;
  total_departments: number;
  active_departments: number;
  total_beds: number;
  occupied_beds: number;
  available_beds: number;
  total_tickets: number;
  open_tickets: number;
  assigned_tickets: number;
  resolved_tickets: number;
  closed_tickets: number;
  current_admissions: number;
  total_discharges: number;
  total_media: number;
  total_assets: number;
  active_assets: number;
  total_deliveries: number;
  pending_deliveries: number;
  total_lab_requests: number;
  total_radiology_requests: number;
  total_drug_requests: number;
  total_requisitions: number;
  pending_requisitions: number;
}

const EMPTY_STATS: DashboardStats = {
  total_users: 0, active_users: 0,
  total_departments: 0, active_departments: 0,
  total_beds: 0, occupied_beds: 0, available_beds: 0,
  total_tickets: 0, open_tickets: 0, assigned_tickets: 0, resolved_tickets: 0, closed_tickets: 0,
  current_admissions: 0, total_discharges: 0,
  total_media: 0,
  total_assets: 0, active_assets: 0,
  total_deliveries: 0, pending_deliveries: 0,
  total_lab_requests: 0, total_radiology_requests: 0, total_drug_requests: 0,
  total_requisitions: 0, pending_requisitions: 0,
};

// Tables that trigger a dashboard refresh on any change
const WATCHED_TABLES = [
  'profiles', 'departments', 'beds', 'bed_allocations',
  'tickets', 'discharge_requests', 'media_files', 'assets',
  'deliveries', 'lab_requests', 'radiology_requests', 'drug_requests',
  'requisitions', 'audit_logs',
];

export function DashboardHome() {
  const { profile, hasRole } = useAuth();
  const { navigate } = useRouter();
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [recentActivity, setRecentActivity] = useState<Array<{
    id: string; action: string; details: Record<string, unknown>; created_at: string;
  }>>([]);
  const [statsLoading, setStatsLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    // Try the view first (fast single query)
    const { data: viewData, error: viewErr } = await supabase
      .from('dashboard_stats')
      .select('*')
      .single();

    if (!viewErr && viewData) {
      // Cast all numeric fields — Supabase returns them as strings via views
      const s: DashboardStats = Object.fromEntries(
        Object.entries(viewData).map(([k, v]) => [k, typeof v === 'string' ? Number(v) : v])
      ) as unknown as DashboardStats;
      setStats(s);
    } else {
      // Fallback: individual queries (works even before the view migration is applied)
      const [
        usersRes, deptRes, bedsRes,
        ticketsRes, allocRes, dischargeRes,
        mediaRes, assetsRes, deliveryRes,
        labRes, radioRes, drugRes, reqRes,
      ] = await Promise.all([
        supabase.from('profiles').select('id, is_active'),
        supabase.from('departments').select('id, is_active'),
        supabase.from('beds').select('id, status'),
        supabase.from('tickets').select('id, status'),
        supabase.from('bed_allocations').select('id, discharged_at'),
        supabase.from('discharge_requests').select('id, status'),
        supabase.from('media_files').select('id'),
        supabase.from('assets').select('id, status'),
        supabase.from('deliveries').select('id, status'),
        supabase.from('lab_requests').select('id'),
        supabase.from('radiology_requests').select('id'),
        supabase.from('drug_requests').select('id'),
        supabase.from('requisitions').select('id, status'),
      ]);

      const users     = usersRes.data     ?? [];
      const depts     = deptRes.data      ?? [];
      const beds      = bedsRes.data      ?? [];
      const tickets   = ticketsRes.data   ?? [];
      const allocs    = allocRes.data     ?? [];
      const discharges = dischargeRes.data ?? [];
      const media     = mediaRes.data     ?? [];
      const assets    = assetsRes.data    ?? [];
      const deliveries = deliveryRes.data ?? [];
      const labs      = labRes.data       ?? [];
      const radios    = radioRes.data     ?? [];
      const drugs     = drugRes.data      ?? [];
      const reqs      = reqRes.data       ?? [];

      setStats({
        total_users:            users.length,
        active_users:           users.filter(u => u.is_active).length,
        total_departments:      depts.length,
        active_departments:     depts.filter(d => d.is_active).length,
        total_beds:             beds.length,
        occupied_beds:          beds.filter(b => b.status === 'occupied').length,
        available_beds:         beds.filter(b => b.status === 'available').length,
        total_tickets:          tickets.length,
        open_tickets:           tickets.filter(t => t.status === 'open').length,
        assigned_tickets:       tickets.filter(t => ['assigned','in_progress'].includes(t.status)).length,
        resolved_tickets:       tickets.filter(t => t.status === 'resolved').length,
        closed_tickets:         tickets.filter(t => t.status === 'closed').length,
        current_admissions:     allocs.filter(a => a.discharged_at === null).length,
        total_discharges:       discharges.filter(d => d.status === 'completed').length,
        total_media:            media.length,
        total_assets:           assets.length,
        active_assets:          assets.filter(a => a.status === 'active').length,
        total_deliveries:       deliveries.length,
        pending_deliveries:     deliveries.filter(d => ['created','assigned','picked_up','in_transit'].includes(d.status)).length,
        total_lab_requests:     labs.length,
        total_radiology_requests: radios.length,
        total_drug_requests:    drugs.length,
        total_requisitions:     reqs.length,
        pending_requisitions:   reqs.filter(r => r.status === 'created').length,
      });
    }

    setStatsLoading(false);
  }, []);

  const fetchActivity = useCallback(async () => {
    const { data } = await supabase
      .from('audit_logs')
      .select('id,action,details,created_at')
      .order('created_at', { ascending: false })
      .limit(8);
    setRecentActivity(data ?? []);
  }, []);

  useEffect(() => {
    fetchStats();
    fetchActivity();

    // Subscribe to ALL relevant tables
    const channel = supabase.channel('dashboard-realtime-v2');

    WATCHED_TABLES.forEach(table => {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => {
          fetchStats();
          if (table === 'audit_logs') fetchActivity();
        },
      );
    });

    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchStats, fetchActivity]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const statCards = [
    {
      label: 'Total Staff',
      value: stats.total_users,
      sub: `${stats.active_users} active`,
      icon: Users,
      color: 'bg-brand-blue-500',
      action: () => navigate('users'),
      canView: hasRole('super_admin', 'md', 'department_head'),
    },
    {
      label: 'Departments',
      value: stats.total_departments,
      sub: `${stats.active_departments} operational`,
      icon: Building2,
      color: 'bg-emerald-500',
      action: () => navigate('departments'),
      canView: true,
    },
    {
      label: 'Total Beds',
      value: stats.total_beds,
      sub: `${stats.occupied_beds} occupied · ${stats.available_beds} free`,
      icon: BedDouble,
      color: 'bg-violet-500',
      action: () => navigate('bed-management'),
      canView: true,
    },
    {
      label: 'Admissions',
      value: stats.current_admissions,
      sub: `${stats.total_discharges} discharged`,
      icon: Activity,
      color: 'bg-rose-500',
      action: () => navigate('bed-management'),
      canView: true,
    },
    {
      label: 'Tickets',
      value: stats.total_tickets,
      sub: `${stats.open_tickets} open · ${stats.assigned_tickets} in progress`,
      icon: Ticket,
      color: 'bg-amber-500',
      action: () => navigate('tickets'),
      canView: true,
    },
    {
      label: 'Media Files',
      value: stats.total_media,
      sub: 'Uploaded documents',
      icon: FileImage,
      color: 'bg-cyan-500',
      action: () => navigate('media'),
      canView: hasRole('super_admin', 'md', 'it_team'),
    },
    {
      label: 'Assets',
      value: stats.total_assets,
      sub: `${stats.active_assets} active`,
      icon: Package,
      color: 'bg-orange-500',
      action: () => navigate('assets'),
      canView: hasRole('super_admin', 'md', 'biomedical_team'),
    },
    {
      label: 'Deliveries',
      value: stats.total_deliveries,
      sub: `${stats.pending_deliveries} pending`,
      icon: Truck,
      color: 'bg-teal-500',
      action: () => navigate('deliveries'),
      canView: true,
    },
    {
      label: 'Hospital Floors',
      value: FLOORS.length,
      sub: 'Mapped & tracked',
      icon: Layers,
      color: 'bg-indigo-500',
      action: () => navigate('floor-map'),
      canView: true,
    },
    {
      label: 'Lab Requests',
      value: stats.total_lab_requests,
      sub: 'Total submitted',
      icon: FlaskConical,
      color: 'bg-green-500',
      action: () => navigate('lab'),
      canView: true,
    },
    {
      label: 'Radiology',
      value: stats.total_radiology_requests,
      sub: 'Total submitted',
      icon: Radio,
      color: 'bg-pink-500',
      action: () => navigate('radiology'),
      canView: true,
    },
    {
      label: 'Pharmacy',
      value: stats.total_drug_requests,
      sub: 'Drug requests',
      icon: Pill,
      color: 'bg-lime-500',
      action: () => navigate('pharmacy'),
      canView: true,
    },
  ];

  const StatValue = ({ loading, value }: { loading: boolean; value: number | string }) =>
    loading
      ? <span className="inline-block h-7 w-12 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
      : <span>{value}</span>;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br
                      from-brand-blue-600 via-brand-blue-700 to-slate-800 p-6 text-white">
        <div className="relative z-10">
          <p className="text-brand-blue-200 text-sm font-medium">{greeting},</p>
          <h1 className="text-2xl font-bold mt-1">{profile?.full_name || 'Welcome'}</h1>
          <p className="text-brand-blue-300 text-sm mt-1">
            {profile ? ROLE_LABELS[profile.role] : ''} &nbsp;·&nbsp;
            {formatDate(new Date().toISOString(), { dateStyle: 'full', timeStyle: undefined })}
          </p>
          <div className="flex items-center gap-2 mt-4">
            <span className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm
                             border border-white/20 rounded-full px-3 py-1 text-xs font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              AVRON ERP — Live Dashboard
            </span>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/5 -translate-y-12 translate-x-12" />
        <div className="absolute bottom-0 right-16 w-32 h-32 rounded-full bg-white/5 translate-y-10" />
        <img src="/assets/images/image copy copy.png" alt="" className="absolute right-6 bottom-4 h-16 opacity-10 hidden sm:block" />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {statCards.filter(c => c.canView).map(card => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className={`stat-card ${card.action ? 'cursor-pointer group' : ''}`}
              onClick={card.action}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {card.label}
                  </p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1.5">
                    <StatValue loading={statsLoading} value={card.value} />
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{card.sub}</p>
                </div>
                <div className={`${card.color} p-2.5 rounded-xl text-white flex-shrink-0`}>
                  <Icon size={18} />
                </div>
              </div>
              {card.action && (
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700
                                flex items-center gap-1 text-xs text-brand-blue-600 dark:text-brand-blue-400
                                group-hover:gap-2 transition-all">
                  <span>View details</span>
                  <ArrowUpRight size={12} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Tickets summary strip */}
      <div className="card p-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Ticket Status Breakdown</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Open',        value: stats.open_tickets,     color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' },
            { label: 'In Progress', value: stats.assigned_tickets,  color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
            { label: 'Resolved',    value: stats.resolved_tickets,  color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
            { label: 'Closed',      value: stats.closed_tickets,    color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
          ].map(t => (
            <div key={t.label} className={`rounded-xl px-4 py-3 ${t.color} cursor-pointer`} onClick={() => navigate('tickets')}>
              <p className="text-xs font-medium opacity-70">{t.label}</p>
              <p className="text-xl font-bold mt-0.5">
                <StatValue loading={statsLoading} value={t.value} />
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Floor summary */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Hospital Floor Overview</h2>
            <button
              onClick={() => navigate('floor-map')}
              className="text-xs text-brand-blue-600 dark:text-brand-blue-400 hover:underline"
            >
              View map
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { floor: 'Basement',      units: 'Radiology · X-Ray · USG · HR · IT',  status: 'operational' },
              { floor: 'Ground Floor',  units: 'Emergency · Pharmacy · Billing',       status: 'operational' },
              { floor: '1st Floor',     units: 'OPD · Consultation · Registration',    status: 'operational' },
              { floor: '2nd–3rd Floor', units: 'General Ward (32 beds)',               status: 'operational' },
              { floor: '4th–5th Floor', units: 'Private Rooms · Suites',              status: 'operational' },
              { floor: '6th Floor',     units: 'ICU 1 & ICU 2',                       status: 'critical' },
              { floor: '7th Floor',     units: 'OT 1 & OT 2 · Recovery',              status: 'restricted' },
              { floor: '8th Floor',     units: 'MD Office · Administration',           status: 'restricted' },
              { floor: 'Terrace',       units: 'Utilities · HVAC · Oxygen',            status: 'operational' },
            ].map(f => (
              <div
                key={f.floor}
                className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 hover:bg-slate-100
                           dark:hover:bg-slate-700 transition-colors cursor-default"
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                    f.status === 'operational' ? 'bg-emerald-400' :
                    f.status === 'critical' ? 'bg-brand-red-400 animate-pulse' :
                    'bg-amber-400'
                  }`} />
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{f.floor}</p>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">{f.units}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Recent activity */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Recent Activity</h2>
            {hasRole('super_admin', 'md') && (
              <button
                onClick={() => navigate('audit-logs')}
                className="text-xs text-brand-blue-600 dark:text-brand-blue-400 hover:underline"
              >
                Full log
              </button>
            )}
          </div>
          <div className="space-y-3">
            {recentActivity.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No recent activity</p>
            ) : (
              recentActivity.map(log => (
                <div key={log.id} className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-slate-100 dark:bg-slate-700
                                  flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Clock size={12} className="text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-800 dark:text-slate-200 capitalize">
                      {log.action.replace('_', ' ')}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {formatDate(log.created_at)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
