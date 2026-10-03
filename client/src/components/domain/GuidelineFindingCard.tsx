import { FINDING_META } from '../../lib/format';
import type { GuidelineFinding } from '../../lib/types';
import { Badge } from '../ui/Badge';
import { Card, CardBody, CardHeader } from '../ui/Card';

/**
 * Renders one guideline-based finding. These are produced by published
 * reference rules (WHO / ADA / NCEP / KDIGO-style), clearly distinct from ML
 * model outputs — the badge and footer make that explicit.
 */
export function GuidelineFindingCard({ finding }: { finding: GuidelineFinding }) {
  const meta = FINDING_META[finding.status];
  return (
    <Card>
      <CardHeader
        title={finding.title}
        subtitle={finding.source}
        action={<Badge className={meta.className}>{meta.label}</Badge>}
      />
      <CardBody className="space-y-2">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{finding.label}</p>
        <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">{finding.details}</p>
        {finding.inputs.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {finding.inputs.map((inp, i) => (
              <span
                key={i}
                className="rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300"
              >
                {inp.label}: <strong>{inp.value}</strong> {inp.unit}
              </span>
            ))}
          </div>
        ) : null}
        <p className="pt-1 text-[11px] text-gray-400 dark:text-gray-500">
          Guideline-based indicator (reference rules) — not an ML model output and not a diagnosis.
        </p>
      </CardBody>
    </Card>
  );
}
