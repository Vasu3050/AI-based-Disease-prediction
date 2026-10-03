import clsx from 'clsx';
import type { ReactNode } from 'react';

export interface TabItem {
  id: string;
  label: ReactNode;
  count?: number;
}

export function Tabs({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={clsx('flex gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-gray-800 dark:bg-gray-900', className)}
    >
      {items.map((item) => (
        <button
          key={item.id}
          role="tab"
          aria-selected={value === item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={clsx(
            'focus-ring flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            value === item.id
              ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-gray-100'
              : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
          )}
        >
          {item.label}
          {item.count !== undefined ? (
            <span className="ml-2 rounded-full bg-gray-200 px-1.5 py-0.5 text-[11px] text-gray-700 dark:bg-gray-700 dark:text-gray-300">
              {item.count}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
