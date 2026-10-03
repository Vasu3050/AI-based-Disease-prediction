import { z } from 'zod';

/**
 * Schema for LLM-generated explanations. The LLM output is validated against
 * this schema BEFORE it is ever shown to a user or stored; invalid output is
 * retried once, then replaced by the deterministic template explanation.
 */
export const explanationContentSchema = z
  .object({
    summary: z.string().min(20).max(2000),
    keyFindings: z.array(z.string().min(3).max(500)).min(1).max(8),
    valueExplanations: z
      .array(
        z.object({
          label: z.string().min(1).max(120),
          finding: z.string().min(3).max(500),
        })
      )
      .max(15)
      .default([]),
    questionsForDoctor: z.array(z.string().min(5).max(300)).min(2).max(8),
    uncertainty: z.string().min(10).max(800),
    disclaimer: z.string().min(10).max(500),
  })
  .strict();

export type ExplanationContent = z.infer<typeof explanationContentSchema>;

export const EXPLANATION_JSON_SCHEMA_EXAMPLE = {
  summary: 'Plain-language summary of the overall report (2-4 sentences).',
  keyFindings: ['One short bullet per important finding (max 8).'],
  valueExplanations: [
    { label: 'Test name', finding: 'What this value means in plain language.' },
  ],
  questionsForDoctor: ['Question the person may want to ask a clinician (2-8).'],
  uncertainty: 'Explain what is uncertain and that model scores are estimates, not diagnoses.',
  disclaimer: 'State clearly that this is not a medical diagnosis and care decisions require a clinician.',
} as const;
