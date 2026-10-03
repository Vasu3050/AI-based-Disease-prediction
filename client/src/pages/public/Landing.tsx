import {
  Activity,
  ArrowRight,
  Brain,
  FileCheck2,
  GitCompareArrows,
  History,
  Lock,
  Microscope,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usePageTitle } from '../../lib/usePageTitle';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

const FEATURES = [
  {
    icon: FileCheck2,
    title: 'Strict structured input',
    text: 'Reports are validated against a typed schema — units checked, values bounded, nothing guessed.',
  },
  {
    icon: Microscope,
    title: 'Reference-range analysis',
    text: 'Every value is compared to typical adult ranges (sex-aware), with lab-provided ranges respected.',
  },
  {
    icon: Brain,
    title: 'Trained ML risk models',
    text: 'Logistic-regression models trained in-repo on public datasets (PIMA, UCI CKD, ILPD) — with honest, documented metrics.',
  },
  {
    icon: Sparkles,
    title: 'Explainability',
    text: 'See which inputs pushed a risk score up or down, plus the model card behind every number.',
  },
  {
    icon: TrendingUp,
    title: 'History, comparison & trends',
    text: 'Track values over time, compare two reports side-by-side, and watch the trajectory of each marker.',
  },
  {
    icon: Lock,
    title: 'Privacy-minded',
    text: 'Self-hosted stack, minimal data collection, full account deletion, no ads or trackers.',
  },
];

const PIPELINE = [
  ['01', 'Structured input', 'You enter a blood report with explicit values and units.'],
  ['02', 'Validation & normalization', 'Units are converted to canonical form; impossible values are rejected.'],
  ['03', 'Reference-range analysis', 'Each value is flagged vs typical ranges; optional lab ranges override.'],
  ['04', 'Guideline indicators', 'ADA / WHO / NCEP / KDIGO-style rule panels flag patterns, clearly labelled as rules.'],
  ['05', 'ML risk models', 'Trained models estimate risk scores only when their required inputs are present.'],
  ['06', 'Optional explanation', 'An LLM (if configured) explains the computed results — it never invents them.'],
];

export function Landing() {
  usePageTitle();
  const { user } = useAuth();

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand-100 blur-3xl dark:bg-brand-950/50" />
        <div className="pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-sky-100 blur-3xl dark:bg-sky-950/40" />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-16 md:grid-cols-2 md:items-center md:px-8 md:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 dark:border-brand-900 dark:bg-brand-950/60 dark:text-brand-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              Educational prototype — not a medical device
            </span>
            <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
              Understand your blood test results — with{' '}
              <span className="text-brand-600 dark:text-brand-400">honest AI</span>.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-gray-600 dark:text-gray-300">
              MediPredict AI validates a structured blood report, analyzes every value against published reference
              ranges, runs transparent ML risk models, and explains it all in plain language — without ever
              pretending to be a doctor.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {user ? (
                <Link to="/app">
                  <Button size="lg" icon={<ArrowRight className="h-4 w-4" />}>
                    Open dashboard
                  </Button>
                </Link>
              ) : (
                <>
                  <Link to="/register">
                    <Button size="lg" icon={<ArrowRight className="h-4 w-4" />}>
                      Create free account
                    </Button>
                  </Link>
                  <Link to="/how-it-works">
                    <Button variant="secondary" size="lg">
                      See how it works
                    </Button>
                  </Link>
                </>
              )}
            </div>
            <p className="mt-6 text-xs text-gray-400 dark:text-gray-500">
              Demo data is synthetic and clearly labeled · No fabricated accuracy claims · Read the{' '}
              <Link className="underline hover:text-gray-600 dark:hover:text-gray-300" to="/safety">
                limitations
              </Link>
            </p>
          </div>

          {/* Product preview (static, clearly demo) */}
          <div className="relative">
            <Card className="relative z-10 space-y-4 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Report analysis — demo preview</p>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                  DEMO / SYNTHETIC
                </span>
              </div>
              <div className="space-y-2">
                {[
                  { label: 'Hemoglobin', value: '10.2 g/dL', state: 'Low', cls: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300' },
                  { label: 'Fasting glucose', value: '112 mg/dL', state: 'High', cls: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
                  { label: 'LDL cholesterol', value: '96 mg/dL', state: 'Normal', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-sm dark:border-gray-800">
                    <span className="text-gray-600 dark:text-gray-300">{row.label}</span>
                    <span className="flex items-center gap-2">
                      <span className="font-medium">{row.value}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${row.cls}`}>{row.state}</span>
                    </span>
                  </div>
                ))}
              </div>
              <div className="rounded-lg border border-gray-100 p-3 dark:border-gray-800">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Model-estimated risk score (illustration)</p>
                <div className="mt-2 flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                    <div className="h-full w-[38%] rounded-full bg-amber-500" />
                  </div>
                  <span className="text-sm font-semibold">38%</span>
                </div>
                <p className="mt-2 text-[10px] leading-relaxed text-gray-400 dark:text-gray-500">
                  Statistical estimate from a limited training dataset — not a diagnosis.
                </p>
              </div>
            </Card>
            <div className="absolute -right-4 -top-4 z-0 h-full w-full rounded-xl border border-brand-200/60 bg-brand-50/50 dark:border-brand-900/60 dark:bg-brand-950/30" />
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/40">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 md:grid-cols-4 md:px-8">
          {[
            ['5', 'risk panels (glycemic, anemia, lipids, liver, kidney)'],
            ['3', 'trained ML models + guideline engines'],
            ['20+', 'laboratory values supported'],
            ['100%', 'of model outputs explainable'],
          ].map(([value, label]) => (
            <div key={label}>
              <p className="text-2xl font-semibold text-brand-600 dark:text-brand-400">{value}</p>
              <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:px-8">
        <h2 className="text-2xl font-semibold tracking-tight">Built like real software, not a demo page</h2>
        <p className="mt-2 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
          Every visible feature works: no fake buttons, no placeholder metrics, no &quot;AI&quot; that is actually a
          single if-statement.
        </p>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <Card key={f.title} className="p-5">
              <f.icon className="h-5 w-5 text-brand-600 dark:text-brand-400" />
              <h3 className="mt-3 text-sm font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-gray-500 dark:text-gray-400">{f.text}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Pipeline */}
      <section className="border-t border-gray-200 bg-white py-16 dark:border-gray-800 dark:bg-gray-950">
        <div className="mx-auto max-w-6xl px-4 md:px-8">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-brand-600 dark:text-brand-400" />
            <h2 className="text-2xl font-semibold tracking-tight">The analysis pipeline</h2>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
            Predictions are never a single &quot;ask an LLM what disease this is&quot;. The pipeline is
            deterministic and auditable at every step.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {PIPELINE.map(([num, title, text]) => (
              <div key={num} className="rounded-xl border border-gray-200 p-5 dark:border-gray-800">
                <p className="font-mono text-xs text-brand-600 dark:text-brand-400">{num}</p>
                <h3 className="mt-2 text-sm font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-500 dark:text-gray-400">{text}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-4 text-xs text-gray-400 dark:text-gray-500">
            <span className="inline-flex items-center gap-1.5">
              <GitCompareArrows className="h-3.5 w-3.5" /> Compare two reports
            </span>
            <span className="inline-flex items-center gap-1.5">
              <History className="h-3.5 w-3.5" /> Full history
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Brain className="h-3.5 w-3.5" /> Model cards with real metrics
            </span>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-gray-200 bg-gradient-to-br from-brand-600 to-brand-800 py-16 dark:border-gray-800">
        <div className="mx-auto max-w-3xl px-4 text-center md:px-8">
          <h2 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
            Try it with clearly-labeled demo data
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-brand-50/90">
            Seed the demo dataset to explore normal, diabetes-pattern, anemia-pattern, lipid, liver and kidney
            scenarios — all synthetic and labeled as such.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to={user ? '/app' : '/register'}>
              <Button size="lg" className="bg-white text-brand-800 hover:bg-brand-50 dark:bg-white dark:text-brand-900 dark:hover:bg-brand-50">
                {user ? 'Open dashboard' : 'Get started'}
              </Button>
            </Link>
            <Link to="/safety">
              <Button size="lg" variant="secondary" className="border-white/40 bg-transparent text-white hover:bg-white/10 dark:border-white/40 dark:bg-transparent dark:text-white dark:hover:bg-white/10">
                Read the limitations
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
