import type { RiskBand } from '../../lib/types';

const COLORS: Record<RiskBand, string> = {
  low: '#10b981',
  borderline: '#f59e0b',
  moderate: '#f97316',
  high: '#ef4444',
};

/**
 * Semicircular gauge for a model-estimated probability (0..1).
 * Deliberately labelled "model-estimated" everywhere — never presented as a
 * diagnosis or a calibrated clinical probability.
 */
export function RiskGauge({
  value,
  band,
  size = 150,
  caption,
}: {
  value?: number;
  band?: RiskBand;
  size?: number;
  caption?: string;
}) {
  const pct = typeof value === 'number' ? Math.min(1, Math.max(0, value)) : 0;
  const color = band ? COLORS[band] : '#9ca3af';

  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <svg viewBox="0 0 160 92" width={size} height={(size * 92) / 160} role="img" aria-label={caption ?? 'Model-estimated risk gauge'}>
        <path d="M 14 84 A 66 66 0 0 1 146 84" fill="none" strokeWidth="14" strokeLinecap="round" className="stroke-gray-200 dark:stroke-gray-800" />
        {typeof value === 'number' ? (
          <path
            d="M 14 84 A 66 66 0 0 1 146 84"
            fill="none"
            stroke={color}
            strokeWidth="14"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${(pct * 100).toFixed(1)} 100`}
          />
        ) : null}
        <text x="80" y="76" textAnchor="middle" className="fill-gray-900 dark:fill-gray-100" style={{ fontSize: 22, fontWeight: 600 }}>
          {typeof value === 'number' ? `${Math.round(pct * 100)}%` : '—'}
        </text>
      </svg>
      <p className="mt-1 text-center text-[11px] text-gray-500 dark:text-gray-400">{caption ?? 'Model-estimated risk score'}</p>
    </div>
  );
}
