import clsx from 'clsx';
import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ className, children, ...rest }: CardProps) {
  return (
    <div
      className={clsx(
        'rounded-xl border border-gray-200 bg-white shadow-card dark:border-gray-800 dark:bg-gray-900',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx('flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4 dark:border-gray-800', className)}>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, children, ...rest }: CardProps) {
  return (
    <div className={clsx('px-5 py-4', className)} {...rest}>
      {children}
    </div>
  );
}
