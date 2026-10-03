import { ArrowLeft, FileDown, GitCompareArrows, PlayCircle, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PredictionSummaryCard } from '../../components/domain/PredictionSummaryCard';
import { ValueStatusPill } from '../../components/domain/ValueStatusPill';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { PageSpinner } from '../../components/ui/Spinner';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import { formatDate, formatNumber, rangeText } from '../../lib/format';
import type { ClientReport, PredictionSummary } from '../../lib/types';
import { usePageTitle } from '../../lib/usePageTitle';

export function ReportDetail() {
  usePageTitle('Report');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [report, setReport] = useState<ClientReport | null>(null);
  const [latestPrediction, setLatestPrediction] = useState<PredictionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api.get<{ report: ClientReport; latestPrediction: PredictionSummary | null }>(
        `/reports/${id}`
      );
      setReport(data.report);
      setLatestPrediction(data.latestPrediction);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const runAnalysis = async () => {
    if (!id) return;
    setRunning(true);
    try {
      const pred = await api.post<{ prediction: { id: string } }>('/predictions', { reportId: id });
      toast.success('Analysis completed.');
      navigate(`/app/predictions/${pred.prediction.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Analysis failed.');
    } finally {
      setRunning(false);
    }
  };

  const doDelete = async () => {
    if (!id) return;
    try {
      await api.del(`/reports/${id}`);
      toast.success('Report deleted.');
      navigate('/app/history');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed.');
    }
  };

  if (loading) return <PageSpinner label="Loading report…" />;
  if (error || !report) {
    return (
      <Alert kind="error" title="Report unavailable">
        {error ?? 'Not found.'}
      </Alert>
    );
  }

  const entries = Object.entries(report.tests);
  const abnormal = entries.filter(([, t]) => t.status && t.status !== 'normal');

  return (
    <div>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            Report · {formatDate(report.reportDate)}
            {report.demoLabel ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                {report.demoLabel}
              </span>
            ) : null}
          </span>
        }
        description={
          <>
            {report.patient?.name ? `${report.patient.name} · ` : ''}
            {report.patient.age} y · {report.patient.sex}
            {report.labName ? ` · ${report.labName}` : ''}
            {report.fasting ? ' · fasting sample' : ''}
          </>
        }
        actions={
          <>
            <Link to="/app/history">
              <Button variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />}>
                History
              </Button>
            </Link>
            <Link to={`/app/compare?left=${report.id}`}>
              <Button variant="secondary" size="sm" icon={<GitCompareArrows className="h-4 w-4" />}>
                Compare
              </Button>
            </Link>
            <Button
              variant="secondary"
              size="sm"
              icon={<Trash2 className="h-4 w-4" />}
              onClick={() => setConfirmDelete(true)}
            >
              Delete
            </Button>
            <Button size="sm" loading={running} icon={<PlayCircle className="h-4 w-4" />} onClick={runAnalysis}>
              {latestPrediction ? 'Re-run analysis' : 'Run analysis'}
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader title="Laboratory values" subtitle={`${entries.length} tests · canonical units`} />
            <CardBody className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400">
                      <th className="px-5 py-3 font-medium">Test</th>
                      <th className="px-3 py-3 font-medium">Value</th>
                      <th className="px-3 py-3 font-medium">Typical range</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {entries.map(([key, t]) => (
                      <tr key={key}>
                        <td className="px-5 py-3">
                          <p className="font-medium text-gray-900 dark:text-gray-100">{t.label ?? key}</p>
                          <p className="text-xs text-gray-400">{t.group}</p>
                        </td>
                        <td className="px-3 py-3">
                          <span className="font-mono">
                            {formatNumber(t.value, t.value % 1 === 0 ? 0 : 2)} {t.unit}
                          </span>
                          {t.submittedUnit !== t.unit ? (
                            <p className="text-[11px] text-gray-400">
                              entered as {t.submittedValue} {t.submittedUnit}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-3 py-3 text-gray-500 dark:text-gray-400">
                          {t.labRange
                            ? `${rangeText(t.labRange.low, t.labRange.high)} (lab)`
                            : 'see analysis'}
                        </td>
                        <td className="px-5 py-3">
                          <ValueStatusPill status={t.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>

          {report.notes ? (
            <Card>
              <CardHeader title="Notes" />
              <CardBody>
                <p className="whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-300">{report.notes}</p>
              </CardBody>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Analysis" subtitle={`${abnormal.length} value(s) outside typical ranges`} />
            <CardBody className="space-y-3">
              {latestPrediction ? (
                <>
                  <PredictionSummaryCard prediction={latestPrediction} />
                  <Link to={`/app/predictions/${latestPrediction.id}`} className="block">
                    <Button variant="secondary" className="w-full" icon={<FileDown className="h-4 w-4" />}>
                      Open full results
                    </Button>
                  </Link>
                </>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No analysis yet for this report. Run the deterministic pipeline to compute reference-range
                    flags, guideline indicators and model estimates.
                  </p>
                  <Button className="w-full" loading={running} icon={<PlayCircle className="h-4 w-4" />} onClick={runAnalysis}>
                    Run analysis
                  </Button>
                </div>
              )}
            </CardBody>
          </Card>

          {abnormal.length > 0 ? (
            <Card>
              <CardHeader title="Values needing attention" />
              <CardBody className="space-y-2">
                {abnormal.map(([key, t]) => (
                  <div key={key} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-300">{t.label ?? key}</span>
                    <span className="flex items-center gap-2">
                      <span className="font-mono">
                        {formatNumber(t.value, 2)} {t.unit}
                      </span>
                      <ValueStatusPill status={t.status} />
                    </span>
                  </div>
                ))}
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this report?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={doDelete}>
              Delete permanently
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600 dark:text-gray-300">
          This deletes the report and all of its analyses. This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
