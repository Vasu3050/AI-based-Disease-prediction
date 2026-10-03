import clsx from 'clsx';
import { AlertTriangle, CheckCircle2, Info, ShieldAlert, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';

type Kind = 'info' | 'success' | 'warning' | 'error' | 'medical';

const META: Record<Kind, { icon: ReactNode; className: string }> = {
  info: {
    icon: <Info className="h-5 w-5 text-sky-500" />,
    className: 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200',
  },
  success: {
    icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
    className:
      'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200',
  },
  warning: {
    icon: <AlertTriangle className="h-5 w-5 text-amber-500" />,
    className:
      'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200',
  },
  error: {
    icon: <XCircle className="h-5 w-5 text-red-500" />,
    className: 'border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200',
  },
  medical: {
    icon: <ShieldAlert className="h-5 w-5 text-red-500" />,
    className: 'border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200',
  },
};

export function Alert({
  kind = 'info',
  title,
  children,
  className,
}: {
  kind?: Kind;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const meta = META[kind];
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={clsx('flex gap-3 rounded-xl border p-4', meta.className, className)}>
      <div className="mt-0.5 shrink-0">{meta.icon}</div>
      <div className="min-w-0 text-sm">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={clsx(title && 'mt-1', 'leading-relaxed opacity-90')}>{children}</div> : null}
      </div>
    </div>
  );
}
