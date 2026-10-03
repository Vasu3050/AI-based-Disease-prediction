/**
 * Estimated glomerular filtration rate (eGFR) — CKD-EPI 2021 creatinine equation
 * (race-free), as published by the Chronic Kidney Disease Epidemiology
 * Collaboration (Inker et al., NEJM 2021).
 *
 * Educational implementation. Always verify against a clinical calculator
 * before any real-world use.
 */
import type { Sex } from './types';

export function ckdEpi2021(creatinineMgDl: number, age: number, sex: Sex): number | null {
  if (sex !== 'male' && sex !== 'female') return null; // equation is sex-specific
  if (!(creatinineMgDl > 0) || !(age > 0 && age < 120)) return null;

  const female = sex === 'female';
  const kappa = female ? 0.7 : 0.9;
  const alpha = female ? -0.241 : -0.302;
  const ratio = creatinineMgDl / kappa;

  const egfr =
    142 *
    Math.pow(Math.min(ratio, 1), alpha) *
    Math.pow(Math.max(ratio, 1), -1.2) *
    Math.pow(0.9938, age) *
    (female ? 1.012 : 1);

  return Math.round(egfr * 10) / 10;
}

/** KDIGO GFR category for an eGFR value. */
export function gfrCategory(egfr: number): { code: string; label: string } {
  if (egfr >= 90) return { code: 'G1', label: 'G1 (normal or high)' };
  if (egfr >= 60) return { code: 'G2', label: 'G2 (mildly decreased)' };
  if (egfr >= 45) return { code: 'G3a', label: 'G3a (mildly to moderately decreased)' };
  if (egfr >= 30) return { code: 'G3b', label: 'G3b (moderately to severely decreased)' };
  if (egfr >= 15) return { code: 'G4', label: 'G4 (severely decreased)' };
  return { code: 'G5', label: 'G5 (kidney failure range)' };
}
