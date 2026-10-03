# Security

Security controls implemented in this codebase, with exact locations.

## Authentication & sessions

- **Password hashing**: bcrypt, 12 rounds — `server/src/services/authService.ts`.
- **Sessions**: stateless JWT signed with `JWT_SECRET` (≥32 chars enforced),
  delivered as an **HTTP-only, SameSite=Lax cookie** (`Secure` in production).
- **Session validation**: every request re-loads the user (disabled users are
  rejected immediately) — `server/src/middleware/auth.ts`.
- **Login hardening**: identical error message for unknown email vs wrong
  password; a dummy bcrypt comparison on unknown users to reduce timing
  enumeration; auth rate limiting (30/15 min/IP).
- **Role-based access**: `requireRole('admin')` guards all `/api/admin/*`
  routes; self-demotion/self-disable/self-delete via admin are blocked.

## Input handling

- **Strict validation everywhere**: Zod schemas with `.strict()` (unknown keys
  rejected) — `server/src/validation/schemas.ts`.
- **Catalog validation**: units, plausibility bounds, date sanity, unknown
  tests rejected (`server/src/domain/catalog.ts`).
- **NoSQL injection**: recursive sanitizer strips `$`-prefixed and dotted keys
  from body/params/query (`server/src/middleware/security.ts`); strict Zod
  schemas reject unknown keys before any query is built; all filters are
  constructed from validated, typed values. (Mongoose's global
  `sanitizeFilter` is deliberately **not** enabled — in Mongoose 8 it also
  wraps legitimate operator objects such as `$gte`, which breaks queries; the
  sanitizer middleware provides the equivalent protection. See
  `server/src/db/connect.ts`.)
- **Body size limit**: `express.json({ limit: '100kb' })`.
- **LLM output is untrusted input**: explanations are JSON-schema validated
  before storage/display; invalid output is retried once, then replaced by a
  deterministic fallback (`server/src/ai/explain.ts`).

## Transport & headers

- **Helmet** security headers on all responses.
- **CORS**: strict allow-list (`CLIENT_URL` + localhost dev origins),
  credentials enabled — `server/src/app.ts`.
- **Rate limiting**: global (600/15 min), auth (30/15 min), predictions
  (120/15 min) — `server/src/middleware/rateLimit.ts`.
- Production is expected behind HTTPS (reverse proxy); `trust proxy` is
  enabled in production for correct client IPs.

## Error handling & information disclosure

- Central error middleware maps errors to safe messages; **stack traces never
  reach clients** (and are only logged in non-production).
- 404 is used for other users' resources to avoid existence leaks.
- LLM error messages are scrubbed of key-like patterns before display.

## Data protection

- No health data in audit logs (enforced by construction + covered by tests).
- Cascade deletion (account or report) removes all linked data.
- Secrets live only in `.env` (gitignored); `.env.example` contains no real
  values; the admin system endpoint exposes a **redacted** config view only.
- `tests/` include checks that secrets never appear in admin responses.

## What this project does NOT claim

This is an educational prototype. It demonstrates production-minded controls
but has not undergone a professional security audit, penetration test, or
clinical compliance review (no HIPAA/GDPR certification etc.). Do not deploy
it for real patient data without an independent security review.
