import { RefreshCw, Sparkles, Stethoscope } from 'lucide-react';
import { useState } from 'react';
import type { PredictionExplanation } from '../../lib/types';
import { formatDateTime } from '../../lib/format';
import { Alert } from '../ui/Alert';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardBody, CardHeader } from '../ui/Card';

/**
 * Renders the explanation record. Clearly separates:
 *  - LLM-generated text (validated JSON, provider shown)
 *  - deterministic fallback summary (no LLM available)
 * The explanation NEVER replaces the computed structured results.
 */
export function ExplanationCard({
  explanation,
  llmEnabled,
  llmLabel,
  onGenerate,
  generating,
}: {
  explanation: PredictionExplanation | null;
  llmEnabled: boolean;
  llmLabel?: string;
  onGenerate: (force: boolean) => void;
  generating: boolean;
}) {
  const [showAll, setShowAll] = useState(false);

  if (!explanation) {
    return (
      <Card>
        <CardHeader
          title="Plain-language explanation"
          subtitle={
            llmEnabled
              ? `Uses the configured LLM (${llmLabel ?? 'AI'}) to explain the computed results — it cannot change them.`
              : 'No LLM is configured — a deterministic offline summary will be generated instead.'
          }
        />
        <CardBody className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Generate a structured explanation of this analysis: what the abnormal values mean, which findings matter
            most, and questions to discuss with a healthcare professional.
          </p>
          <Button
            onClick={() => onGenerate(false)}
            loading={generating}
            icon={llmEnabled ? <Sparkles className="h-4 w-4" /> : <Stethoscope className="h-4 w-4" />}
          >
            Generate explanation
          </Button>
          {llmEnabled ? (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Local models may take a while for the first request (model load). A deterministic fallback is used
              automatically if the LLM is unavailable or returns invalid output.
            </p>
          ) : null}
        </CardBody>
      </Card>
    );
  }

  const c = explanation.content;
  return (
    <Card>
      <CardHeader
        title="Plain-language explanation"
        subtitle={`Generated ${formatDateTime(explanation.generatedAt)}`}
        action={
          <div className="flex items-center gap-2">
            {explanation.source === 'llm' ? (
              <Badge
                className="bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-300"
                title={`Provider: ${explanation.provider ?? ''} · Model: ${explanation.model ?? ''}`}
              >
                AI-generated · {explanation.model ?? explanation.provider}
              </Badge>
            ) : (
              <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                Auto summary (no LLM)
              </Badge>
            )}
            <Button variant="ghost" size="sm" loading={generating} onClick={() => onGenerate(true)} icon={<RefreshCw className="h-3.5 w-3.5" />}>
              Regenerate
            </Button>
          </div>
        }
      />
      <CardBody className="space-y-5">
        {explanation.fallbackReason ? <Alert kind="warning">{explanation.fallbackReason}</Alert> : null}

        <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-200">{c.summary}</p>

        {c.keyFindings.length > 0 ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Key findings
            </p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-gray-600 dark:text-gray-300">
              {c.keyFindings.map((k, i) => (
                <li key={i}>{k}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {c.valueExplanations.length > 0 ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              About the flagged values
            </p>
            <div className="mt-2 space-y-2">
              {(showAll ? c.valueExplanations : c.valueExplanations.slice(0, 4)).map((v, i) => (
                <div key={i} className="rounded-lg border border-gray-100 p-3 text-sm dark:border-gray-800">
                  <span className="font-medium text-gray-800 dark:text-gray-200">{v.label}: </span>
                  <span className="text-gray-600 dark:text-gray-300">{v.finding}</span>
                </div>
              ))}
            </div>
            {c.valueExplanations.length > 4 ? (
              <button
                type="button"
                onClick={() => setShowAll(!showAll)}
                className="mt-2 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
              >
                {showAll ? 'Show fewer' : `Show all ${c.valueExplanations.length}`}
              </button>
            ) : null}
          </div>
        ) : null}

        {c.questionsForDoctor.length > 0 ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Questions to discuss with a healthcare professional
            </p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-gray-600 dark:text-gray-300">
              {c.questionsForDoctor.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="rounded-lg bg-gray-50 p-3 text-xs leading-relaxed text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
          <p>
            <strong>Uncertainty: </strong>
            {c.uncertainty}
          </p>
          <p className="mt-2">
            <strong>Disclaimer: </strong>
            {c.disclaimer}
          </p>
        </div>
      </CardBody>
    </Card>
  );
}
