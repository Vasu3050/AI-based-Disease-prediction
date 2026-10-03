import clsx from 'clsx';
import type { ReactNode } from 'react';
import { Card } from './Card';

export function StatCard({
  label,
  value,
  hint,
  icon,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={clsx('p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">{value}</p>
          {hint ? <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p> : null}
        </div>
        {icon ? <div className="shrink-0 rounded-lg bg-brand-50 p-2 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400">{icon}</div> : null}
      </div>
    </Card>
  );
}
