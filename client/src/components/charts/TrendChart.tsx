import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TrendSeries } from '../../lib/types';

export function TrendChart({
  series,
  range,
  height = 230,
}: {
  series: TrendSeries;
  range?: { low?: number; high?: number };
  height?: number;
}) {
  const data = series.points.map((p) => ({ ...p, dateLabel: p.date.slice(5) }));

  return (
    <div>
      <p className="mb-1 text-sm font-medium text-gray-800 dark:text-gray-200">
        {series.label} <span className="text-xs font-normal text-gray-500">({series.unit})</span>
      </p>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-800" />
          <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} tickLine={false} />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} domain={['auto', 'auto']} width={44} />
          <Tooltip
            formatter={(v: number | string) => [`${v} ${series.unit}`, series.label]}
            labelFormatter={(l) => `Date: ${l}`}
            contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
          />
          {range && (range.low !== undefined || range.high !== undefined) ? (
            <ReferenceArea
              y1={range.low ?? undefined}
              y2={range.high ?? undefined}
              fill="#0ba99b"
              fillOpacity={0.08}
              strokeOpacity={0}
            />
          ) : null}
          <Line
            type="monotone"
            dataKey="value"
            stroke="#0ba99b"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
      {range && (range.low !== undefined || range.high !== undefined) ? (
        <p className="text-[11px] text-gray-400 dark:text-gray-500">
          Shaded band = typical reference range ({range.low ?? '—'}–{range.high ?? '—'}).
        </p>
      ) : null}
    </div>
  );
}
