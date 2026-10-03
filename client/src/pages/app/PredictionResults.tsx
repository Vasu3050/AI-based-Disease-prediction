import { ArrowLeft, Printer } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ModelResultCard } from '../../components/domain/ModelResultCard';
import { GuidelineFindingCard } from '../../components/domain/GuidelineFindingCard';
import { DisclaimerBanner } from '../../components/domain/DisclaimerBanner';
import { ExplanationCard } from '../../components/domain/ExplanationCard';
import { ValueStatusPill } from '../../components/domain/ValueStatusPill';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { PageSpinner } from '../../components/ui/Spinner';
import { StatCard } from '../../components/ui/StatCard';
import { Tabs } from '../../components/ui/Tabs';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import { formatDateTime, formatNumber, rangeText } from '../../lib/format';
import type { ClientReport, Prediction } from '../../lib/types';
import { usePageTitle } from '../../lib/usePageTitle';

export function PredictionResults() {
  usePageTitle('Analysis results');
  const { id } = useParams<{ id: string }>();
  const toast = useToast();

  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [report, setReport] = useState<ClientReport | null>(null);
  const [llm, setLlm] = useState<{ enabled: boolean; provider: string | null; model: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const [findingsTab, setFindingsTab] = useState('attention');
  const [valuesTab, setValuesTab] = useState('abnormal');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!id) return;
      try {
        const pred = await api.get<{ prediction: Prediction }>(`/predictions/${id}`);
        if (cancelled) return;
        setPrediction(pred.prediction);
        const [rep, llmStatus] = await Promise.allSettled([
          api.get<{ report: ClientReport }>(`/reports/${pred.prediction.reportId}`),
          api.get<{ enabled: boolean; provider: string | null; model: string | null }>('/meta/llm'),
        ]);
        if (cancelled) return;
        if (rep.status === 'fulfilled') setReport(rep.value.report);
        if (llmStatus.status === 'fulfilled') setLlm(llmStatus.value);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load results.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const generateExplanation = useCallback(
    async (force: boolean) => {
      if (!id) return;
      setGenerating(true);
      try {
        const data = await api.post<{ prediction: Prediction }>(
          `/predictions/${id}/explain${force ? '?force=1' : ''}`
        );
        setPrediction(data.prediction);
        const ex = data.prediction.explanation;
        if (ex?.source === 'llm') toast.success('AI explanation generated.');
        else if (ex?.fallbackReason) toast.warning('LLM unavailable — a deterministic summary was generated instead.');
        else toast.info('Deterministic summary generated (no LLM configured).');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Explanation generation failed.');
      } finally {
        setGenerating(false);
      }
    },
    [id, toast]
  );

  const attentionFindings = useMemo(
    () => prediction?.results.guidelines.filter((g) => g.status !== 'ok') ?? [],
    [prediction]
  );
  const okFindings = useMemo(
    () => prediction?.results.guidelines.filter((g) => g.status === 'ok') ?? [],
    [prediction]
  );

  if (loading) return <PageSpinner label="Loading analysis…" />;
  if (error || !prediction) {
    return (
      <Alert kind="error" title="Results unavailable">
        {error ?? 'Not found.'}
      </Alert>
    );
  }

  const r = prediction.results;

  return (
    <div>
      <div className="mb-4 print:hidden">
        <Link to={`/app/reports/${prediction.reportId}`} className="text-sm text-brand-600 hover:underline dark:text-brand-400">
          <ArrowLeft className="mr-1 inline h-3.5 w-3.5" />
          Back to report
        </Link>
      </div>

      <PageHeader
        title="Analysis results"
        description={
          <>
            {report?.patient?.name ? `${report.patient.name} · ` : ''}
            {formatDateTime(r.analyzedAt)} · engine v{r.engineVersion}
            {report?.demoLabel ? ` · ${report.demoLabel}` : ''}
          </>
        }
        actions={
          <Button variant="secondary" size="sm" icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>
            Print / Save PDF
          </Button>
        }
      />

      <div className="mb-6">
        <DisclaimerBanner />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Values analyzed" value={r.summary.testsAnalyzed} />
        <StatCard
          label="Outside typical ranges"
          value={r.summary.abnormalCount}
          hint={r.summary.abnormalCount === 0 ? 'all within typical ranges' : 'see table below'}
        />
        <StatCard label="Guideline findings" value={`${attentionFindings.length} need attention`} hint={`${okFindings.length} within reference`} />
        <StatCard
          label="Model estimates"
          value={r.summary.modelCount}
          hint={
            r.models.some((m) => m.status === 'insufficient_data')
              ? `${r.models.filter((m) => m.status === 'insufficient_data').length} skipped (missing inputs)`
              : 'all models ran'
          }
        />
      </div>

      {(r.computed.egfr !== undefined || r.computed.bmi !== undefined) && (
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {r.computed.egfr !== undefined ? (
            <span className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 dark:border-gray-800 dark:bg-gray-900">
              eGFR (CKD-EPI 2021): <strong>{r.computed.egfr}</strong> mL/min/1.73m²
            </span>
          ) : null}
          {r.computed.bmi !== undefined ? (
            <span className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 dark:border-gray-800 dark:bg-gray-900">
              BMI: <strong>{r.computed.bmi}</strong> kg/m²
            </span>
          ) : null}
        </div>
      )}

      {/* Models */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold tracking-tight">Model-estimated risk scores</h2>
        <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
          Logistic-regression models trained on public datasets (see model cards below each score). These are
          statistical estimates — not diagnoses, not calibrated clinical probabilities.
        </p>
        <div className="mt-4 space-y-5">
          {r.models.length === 0 ? (
            <Alert kind="info">
              No ML models are loaded on this server. Train them with <code>npm run dataset:fetch</code> and{' '}
              <code>npm run train:models</code>, then refresh from the admin panel.
            </Alert>
          ) : (
            r.models.map((m) => <ModelResultCard key={m.targetId} model={m} />)
          )}
        </div>
      </section>

      {/* Guideline findings */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold tracking-tight">Guideline-based indicators</h2>
        <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
          Deterministic checks against published reference thresholds (ADA, WHO, NCEP ATP III-style, KDIGO). Labelled
          as rules — not ML, not diagnoses.
        </p>
        <div className="mt-4">
          <Tabs
            value={findingsTab}
            onChange={setFindingsTab}
            items={[
              { id: 'attention', label: 'Needs attention', count: attentionFindings.length },
              { id: 'ok', label: 'Within reference', count: okFindings.length },
            ]}
          />
          <div className="mt-4 space-y-4">
            {(findingsTab === 'attention' ? attentionFindings : okFindings).map((g) => (
              <GuidelineFindingCard key={g.id} finding={g} />
            ))}
            {(findingsTab === 'attention' ? attentionFindings : okFindings).length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {findingsTab === 'attention' ? 'No findings need attention.' : 'No reference findings in this view.'}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {/* Values table */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold tracking-tight">All analyzed values</h2>
        <div className="mt-4">
          <Tabs
            value={valuesTab}
            onChange={setValuesTab}
            items={[
              { id: 'abnormal', label: 'Outside ranges', count: r.abnormalValues.length },
              { id: 'all', label: 'All values', count: r.values.length },
            ]}
          />
          <Card className="mt-4 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400">
                    <th className="px-5 py-3 font-medium">Test</th>
                    <th className="px-3 py-3 font-medium">Value</th>
                    <th className="px-3 py-3 font-medium">Range used</th>
                    <th className="px-3 py-3 font-medium">Deviation</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {(valuesTab === 'abnormal' ? r.abnormalValues : r.values).map((v) => (
                    <tr key={v.key}>
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-900 dark:text-gray-100">{v.label}</p>
                        <p className="text-xs text-gray-400">{v.group}</p>
                      </td>
                      <td className="px-3 py-3 font-mono">
                        {formatNumber(v.value, Math.abs(v.value) < 10 ? 2 : 0)} {v.unit}
                      </td>
                      <td className="px-3 py-3 text-gray-500 dark:text-gray-400">
                        {rangeText(v.range.low, v.range.high)}
                        {v.labRangeUsed ? ' (lab)' : ''}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                            <div
                              className={`h-full rounded-full ${v.status === 'high' ? 'bg-red-500' : v.status === 'low' ? 'bg-sky-500' : 'bg-emerald-500'}`}
                              style={{ width: `${Math.max(4, v.deviation * 100)}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-gray-400">
                            {v.status === 'normal' ? '—' : `${Math.round(v.deviation * 100)}%`}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <ValueStatusPill status={v.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </section>

      {/* Explanation */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold tracking-tight">Explanation</h2>
        <div className="mt-4">
          <ExplanationCard
            explanation={prediction.explanation}
            llmEnabled={llm?.enabled ?? false}
            llmLabel={llm?.model ?? llm?.provider ?? undefined}
            onGenerate={generateExplanation}
            generating={generating}
          />
        </div>
      </section>

      {/* Meta / disclaimers */}
      <section className="mt-8 space-y-3">
        <Card>
          <CardHeader title="Traceability" subtitle="What produced this analysis" />
          <CardBody className="grid gap-2 text-xs text-gray-500 dark:text-gray-400 sm:grid-cols-2">
            <p>Engine version: {r.engineVersion}</p>
            <p>Analyzed at: {formatDateTime(r.analyzedAt)}</p>
            <p>
              Models used:{' '}
              {prediction.modelVersions.length > 0
                ? prediction.modelVersions.map((m) => `${m.key} v${m.version}`).join(', ')
                : 'none'}
            </p>
            <p>Report id: {prediction.reportId}</p>
          </CardBody>
        </Card>
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Full disclaimers
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
            {r.disclaimers.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
