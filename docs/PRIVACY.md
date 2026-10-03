# Privacy

Blood-test values are sensitive health-related information. The platform is
built to collect the minimum necessary and to make deletion straightforward.

## Data inventory

| Data | Where | Notes |
|---|---|---|
| Name, email, bcrypt password hash | `users` | required for the account |
| Patient basics (name/sex/birth year) | `patients` | optional profiles; reports also keep a snapshot for integrity |
| Laboratory values + optional context (BMI/BP/smoking) | `bloodreports` | stored in canonical units |
| Analysis results | `predictions` | structured; includes model versions |
| Security events (login, report created, …) | `auditlogs` | **no laboratory values**, no health data |
| Theme/UI preferences | account settings | non-sensitive |

Deliberately **not** collected: addresses, phone numbers, government IDs,
insurance data, free-form clinical history (the notes field is user-optional
and never used for prediction).

## LLM data policy (the "explanation" feature)

When an LLM provider is configured and the user requests an explanation, the
server sends a **minimal structured summary**: patient age & sex, flagged
values with their ranges, guideline labels, and model bands/scores.

- Names, emails, phone numbers, account IDs, notes and identifiers are
  **never** sent.
- The explanation is optional; with `LLM_PROVIDER=none` a fully
  deterministic summary is generated **offline** and nothing leaves the server.
- When using a hosted provider (OpenAI, xAI, Groq, …), your provider's data
  policies apply to that request — choose providers accordingly. For maximum
  privacy, use a local model (Ollama) so no data leaves the machine.

## User controls

- Delete individual reports (cascades their predictions).
- Delete the entire account in **Settings → Danger zone** (password-confirmed):
  removes patients, reports, predictions and the user's audit trail.
- Self-host everything: database, API, ML and (optionally) the LLM.

## Logging

- Request logs (morgan) contain method/path/status only — no bodies.
- Audit logs store action + entity reference + IP/user-agent; **never lab
  values** (asserted by automated tests).
- Application logs do not include patient values.

## Prototype caveats

This is an educational project, not a certified privacy-compliant service.
Run it locally/for demonstrations; consult legal counsel before handling real
patient data in any regulated context.
