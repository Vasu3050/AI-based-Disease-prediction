import clsx from 'clsx';
import { Loader2 } from 'lucide-react';

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-gray-500 dark:text-gray-400">
      <Loader2 className={clsx('h-4 w-4 animate-spin', className)} />
      {label ? <span className="text-sm">{label}</span> : <span className="sr-only">Loading</span>}
    </span>
  );
}

export function PageSpinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner className="h-6 w-6" label={label} />
    </div>
  );
}
