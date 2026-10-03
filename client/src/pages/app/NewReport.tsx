import { ChevronDown, FilePlus2, Info, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Checkbox, Input, Select, Textarea } from '../../components/ui/Input';
import { PageHeader } from '../../components/ui/PageHeader';
import { PageSpinner } from '../../components/ui/Spinner';
import { useToast } from '../../context/ToastContext';
import { api, ApiClientError, fieldIssues } from '../../lib/api';
import type { Patient, Sex, TestCatalogItem } from '../../lib/types';
import { usePageTitle } from '../../lib/usePageTitle';

interface TestRowState {
  enabled: boolean;
  value: string;
  unit: string;
  labLow: string;
  labHigh: string;
}

const NORMAL_BASE: Record<string, number> = {
  hemoglobin: 14.6,
  rbc: 5.2,
  wbc: 6500,
  platelets: 250000,
  mcv: 88,
  fasting_glucose: 92,
  hba1c: 5.2,
  total_cholesterol: 178,
  ldl: 96,
  hdl: 52,
  triglycerides: 120,
  alt: 24,
  ast: 22,
  alp: 80,
  total_bilirubin: 0.8,
  albumin: 4.4,
  creatinine: 0.95,
  urea: 14,
};

const PRESETS: { id: string; label: string; apply: (base: Record<string, number>) => Record<string, number> }[] = [
  { id: 'normal', label: 'Normal pattern (synthetic)', apply: (b) => ({ ...b }) },
  {
    id: 'glucose',
    label: 'Glucose-related pattern (synthetic)',
    apply: (b) => ({ ...b, fasting_glucose: 118, hba1c: 6.1 }),
  },
  {
    id: 'anemia',
    label: 'Anemia pattern (synthetic)',
    apply: (b) => ({ ...b, hemoglobin: 10.4, rbc: 4.0, mcv: 74, ferritin: 12 }),
  },
  {
    id: 'lipids',
    label: 'Lipid abnormalities (synthetic)',
    apply: (b) => ({ ...b, total_cholesterol: 248, ldl: 168, hdl: 36, triglycerides: 240 }),
  },
  {
    id: 'liver',
    label: 'Liver abnormalities (synthetic)',
    apply: (b) => ({ ...b, alt: 96, ast: 74, alp: 140, total_bilirubin: 1.6 }),
  },
  {
    id: 'kidney',
    label: 'Kidney abnormalities (synthetic)',
    apply: (b) => ({ ...b, creatinine: 1.9, urea: 38, hemoglobin: 11.2 }),
  },
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function NewReport() {
  usePageTitle('New report');
  const navigate = useNavigate();
  const toast = useToast();

  const [catalog, setCatalog] = useState<TestCatalogItem[] | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientMode, setPatientMode] = useState<'existing' | 'inline'>('inline');
  const [patientId, setPatientId] = useState('');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<Sex>('male');

  const [date, setDate] = useState(today());
  const [labName, setLabName] = useState('');
  const [fasting, setFasting] = useState(true);
  const [notes, setNotes] = useState('');

  const [ctx, setCtx] = useState({
    weightKg: '',
    heightCm: '',
    bmi: '',
    systolicBp: '',
    diastolicBp: '',
    smoker: '',
    familyHistoryDiabetes: false,
  });

  const [rows, setRows] = useState<Record<string, TestRowState>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cat, pts] = await Promise.all([
          api.get<{ tests: TestCatalogItem[] }>('/meta/blood-tests'),
          api.get<{ patients: Patient[] }>('/patients'),
        ]);
        if (cancelled) return;
        setCatalog(cat.tests);
        setPatients(pts.patients);
        if (pts.patients.length > 0) {
          setPatientMode('existing');
          setPatientId(pts.patients[0]?._id ?? pts.patients[0]?.id ?? '');
        }
      } catch (err) {
        if (!cancelled) setServerError(err instanceof Error ? err.message : 'Failed to load form data.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = useMemo(() => {
    if (!catalog) return [];
    const map = new Map<string, TestCatalogItem[]>();
    for (const t of catalog) {
      const list = map.get(t.group) ?? [];
      list.push(t);
      map.set(t.group, list);
    }
    return [...map.entries()];
  }, [catalog]);

  const setRow = (key: string, patch: Partial<TestRowState>) => {
    setRows((r) => {
      const prev = r[key] ?? { enabled: false, value: '', unit: '', labLow: '', labHigh: '' };
      return { ...r, [key]: { ...prev, ...patch } };
    });
  };

  const toggleRow = (t: TestCatalogItem, on: boolean) => {
    setRow(t.key, { enabled: on, unit: rows[t.key]?.unit || t.canonicalUnit });
  };

  const applyPreset = (presetId: string) => {
    if (!catalog) return;
    const preset = PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const values = preset.apply(NORMAL_BASE);
    const next: Record<string, TestRowState> = {};
    for (const t of catalog) {
      const v = values[t.key];
      if (v !== undefined) {
        next[t.key] = {
          enabled: true,
          value: String(v),
          unit: t.canonicalUnit,
          labLow: '',
          labHigh: '',
        };
      }
    }
    setRows(next);
    toast.info('Synthetic example values loaded — review them before submitting.', 'Prefilled');
  };

  const clientValidate = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (patientMode === 'existing' && !patientId) errs.patientId = 'Select a patient.';
    if (patientMode === 'inline') {
      const a = Number(age);
      if (!age.trim() || !Number.isFinite(a) || a < 0 || a > 120) errs.age = 'Enter a valid age (0–120).';
    }
    if (!date) errs.date = 'Report date is required.';
    else if (new Date(`${date}T00:00:00Z`).getTime() > Date.now() + 14 * 3_600_000) {
      // 14h slack = "today" is accepted in any timezone.
      errs.date = 'Date cannot be in the future.';
    }

    const enabled = Object.entries(rows).filter(([, r]) => r.enabled);
    if (enabled.length === 0) errs.tests = 'Include at least one laboratory test.';
    for (const [key, r] of enabled) {
      const def = catalog?.find((t) => t.key === key);
      if (!def) continue;
      const v = Number(r.value);
      if (!r.value.trim() || !Number.isFinite(v)) {
        errs[`tests.${key}`] = 'Enter a numeric value.';
        continue;
      }
      if (v < def.bounds.min || v > def.bounds.max) {
        errs[`tests.${key}`] = `Plausible range: ${def.bounds.min}–${def.bounds.max} ${def.canonicalUnit}.`;
      }
      const lo = r.labLow.trim() ? Number(r.labLow) : undefined;
      const hi = r.labHigh.trim() ? Number(r.labHigh) : undefined;
      if (lo !== undefined && hi !== undefined && !(lo < hi)) {
        errs[`tests.${key}`] = 'Lab range: low must be smaller than high.';
      }
    }
    return errs;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');
    const errs = clientValidate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error('Please fix the highlighted fields.', 'Validation');
      return;
    }

    const tests: Record<string, { value: number; unit: string; labRange?: { low?: number; high?: number } }> = {};
    for (const [key, r] of Object.entries(rows)) {
      if (!r.enabled) continue;
      const entry: { value: number; unit: string; labRange?: { low?: number; high?: number } } = {
        value: Number(r.value),
        unit: r.unit,
      };
      const lo = r.labLow.trim() ? Number(r.labLow) : undefined;
      const hi = r.labHigh.trim() ? Number(r.labHigh) : undefined;
      if (lo !== undefined || hi !== undefined) entry.labRange = { low: lo, high: hi };
      tests[key] = entry;
    }

    const context: Record<string, unknown> = {};
    if (ctx.weightKg.trim()) context.weightKg = Number(ctx.weightKg);
    if (ctx.heightCm.trim()) context.heightCm = Number(ctx.heightCm);
    if (ctx.bmi.trim()) context.bmi = Number(ctx.bmi);
    if (ctx.systolicBp.trim()) context.systolicBp = Number(ctx.systolicBp);
    if (ctx.diastolicBp.trim()) context.diastolicBp = Number(ctx.diastolicBp);
    if (ctx.smoker) context.smoker = ctx.smoker;
    if (ctx.familyHistoryDiabetes) context.familyHistoryDiabetes = true;

    const payload = {
      ...(patientMode === 'existing' && patientId ? { patientId } : {}),
      ...(patientMode === 'inline'
        ? { patient: { name: name.trim() || undefined, age: Number(age), sex } }
        : {}),
      ...(Object.keys(context).length > 0 ? { context } : {}),
      report: { date, labName: labName.trim() || undefined, fasting },
      notes: notes.trim() || undefined,
      tests,
    };

    // When a saved profile is selected, the server derives age (from birth year)
    // and sex from the profile — no placeholder values are sent.
    setSubmitting(true);
    try {
      const created = await api.post<{ report: { id: string } }>('/reports', payload);
      const reportId = created.report.id;
      toast.success('Report validated and saved.', 'Step 1/2 complete');

      try {
        const pred = await api.post<{ prediction: { id: string } }>('/predictions', { reportId });
        navigate(`/app/predictions/${pred.prediction.id}`);
      } catch {
        toast.warning('Report saved, but the analysis did not finish. You can re-run it from the report page.');
        navigate(`/app/reports/${reportId}`);
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        const issues = fieldIssues(err);
        if (issues) {
          const mapped: Record<string, string> = {};
          for (const i of issues) mapped[i.path || 'form'] = i.message;
          setErrors(mapped);
        }
        setServerError(`${err.message}${issues ? '' : ''}`);
      } else {
        setServerError('Something unexpected happened. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!catalog) {
    return serverError ? (
      <Alert kind="error" title="Could not load the test catalog">
        {serverError}
      </Alert>
    ) : (
      <PageSpinner label="Loading test catalog…" />
    );
  }

  return (
    <div>
      <PageHeader
        title="New blood report"
        description="Structured input only: every value needs an explicit unit. Impossible values are rejected; missing units are never guessed."
        actions={
          <Select
            aria-label="Prefill synthetic example"
            className="w-64"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) applyPreset(e.target.value);
              e.target.value = '';
            }}
          >
            <option value="">Prefill example values…</option>
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
        }
      />

      <Alert kind="info" className="mb-6">
        <span className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Educational prototype — values you enter are used only to demonstrate the analysis pipeline. Values saved
            through this form are treated as user-provided (not demo-labeled); preset examples are synthetic.
          </span>
        </span>
      </Alert>

      {serverError ? (
        <Alert kind="error" title="Could not save the report" className="mb-6">
          {serverError}
        </Alert>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-6" noValidate>
        {/* Patient */}
        <Card>
          <CardHeader title="1 · Patient" subtitle="Use a saved patient profile or enter details for this report only" />
          <CardBody className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={patientMode === 'existing' ? 'primary' : 'secondary'}
                onClick={() => setPatientMode('existing')}
                disabled={patients.length === 0}
              >
                Saved patient {patients.length === 0 ? '(none yet)' : `(${patients.length})`}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={patientMode === 'inline' ? 'primary' : 'secondary'}
                onClick={() => setPatientMode('inline')}
              >
                One-off entry
              </Button>
            </div>

            {patientMode === 'existing' ? (
              patients.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No saved patients yet — use one-off entry, or{' '}
                  <Link className="text-brand-600 underline dark:text-brand-400" to="/app/patients">
                    create a patient profile
                  </Link>
                  .
                </p>
              ) : (
                <Select label="Patient profile" value={patientId} onChange={(e) => setPatientId(e.target.value)} error={errors.patientId}>
                  {patients.map((p) => (
                    <option key={p._id ?? p.id} value={p._id ?? p.id}>
                      {p.name} · {p.sex}
                      {p.birthYear ? ` · born ${p.birthYear}` : ''}
                    </option>
                  ))}
                </Select>
              )
            ) : (
              <div className="grid gap-4 sm:grid-cols-3">
                <Input label="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Demo Patient" />
                <Input
                  label="Age"
                  type="number"
                  min={0}
                  max={120}
                  required
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  error={errors.age}
                />
                <Select label="Sex" value={sex} onChange={(e) => setSex(e.target.value as Sex)}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other / prefer not to say</option>
                </Select>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Report details */}
        <Card>
          <CardHeader title="2 · Report details" />
          <CardBody className="grid gap-4 sm:grid-cols-3">
            <Input label="Report date" type="date" required value={date} max={today()} onChange={(e) => setDate(e.target.value)} error={errors.date} />
            <Input label="Laboratory (optional)" value={labName} onChange={(e) => setLabName(e.target.value)} placeholder="e.g. City Diagnostics" />
            <div className="pt-7">
              <Checkbox id="fasting" label="Fasting sample" checked={fasting} onChange={(e) => setFasting(e.target.checked)} />
            </div>
          </CardBody>
        </Card>

        {/* Optional context */}
        <Card>
          <CardBody>
            <details className="group">
              <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold text-gray-900 dark:text-gray-100">
                3 · Optional context — improves model coverage
                <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                BMI and blood pressure are used by some ML models when available; otherwise those models are skipped
                and tell you what is missing.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <Input label="Weight (kg)" type="number" value={ctx.weightKg} onChange={(e) => setCtx({ ...ctx, weightKg: e.target.value })} />
                <Input label="Height (cm)" type="number" value={ctx.heightCm} onChange={(e) => setCtx({ ...ctx, heightCm: e.target.value })} />
                <Input
                  label="BMI (or leave blank)"
                  type="number"
                  value={ctx.bmi}
                  onChange={(e) => setCtx({ ...ctx, bmi: e.target.value })}
                  hint={
                    !ctx.bmi && ctx.weightKg && ctx.heightCm
                      ? `Computed: ${(Number(ctx.weightKg) / Math.pow(Number(ctx.heightCm) / 100, 2)).toFixed(1)}`
                      : undefined
                  }
                />
                <Input label="Systolic BP (mm Hg)" type="number" value={ctx.systolicBp} onChange={(e) => setCtx({ ...ctx, systolicBp: e.target.value })} />
                <Input label="Diastolic BP (mm Hg)" type="number" value={ctx.diastolicBp} onChange={(e) => setCtx({ ...ctx, diastolicBp: e.target.value })} />
                <Select label="Smoking status" value={ctx.smoker} onChange={(e) => setCtx({ ...ctx, smoker: e.target.value })}>
                  <option value="">Not specified</option>
                  <option value="never">Never</option>
                  <option value="former">Former</option>
                  <option value="current">Current</option>
                </Select>
              </div>
              <div className="mt-3">
                <Checkbox
                  id="familyHistoryDiabetes"
                  label="Family history of diabetes"
                  checked={ctx.familyHistoryDiabetes}
                  onChange={(e) => setCtx({ ...ctx, familyHistoryDiabetes: e.target.checked })}
                />
              </div>
            </details>
          </CardBody>
        </Card>

        {/* Tests */}
        <Card>
          <CardHeader
            title="4 · Laboratory tests"
            subtitle="Include only the tests you have. Each needs a value and a unit."
            action={
              errors.tests ? <span className="text-xs font-medium text-red-600">{errors.tests}</span> : null
            }
          />
          <CardBody className="space-y-6">
            {grouped.map(([group, tests]) => (
              <div key={group}>
                <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <Sparkles className="h-3.5 w-3.5" /> {group}
                </p>
                <div className="space-y-2">
                  {tests.map((t) => {
                    const row = rows[t.key] ?? { enabled: false, value: '', unit: t.canonicalUnit, labLow: '', labHigh: '' };
                    const err = errors[`tests.${t.key}`];
                    return (
                      <div
                        key={t.key}
                        className={`rounded-xl border p-3 transition-colors ${
                          row.enabled
                            ? err
                              ? 'border-red-300 bg-red-50/40 dark:border-red-900 dark:bg-red-950/20'
                              : 'border-brand-200 bg-brand-50/40 dark:border-brand-900 dark:bg-brand-950/20'
                            : 'border-gray-200 dark:border-gray-800'
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-3">
                          <Checkbox
                            id={`t-${t.key}`}
                            label={<span className="text-sm font-medium">{t.label}</span>}
                            checked={row.enabled}
                            onChange={(e) => toggleRow(t, e.target.checked)}
                          />
                          <span className="hidden text-xs text-gray-400 md:inline" title={t.description}>
                            {t.description}
                          </span>
                          <div className="ml-auto flex items-center gap-2">
                            <input
                              type="number"
                              step="any"
                              inputMode="decimal"
                              placeholder="value"
                              value={row.value}
                              onChange={(e) => setRow(t.key, { value: e.target.value })}
                              disabled={!row.enabled}
                              className="focus-ring h-9 w-28 rounded-lg border border-gray-300 bg-white px-2.5 text-sm disabled:cursor-not-allowed disabled:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:disabled:bg-gray-800"
                            />
                            <select
                              value={row.unit || t.canonicalUnit}
                              onChange={(e) => setRow(t.key, { unit: e.target.value })}
                              disabled={!row.enabled}
                              className="focus-ring h-9 rounded-lg border border-gray-300 bg-white px-2 text-sm disabled:cursor-not-allowed disabled:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:disabled:bg-gray-800"
                            >
                              {t.units.map((u) => (
                                <option key={u} value={u}>
                                  {u}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        {row.enabled ? (
                          <div className="mt-2 flex flex-wrap items-center gap-3 pl-6 text-xs text-gray-500 dark:text-gray-400">
                            <span>
                              Typical range: {t.ranges.default?.low ?? '—'}–{t.ranges.default?.high ?? '—'} {t.canonicalUnit}
                            </span>
                            <span className="flex items-center gap-1.5">
                              Lab range (optional):
                              <input
                                type="number"
                                step="any"
                                placeholder="low"
                                value={row.labLow}
                                onChange={(e) => setRow(t.key, { labLow: e.target.value })}
                                className="focus-ring h-7 w-20 rounded-md border border-gray-200 bg-white px-2 text-xs dark:border-gray-700 dark:bg-gray-900"
                              />
                              –
                              <input
                                type="number"
                                step="any"
                                placeholder="high"
                                value={row.labHigh}
                                onChange={(e) => setRow(t.key, { labHigh: e.target.value })}
                                className="focus-ring h-7 w-20 rounded-md border border-gray-200 bg-white px-2 text-xs dark:border-gray-700 dark:bg-gray-900"
                              />
                            </span>
                          </div>
                        ) : null}
                        {err ? <p className="mt-2 pl-6 text-xs text-red-600 dark:text-red-400">{err}</p> : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardBody>
        </Card>

        {/* Notes + submit */}
        <Card>
          <CardBody className="space-y-4">
            <Textarea
              label="Notes (optional, not used for prediction)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything you want to remember about this report (e.g. symptoms context, fasting duration)…"
            />
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="max-w-md text-xs text-gray-400 dark:text-gray-500">
                By submitting you confirm this is a structured representation of a blood report and that you understand
                this tool provides educational risk estimates only — never a diagnosis.
              </p>
              <Button type="submit" size="lg" loading={submitting} icon={<FilePlus2 className="h-4 w-4" />}>
                Validate & analyze
              </Button>
            </div>
          </CardBody>
        </Card>
      </form>
    </div>
  );
}
