import clsx from 'clsx';

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-md bg-gray-200 dark:bg-gray-800', className)} />;
}

export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-card dark:border-gray-800 dark:bg-gray-900">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="mt-3 h-8 w-2/3" />
      <Skeleton className="mt-3 h-3 w-1/2" />
    </div>
  );
}

export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
