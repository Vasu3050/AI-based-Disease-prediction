# Datasets

All training data comes from **legitimate public research datasets**. Raw files
are downloaded by `npm run dataset:fetch` into `ml/datasets/raw/` and are not
committed to git. Attribution and limitations below.

> The repository also ships **synthetic demo scenarios** for presentations —
> these are labeled `"DEMO / SYNTHETIC DATA — NOT FOR CLINICAL USE"` and are
> never used for training or accuracy claims.

## 1. PIMA Indians Diabetes Database

| Field | Value |
|---|---|
| Source | National Institute of Diabetes and Digestive and Kidney Diseases (NIDDK); distributed via widely mirrored public copies |
| URLs | `raw.githubusercontent.com/jbrownlee/Datasets/master/pima-indians-diabetes.data.csv` (primary), `raw.githubusercontent.com/plotly/datasets/master/diabetes.csv` (fallback) |
| License | Public research dataset, commonly distributed as CC0/public domain via mirrors |
| Samples | 768 (all female, age ≥ 21, Pima heritage) |
| Features used | Glucose (2-h OGTT), BloodPressure (diastolic), BMI, Age |
| Target | `Outcome` (diabetes diagnosis) |
| Preprocessing | Zeros in Glucose/BloodPressure/BMI treated as missing; rows with missing required features dropped → 724 (full) / 763 (reduced) usable |
| Key limitations | Population specific; glucose is a 2-h OGTT value (≠ fasting glucose used in the app); 1990s cohort |

## 2. Indian Liver Patient Dataset (ILPD)

| Field | Value |
|---|---|
| Source | UCI Machine Learning Repository, dataset 225 |
| URL | `archive.ics.uci.edu/dataset/225/ilpd+indian+liver+patient+dataset` |
| License | CC BY 4.0 |
| Samples | 583 |
| Features used | Age, Sex, Total Bilirubin, Alkaline Phosphatase, ALT (SGPT), AST (SGOT), Albumin |
| Target | Dataset "selector" field (1 = liver patient per dataset documentation) |
| Preprocessing | Numeric parsing; no rows dropped for the used features (583 usable) |
| Key limitations | Single binary label (not a specific disease); small; some extreme outliers; single-region population |

## 3. Chronic Kidney Disease (UCI CKD)

| Field | Value |
|---|---|
| Source | UCI Machine Learning Repository, dataset 336 |
| URL | `archive.ics.uci.edu/dataset/336/chronic+kidney+disease` |
| License | CC BY 4.0 |
| Samples | 400 |
| Features used | Age, Hemoglobin, Blood urea (mapped to BUN), Serum creatinine |
| Target | `class` (ckd / notckd) |
| Preprocessing | `?`/tab artifacts → missing; rows without the used features dropped → 326 (full) / 329 (reduced) usable |
| Key limitations | Small single-centre cohort; "blood urea" ↔ BUN mapping caveat; known to be highly separable (optimistic metrics) |

## Fetch pipeline

```
ml/datasets/fetch-datasets.mjs
  ├─ tries multiple mirrors per dataset
  ├─ validates row/column counts before accepting
  ├─ handles ZIP (stored + deflate), RAR (via system tar/bsdtar), ARFF→CSV conversion
  └─ writes raw files + sources.json (URLs, sha256, row/col counts, timestamps)
```

If a source fails, the script prints **manual fallback instructions** — it
never silently substitutes different data.

## Provenance in the product

Every trained artifact carries `dataset: { name, source, url, license }` plus
limitation notes; these are surfaced in the UI (model cards, admin model page)
and stored with the modelVersion registry record.

## Demo data (not a dataset)

`npm run demo:seed` creates synthetic reports covering six educational
scenarios (normal, glucose pattern, anemia pattern, lipid pattern, liver
pattern, kidney pattern) for the demo account. They are marked
`"DEMO / SYNTHETIC DATA — NOT FOR CLINICAL USE"` in the database and in the UI.
