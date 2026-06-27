import { cn } from '../../lib/utils';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-10 w-10' };

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <svg
      className={cn('animate-spin text-brand-blue-600', sizes[size], className)}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export function FullPageLoader() {
  return (
    <div className="fixed inset-0 bg-white dark:bg-slate-900 flex flex-col items-center justify-center z-50">
      <div className="flex flex-col items-center gap-4">
        <img src="/assets/images/image copy copy.png" alt="Avron Hospitals" className="h-16 w-auto animate-pulse" />
        <Spinner size="lg" />
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Loading AVRON ERP...</p>
      </div>
    </div>
  );
}
