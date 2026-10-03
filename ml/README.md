# ML pipeline (MediPredict AI)

This directory contains the **real, reproducible** training pipeline used to
produce the model artifacts consumed by the server (`server/src/ml/`).

```
ml/
├─ datasets/
│  ├─ dataset-meta.mjs     # provenance, licenses, limitations
│  ├─ fetch-datasets.mjs   # downloads + validates raw datasets (raw/ is gitignored)
│  └─ raw/                 # downloaded data (NOT committed)
├─ training/
│  ├─ lib.mjs              # logistic regression (IRLS), metrics, CV utilities
│  └─ train-all.mjs        # trains all models → ml/models/*.model.json
└─ models/                 # versioned JSON artifacts loaded by the server
```

## Usage

```bash
npm run dataset:fetch   # downloads PIMA, ILPD, UCI CKD into ml/datasets/raw/
npm run train:models    # trains + evaluates + writes ml/models/*.model.json
```

The app loads artifacts from `ml/models/` at startup (configurable via
`MODELS_DIR`). After retraining, reload them from the admin panel
(Admin → Models → "Reload artifacts") or restart the server.

## Honesty rules

- Metrics are always measured on a **held-out test split** (and reported with
  5-fold CV stability) — never from training data.
- Known limitations and semantic caveats are embedded in every artifact and
  surfaced in the UI (model cards).
- Demo/synthetic data is never used to claim accuracy.
- Full details: [docs/ML.md](../docs/ML.md) and [docs/DATASETS.md](../docs/DATASETS.md).
