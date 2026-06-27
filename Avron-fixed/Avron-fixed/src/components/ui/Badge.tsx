import { cn } from '../../lib/utils';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-brand-blue-100 text-brand-blue-700 dark:bg-brand-blue-900/30 dark:text-brand-blue-400',
  success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  danger:  'bg-brand-red-100 text-brand-red-700 dark:bg-brand-red-900/30 dark:text-brand-red-400',
  info:    'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  neutral: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
};

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
  dot?: boolean;
}

export function Badge({ children, variant = 'default', className, dot }: BadgeProps) {
  return (
    <span className={cn('badge', variantClasses[variant], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
