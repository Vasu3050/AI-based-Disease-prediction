import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-3 text-gray-400 dark:text-gray-600">{icon ?? <Inbox className="h-8 w-8" />}</div>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-md text-sm text-gray-500 dark:text-gray-400">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
