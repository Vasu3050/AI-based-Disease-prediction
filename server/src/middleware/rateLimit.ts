import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

const skip = () => env.isTest;

/** Global soft limiter for all API requests. */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down.' } },
});

/** Stricter limiter for authentication endpoints (brute-force protection). */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip,
  message: {
    error: { code: 'RATE_LIMITED', message: 'Too many authentication attempts. Try again later.' },
  },
});

/** Limiter for compute-heavy endpoints (prediction creation). */
export const predictionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip,
  message: {
    error: { code: 'RATE_LIMITED', message: 'Too many prediction requests. Please slow down.' },
  },
});
