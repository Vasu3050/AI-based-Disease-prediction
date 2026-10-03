import { usePageTitle } from '../../lib/usePageTitle';
import { Alert } from '../../components/ui/Alert';
import { Card } from '../../components/ui/Card';

const STEPS = [
  {
    n: 1,
    title: 'Structured input (no free-form guessing)',
    body: 'You submit a blood report as structured data: each test has an explicit value, a unit, and optionally a laboratory-specific reference range. Free-form medical text is not accepted as primary input by design.',
  },
  {
    n: 2,
    title: 'Validation & unit normalization',
    body: 'Every entry is validated: the test key must exist in the server catalog, the unit must be one of the accepted units for that test, the value must be finite and within physically plausible bounds. Units are converted to canonical units (e.g. mmol/L → mg/dL) before storage. Missing units are never silently guessed.',
  },
  {
    n: 3,
    title: 'Reference-range analysis',
    body: 'Each value is compared against typical adult reference ranges (sex-specific where standard, e.g. hemoglobin). If the report carries lab-specific ranges, those take precedence. Values are labeled low / normal / high with a relative deviation indicator.',
  },
  {
    n: 4,
    title: 'Guideline-based indicators',
    body: 'Deterministic rule panels produce transparent flags from published thresholds: glycemic categories (ADA), anemia screening (WHO severity bands), lipid classification (NCEP ATP III style), liver-enzyme patterns, and eGFR categories (CKD-EPI 2021 + KDIGO). These are clearly labeled as guideline rules — not ML and not diagnoses.',
  },
  {
    n: 5,
    title: 'ML risk models',
    body: 'Logistic-regression models (trained in this repository on documented public datasets) estimate risk scores. A model runs only when all of its required inputs are present; otherwise it is skipped with an explicit "missing inputs" message. Every model shows its dataset card and held-out validation metrics.',
  },
  {
    n: 6,
    title: 'Optional LLM explanation',
    body: 'If an LLM provider is configured (server-side only), a minimal structured summary of the already-computed results is sent to produce a plain-language explanation, which is validated against a strict JSON schema before display. The LLM cannot change the computed results, and the app works fully without it (a deterministic summary is used instead).',
  },
];

export function HowItWorks() {
  usePageTitle('How it works');

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 md:py-16">
      <h1 className="text-3xl font-semibold tracking-tight">How it works</h1>
      <p className="mt-3 leading-relaxed text-gray-600 dark:text-gray-300">
        A deterministic pipeline where every layer is visible, testable and documented. The LLM never predicts —
        it only explains.
      </p>

      <div className="mt-8">
        <Alert kind="info" title="Input example (structured)">
          <pre className="mt-2 overflow-x-auto rounded-lg bg-gray-950 p-3 text-[11px] leading-relaxed text-gray-100">
{`{
  "patient": { "age": 45, "sex": "male" },
  "report":  { "date": "2026-09-14", "fasting": true },
  "context": { "bmi": 27.4, "diastolicBp": 84 },
  "tests": {
    "hemoglobin":      { "value": 14.1, "unit": "g/dL" },
    "fasting_glucose": { "value": 112,  "unit": "mg/dL" },
    "hba1c":           { "value": 5.9,  "unit": "%" }
  }
}`}
          </pre>
        </Alert>
      </div>

      <div className="mt-8 space-y-4">
        {STEPS.map((s) => (
          <Card key={s.n} className="flex gap-4 p-5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 font-mono text-sm font-semibold text-white">
              {s.n}
            </div>
            <div>
              <h2 className="text-sm font-semibold">{s.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{s.body}</p>
            </div>
          </Card>
        ))}
      </div>

      <h2 className="mt-12 text-xl font-semibold">What "model-estimated risk score" means</h2>
      <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
        It is the output of a statistical model (probability between 0 and 1) trained to separate cases from
        non-cases in a research dataset. It is displayed as a percentage because that is what the model computes —
        but it is deliberately <strong>not</strong> presented as &quot;your chance of having disease X&quot;,
        because that would require proper external calibration and validation, which this educational prototype
        does not claim to have. Treat it as a conversation starter with a clinician, never as a verdict.
      </p>
    </div>
  );
}
