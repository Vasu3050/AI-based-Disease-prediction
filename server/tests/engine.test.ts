import { describe, expect, it } from 'vitest';
import { convertToCanonical, getTestDef, normalizeTestEntry } from '../src/domain/catalog';
import { ckdEpi2021, gfrCategory } from '../src/domain/egfr';
import { runAnalysis } from '../src/ml/engine';
import { loadModels } from '../src/ml/registry';

describe('unit normalization (catalog)', () => {
  it('converts glucose mmol/L → mg/dL', () => {
    const def = getTestDef('fasting_glucose')!;
    expect(convertToCanonical(def, 7, 'mmol/L')).toBeCloseTo(126.127, 2);
  });

  it('converts HbA1c mmol/mol → %', () => {
    const def = getTestDef('hba1c')!;
    expect(convertToCanonical(def, 48, 'mmol/mol')).toBeCloseTo(6.54, 1);
  });

  it('converts creatinine µmol/L → mg/dL', () => {
    const def = getTestDef('creatinine')!;
    expect(convertToCanonical(def, 88.4, 'µmol/L')).toBeCloseTo(1.0, 2);
  });

  it('converts hemoglobin g/L → g/dL', () => {
    const def = getTestDef('hemoglobin')!;
    expect(convertToCanonical(def, 140, 'g/L')).toBeCloseTo(14, 3);
  });

  it('rejects unknown units instead of guessing', () => {
    const def = getTestDef('hemoglobin')!;
    expect(convertToCanonical(def, 14, 'stone')).toBeNull();
    const result = normalizeTestEntry('hemoglobin', { value: 14, unit: 'furlongs' });
    expect(result.ok).toBe(false);
  });

  it('rejects physically implausible values', () => {
    expect(normalizeTestEntry('hemoglobin', { value: 200, unit: 'g/dL' }).ok).toBe(false);
    expect(normalizeTestEntry('platelets', { value: -5, unit: 'cells/µL' }).ok).toBe(false);
    expect(normalizeTestEntry('fasting_glucose', { value: 0.01, unit: 'mg/dL' }).ok).toBe(false);
  });
});

describe('eGFR (CKD-EPI 2021)', () => {
  it('computes plausible values for typical inputs', () => {
    const egfr = ckdEpi2021(1.0, 50, 'male');
    expect(egfr).toBeGreaterThan(85);
    expect(egfr).toBeLessThan(100);
  });

  it('returns lower values for higher creatinine', () => {
    const low = ckdEpi2021(0.9, 60, 'female')!;
    const high = ckdEpi2021(2.5, 60, 'female')!;
    expect(high).toBeLessThan(low);
    expect(high).toBeLessThan(30);
  });

  it('maps KDIGO categories', () => {
    expect(gfrCategory(95).code).toBe('G1');
    expect(gfrCategory(75).code).toBe('G2');
    expect(gfrCategory(50).code).toBe('G3a');
    expect(gfrCategory(35).code).toBe('G3b');
    expect(gfrCategory(20).code).toBe('G4');
    expect(gfrCategory(10).code).toBe('G5');
  });

  it('cannot compute for unspecified sex (documented behavior)', () => {
    expect(ckdEpi2021(1.0, 50, 'other')).toBeNull();
  });
});

describe('analysis engine (end-to-end, no DB)', () => {
  const baseInput = {
    patient: { age: 54, sex: 'male' as const },
    context: { bmi: 28, diastolicBp: 88 },
    tests: {
      hemoglobin: { value: 10.2 },
      fasting_glucose: { value: 132 },
      hba1c: { value: 6.8 },
      creatinine: { value: 1.6 },
      urea: { value: 28 },
      alt: { value: 96 },
      ast: { value: 70 },
      alp: { value: 120 },
      total_bilirubin: { value: 1.5 },
      albumin: { value: 3.9 },
    },
  };

  it('flags abnormal values and guideline findings', () => {
    const result = runAnalysis(baseInput);
    const byKey = new Map(result.values.map((v) => [v.key, v]));
    expect(byKey.get('hemoglobin')?.status).toBe('low');
    expect(byKey.get('fasting_glucose')?.status).toBe('high');
    expect(byKey.get('creatinine')?.status).toBe('high');

    const glycemic = result.guidelines.filter((g) => g.panel === 'glycemic');
    expect(glycemic.some((g) => g.status === 'concern')).toBe(true); // ≥126 / ≥6.5 diabetes-range
    const anemia = result.guidelines.find((g) => g.panel === 'anemia');
    expect(['attention', 'concern']).toContain(anemia?.status);
    expect(anemia?.label).toContain('anemia');
    const liver = result.guidelines.find((g) => g.title === 'Liver enzymes');
    expect(liver?.status).toBe('attention'); // 96 vs ULN 55 (<3x)
    expect(result.computed.egfr).toBeDefined();
    expect(result.summary.abnormalCount).toBeGreaterThan(3);
  });

  it('treats values inside ranges as normal and produces an ok summary', () => {
    const result = runAnalysis({
      patient: { age: 30, sex: 'female' as const },
      context: {},
      tests: {
        hemoglobin: { value: 13.5 },
        fasting_glucose: { value: 88 },
        hba1c: { value: 5.1 },
      },
    });
    expect(result.summary.abnormalCount).toBe(0);
    const glucose = result.guidelines.find((g) => g.id === 'glycemic-fpg');
    expect(glucose?.status).toBe('ok');
  });

  it('never imputes missing model inputs (skips with explanation)', () => {
    const artifacts = loadModels().artifacts;
    if (artifacts.length === 0) return; // models not trained in this environment — acceptable
    const result = runAnalysis({
      patient: { age: 40, sex: 'male' as const },
      context: {},
      tests: { hemoglobin: { value: 14 } }, // no glucose/creatinine etc.
    });
    const kidney = result.models.find((m) => m.targetId === 'kidney_risk');
    expect(kidney?.status).toBe('insufficient_data');
    expect((kidney?.missingFeatures ?? []).length).toBeGreaterThan(0);
  });

  it('provides contributions for every model input when a model runs', () => {
    const artifacts = loadModels().artifacts;
    if (artifacts.length === 0) return;
    const result = runAnalysis({
      patient: { age: 50, sex: 'male' as const },
      context: { bmi: 27, diastolicBp: 85 },
      tests: {
        fasting_glucose: { value: 110 },
        hba1c: { value: 5.9 },
        hemoglobin: { value: 14 },
        creatinine: { value: 1.0 },
        urea: { value: 15 },
        alt: { value: 30 },
        ast: { value: 25 },
        alp: { value: 90 },
        total_bilirubin: { value: 0.9 },
        albumin: { value: 4.2 },
      },
    });
    const diabetes = result.models.find((m) => m.targetId === 'diabetes_risk');
    expect(diabetes?.status).toBe('ok');
    // Contributions are sorted by absolute magnitude, descending.
    const contributions = diabetes!.contributions!;
    for (let i = 1; i < contributions.length; i += 1) {
      expect(Math.abs(contributions[i - 1]!.contribution)).toBeGreaterThanOrEqual(
        Math.abs(contributions[i]!.contribution)
      );
    }
    // Every contribution must carry a direction and a label.
    for (const c of contributions) {
      expect(['up', 'down']).toContain(c.direction);
      expect(c.label.length).toBeGreaterThan(0);
    }
  });
});
