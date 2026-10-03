import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { formatDateTime } from '../../lib/format';
import type { PredictionSummary } from '../../lib/types';
import { Badge } from '../ui/Badge';
import { RiskBadge } from './RiskBadge';

/** Compact summary card for a prediction (used in dashboard + report lists). */
export function PredictionSummaryCard({ prediction }: { prediction: PredictionSummary }) {
  return (
    <Link
      to={`/app/predictions/${prediction.id}`}
      className="focus-ring block rounded-xl border border-gray-200 bg-white p-4 shadow-card transition-colors hover:border-brand-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-brand-700"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{prediction.headline}</p>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {formatDateTime(prediction.createdAt)} · engine v{prediction.engineVersion}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {prediction.bands
          .filter((b) => b.band)
          .map((b) => (
            <span key={b.targetId} className="flex items-center gap-1.5">
              <span className="text-[11px] text-gray-500 dark:text-gray-400">{b.title}</span>
              {b.band ? <RiskBadge band={b.band} small /> : null}
            </span>
          ))}
        {prediction.topFindings.map((f, i) => (
          <Badge
            key={i}
            className={
              f.status === 'concern'
                ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
            }
          >
            {f.title}
          </Badge>
        ))}
        {prediction.abnormalCount === 0 && prediction.topFindings.length === 0 ? (
          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
            All values within typical ranges
          </Badge>
        ) : null}
      </div>
    </Link>
  );
}
