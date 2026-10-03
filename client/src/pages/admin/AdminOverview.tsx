import { Activity, Brain, FileText, ScrollText, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Alert } from '../../components/ui/Alert';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { StatCard } from '../../components/ui/StatCard';
import { api } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { usePageTitle } from '../../lib/usePageTitle';

interface Overview {
  users: { total: number; disabled: number; active7d: number };
  reports: { total: number };
  predictions: { total: number; failed: number };
  audit: { last24h: number };
  models: { loaded: number; errors: number };
  predictionsPerDay: { date: string; total: number; failed: number }[];
  engineVersion: string;
}

interface AuditItem {
  id: string;
  action: string;
  actorEmail: string | null;
  entityType: string | null;
  createdAt: string;
}

export function AdminOverview() {
  usePageTitle('Admin · Overview');
  const [data, setData] = useState<Overview | null>(null);
  const [recent, setRecent] = useState<AuditItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [overview, logs] = await Promise.all([
          api.get<Overview>('/admin/overview'),
          api.get<{ logs: AuditItem[] }>('/admin/audit-logs?limit=8'),
        ]);
        setData(overview);
        setRecent(logs.logs);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load overview.');
      }
    })();
  }, []);

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!data) return <SkeletonRows rows={6} />;

  return (
    <div>
      <PageHeader
        title="Admin overview"
        description={`System health at a glance · engine v${data.engineVersion}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Users" value={data.users.total} hint={`${data.users.active7d} active (7d) · ${data.users.disabled} disabled`} icon={<Users className="h-4 w-4" />} />
        <StatCard label="Reports" value={data.reports.total} icon={<FileText className="h-4 w-4" />} />
        <StatCard
          label="Predictions"
          value={data.predictions.total}
          hint={`${data.predictions.failed} failed`}
          icon={<Activity className="h-4 w-4" />}
        />
        <StatCard
          label="Models loaded"
          value={data.models.loaded}
          hint={data.models.errors > 0 ? `${data.models.errors} invalid artifact(s)` : 'all artifacts valid'}
          icon={<Brain className="h-4 w-4" />}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Predictions per day" subtitle="Last 14 days" />
          <CardBody>
            {data.predictionsPerDay.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">No predictions yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.predictionsPerDay} margin={{ top: 8, right: 8, bottom: 4, left: -18 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-800" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }} />
                  <Bar dataKey="total" name="Total" fill="#0ba99b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="failed" name="Failed" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Recent audit events" subtitle={`${data.audit.last24h} events in last 24h`} />
          <CardBody>
            {recent.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No events yet.</p>
            ) : (
              <ul className="space-y-2.5">
                {recent.map((l) => (
                  <li key={l.id} className="flex items-start gap-2 text-xs">
                    <ScrollText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
                    <div className="min-w-0">
                      <p className="font-medium text-gray-700 dark:text-gray-200">{l.action}</p>
                      <p className="truncate text-gray-400">
                        {l.actorEmail ?? 'system'} · {formatDateTime(l.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
