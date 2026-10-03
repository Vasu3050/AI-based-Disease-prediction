import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ExplanationCard } from './ExplanationCard';
import type { PredictionExplanation } from '../../lib/types';

const templateExplanation: PredictionExplanation = {
  source: 'template',
  generatedAt: '2026-10-01T10:00:00.000Z',
  fallbackReason: 'LLM layer not configured (LLM_PROVIDER=none).',
  content: {
    summary:
      'This report analyzed 4 laboratory value(s): 1 outside typical ranges and 1 guideline finding(s) flagged for attention.',
    keyFindings: ['Fasting glucose: prediabetes-range (ADA).'],
    valueExplanations: [{ label: 'Fasting glucose', finding: '112 mg/dL is above the typical range.' }],
    questionsForDoctor: ['Should my glucose or HbA1c be re-tested to confirm these values?'],
    uncertainty: 'Model scores are probabilistic estimates and can be wrong.',
    disclaimer: 'This is not a medical diagnosis and not medical advice.',
  },
};

describe('ExplanationCard', () => {
  it('shows a generate button and LLM status when no explanation exists', async () => {
    const onGenerate = vi.fn();
    render(
      <ExplanationCard explanation={null} llmEnabled={true} llmLabel="ollama · deepseek-r1:14b" onGenerate={onGenerate} generating={false} />
    );
    expect(screen.getByText(/deepseek-r1:14b/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /generate explanation/i }));
    expect(onGenerate).toHaveBeenCalledWith(false);
  });

  it('labels deterministic fallbacks clearly (never as AI output)', () => {
    render(
      <ExplanationCard explanation={templateExplanation} llmEnabled={false} onGenerate={vi.fn()} generating={false} />
    );
    expect(screen.getByText(/Auto summary \(no LLM\)/i)).toBeInTheDocument();
    expect(screen.getByText(/LLM layer not configured/i)).toBeInTheDocument();
    expect(screen.queryByText(/AI-generated/)).not.toBeInTheDocument();
  });

  it('labels LLM explanations with provider/model and renders the validated content', () => {
    const llmExplanation: PredictionExplanation = {
      ...templateExplanation,
      source: 'llm',
      provider: 'ollama',
      model: 'ollama · deepseek-r1:14b',
      fallbackReason: undefined,
    };
    render(
      <ExplanationCard explanation={llmExplanation} llmEnabled={true} onGenerate={vi.fn()} generating={false} />
    );
    expect(screen.getByText(/AI-generated/)).toBeInTheDocument();
    expect(screen.getByText(/prediabetes-range/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /regenerate/i })).toBeInTheDocument();
  });
});
