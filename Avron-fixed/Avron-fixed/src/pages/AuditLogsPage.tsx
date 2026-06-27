import { useState, useEffect, useCallback } from 'react';
import { Search, ShieldCheck, Filter, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { cn, formatDate } from '../lib/utils';
import type { AuditLog, AuditAction } from '../types';

const ACTION_META: Record<AuditAction, { label: string; variant: 'success'|'info'|'warning'|'danger'|'neutral' }> = {
  login:          { label: 'Login',          variant: 'success' },
  logout:         { label: 'Logout',         variant: 'neutral' },
  create:         { label: 'Create',         variant: 'info' },
  update:         { label: 'Update',         variant: 'warning' },
  delete:         { label: 'Delete',         variant: 'danger' },
  assign:         { label: 'Assign',         variant: 'info' },
  approve:        { label: 'Approve',        variant: 'success' },
  reject:         { label: 'Reject',         variant: 'danger' },
  transfer:       { label: 'Transfer',       variant: 'warning' },
  reset_password: { label: 'Reset Password', variant: 'warning' },
  otp_request:    { label: 'OTP Request',    variant: 'neutral' },
};

const PAGE_SIZE = 25;

export function AuditLogsPage() {
  const [logs, setLogs]           = useState<AuditLog[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [actionFilter, setAction] = useState<AuditAction | ''>('');
  const [page, setPage]           = useState(0);
  const [total, setTotal]         = useState(0);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('audit_logs')
      .select('*, profile:profiles(id,full_name,role)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (actionFilter) q = q.eq('action', actionFilter);

    const { data, count } = await q;
    setLogs(data ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  }, [page, actionFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const filtered = search
    ? logs.filter(l => {
        const q = search.toLowerCase();
        return (
          l.action.includes(q) ||
          (l.entity_type ?? '').toLowerCase().includes(q) ||
          JSON.stringify(l.details).toLowerCase().includes(q)
        );
      })
    : logs;

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Logs</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Immutable record of all system actions ({total.toLocaleString()} total)
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search logs..."
            className="input-field pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={15} className="text-slate-400 flex-shrink-0" />
          <select
            value={actionFilter}
            onChange={e => { setAction(e.target.value as AuditAction | ''); setPage(0); }}
            className="input-field sm:w-44"
          >
            <option value="">All Actions</option>
            {Object.entries(ACTION_META).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        <button onClick={() => fetchLogs()} className="btn-secondary flex-shrink-0">
          <RefreshCw size={15} />
        </button>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <ShieldCheck size={32} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
            <p className="text-sm text-slate-500">No audit logs found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 text-left">Timestamp</th>
                  <th className="px-4 py-3 text-left">Action</th>
                  <th className="px-4 py-3 text-left hidden md:table-cell">Entity</th>
                  <th className="px-4 py-3 text-left hidden lg:table-cell">Details</th>
                  <th className="px-4 py-3 text-left hidden sm:table-cell">User</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(log => {
                  const meta = ACTION_META[log.action] ?? { label: log.action, variant: 'neutral' as const };
                  const profile = log.profile as unknown as { full_name: string } | null;
                  return (
                    <tr key={log.id} className="table-row">
                      <td className="table-cell whitespace-nowrap text-xs text-slate-500">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="table-cell">
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                      </td>
                      <td className="table-cell hidden md:table-cell text-xs text-slate-600 dark:text-slate-400 capitalize">
                        {log.entity_type ?? '—'}
                      </td>
                      <td className="table-cell hidden lg:table-cell">
                        <code className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50
                                         dark:bg-slate-700 px-2 py-0.5 rounded max-w-xs block truncate">
                          {JSON.stringify(log.details)}
                        </code>
                      </td>
                      <td className="table-cell hidden sm:table-cell text-xs text-slate-600 dark:text-slate-400">
                        {profile?.full_name ?? '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-700">
            <p className="text-xs text-slate-500">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
