import { BrainCircuit } from 'lucide-react';
import { formatNumber } from '../../lib/format';
import type { MlModelResult } from '../../lib/types';
import { ContributionBars } from '../charts/ContributionBars';
import { RiskGauge } from '../charts/RiskGauge';
import { Alert } from '../ui/Alert';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { RiskBadge } from './RiskBadge';

/** One ML model result with gauge, explainability and honest metrics. */
export function ModelResultCard({ model }: { model: MlModelResult }) {
  if (model.status === 'insufficient_data') {
    return (
      <Card>
        <CardHeader title={model.title} subtitle={model.description} action={<RiskBadge band="low" small />} />
        <CardBody>
          <Alert kind="info" title="Not enough input values for this model">
            <p>
              Missing: <strong>{model.missingFeatures?.map((m) => m.label).join(', ') || '—'}</strong>. No values
              are imputed or guessed.
            </p>
            {model.note ? <p className="mt-1">{model.note}</p> : null}
          </Alert>
        </CardBody>
      </Card>
    );
  }

  if (model.status !== 'ok') return null;

  return (
    <Card>
      <CardHeader
        title={model.title}
        subtitle={model.description}
        action={model.band ? <RiskBadge band={model.band} /> : null}
      />
      <CardBody className="space-y-4">
        <div className="flex flex-col items-center gap-6 md:flex-row md:items-start">
          <div className="shrink-0">
            <RiskGauge value={model.probability} band={model.band} caption="Model-estimated risk score (0–100%)" />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
              This score is the output of a logistic-regression model trained on a public dataset. It is a
              <strong> statistical estimate, not a diagnosis</strong>, and it can be wrong in both directions —
              including missing real problems (false negatives).
            </p>
            {model.metrics ? (
              <details className="group rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
                <summary className="cursor-pointer select-none font-medium text-gray-600 dark:text-gray-300">
                  Model card: dataset & held-out validation metrics
                </summary>
                <div className="mt-2 space-y-1.5">
                  <p>
                    Dataset: <strong>{model.metrics.datasetName}</strong> · train n={model.metrics.nTrain} · test
                    n={model.metrics.nTest} · positive prevalence {formatNumber(model.metrics.prevalence * 100, 1)}%
                  </p>
                  <p>
                    ROC-AUC {formatNumber(model.metrics.rocAuc, 3)} · PR-AUC {formatNumber(model.metrics.prAuc, 3)} ·
                    Accuracy {formatNumber(model.metrics.accuracy * 100, 1)}% · Precision{' '}
                    {formatNumber(model.metrics.precision * 100, 1)}% · Recall {formatNumber(model.metrics.recall * 100, 1)}% ·
                    F1 {formatNumber(model.metrics.f1, 3)} · Brier {formatNumber(model.metrics.brier, 3)}
                  </p>
                  <p className="italic">
                    Metrics measured on a held-out split of the training dataset — not a guarantee of real-world
                    clinical performance.
                  </p>
                </div>
              </details>
            ) : null}
            <p className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500">
              <BrainCircuit className="h-3.5 w-3.5" />
              {model.modelName} · v{model.modelVersion} · contributions in standardized log-odds space
            </p>
          </div>
        </div>

        {model.contributions && model.contributions.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Which inputs influenced this score
            </p>
            <ContributionBars data={model.contributions} />
          </div>
        ) : null}

        {model.note ? (
          <p className="text-xs leading-relaxed text-gray-400 dark:text-gray-500">{model.note}</p>
        ) : null}
      </CardBody>
    </Card>
  );
}
