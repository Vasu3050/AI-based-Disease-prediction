import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ModelResultCard } from './ModelResultCard';
import type { MlModelResult } from '../../lib/types';

const baseMetrics = {
  rocAuc: 0.826,
  prAuc: 0.733,
  accuracy: 0.772,
  precision: 0.743,
  recall: 0.52,
  f1: 0.612,
  brier: 0.161,
  nTrain: 579,
  nTest: 145,
  prevalence: 0.345,
  datasetName: 'PIMA Indians Diabetes Database',
};

describe('ModelResultCard', () => {
  it('renders an honest model-estimated score with contributions and model card', () => {
    const model: MlModelResult = {
      targetId: 'diabetes_risk',
      title: 'Diabetes-related risk score',
      description: 'Logistic regression (PIMA-trained).',
      status: 'ok',
      probability: 0.72,
      band: 'moderate',
      modelName: 'diabetes-full-lr',
      modelVersion: '1.0.0',
      metrics: baseMetrics,
      contributions: [
        { feature: 'glucose', label: 'Fasting glucose', value: 128, unit: 'mg/dL', contribution: 0.9, direction: 'up' },
        { feature: 'bmi', label: 'Body-mass index', value: 26, unit: 'kg/m²', contribution: -0.2, direction: 'down' },
      ],
      note: 'Not a diagnosis.',
    };
    render(<ModelResultCard model={model} />);

    expect(screen.getByText('Diabetes-related risk score')).toBeInTheDocument();
    expect(screen.getByText('72%')).toBeInTheDocument();
    // Never presented as "chance of disease"
    expect(screen.queryByText(/chance you have/i)).not.toBeInTheDocument();
    expect(screen.getByText(/^Moderate \(model\)$/i)).toBeInTheDocument();
    expect(screen.getByText(/statistical estimate, not a diagnosis/i)).toBeInTheDocument();
    // Model card with dataset + honest metrics
    expect(screen.getByText(/PIMA Indians Diabetes Database/)).toBeInTheDocument();
    // Contributions section
    expect(screen.getByText(/Which inputs influenced this score/i)).toBeInTheDocument();
  });

  it('shows missing features (no silent imputation) when inputs are unavailable', () => {
    const model: MlModelResult = {
      targetId: 'kidney_risk',
      title: 'Kidney-related risk score',
      description: 'UCI CKD-trained.',
      status: 'insufficient_data',
      missingFeatures: [
        { id: 'creatinine', label: 'Creatinine' },
        { id: 'bun', label: 'Blood urea nitrogen' },
      ],
      note: 'Add them to a report to receive an estimate.',
    };
    render(<ModelResultCard model={model} />);
    expect(screen.getByText(/Not enough input values for this model/i)).toBeInTheDocument();
    expect(screen.getByText(/Creatinine/)).toBeInTheDocument();
    expect(screen.getByText(/No values are imputed or guessed/i)).toBeInTheDocument();
  });
});
