/**
 * Zod schemas for every API input. Strict by design: unknown keys are rejected,
 * units are validated against the catalog, and impossible values are refused.
 */
import { z } from 'zod';
import { getTestDef, normalizeTestEntry } from '../domain/catalog';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid identifier.');

// ---------------------------------------------------------------- auth
export const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(120),
    email: z.string().trim().toLowerCase().email('A valid email address is required.').max(254),
    password: z
      .string()
      .min(10, 'Password must be at least 10 characters.')
      .max(200)
      .regex(/[a-zA-Z]/, 'Password must contain at least one letter.')
      .regex(/[0-9]/, 'Password must contain at least one number.'),
  })
  .strict();

export const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email('A valid email address is required.'),
    password: z.string().min(1, 'Password is required.').max(200),
  })
  .strict();

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(200),
    newPassword: z
      .string()
      .min(10, 'Password must be at least 10 characters.')
      .max(200)
      .regex(/[a-zA-Z]/, 'Password must contain at least one letter.')
      .regex(/[0-9]/, 'Password must contain at least one number.'),
  })
  .strict();

export const updateMeSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    settings: z
      .object({
        theme: z.enum(['light', 'dark', 'system']).optional(),
        highContrastCharts: z.boolean().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

// ---------------------------------------------------------------- patients
export const patientCreateSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required.').max(120),
    sex: z.enum(['male', 'female', 'other']),
    birthYear: z.number().int().min(1900).max(2100, 'Enter a valid birth year.'),
    externalRef: z.string().trim().max(120).optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .strict();

export const patientUpdateSchema = patientCreateSchema.partial();

// ---------------------------------------------------------------- reports
const labRangeSchema = z
  .object({
    low: z.number().finite().optional(),
    high: z.number().finite().optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.low !== undefined && val.high !== undefined && !(val.low < val.high)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Low must be smaller than high in a laboratory range.',
      });
    }
  });

const testEntrySchema = z
  .object({
    value: z.number().finite('A numeric value is required.'),
    unit: z.string().trim().min(1, 'A unit is required.').max(30),
    labRange: labRangeSchema.optional(),
  })
  .strict();

const contextSchema = z
  .object({
    bmi: z.number().min(5).max(100).optional(),
    weightKg: z.number().min(2).max(500).optional(),
    heightCm: z.number().min(30).max(260).optional(),
    systolicBp: z.number().int().min(40).max(300).optional(),
    diastolicBp: z.number().int().min(20).max(200).optional(),
    smoker: z.enum(['never', 'former', 'current']).optional(),
    familyHistoryDiabetes: z.boolean().optional(),
  })
  .strict();

export const reportCreateSchema = z
  .object({
    /** Inline patient details — required when `patientId` is not provided. */
    patient: z
      .object({
        name: z.string().trim().max(120).optional(),
        age: z.number().int().min(0).max(120),
        sex: z.enum(['male', 'female', 'other']),
      })
      .strict()
      .optional(),
    patientId: objectId.optional(),
    context: contextSchema.optional(),
    report: z
      .object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD format.'),
        labName: z.string().trim().max(120).optional(),
        fasting: z.boolean().optional(),
      })
      .strict(),
    notes: z.string().trim().max(1000).optional(),
    tests: z.record(z.string(), testEntrySchema),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (!val.patientId && !val.patient) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide patient details or select a saved patient profile.',
        path: ['patient'],
      });
    }
    const keys = Object.keys(val.tests);
    if (keys.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'At least one laboratory test is required.', path: ['tests'] });
    }

    // Date sanity
    const d = new Date(`${val.report.date}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Report date is not a real date.', path: ['report', 'date'] });
    } else {
      // Allow "today" in any timezone (UTC offsets range from −12h to +14h);
      // anything beyond that is a genuinely future date.
      const slackMs = 14 * 60 * 60 * 1000;
      if (d.getTime() > Date.now() + slackMs) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Report date cannot be in the future.',
          path: ['report', 'date'],
        });
      }
      if (d.getUTCFullYear() < 1900) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Report date is implausibly old.',
          path: ['report', 'date'],
        });
      }
    }

    // Per-test key + unit + plausibility validation (single source of truth: catalog)
    for (const [key, entry] of Object.entries(val.tests)) {
      if (!getTestDef(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unknown test "${key}". Allowed tests are defined by the server catalog.`,
          path: ['tests', key],
        });
        continue;
      }
      const normalized = normalizeTestEntry(key, { value: entry.value, unit: entry.unit });
      if (!normalized.ok) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: normalized.reason,
          path: ['tests', key],
        });
      }
    }

    // Context sanity: BMI computable only with both weight+height, etc.
    if (val.context?.weightKg !== undefined && val.context?.heightCm === undefined && val.context?.bmi === undefined) {
      // allowed (weight alone is fine, just unused) — no issue.
    }
  });

export const compareSchema = z
  .object({
    ids: z
      .array(objectId)
      .length(2, 'Exactly two report ids are required.')
      .refine((ids) => ids[0] !== ids[1], 'Select two different reports.'),
  })
  .strict();

// ---------------------------------------------------------------- predictions
export const predictionCreateSchema = z
  .object({
    reportId: objectId,
  })
  .strict();

// ---------------------------------------------------------------- queries
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  patientId: objectId.optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  q: z.string().trim().max(200).optional(),
});

// ---------------------------------------------------------------- admin
export const adminUserUpdateSchema = z
  .object({
    role: z.enum(['user', 'admin']).optional(),
    disabled: z.boolean().optional(),
  })
  .strict()
  .refine((v) => v.role !== undefined || v.disabled !== undefined, {
    message: 'Provide at least one field to update.',
  });

export const auditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  action: z.string().trim().max(64).optional(),
});
