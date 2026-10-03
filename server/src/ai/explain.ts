/**
 * Explanation layer.
 *
 * Produces a natural-language explanation of ALREADY-COMPUTED structured
 * results. Uses the configured LLM provider when available; otherwise (or on
 * failure) falls back to a deterministic template. The structured analysis is
 * never modified by this layer.
 *
 * Privacy: only the minimum structured information is sent — no names, no
 * identifiers, no free text. See docs/PRIVACY.md.
 */
import type { AnalysisResult } from '../domain/types';
import { logger } from '../utils/logger';
import { getLLMProvider } from './provider';
import {
  explanationContentSchema,
  EXPLANATION_JSON_SCHEMA_EXAMPLE,
  type ExplanationContent,
} from './schemas';

export interface ExplanationRecord {
  source: 'llm' | 'template';
  provider?: string;
  model?: string;
  generatedAt: Date;
  fallbackReason?: string;
  content: ExplanationContent;
}

const SYSTEM_PROMPT = `You are a careful, conservative medical-explanation assistant embedded in an EDUCATIONAL blood-test analysis prototype ("MediPredict AI").

Your job: explain ALREADY-COMPUTED structured results in plain language (aim for ~8th grade reading level).

HARD RULES (never violate):
1. Never give a diagnosis. Use phrases like "may suggest", "can be associated with", "requires clinical evaluation".
2. Never recommend starting, stopping, or changing any medication or treatment.
3. Use ONLY the data provided in the user message. Never invent laboratory values, patient history, symptoms, or scientific evidence.
4. Model scores are probabilistic estimates that can be wrong — always communicate uncertainty honestly. Never claim certainty and never claim clinical validation.
5. If results look normal, say so plainly without inventing concerns.
6. Include practical questions the person could ask a healthcare professional.
7. Output MUST be a single valid JSON object matching the provided schema exactly. No markdown, no commentary.

JSON schema to follow (example shape):
${JSON.stringify(EXPLANATION_JSON_SCHEMA_EXAMPLE, null, 2)}`;

function buildUserPayload(result: AnalysisResult, patient: { age: number; sex: string }) {
  const payload = {
    patient: { age: patient.age, sex: patient.sex },
    computed: {
      bmi: result.computed.bmi ?? null,
      egfr: result.computed.egfr ?? null,
    },
    summaryCounts: {
      testsAnalyzed: result.summary.testsAnalyzed,
      abnormalCount: result.summary.abnormalCount,
    },
    abnormalValues: result.abnormalValues.map((v) => ({
      label: v.label,
      value: v.value,
      unit: v.unit,
      status: v.status,
      typicalRange:
        v.range.low !== undefined || v.range.high !== undefined
          ? { low: v.range.low ?? null, high: v.range.high ?? null }
          : null,
    })),
    guidelineFindings: result.guidelines.map((g) => ({
      title: g.title,
      status: g.status,
      label: g.label,
      details: g.details,
      source: g.source,
    })),
    modelScores: result.models.map((m) => ({
      title: m.title,
      status: m.status,
      modelEstimatedRiskScore: m.probability ?? null,
      band: m.band ?? null,
      note: m.note ?? null,
      missingInputs: m.missingFeatures?.map((mf) => mf.label) ?? null,
    })),
    disclaimers: result.disclaimers,
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Extract the (first) JSON object from raw model output. Local reasoning
 * models (e.g. DeepSeek-R1 via Ollama) often wrap JSON in prose or think
 * tags, so we take the substring from the first '{' to the last '}' and strip
 * common markdown fences first.
 */
function extractJsonObject(text: string): string {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No JSON object found in model output');
  }
  return t.slice(start, end + 1);
}

/** Deterministic fallback explanation (no LLM required). */
export function templateExplanation(result: AnalysisResult): ExplanationRecord {
  const abnormal = result.abnormalValues;
  const findings = result.guidelines.filter((g) => g.status !== 'ok');
  const okModels = result.models.filter((m) => m.status === 'ok');

  const keyFindings: string[] = [];
  for (const g of findings.slice(0, 5)) {
    keyFindings.push(`${g.title}: ${g.label}.`);
  }
  for (const v of abnormal.slice(0, 5)) {
    if (!findings.some((g) => g.title === v.label)) {
      keyFindings.push(
        `${v.label} is ${v.status === 'high' ? 'above' : 'below'} the typical range (${v.value} ${v.unit}).`
      );
    }
  }
  if (keyFindings.length === 0) {
    keyFindings.push(
      `All ${result.summary.testsAnalyzed} analyzed values are within typical ranges.`,
      'Routine values can still require interpretation in your personal clinical context.'
    );
  }

  const questions: string[] = [];
  const panels = new Set(result.guidelines.map((g) => g.panel));
  if (panels.has('glycemic')) questions.push('Should my glucose or HbA1c be re-tested to confirm these values?');
  if (panels.has('anemia')) questions.push('Do my hemoglobin and blood-count values need further tests (e.g. iron studies)?');
  if (panels.has('lipids')) questions.push('How do these lipid values affect my cardiovascular risk, and what follow-up is appropriate?');
  if (panels.has('liver')) questions.push('Should my liver-related values be repeated or investigated further?');
  if (panels.has('kidney')) questions.push('How should my kidney values be monitored over time?');
  questions.push('Which of these findings matters most for my situation, and what should I do next?');

  const content: ExplanationContent = {
    summary:
      `This report analyzed ${result.summary.testsAnalyzed} laboratory value(s): ` +
      `${result.summary.abnormalCount} outside typical ranges and ${findings.length} guideline finding(s) flagged for attention. ` +
      (okModels.length > 0
        ? `${okModels.length} model-estimated risk score(s) were computed — these are probabilistic estimates from a limited training dataset and can be wrong. `
        : '') +
      `This summary was generated automatically without an AI language model (no LLM configured or available).`,
    keyFindings,
    valueExplanations: abnormal.slice(0, 10).map((v) => ({
      label: v.label,
      finding: `${v.value} ${v.unit} is ${v.status === 'high' ? 'above' : 'below'} the typical range` +
        (v.range.low !== undefined || v.range.high !== undefined
          ? ` (${v.range.low ?? '—'}–${v.range.high ?? '—'} ${v.unit}).`
          : '.'),
    })),
    questionsForDoctor: questions.slice(0, 6),
    uncertainty:
      'Model-estimated risk scores are probabilistic outputs of statistical models trained on limited public datasets; they can be wrong in both directions and are not clinically validated. Guideline flags describe laboratory patterns, not diagnoses. Always interpret results with a qualified healthcare professional.',
    disclaimer:
      'This is not a medical diagnosis and not medical advice. Do not start, stop, or change any medication based on this output. Seek immediate medical attention for urgent symptoms.',
  };

  return { source: 'template', generatedAt: new Date(), content };
}

export async function generateExplanation(
  result: AnalysisResult,
  patient: { age: number; sex: string }
): Promise<ExplanationRecord> {
  const provider = getLLMProvider();
  if (!provider) {
    return {
      ...templateExplanation(result),
      fallbackReason: 'LLM layer not configured (LLM_PROVIDER=none).',
    };
  }

  const userPayload = buildUserPayload(result, patient);

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const repairNote =
        attempt === 1
          ? ''
          : '\n\nIMPORTANT: Your previous reply was not valid JSON or did not match the schema. Reply with ONLY a single valid JSON object matching the schema.';
      const raw = await provider.complete({
        system: SYSTEM_PROMPT,
        user: `Structured results to explain:\n\n${userPayload}${repairNote}`,
      });
      const parsedJson: unknown = JSON.parse(extractJsonObject(raw));
      const validated = explanationContentSchema.parse(parsedJson);
      return {
        source: 'llm',
        provider: provider.name,
        model: provider.label,
        generatedAt: new Date(),
        content: validated,
      };
    } catch (err) {
      const message = sanitizeLLMError(err);
      const timedOut = /timed?\s?out|abort/i.test(message);
      logger.warn(`LLM explanation attempt ${attempt} failed`, { message, timedOut });
      // A timeout means the model is too slow for the configured budget —
      // retrying would just double the wait for the user. Fall back now.
      if (timedOut || attempt === 2) {
        return {
          ...templateExplanation(result),
          fallbackReason: `LLM unavailable or returned invalid output (${message}). Deterministic summary shown instead.`,
        };
      }
    }
  }

  // Unreachable, but keeps TypeScript happy.
  return templateExplanation(result);
}

/** Never leak API keys or URLs with credentials into user-visible text. */
function sanitizeLLMError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return raw
    .replace(/sk-[A-Za-z0-9-_]+/g, '[redacted]')
    .replace(/key=[^&\s]+/gi, 'key=[redacted]')
    .slice(0, 200);
}
