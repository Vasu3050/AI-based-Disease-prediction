# Limitations & honest non-claims

This project deliberately avoids overstating what it can do. Everything below
is true of the current implementation.

## Medical limitations

1. **Not a diagnosis, not medical advice.** All outputs are educational
   decision-support signals. No output may be used to start/stop/change
   treatment. Emergency symptoms require immediate care regardless of results.
2. **No clinical validation.** The models and rules have **not** been validated
   on real patient outcomes, prospective cohorts, or external populations.
   Reported metrics are held-out splits of the training datasets only.
3. **Dataset biases carry over.** Each model inherits the population, era and
   collection quirks of its dataset (Pima women ≥21; a single-region Indian
   hospital cohort; a single-centre CKD set). See [DATASETS.md](DATASETS.md).
4. **Semantic caveats**: PIMA's glucose is a 2-h OGTT value while the app
   feeds fasting glucose; the CKD "blood urea" field is mapped to BUN. Both are
   disclosed in the UI model cards and [ML.md](ML.md).
5. **Reference ranges vary by lab.** Default ranges are typical adult values;
   only lab-provided ranges (when entered) override them.
6. **No calibration claims.** Brier scores are reported, but no external
   calibration study exists; a "72%" model score is not "a 72% chance you have
   disease X".
7. **Not for emergencies or triage.** The system has no symptom input and
   cannot assess urgency.

## Technical limitations

- Medium-sized prototypes (PIMA 768 / ILPD 583 / CKD 400 rows) — small-data
  regime with limited generalization; extreme inputs may produce extreme
  estimates (the UI shows contributions and model cards to keep this visible).
- The demo environment is a single-node MongoDB deployment without HA.
- LLM explanations depend on the configured provider; local reasoning models
  can be slow (raise `LLM_TIMEOUT_MS`), and a deterministic fallback is used
  when unavailable.
- No image/OCR/PDF ingestion of lab reports — input is intentionally
  structured (free-form ingestion is a known future work item).
- Browser support: modern evergreen browsers; no legacy IE support.

## What we explicitly DO NOT claim anywhere

- No "99% accurate", "doctor-level", "clinically proven",
  "FDA-approved", or equivalent statements.
- No fabricated confidence intervals or literature numbers.
- No claim that demo data is real data; demo scenarios are always labeled
  `"DEMO / SYNTHETIC DATA — NOT FOR CLINICAL USE"`.

## Future improvements (not implemented — documented honestly)

- External validation dataset + calibration study.
- More targets (e.g. thyroid panels) with proper datasets.
- FHIR/HL7 structured import; lab PDF parsing with human review.
- Longitudinal risk modeling using trend data (currently trend view is
  descriptive only).
- Multi-language UI and accessibility audit (a11y basics are implemented:
  labels, focus rings, aria attributes; a full WCAG audit is not done).
