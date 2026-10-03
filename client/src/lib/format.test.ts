import { describe, expect, it } from 'vitest';
import { BAND_META, formatDate, formatNumber, formatPercent, rangeText, STATUS_META } from './format';

describe('format helpers', () => {
  it('formats ranges in all shapes', () => {
    expect(rangeText(70, 99)).toBe('70 – 99');
    expect(rangeText(40, undefined)).toBe('≥ 40');
    expect(rangeText(undefined, 149)).toBe('≤ 149');
    expect(rangeText(undefined, undefined)).toBe('—');
  });

  it('formats numbers with given precision', () => {
    expect(formatNumber(14.567, 1)).toBe('14.6');
    expect(formatNumber(250000, 0)).toBe('250,000');
    expect(formatNumber(Number.NaN)).toBe('—');
  });

  it('formats percentages from model probabilities', () => {
    expect(formatPercent(0.826, 0)).toBe('83%');
  });

  it('formats ISO dates', () => {
    expect(formatDate('2026-03-15')).toMatch(/2026/);
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });

  it('exposes risk bands and value statuses with human labels', () => {
    expect(Object.keys(BAND_META)).toEqual(['low', 'borderline', 'moderate', 'high']);
    // Band labels must never imply diagnosis certainty.
    for (const meta of Object.values(BAND_META)) {
      expect(meta.label.toLowerCase()).not.toContain('chance');
      expect(meta.label.toLowerCase()).not.toContain('have ');
    }
    expect(STATUS_META.low.label).toBe('Low');
    expect(STATUS_META.normal.label).toBe('Normal');
    expect(STATUS_META.high.label).toBe('High');
  });
});
