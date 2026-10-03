# Reference ranges, units & conversions

The catalog in `server/src/domain/catalog.ts` is the single source of truth the
server and the report form are both generated from.

**Important:** reference ranges vary between laboratories. The values here are
*typical adult references* for an educational prototype. Reports may carry a
laboratory-specific range (`labRange`), which **overrides** the default during
analysis. All values in the app are stored in canonical units.

## Tests

| Key | Test | Canonical unit | Accepted units | Typical range | Source |
|---|---|---|---|---|---|
| `hemoglobin` | Hemoglobin | g/dL | g/dL, g/L | M 13.0–17.0 · F 12.0–15.0 | WHO anemia thresholds / typical refs |
| `rbc` | Red blood cell count | million/µL | million/µL, 10^12/L | M 4.5–5.9 · F 4.1–5.1 | MedlinePlus / typical refs |
| `wbc` | White blood cell count | cells/µL | cells/µL, 10^3/µL | 4,000–11,000 | Typical adult refs |
| `platelets` | Platelet count | cells/µL | cells/µL, 10^3/µL | 150,000–450,000 | Typical adult refs |
| `hematocrit` | Hematocrit | % | %, L/L | M 38.8–50.0 · F 34.9–44.5 | Mayo Clinic refs |
| `mcv` | MCV | fL | fL | 80–100 | Typical adult refs |
| `fasting_glucose` | Fasting glucose | mg/dL | mg/dL, mmol/L | 70–99 | ADA (normal <100; 100–125 elevated; ≥126 diabetes-range) |
| `hba1c` | HbA1c | % | %, mmol/mol | 4.0–5.6 | ADA (normal <5.7; 5.7–6.4 prediabetes-range; ≥6.5 diabetes-range) |
| `total_cholesterol` | Total cholesterol | mg/dL | mg/dL, mmol/L | 100–199 | NCEP ATP III (<200 desirable) |
| `ldl` | LDL cholesterol | mg/dL | mg/dL, mmol/L | 25–99 | NCEP ATP III (<100 optimal) |
| `hdl` | HDL cholesterol | mg/dL | mg/dL, mmol/L | M ≥40 · F ≥50 | NCEP ATP III low-HDL thresholds |
| `triglycerides` | Triglycerides | mg/dL | mg/dL, mmol/L | 20–149 | NCEP ATP III (<150 normal) |
| `alt` | ALT (SGPT) | U/L | U/L, IU/L | M 7–55 · F 7–45 | Mayo Clinic refs |
| `ast` | AST (SGOT) | U/L | U/L, IU/L | 8–48 | Mayo Clinic refs |
| `alp` | Alkaline phosphatase | U/L | U/L, IU/L | 40–129 | Mayo Clinic refs |
| `total_bilirubin` | Total bilirubin | mg/dL | mg/dL, µmol/L | 0.1–1.2 | Mayo Clinic refs |
| `albumin` | Albumin | g/dL | g/dL, g/L | 3.5–5.0 | Mayo Clinic refs |
| `creatinine` | Creatinine | mg/dL | mg/dL, µmol/L | M 0.74–1.35 · F 0.59–1.04 | Mayo Clinic refs |
| `urea` | Blood urea nitrogen (BUN) | mg/dL | mg/dL, mmol/L | 7–20 | Typical adult refs |
| `tsh` | TSH | mIU/L | mIU/L, µIU/mL | 0.4–4.0 | Typical adult refs |
| `uric_acid` | Uric acid | mg/dL | mg/dL, µmol/L | M 3.4–7.0 · F 2.4–6.0 | Mayo Clinic refs |
| `ferritin` | Ferritin | ng/mL | ng/mL, µg/L | M 30–400 · F 13–150 | Mayo Clinic refs |

For `sex: other`, sex-neutral (widest) ranges are applied; the anemia rule uses
a conservative threshold and says so in the finding text.

## Conversions applied at intake

| From | To | Rule |
|---|---|---|
| mmol/L → mg/dL | glucose | ×18.0182 |
| mmol/mol → % | HbA1c (IFCC→DCCT) | ÷10.929 + 2.15 |
| mmol/L → mg/dL | cholesterol (all lipid tests) | ×38.67 |
| mmol/L → mg/dL | triglycerides | ×88.57 |
| µmol/L → mg/dL | creatinine | ÷88.4 |
| µmol/L → mg/dL | bilirubin | ÷17.104 |
| g/L → g/dL | hemoglobin, albumin | ×0.1 |
| L/L → % | hematocrit | ×100 |
| 10^3/µL → cells/µL | WBC, platelets | ×1000 |
| mmol/L → mg/dL | urea (as BUN) | ×2.8 |

Unknown units are **rejected** — the system never guesses a missing unit.

## Plausibility bounds

Each test has absolute bounds (e.g. hemoglobin 2–25 g/dL, glucose 10–1000
mg/dL) applied after conversion; values outside are rejected as
data-entry errors rather than analyzed.

## Computed values (not user input)

- **eGFR** — CKD-EPI 2021 (race-free; Inker et al.). Requires creatinine, age
  and sex (male/female). KDIGO categories G1–G5 shown.
- **BMI** — from direct BMI input, or computed from weight+height.

## Guideline panels (rules, not ML)

| Panel | Basis |
|---|---|
| Glycemic | ADA diagnostic ranges (FPG, HbA1c) |
| Anemia | WHO hemoglobin thresholds + severity bands; MCV pattern hints; ferritin note |
| Lipids | NCEP ATP III category boundaries |
| Liver | Standard upper limits; hepatocellular vs cholestatic pattern hints |
| Kidney | eGFR categories + BUN/creatinine flags (KDIGO-style) |
