import { ArrowRight, GitCompareArrows } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PredictionSummaryCard } from '../../components/domain/PredictionSummaryCard';
import { ValueStatusPill } from '../../components/domain/ValueStatusPill';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Select } from '../../components/ui/Input';
import { PageHeader } from '../../components/ui/PageHeader';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/format';
import type { ClientReport, Paginated, PredictionSummary, ReportWithPrediction } from '../../lib/types';
import { usePageTitle } from '../../lib/usePageTitle';

interface CompareRow {
  key: string;
  label: string;
  unit: string;
  group: string;
  a: number | null;
  b: number | null;
  delta: number | null;
  statusA: 'low' | 'normal' | 'high' | null;
  statusB: 'low' | 'normal' | 'high' | null;
}

interface CompareResult {
  first: ClientReport;
  second: ClientReport;
  deltas: CompareRow[];
  predictions: { first: PredictionSummary | null; second: PredictionSummary | null };
}

export function Compare() {
  usePageTitle('Compare reports');
  const [params, setParams] = useSearchParams();
  const [reports, setReports] = useState<ReportWithPrediction[]>([]);
  const [leftId, setLeftId] = useState(params.get('left') ?? '');
  const [rightId, setRightId] = useState(params.get('right') ?? '');
  const [result, setResult] = useState<CompareResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Paginated<ReportWithPrediction>>('/reports?limit=100&page=1')
      .then((r) => setReports(r.items))
      .catch(() => setReports([]));
  }, []);

  const runCompare = useCallback(
    async (left: string, right: string) => {
      if (!left || !right || left === right) {
        setError('Select two different reports.');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await api.post<CompareResult>('/reports/compare', { ids: [left, right] });
        setResult(res);
        setParams({ left, right });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Comparison failed.');
      } finally {
        setLoading(false);
      }
    },
    [setParams]
  );

  useEffect(() => {
    const l = params.get('left');
    const r = params.get('right');
    if (l && r) void runCompare(l, r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flagged = result?.deltas.filter((d) => d.statusA !== d.statusB) ?? [];

  return (
    <div>
      <PageHeader
        title="Compare reports"
        description="Pick two reports to see how each value changed between them (sorted by report date)."
      />

      <Card className="mb-6">
        <CardBody className="grid items-end gap-4 md:grid-cols-[1fr_1fr_auto]">
          <Select label="First report" value={leftId} onChange={(e) => setLeftId(e.target.value)}>
            <option value="">Select…</option>
            {reports.map((r) => (
              <option key={r.id} value={r.id}>
                {formatDate(r.reportDate)} {r.patient?.name ? `· ${r.patient.name}` : ''} · {Object.keys(r.tests).length} tests
              </option>
            ))}
          </Select>
          <Select label="Second report" value={rightId} onChange={(e) => setRightId(e.target.value)}>
            <option value="">Select…</option>
            {reports.map((r) => (
              <option key={r.id} value={r.id}>
                {formatDate(r.reportDate)} {r.patient?.name ? `· ${r.patient.name}` : ''} · {Object.keys(r.tests).length} tests
              </option>
            ))}
          </Select>
          <Button
            icon={<GitCompareArrows className="h-4 w-4" />}
            loading={loading}
            disabled={!leftId || !rightId || leftId === rightId}
            onClick={() => runCompare(leftId, rightId)}
          >
            Compare
          </Button>
        </CardBody>
      </Card>

      {error ? (
        <Alert kind="error" className="mb-6">
          {error}
        </Alert>
      ) : null}

      {!result && !loading ? (
        <EmptyState
          icon={<GitCompareArrows className="h-8 w-8" />}
          title="Choose two reports"
          description={
            reports.length < 2
              ? 'You need at least two stored reports to compare. Submit one more first.'
              : 'Select two reports above to see the differences per laboratory value.'
          }
          action={
            reports.length < 2 ? (
              <Link to="/app/reports/new">
                <Button>New report</Button>
              </Link>
            ) : undefined
          }
        />
      ) : null}

      {result ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            {([result.first, result.second] as ClientReport[]).map((rep, i) => (
              <Card key={rep.id}>
                <CardHeader
                  title={i === 0 ? 'Earlier report' : 'Later report'}
                  subtitle={`${formatDate(rep.reportDate)}${rep.patient?.name ? ` · ${rep.patient.name}` : ''}${rep.labName ? ` · ${rep.labName}` : ''}`}
                />
                <CardBody className="space-y-3">
                  <Link to={`/app/reports/${rep.id}`} className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">
                    Open report →
                  </Link>
                  {result.predictions[i === 0 ? 'first' : 'second'] ? (
                    <PredictionSummaryCard prediction={result.predictions[i === 0 ? 'first' : 'second']!} />
                  ) : (
                    <p className="text-xs text-gray-500 dark:text-gray-400">No analysis stored for this report.</p>
                  )}
                </CardBody>
              </Card>
            ))}
          </div>

          {flagged.length > 0 ? (
            <Card>
              <CardHeader title="Changes that cross reference ranges" subtitle={`${flagged.length} value(s)`} />
              <CardBody className="space-y-2">
                {flagged.map((d) => (
                  <div key={d.key} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium text-gray-800 dark:text-gray-200">{d.label}</span>
                    <span className="text-gray-500 dark:text-gray-400">
                      {d.a ?? '—'} → {d.b ?? '—'} {d.unit}
                    </span>
                    <ValueStatusPill status={d.statusA ?? undefined} />
                    <ArrowRight className="h-3.5 w-3.5 text-gray-400" />
                    <ValueStatusPill status={d.statusB ?? undefined} />
                  </div>
                ))}
              </CardBody>
            </Card>
          ) : (
            <Alert kind="success" title="No range-crossing changes">
              No value moved from/or into an out-of-range status between these reports.
            </Alert>
          )}

          <Card>
            <CardHeader title="Per-value comparison" subtitle="Values present in either report; deltas computed on canonical (normalized) units." />
            <CardBody className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400">
                      <th className="px-5 py-3 font-medium">Test</th>
                      <th className="px-3 py-3 font-medium">Earlier</th>
                      <th className="px-3 py-3 font-medium">Later</th>
                      <th className="px-3 py-3 font-medium">Δ change</th>
                      <th className="px-5 py-3 font-medium">Status change</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {result.deltas.map((d) => (
                      <tr key={d.key} className={d.statusA !== d.statusB ? 'bg-amber-50/60 dark:bg-amber-950/20' : ''}>
                        <td className="px-5 py-3">
                          <p className="font-medium text-gray-900 dark:text-gray-100">{d.label}</p>
                          <p className="text-xs text-gray-400">{d.group}</p>
                        </td>
                        <td className="px-3 py-3 font-mono">{d.a ?? '—'}</td>
                        <td className="px-3 py-3 font-mono">{d.b ?? '—'}</td>
                        <td className="px-3 py-3">
                          {d.delta === null ? (
                            <span className="text-gray-400">—</span>
                          ) : (
                            <span
                              className={
                                d.delta === 0
                                  ? 'text-gray-500'
                                  : d.delta > 0
                                    ? 'text-red-600 dark:text-red-400'
                                    : 'text-sky-600 dark:text-sky-400'
                              }
                            >
                              {d.delta > 0 ? '+' : ''}
                              {d.delta} {d.unit}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1.5">
                            {d.statusA ? <ValueStatusPill status={d.statusA} /> : <span className="text-gray-400">—</span>}
                            {d.statusA !== d.statusB ? (
                              <>
                                <ArrowRight className="h-3.5 w-3.5 text-gray-400" />
                                {d.statusB ? <ValueStatusPill status={d.statusB} /> : <span className="text-gray-400">—</span>}
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>

          <p className="text-xs text-gray-400 dark:text-gray-500">
            Range status uses the analysis rules (sex-aware typical ranges; lab-provided ranges override defaults
            where present). Deltas are for interpretation by a professional — not medical advice.
          </p>
        </div>
      ) : null}
    </div>
  );
}
