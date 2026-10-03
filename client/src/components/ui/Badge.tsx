import clsx from 'clsx';
import type { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  className?: string;
  title?: string;
}

export function Badge({ children, className, title }: BadgeProps) {
  return (
    <span
      title={title}
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        className ?? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
      )}
    >
      {children}
    </span>
  );
}
