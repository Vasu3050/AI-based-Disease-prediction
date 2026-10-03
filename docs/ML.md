# Machine Learning

This document is deliberately honest about what the models are, how they were
trained, what the reported numbers mean, and where they break.

## TL;DR

| Model | Target | Features | Held-out ROC-AUC (this repo) | CV ROC-AUC (5-fold) |
|---|---|---|---|---|
| `diabetes_full` | Diabetes-related risk | glucose, BMI, age, diastolic BP | **0.826** | 0.825 ± 0.019 |
| `diabetes_reduced` | Diabetes-related risk (fallback) | glucose, age | **0.857** | 0.793 ± 0.053 |
| `liver_full` | Liver-related abnormality risk | age, sex, bilirubin, ALP, ALT, AST, albumin | **0.751** | 0.739 ± 0.082 |
| `kidney_full` | Kidney-related risk | age, hemoglobin, BUN, creatinine | **0.986** | 0.984 ± 0.011 |
| `kidney_reduced` | Kidney-related risk (no BUN) | age, hemoglobin, creatinine | **0.979** | 0.982 ± 0.017 |

> **These numbers are NOT real-world clinical performance.** They are held-out
> test-split metrics on the specific research datasets listed in
> [DATASETS.md](DATASETS.md), measured by the pipeline in this repository
> (seed 42). Kidney datasets in particular are known to be "easy" — a high AUC
> there does not mean the model is a good clinical tool.

Reproduce: `npm run dataset:fetch && npm run train:models`
(prints the same table and writes `ml/models/manifest.json`).

## Architecture: where ML sits in the pipeline

```
blood values → validation → reference ranges → guideline rules → ML models → structured result
                                                                        ↘
                                                     optional LLM explanation (never predicts)
```

ML models are **one component** of a deterministic pipeline. They run only when
all their required inputs are present; nothing is imputed or guessed. When a
model cannot run, the UI says exactly which values are missing.

## Algorithm choice

Logistic regression (L2-regularized, trained with IRLS/Newton) for every
target. Rationale:

- **Interpretability**: coefficients expose direction/magnitude of each
  feature; per-prediction contributions are computed as `coef × z-score` —
  shown in the UI ("which inputs influenced this score").
- **Small datasets**: PIMA (768), ILPD (583), CKD (400) — deep models would
  overfit and be unaccountable.
- **Calibration-friendly**: probabilistic output with documented limitations.

Model selection should be evidence-based; the training script makes it trivial
to add alternatives later, but nothing more complex was added **because it was
not justified by validation results**, not for lack of capability.

## Training procedure (implementation: `ml/training/`)

1. **Preprocessing** (per dataset, documented in DATASETS.md):
   - PIMA: zeros in Glucose/BloodPressure/BMI are treated as missing
     (recorded as `0` in the source but physiologically impossible), rows with
     missing required features dropped.
   - ILPD: numeric parsing; rows missing any model feature dropped (none).
   - CKD: `?`/tab artifacts parsed as missing; rows without the 4/3 required
     features dropped.
2. **Split**: stratified train/test (80/20, seed 42), label-stratified.
3. **Scaling**: standardization fit on **training data only**; parameters
   stored inside the artifact and reused at inference.
4. **Fit**: IRLS logistic regression, L2 = 0.01 (intercept unregularized).
5. **Evaluation** (on the held-out test set): ROC-AUC, PR-AUC, accuracy,
   precision, recall, F1 (threshold 0.5), Brier score; plus stratified 5-fold
   CV ROC-AUC on the training portion for stability context.
6. **Artifacts**: `ml/models/<key>.model.json` — features, scaler, coefficients,
   intercept, metrics, dataset metadata, caveats (`notes`), CV summary.
   The server validates artifact shape at load time and refuses malformed files.

## Explainability

For each prediction: `contribution_i = coefficient_i × z_i` where `z_i` is the
standardized feature value. Positive contributions push the model's log-odds
up; negative push down. The UI sorts by absolute magnitude. This explains the
**model output** — it is not a causal medical statement.

## Risk bands

`probabilityToBand(p)`: `<0.25 low / <0.5 borderline / <0.75 moderate / ≥0.75 high`.
Bands are **display conveniences**, not clinical thresholds. Thresholds for
classification metrics use 0.5, chosen as the default, not optimized for any
clinical objective (e.g. screening sensitivity).

## Model-specific caveats (also embedded in artifacts & shown in the UI)

### Diabetes models (PIMA)
- The dataset's glucose field is a **2-hour oral glucose tolerance test**, while
  the app usually supplies **fasting glucose**. These are different
  measurements — outputs are rough educational estimates, not comparable to
  model metrics in the literature.
- Population: Pima women ≥21. **Not representative** of general populations.

### Liver model (ILPD)
- Label = "liver patient" selector, **not a specific disease**. Interpret as
  "pattern consistent with the dataset's liver-patient class", nothing more.
- 583 rows; extreme lab outliers exist; metrics are modest (AUC ≈ 0.75).

### Kidney models (UCI CKD)
- The dataset's "blood urea" (`bu`) field is mapped to **BUN** — a small
  semantic caveat.
- Many missing values; only complete rows used (n≈326/329).
- Very high metrics are partially an artifact of this dataset's structure
  (separability) — do not read them as clinical-grade performance.

## Fine-tuning: investigated and deliberately not used

The master requirements ask to investigate whether LLM fine-tuning is appropriate.
Conclusion: **no**, and here is the reasoning (documented rather than silently skipped):

- **The LLM does not predict.** It only rewrites already-computed structured
  results into plain language. Fine-tuning a generative model for this task
  would add cost, opaque failure modes and hallucination risk without improving
  the actual predictions, which come from the deterministic pipeline + classical
  ML models.
- **No suitable supervised data exists.** We would need expert-written
  explanation pairs validated for safety; fabricating such a dataset would
  violate this project's honesty rules.
- **Better tools exist for the job.** The explanation layer instead uses:
  structured prompting (strict system rules, minimal payload), JSON-schema
  validation of every LLM response, a retry, and a deterministic template
  fallback when anything is off — behavior that is testable and auditable.
- **Classical ML is already "trained":** the prediction layer (logistic
  regressions) has a genuine, reproducible training/evaluation pipeline with
  versioned artifacts (see above). That is where modeling effort belongs for
  this scope.

An optional fine-tuning playground could be added later *if* a vetted,
curated explanation dataset ever exists — it is explicitly out of scope today.

## What is intentionally NOT claimed

- No "99% accurate", "doctor-level", or "clinically proven" claims anywhere.
- No diagnostic thresholds presented as medical advice.
- No calibration claims — the Brier score is reported in the model card, but
  no external calibration study exists.
- Guideline panels (WHO/ADA/NCEP/KDIGO-style) are **rules**, not ML, and are
  labeled as such in the API and the UI.
