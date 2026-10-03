import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

export interface DonutSlice {
  name: string;
  value: number;
  color: string;
}

export function StatusDonut({
  slices,
  centerLabel,
  centerValue,
}: {
  slices: DonutSlice[];
  centerLabel?: string;
  centerValue?: string | number;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total === 0) {
    return <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">No data yet.</p>;
  }
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={slices}
            dataKey="value"
            nameKey="name"
            innerRadius={58}
            outerRadius={82}
            paddingAngle={2}
            strokeWidth={0}
            isAnimationActive={false}
          >
            {slices.map((s, i) => (
              <Cell key={i} fill={s.color} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">{centerValue ?? total}</p>
        {centerLabel ? <p className="text-[11px] text-gray-500 dark:text-gray-400">{centerLabel}</p> : null}
      </div>
      <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
        {slices.map((s) => (
          <span key={s.name} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            {s.name}: {s.value}
          </span>
        ))}
      </div>
    </div>
  );
}
