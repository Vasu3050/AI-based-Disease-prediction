import { ArrowRight, FilePlus2, FileText, FlaskConical, GitCompare, TrendingUp, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PredictionSummaryCard } from '../../components/domain/PredictionSummaryCard';
import { StatusDonut } from '../../components/charts/StatusDonut';
import { Button } from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { StatCard } from '../../components/ui/StatCard';
import { ValueStatusPill } from '../../components/domain/ValueStatusPill';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { formatDate, formatDateTime } from '../../lib/format';
import type { Paginated, PredictionSummary, ReportWithPrediction } from '../../lib/types';
import { usePageTitle } from '../../lib/usePageTitle';

export function Dashboard() {
  usePageTitle('Dashboard');
  const { user } = useAuth();
  const [reports, setReports] = useState<ReportWithPrediction[] | null>(null);
  const [reportsTotal, setReportsTotal] = useState(0);
  const [predictions, setPredictions] = useState<PredictionSummary[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [r, p] = await Promise.all([
          api.get<Paginated<ReportWithPrediction>>('/reports?limit=6&page=1'),
          api.get<{ predictions: PredictionSummary[] }>('/predictions?limit=6'),
        ]);
        if (cancelled) return;
        setReports(r.items);
        setReportsTotal(r.total);
        setPredictions(p.predictions);
      } catch {
        if (!cancelled) {
          setReports([]);
          setPredictions([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const latestReport = reports?.[0];
  const totalAbnormal = reports?.reduce(
    (sum, r) => sum + (r.latestPrediction?.abnormalCount ?? 0),
    0
  );
  const latestTests = latestReport ? Object.values(latestReport.tests) : [];
  const latestNormal = latestTests.filter((t) => t.status === 'normal').length;
  const latestAbnormal = latestTests.filter((t) => t.status && t.status !== 'normal').length;

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${user?.name?.split(' ')[0] ?? 'there'}`}
        description="Your blood-test analysis workspace. Everything here is educational decision-support — not a diagnosis."
        actions={
          <Link to="/app/reports/new">
            <Button icon={<FilePlus2 className="h-4 w-4" />}>New report</Button>
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Reports stored" value={reportsTotal} icon={<FileText className="h-4 w-4" />} />
        <StatCard
          label="Last report"
          value={latestReport ? formatDate(latestReport.reportDate) : '—'}
          hint={latestReport?.patient?.name ?? latestReport?.labName ?? undefined}
          icon={<FlaskConical className="h-4 w-4" />}
        />
        <StatCard
          label="Analyses run"
          value={predictions?.length ?? '—'}
          hint="recent (up to 6 shown)"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          label="Out-of-range values"
          value={totalAbnormal ?? '—'}
          hint="across recent reports"
          icon={<ArrowRight className="h-4 w-4" />}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              title="Recent reports"
              subtitle="Latest submissions and their analysis status"
              action={
                <Link to="/app/history" className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">
                  View all
                </Link>
              }
            />
            <CardBody>
              {reports === null ? (
                <SkeletonRows rows={4} />
              ) : reports.length === 0 ? (
                <EmptyState
                  title="No reports yet"
                  description="Submit your first structured blood report to see validation, reference-range analysis and model-based risk estimates."
                  action={
                    <Link to="/app/reports/new">
                      <Button icon={<FilePlus2 className="h-4 w-4" />}>Create first report</Button>
                    </Link>
                  }
                />
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                  {reports.map((r) => {
                    const testEntries = Object.values(r.tests);
                    const abnormal = testEntries.filter((t) => t.status && t.status !== 'normal');
                    return (
                      <li key={r.id}>
                        <Link
                          to={`/app/reports/${r.id}`}
                          className="focus-ring -mx-2 flex items-center justify-between gap-4 rounded-lg px-2 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/60"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                              {r.patient?.name ? `${r.patient.name} · ` : ''}
                              {formatDate(r.reportDate)}
                              {r.demoLabel ? (
                                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                                  DEMO
                                </span>
                              ) : null}
                            </p>
                            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                              {testEntries.length} tests · {r.labName ?? 'no lab specified'}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {abnormal.slice(0, 2).map((t, i) => (
                              <span key={i} className="hidden items-center gap-1 sm:flex">
                                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                  {t.label ?? t.unit}
                                </span>
                                <ValueStatusPill status={t.status} />
                              </span>
                            ))}
                            {abnormal.length > 2 ? (
                              <span className="text-xs text-gray-400">+{abnormal.length - 2}</span>
                            ) : null}
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Recent analyses" subtitle="Model + guideline results" />
            <CardBody className="space-y-3">
              {predictions === null ? (
                <SkeletonRows rows={3} />
              ) : predictions.length === 0 ? (
                <p className="py-4 text-sm text-gray-500 dark:text-gray-400">No analyses yet.</p>
              ) : (
                predictions
                  .slice(0, 4)
                  .map((p) => <PredictionSummaryCard key={p.id} prediction={p} />)
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Quick actions" />
            <CardBody className="grid grid-cols-2 gap-3">
              {[
                { to: '/app/reports/new', label: 'New report', icon: FilePlus2 },
                { to: '/app/patients', label: 'Patients', icon: Users },
                { to: '/app/trends', label: 'Trends', icon: TrendingUp },
                { to: '/app/compare', label: 'Compare', icon: GitCompare },
              ].map((a) => (
                <Link
                  key={a.to}
                  to={a.to}
                  className="focus-ring flex flex-col items-center gap-2 rounded-xl border border-gray-200 px-3 py-4 text-center text-xs font-medium text-gray-600 transition-colors hover:border-brand-300 hover:text-brand-700 dark:border-gray-800 dark:text-gray-300 dark:hover:border-brand-800 dark:hover:text-brand-300"
                >
                  <a.icon className="h-5 w-5" />
                  {a.label}
                </Link>
              ))}
            </CardBody>
          </Card>

          {latestReport ? (
            <Card>
              <CardHeader title="Latest analysis" subtitle={formatDateTime(latestReport.createdAt)} />
              <CardBody>
                {latestReport.latestPrediction ? (
                  <PredictionSummaryCard prediction={latestReport.latestPrediction} />
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Analysis pending.</p>
                )}
                {latestNormal + latestAbnormal > 0 ? (
                  <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-800">
                    <StatusDonut
                      slices={[
                        { name: 'Within ranges', value: latestNormal, color: '#10b981' },
                        { name: 'Outside ranges', value: latestAbnormal, color: '#ef4444' },
                      ]}
                      centerValue={latestTests.length}
                      centerLabel="values"
                    />
                  </div>
                ) : null}
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
