import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useNotifications } from '../../contexts/NotificationContext';

const configs = {
  success: {
    icon: CheckCircle,
    classes: 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/30',
    iconClass: 'text-emerald-500',
    titleClass: 'text-emerald-900 dark:text-emerald-100',
    msgClass: 'text-emerald-700 dark:text-emerald-300',
  },
  error: {
    icon: AlertCircle,
    classes: 'border-brand-red-200 dark:border-brand-red-800 bg-brand-red-50 dark:bg-brand-red-900/30',
    iconClass: 'text-brand-red-500',
    titleClass: 'text-brand-red-900 dark:text-brand-red-100',
    msgClass: 'text-brand-red-700 dark:text-brand-red-300',
  },
  warning: {
    icon: AlertTriangle,
    classes: 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30',
    iconClass: 'text-amber-500',
    titleClass: 'text-amber-900 dark:text-amber-100',
    msgClass: 'text-amber-700 dark:text-amber-300',
  },
  info: {
    icon: Info,
    classes: 'border-brand-blue-200 dark:border-brand-blue-800 bg-brand-blue-50 dark:bg-brand-blue-900/30',
    iconClass: 'text-brand-blue-500',
    titleClass: 'text-brand-blue-900 dark:text-brand-blue-100',
    msgClass: 'text-brand-blue-700 dark:text-brand-blue-300',
  },
};

export function ToastContainer() {
  const { toasts, removeToast } = useNotifications();

  if (!toasts.length) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full">
      {toasts.map(t => {
        const cfg = configs[t.type];
        const Icon = cfg.icon;
        return (
          <div
            key={t.id}
            className={cn(
              'flex items-start gap-3 p-4 rounded-xl border shadow-card-lg animate-slide-up',
              cfg.classes,
            )}
          >
            <Icon size={18} className={cn('flex-shrink-0 mt-0.5', cfg.iconClass)} />
            <div className="flex-1 min-w-0">
              <p className={cn('text-sm font-semibold', cfg.titleClass)}>{t.title}</p>
              <p className={cn('text-xs mt-0.5', cfg.msgClass)}>{t.message}</p>
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="flex-shrink-0 p-0.5 rounded opacity-60 hover:opacity-100 transition-opacity"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
