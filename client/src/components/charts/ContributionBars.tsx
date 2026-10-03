import {
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { FeatureContribution } from '../../lib/types';
import { formatNumber } from '../../lib/format';

/** Horizontal bars showing per-feature contributions to the model log-odds. */
export function ContributionBars({ data }: { data: FeatureContribution[] }) {
  const sorted = [...data].sort((a, b) => a.contribution - b.contribution);
  const height = Math.max(160, sorted.length * 38 + 40);

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={sorted} layout="vertical" margin={{ top: 8, right: 28, bottom: 8, left: 8 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="label"
            width={150}
            tick={{ fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value: number | string, _name, item) => {
              const p = item?.payload as FeatureContribution | undefined;
              const v = typeof value === 'number' ? value : Number(value);
              return [
                `${v > 0 ? '+' : ''}${formatNumber(v, 3)} (input: ${p ? `${p.value}${p.unit ? ' ' + p.unit : ''}` : ''})`,
                'Contribution',
              ];
            }}
            contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
          />
          <ReferenceLine x={0} stroke="#9ca3af" />
          <Bar dataKey="contribution" radius={4} maxBarSize={22}>
            {sorted.map((entry, i) => (
              <Cell key={i} fill={entry.contribution >= 0 ? '#ef4444' : '#3b82f6'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-1 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
        Contributions are in standardized (z-score) log-odds space — red pushes the model score up, blue pushes it
        down. They explain the model&apos;s output; they are not causal medical statements.
      </p>
    </div>
  );
}
