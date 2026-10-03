/**
 * Guideline-based indicators.
 *
 * These findings are generated from PUBLISHED REFERENCE RULES (WHO, ADA,
 * NCEP ATP III, KDIGO), NOT from machine learning. They are clearly labelled
 * as "guideline-based" throughout the app and in API responses.
 *
 * Educational use only — categories like "diabetes-range" describe a laboratory
 * pattern, not a clinical diagnosis.
 */
import { gfrCategory } from './egfr';
import { getTestDef, resolveRange } from './catalog';
import type { GuidelineFinding, Sex } from './types';
import type { NormalizedReport } from './features';

function uln(key: string, sex: Sex): number {
  const def = getTestDef(key);
  if (!def) return Number.POSITIVE_INFINITY;
  const resolved = resolveRange(def, sex);
  return resolved.range.high ?? Number.POSITIVE_INFINITY;
}

function v(report: NormalizedReport, key: string): number | undefined {
  return report.tests[key];
}

function ref(key: string, report: NormalizedReport): { label: string; value: number; unit: string } {
  const def = getTestDef(key)!;
  return { label: def.label, value: report.tests[key]!, unit: def.canonicalUnit };
}

export function analyzeGlycemic(report: NormalizedReport): GuidelineFinding[] {
  const findings: GuidelineFinding[] = [];
  const fpg = v(report, 'fasting_glucose');
  const a1c = v(report, 'hba1c');

  if (fpg !== undefined) {
    let status: GuidelineFinding['status'] = 'ok';
    let label = 'Fasting glucose in normal range (ADA)';
    let details = `Fasting glucose ${fpg} mg/dL is within the normal fasting range (<100 mg/dL).`;
    if (fpg < 70) {
      status = 'attention';
      label = 'Fasting glucose below normal range';
      details = `Fasting glucose ${fpg} mg/dL is below the typical fasting range (70–99 mg/dL).`;
    } else if (fpg >= 126) {
      status = 'concern';
      label = 'Fasting glucose in diabetes-range (ADA)';
      details = `Fasting glucose ${fpg} mg/dL is at or above the ADA threshold (≥126 mg/dL) for a diabetes-range value. This pattern requires confirmation and clinical evaluation — it is not a diagnosis on its own.`;
    } else if (fpg >= 100) {
      status = 'attention';
      label = 'Fasting glucose in prediabetes-range (ADA)';
      details = `Fasting glucose ${fpg} mg/dL falls in the impaired-fasting-glucose range (100–125 mg/dL) per ADA. This suggests increased diabetes risk and warrants clinical follow-up.`;
    }
    findings.push({
      id: 'glycemic-fpg',
      panel: 'glycemic',
      title: 'Fasting glucose',
      status,
      label,
      details,
      source: 'ADA Standards of Care — diagnostic criteria (educational use)',
      inputs: [ref('fasting_glucose', report)],
    });
  }

  if (a1c !== undefined) {
    let status: GuidelineFinding['status'] = 'ok';
    let label = 'HbA1c in normal range (ADA)';
    let details = `HbA1c ${a1c}% is below the prediabetes threshold (<5.7%).`;
    if (a1c >= 6.5) {
      status = 'concern';
      label = 'HbA1c in diabetes-range (ADA)';
      details = `HbA1c ${a1c}% is at or above the ADA threshold (≥6.5%) for a diabetes-range value. Requires confirmation and clinical evaluation — not a diagnosis on its own.`;
    } else if (a1c >= 5.7) {
      status = 'attention';
      label = 'HbA1c in prediabetes-range (ADA)';
      details = `HbA1c ${a1c}% falls in the prediabetes range (5.7–6.4%) per ADA, indicating increased diabetes risk.`;
    }
    findings.push({
      id: 'glycemic-hba1c',
      panel: 'glycemic',
      title: 'HbA1c',
      status,
      label,
      details,
      source: 'ADA Standards of Care — diagnostic criteria (educational use)',
      inputs: [ref('hba1c', report)],
    });
  }

  return findings;
}

export function analyzeAnemia(report: NormalizedReport): GuidelineFinding[] {
  const hb = v(report, 'hemoglobin');
  if (hb === undefined) return [];

  const sex = report.patient.sex;
  const female = sex === 'female';
  // Sex-specific thresholds do not apply to 'other'; we conservatively use the
  // lower (female) threshold and disclose that in the finding text.
  const threshold = female || sex === 'other' ? 12.0 : 13.0; // WHO non-pregnant adults
  const inputs = [ref('hemoglobin', report)];

  let status: GuidelineFinding['status'] = 'ok';
  let label: string;
  let details: string;

  if (hb >= threshold) {
    label = 'Hemoglobin not in anemia range (WHO)';
    details = `Hemoglobin ${hb} g/dL is at or above the WHO anemia threshold (${threshold} g/dL for ${
      female ? 'non-pregnant women' : 'men'
    }).`;
  } else {
    // WHO severity bands (approximate, non-pregnant adults)
    let severity: string;
    if (hb < 8.0) {
      severity = 'severe';
      status = 'concern';
    } else if (hb < 11.0) {
      severity = 'moderate';
      status = 'concern';
    } else {
      severity = 'mild';
      status = 'attention';
    }
    label = `Hemoglobin below WHO anemia threshold — ${severity} range`;
    details = `Hemoglobin ${hb} g/dL is below the WHO threshold (${threshold} g/dL). Using WHO severity bands this falls in the ${severity} range. Anemia has many causes (iron deficiency, chronic disease, B12/folate, blood loss, etc.) and requires clinical evaluation.`;
    if (sex === 'other') {
      details += ' Sex-specific thresholds are unavailable for the recorded sex; a conservative threshold was applied.';
    }
    if (severity !== 'mild') status = 'concern';
  }

  // Pattern hints (only when data available) — educational, not diagnostic.
  const mcv = v(report, 'mcv');
  const ferritin = v(report, 'ferritin');
  const hints: string[] = [];
  if (mcv !== undefined) {
    if (mcv < 80) hints.push(`MCV ${mcv} fL suggests a microcytic pattern (e.g. iron deficiency, thalassemia trait).`);
    else if (mcv > 100)
      hints.push(`MCV ${mcv} fL suggests a macrocytic pattern (e.g. B12/folate deficiency, other causes).`);
  }
  if (ferritin !== undefined && ferritin < 30) {
    hints.push(`Ferritin ${ferritin} ng/mL is low, which can support iron deficiency when interpreted clinically.`);
  }
  if (hints.length > 0) {
    details += ` Additional pattern notes: ${hints.join(' ')}`;
  }

  return [
    {
      id: 'anemia-who',
      panel: 'anemia',
      title: 'Anemia screening (hemoglobin)',
      status,
      label,
      details,
      source: 'WHO haemoglobin concentrations for anaemia diagnosis (educational use)',
      inputs,
    },
  ];
}

export function analyzeLipids(report: NormalizedReport): GuidelineFinding[] {
  const findings: GuidelineFinding[] = [];

  const make = (
    key: 'total_cholesterol' | 'ldl' | 'hdl' | 'triglycerides',
    bands: { ok: string; attention: string; concern: string },
    check: (value: number, sex: Sex) => GuidelineFinding['status'],
    describe: (value: number, status: GuidelineFinding['status']) => string
  ) => {
    const value = v(report, key);
    if (value === undefined) return;
    const status = check(value, report.patient.sex);
    findings.push({
      id: `lipid-${key}`,
      panel: 'lipids',
      title: getTestDef(key)!.label,
      status,
      label: status === 'ok' ? bands.ok : status === 'attention' ? bands.attention : bands.concern,
      details: describe(value, status),
      source: 'NCEP ATP III classification (educational use)',
      inputs: [ref(key, report)],
    });
  };

  make(
    'total_cholesterol',
    { ok: 'Desirable (<200 mg/dL)', attention: 'Borderline high (200–239 mg/dL)', concern: 'High (≥240 mg/dL)' },
    (val) => (val >= 240 ? 'concern' : val >= 200 ? 'attention' : 'ok'),
    (val) => `Total cholesterol ${val} mg/dL.`
  );
  make(
    'ldl',
    { ok: 'Optimal (<100 mg/dL)', attention: 'Near-optimal / borderline (100–159 mg/dL)', concern: 'High (≥160 mg/dL)' },
    (val) => (val >= 160 ? 'concern' : val >= 100 ? 'attention' : 'ok'),
    (val) => `LDL cholesterol ${val} mg/dL. LDL is a major modifiable risk factor; targets depend on overall cardiovascular risk.`
  );
  make(
    'hdl',
    {
      ok: 'HDL above low threshold',
      attention: 'HDL below low threshold',
      concern: 'HDL below low threshold',
    },
    (val, sex) => (val < (sex === 'female' ? 50 : 40) ? 'attention' : 'ok'),
    (val, _status) => `HDL cholesterol ${val} mg/dL. Low HDL (<40 mg/dL men, <50 mg/dL women per ATP III) is one risk marker among others.`
  );
  make(
    'triglycerides',
    { ok: 'Normal (<150 mg/dL)', attention: 'Borderline high (150–199 mg/dL)', concern: 'High (≥200 mg/dL)' },
    (val) => (val >= 200 ? 'concern' : val >= 150 ? 'attention' : 'ok'),
    (val) => `Triglycerides ${val} mg/dL.`
  );

  return findings;
}

export function analyzeLiver(report: NormalizedReport): GuidelineFinding[] {
  const findings: GuidelineFinding[] = [];
  const sex = report.patient.sex;

  const alt = v(report, 'alt');
  const ast = v(report, 'ast');
  const alp = v(report, 'alp');
  const bili = v(report, 'total_bilirubin');
  const albumin = v(report, 'albumin');

  const altUln = uln('alt', sex);
  const astUln = uln('ast', sex);
  const alpUln = uln('alp', sex);

  const altAbnormal = alt !== undefined && alt > altUln;
  const astAbnormal = ast !== undefined && ast > astUln;
  const alpAbnormal = alp !== undefined && alp > alpUln;

  if (alt !== undefined || ast !== undefined || alp !== undefined) {
    const elevatedEnzymes: string[] = [];
    if (altAbnormal) elevatedEnzymes.push(`ALT ${alt} U/L (upper limit ~${altUln})`);
    if (astAbnormal) elevatedEnzymes.push(`AST ${ast} U/L (upper limit ~${astUln})`);
    if (alpAbnormal) elevatedEnzymes.push(`ALP ${alp} U/L (upper limit ~${alpUln})`);

    let status: GuidelineFinding['status'] = 'ok';
    let details: string;
    let label: string;

    if (elevatedEnzymes.length === 0) {
      label = 'Liver enzymes within typical ranges';
      details = 'ALT, AST and ALP are within typical adult reference ranges.';
    } else {
      const severe =
        (alt !== undefined && alt > altUln * 3) || (ast !== undefined && ast > astUln * 3);
      status = severe ? 'concern' : 'attention';
      label = severe
        ? 'Marked liver-enzyme elevation (educational flag)'
        : 'Mild liver-enzyme elevation (educational flag)';
      details = `Elevated: ${elevatedEnzymes.join('; ')}.`;
      // Educational pattern note
      if (altAbnormal && !alpAbnormal && alt !== undefined && ast !== undefined) {
        details +=
          ' Pattern appears predominantly hepatocellular (transaminases elevated, ALP not elevated). Educational note — many causes exist (fatty liver, viral hepatitis, alcohol, medications, muscle sources).';
      } else if (alpAbnormal && !altAbnormal) {
        details +=
          ' Pattern appears predominantly cholestatic (ALP elevated, transaminases not elevated). Educational note only.';
      }
      details += ' Persistently abnormal liver tests require clinical evaluation.';
    }

    findings.push({
      id: 'liver-enzymes',
      panel: 'liver',
      title: 'Liver enzymes',
      status,
      label,
      details,
      source: 'Standard laboratory upper reference limits (educational use)',
      inputs: [
        ...(alt !== undefined ? [ref('alt', report)] : []),
        ...(ast !== undefined ? [ref('ast', report)] : []),
        ...(alp !== undefined ? [ref('alp', report)] : []),
      ],
    });
  }

  if (bili !== undefined) {
    const status: GuidelineFinding['status'] = bili > 2 ? 'concern' : bili > 1.2 ? 'attention' : 'ok';
    findings.push({
      id: 'liver-bilirubin',
      panel: 'liver',
      title: 'Bilirubin',
      status,
      label:
        status === 'ok'
          ? 'Bilirubin within typical range'
          : status === 'attention'
            ? 'Bilirubin mildly elevated'
            : 'Bilirubin elevated',
      details: `Total bilirubin ${bili} mg/dL (typical range 0.1–1.2 mg/dL).`,
      source: 'Typical adult reference ranges (educational use)',
      inputs: [ref('total_bilirubin', report)],
    });
  }

  if (albumin !== undefined) {
    const status: GuidelineFinding['status'] = albumin < 3.5 ? 'attention' : 'ok';
    findings.push({
      id: 'liver-albumin',
      panel: 'liver',
      title: 'Albumin',
      status,
      label: status === 'ok' ? 'Albumin within typical range' : 'Albumin below typical range',
      details: `Albumin ${albumin} g/dL (typical range 3.5–5.0 g/dL).`,
      source: 'Typical adult reference ranges (educational use)',
      inputs: [ref('albumin', report)],
    });
  }

  return findings;
}

export function analyzeKidney(
  report: NormalizedReport,
  egfr: number | null | undefined
): GuidelineFinding[] {
  const findings: GuidelineFinding[] = [];
  const sex = report.patient.sex;

  const creatinine = v(report, 'creatinine');
  const urea = v(report, 'urea');

  if (egfr !== null && egfr !== undefined) {
    const cat = gfrCategory(egfr);
    let status: GuidelineFinding['status'] = 'ok';
    if (cat.code === 'G3a') status = 'attention';
    else if (cat.code === 'G3b' || cat.code === 'G4' || cat.code === 'G5') status = 'concern';

    findings.push({
      id: 'kidney-egfr',
      panel: 'kidney',
      title: 'Estimated GFR (CKD-EPI 2021)',
      status,
      label: `eGFR ≈ ${egfr} mL/min/1.73m² — KDIGO ${cat.label}`,
      details:
        `Estimated from creatinine ${creatinine} mg/dL, age ${report.patient.age}, sex ${sex}. ` +
        `eGFR is an estimate and is not valid in acute illness, extremes of muscle mass, or pregnancy. ` +
        `CKD classification requires persistence ≥3 months — a single value cannot establish it.`,
      source: 'CKD-EPI 2021 (Inker et al.) + KDIGO categories (educational use)',
      inputs: creatinine !== undefined ? [ref('creatinine', report)] : [],
    });
  } else if (creatinine !== undefined) {
    const def = getTestDef('creatinine')!;
    const resolved = resolveRange(def, sex, undefined);
    const above = resolved.range.high !== undefined && creatinine > resolved.range.high;
    findings.push({
      id: 'kidney-creatinine',
      panel: 'kidney',
      title: 'Creatinine',
      status: above ? 'attention' : 'ok',
      label: above ? 'Creatinine above typical range' : 'Creatinine within typical range',
      details: `Creatinine ${creatinine} mg/dL. (eGFR could not be computed — it requires sex-specific calculation.)`,
      source: 'Typical adult reference ranges (educational use)',
      inputs: [ref('creatinine', report)],
    });
  }

  if (urea !== undefined) {
    const ureaHigh = urea > 20;
    if (ureaHigh) {
      findings.push({
        id: 'kidney-urea',
        panel: 'kidney',
        title: 'Blood urea nitrogen',
        status: urea > 40 ? 'concern' : 'attention',
        label: 'BUN above typical range',
        details: `BUN ${urea} mg/dL (typical 7–20 mg/dL). Interpret together with creatinine and clinical context (hydration, diet, catabolism).`,
        source: 'Typical adult reference ranges (educational use)',
        inputs: [ref('urea', report)],
      });
    }
  }

  return findings;
}

export function analyzeGuidelines(
  report: NormalizedReport,
  egfr: number | null | undefined
): GuidelineFinding[] {
  return [
    ...analyzeGlycemic(report),
    ...analyzeAnemia(report),
    ...analyzeLipids(report),
    ...analyzeLiver(report),
    ...analyzeKidney(report, egfr),
  ];
}
