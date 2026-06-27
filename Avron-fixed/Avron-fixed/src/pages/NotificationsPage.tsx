import { CheckCheck, Trash2, Bell, AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { Badge } from '../components/ui/Badge';
import { cn, formatDate } from '../lib/utils';
import type { NotificationType } from '../types';

const typeConfig: Record<NotificationType, { icon: typeof Bell; iconClass: string; variant: 'info'|'success'|'warning'|'danger'|'neutral' }> = {
  info:     { icon: Info,          iconClass: 'text-sky-500',       variant: 'info' },
  success:  { icon: CheckCircle2,  iconClass: 'text-emerald-500',   variant: 'success' },
  warning:  { icon: AlertTriangle, iconClass: 'text-amber-500',     variant: 'warning' },
  error:    { icon: AlertCircle,   iconClass: 'text-brand-red-500', variant: 'danger' },
  critical: { icon: AlertCircle,   iconClass: 'text-brand-red-600 animate-pulse-ring', variant: 'danger' },
};

export function NotificationsPage() {
  const { user } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, refreshNotifications } = useNotifications();

  const deleteNotif = async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id).eq('user_id', user?.id ?? '');
    refreshNotifications();
  };

  const deleteAll = async () => {
    await supabase.from('notifications').delete().eq('user_id', user?.id ?? '');
    refreshNotifications();
  };

  return (
    <div className="space-y-5 animate-fade-in max-w-2xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {notifications.length} total · {unreadCount} unread
          </p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button onClick={() => markAllAsRead()} className="btn-secondary text-xs py-2">
              <CheckCheck size={14} /> Mark all read
            </button>
          )}
          {notifications.length > 0 && (
            <button onClick={deleteAll} className="btn-secondary text-xs py-2 text-brand-red-500">
              <Trash2 size={14} /> Clear all
            </button>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="card text-center py-20">
          <Bell size={40} className="mx-auto mb-4 text-slate-300 dark:text-slate-600" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No notifications</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            You're all caught up! Notifications will appear here.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {notifications.map((n, idx) => {
            const cfg = typeConfig[n.type];
            const Icon = cfg.icon;
            return (
              <div
                key={n.id}
                className={cn(
                  'flex items-start gap-4 p-4 transition-colors',
                  idx < notifications.length - 1 && 'border-b border-slate-100 dark:border-slate-700',
                  !n.is_read && 'bg-brand-blue-50/50 dark:bg-brand-blue-900/5',
                  'hover:bg-slate-50 dark:hover:bg-slate-700/30',
                )}
              >
                <div className={cn(
                  'h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5',
                  !n.is_read ? 'bg-white dark:bg-slate-700 shadow-sm' : 'bg-slate-100 dark:bg-slate-700/50',
                )}>
                  <Icon size={18} className={cfg.iconClass} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn(
                      'text-sm',
                      n.is_read ? 'text-slate-600 dark:text-slate-400' : 'font-semibold text-slate-900 dark:text-white',
                    )}>
                      {n.title}
                    </p>
                    <Badge variant={cfg.variant} className="flex-shrink-0 capitalize text-[10px]">
                      {n.type}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    {n.message}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1.5">{formatDate(n.created_at)}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {!n.is_read && (
                    <button
                      onClick={() => markAsRead(n.id)}
                      className="p-1.5 text-slate-400 hover:text-brand-blue-600
                                 hover:bg-brand-blue-50 dark:hover:bg-brand-blue-900/20
                                 rounded-lg transition-colors"
                      title="Mark as read"
                    >
                      <CheckCheck size={13} />
                    </button>
                  )}
                  <button
                    onClick={() => deleteNotif(n.id)}
                    className="p-1.5 text-slate-400 hover:text-brand-red-600
                               hover:bg-brand-red-50 dark:hover:bg-brand-red-900/20
                               rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
