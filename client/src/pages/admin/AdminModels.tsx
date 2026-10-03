import { Brain, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import { formatDateTime, formatNumber } from '../../lib/format';
import { usePageTitle } from '../../lib/usePageTitle';

interface ModelInfo {
  key: string;
  name: string;
  targetId: string;
  title: string;
  version: string;
  trainedAt: string;
  features: string[];
  metrics: {
    rocAuc: number;
    prAuc: number;
    accuracy: number;
    precision: number;
    recall: number;
    f1: number;
    brier: number;
    nTrain: number;
    nTest: number;
    prevalence: number;
    datasetName: string;
  };
  dataset: { name: string; source: string; url?: string; license?: string };
  notes: string;
}

interface ModelsResponse {
  modelsDir: string;
  loadedAt: string;
  models: ModelInfo[];
  errors: { file: string; error: string }[];
  usage: { key: string; version: string; predictions: number }[];
}

export function AdminModels() {
  usePageTitle('Admin · Models');
  const toast = useToast();
  const [data, setData] = useState<ModelsResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await api.get<ModelsResponse>('/admin/models');
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load models.');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await api.post('/admin/models/refresh');
      toast.success('Model artifacts reloaded from disk.');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Refresh failed.');
    } finally {
      setRefreshing(false);
    }
  };

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!data) return <SkeletonRows rows={4} />;

  const usageFor = (key: string, version: string) =>
    data.usage.find((u) => u.key === key && u.version === version)?.predictions ?? 0;

  return (
    <div>
      <PageHeader
        title="Prediction models"
        description="Loaded model artifacts, their datasets and held-out validation metrics. Metrics come from training runs — not real-world guarantees."
        actions={
          <Button size="sm" loading={refreshing} icon={<RefreshCw className="h-4 w-4" />} onClick={refresh}>
            Reload artifacts
          </Button>
        }
      />

      {data.errors.length > 0 ? (
        <Alert kind="warning" title={`${data.errors.length} invalid artifact(s)`} className="mb-5">
          <ul className="list-disc pl-5">
            {data.errors.map((e) => (
              <li key={e.file}>
                <strong>{e.file}</strong>: {e.error}
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <p className="mb-5 text-xs text-gray-500 dark:text-gray-400">
        Artifacts directory: <code className="rounded bg-black/5 px-1 dark:bg-white/10">{data.modelsDir}</code> · last
        loaded {formatDateTime(data.loadedAt)}
      </p>

      {data.models.length === 0 ? (
        <EmptyState
          icon={<Brain className="h-8 w-8" />}
          title="No models loaded"
          description="Run `npm run dataset:fetch` then `npm run train:models` to train the models, then reload artifacts."
        />
      ) : (
        <div className="space-y-5">
          {data.models.map((m) => (
            <Card key={m.key}>
              <CardHeader
                title={`${m.title} (${m.targetId})`}
                subtitle={`${m.name} · v${m.version} · trained ${formatDateTime(m.trainedAt)}`}
                action={
                  <Badge className="bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-300">
                    {usageFor(m.key, m.version)} predictions
                  </Badge>
                }
              />
              <CardBody className="space-y-3">
                <div className="grid gap-3 text-xs sm:grid-cols-4 md:grid-cols-7">
                  {[
                    ['ROC-AUC', formatNumber(m.metrics.rocAuc, 3)],
                    ['PR-AUC', formatNumber(m.metrics.prAuc, 3)],
                    ['Accuracy', `${formatNumber(m.metrics.accuracy * 100, 1)}%`],
                    ['Precision', `${formatNumber(m.metrics.precision * 100, 1)}%`],
                    ['Recall', `${formatNumber(m.metrics.recall * 100, 1)}%`],
                    ['F1', formatNumber(m.metrics.f1, 3)],
                    ['Brier', formatNumber(m.metrics.brier, 3)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg bg-gray-50 p-2.5 text-center dark:bg-gray-800/60">
                      <p className="text-[10px] uppercase tracking-wide text-gray-400">{label}</p>
                      <p className="mt-0.5 font-mono text-sm font-semibold text-gray-800 dark:text-gray-200">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="grid gap-2 text-xs text-gray-500 dark:text-gray-400 sm:grid-cols-2">
                  <p>
                    Dataset: <strong>{m.dataset.name}</strong>
                    {m.dataset.license ? ` · license: ${m.dataset.license}` : ''}
                  </p>
                  <p>
                    Samples: train n={m.metrics.nTrain} · test n={m.metrics.nTest} · prevalence{' '}
                    {formatNumber(m.metrics.prevalence * 100, 1)}%
                  </p>
                  <p>Features: {m.features.join(', ')}</p>
                  {m.dataset.url ? (
                    <p className="truncate">
                      Source: <span className="text-gray-400">{m.dataset.url}</span>
                    </p>
                  ) : null}
                </div>
                {m.notes ? (
                  <p className="rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                    {m.notes}
                  </p>
                ) : null}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
