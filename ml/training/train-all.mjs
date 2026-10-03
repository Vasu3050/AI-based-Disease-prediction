#!/usr/bin/env node
/**
 * Model training pipeline for MediPredict AI.
 *
 * Trains interpretable logistic-regression models on the public datasets in
 * `ml/datasets/raw/` and writes versioned JSON artifacts to `ml/models/`.
 *
 * Usage:
 *   npm run dataset:fetch    (once)
 *   npm run train:models
 *
 * Honesty rules (enforced here):
 *   - every artifact records its dataset, limitations and honest metrics
 *     measured on a HELD-OUT TEST split (never reported from training data);
 *   - cross-validation summaries are included for stability context;
 *   - known semantic caveats are written into `notes` and shown in the UI.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATASETS_META } from '../datasets/dataset-meta.mjs';
import {
  averagePrecision,
  brierScore,
  computeMeanStd,
  confusionAt,
  fitLogisticIRLS,
  formatMetricsTable,
  mean,
  predictProba,
  rocAuc,
  stdev,
  standardizeRow,
  stratifiedKFolds,
  stratifiedSplit,
} from './lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RAW_DIR = path.join(HERE, '..', 'datasets', 'raw');
const MODELS_DIR = path.join(HERE, '..', 'models');
fs.mkdirSync(MODELS_DIR, { recursive: true });

const SEED = 42;

// ------------------------------------------------------------------ CSV parsing

function parseCsv(text) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== '')
    .map((l) => l.split(',').map((c) => c.trim()));
}

function num(v) {
  if (v === undefined || v === null || v === '?' || v === '') return NaN;
  const n = Number(String(v).replace('\t', '').trim());
  return Number.isFinite(n) ? n : NaN;
}

function clean(v) {
  return typeof v === 'string' ? v.replace(/\t/g, '').trim().toLowerCase() : v;
}

// ------------------------------------------------------------------ model training

function trainModel({ key, name, targetId, title, description, features, X, y, datasetMeta, notes }) {
  const { train, test } = stratifiedSplit(y, 0.2, SEED);
  const Xtr = train.map((i) => X[i]);
  const ytr = train.map((i) => y[i]);
  const Xte = test.map((i) => X[i]);
  const yte = test.map((i) => y[i]);

  const { mean: mu, std: sigma } = computeMeanStd(Xtr);
  const XtrS = Xtr.map((r) => standardizeRow(r, mu, sigma));
  const XteS = Xte.map((r) => standardizeRow(r, mu, sigma));

  const model = fitLogisticIRLS(XtrS, ytr, { l2: 0.01 });
  const pTest = predictProba(XteS, model);

  const roc = rocAuc(pTest, yte);
  const pr = averagePrecision(pTest, yte);
  const conf = confusionAt(pTest, yte, 0.5);
  const brier = brierScore(pTest, yte);

  // Stratified 5-fold CV on the TRAINING portion (per-fold standardization).
  const folds = stratifiedKFolds(ytr, 5, SEED + 7);
  const foldAucs = [];
  for (let f = 0; f < folds.length; f += 1) {
    const va = folds[f];
    const tr = folds.filter((_, i) => i !== f).flat();
    const Xf = tr.map((i) => Xtr[i]);
    const yf = tr.map((i) => ytr[i]);
    const { mean: m2, std: s2 } = computeMeanStd(Xf);
    const fit = fitLogisticIRLS(
      Xf.map((r) => standardizeRow(r, m2, s2)),
      yf,
      { l2: 0.01 }
    );
    const pv = predictProba(
      va.map((i) => standardizeRow(Xtr[i], m2, s2)),
      fit
    );
    foldAucs.push(rocAuc(pv, va.map((i) => ytr[i])));
  }

  const round6 = (n) => Math.round(n * 1e6) / 1e6;

  const artifact = {
    key,
    name,
    targetId,
    title,
    description,
    version: '1.0.0',
    trainedAt: new Date().toISOString(),
    features,
    scaler: { mean: mu.map(round6), std: sigma.map(round6) },
    coefficients: model.coefficients.map(round6),
    intercept: round6(model.intercept),
    decisionThreshold: 0.5,
    metrics: {
      rocAuc: round6(roc),
      prAuc: round6(pr),
      accuracy: round6(conf.accuracy),
      precision: round6(conf.precision),
      recall: round6(conf.recall),
      f1: round6(conf.f1),
      brier: round6(brier),
      nTrain: train.length,
      nTest: test.length,
      prevalence: round6(mean(yte)),
      datasetName: datasetMeta.name,
    },
    dataset: {
      name: datasetMeta.name,
      source: datasetMeta.source,
      url: datasetMeta.url,
      license: datasetMeta.license,
    },
    notes,
    cv: {
      folds: foldAucs.length,
      aucMean: round6(mean(foldAucs)),
      aucStd: round6(stdev(foldAucs)),
    },
  };

  return {
    artifact,
    row: {
      name: key,
      nTrain: train.length,
      nTest: test.length,
      prevalence: mean(yte),
      rocAuc: roc,
      prAuc: pr,
      accuracy: conf.accuracy,
      precision: conf.precision,
      recall: conf.recall,
      f1: conf.f1,
      brier,
      cvAucMean: mean(foldAucs),
      cvAucStd: stdev(foldAucs),
    },
  };
}

// ------------------------------------------------------------------ dataset builders

function buildPima() {
  const text = fs.readFileSync(path.join(RAW_DIR, 'pima.csv'), 'utf8');
  const rows = parseCsv(text);
  const hasHeader = Number.isNaN(num(rows[0][0]));
  const data = hasHeader ? rows.slice(1) : rows;
  // Columns: Pregnancies(0) Glucose(1) BloodPressure(2) SkinThickness(3)
  //          Insulin(4) BMI(5) Pedigree(6) Age(7) Outcome(8)
  const samples = [];
  for (const r of data) {
    let glucose = num(r[1]);
    let bp = num(r[2]);
    let bmi = num(r[5]);
    const age = num(r[7]);
    const outcome = num(r[8]);
    if (glucose === 0) glucose = NaN;
    if (bp === 0) bp = NaN;
    if (bmi === 0) bmi = NaN;
    if (!Number.isFinite(outcome)) continue;
    samples.push({ glucose, bp, bmi, age, y: outcome === 1 ? 1 : 0 });
  }
  return samples;
}

function buildIlpd() {
  const text = fs.readFileSync(path.join(RAW_DIR, 'ilpd.csv'), 'utf8');
  const rows = parseCsv(text);
  const hasHeader = Number.isNaN(num(rows[0][0]));
  const data = hasHeader ? rows.slice(1) : rows;
  // Columns: Age(0) Gender(1) TB(2) DB(3) ALP(4) ALT(5) AST(6) TP(7) ALB(8) A/G(9) Dataset(10)
  const samples = [];
  for (const r of data) {
    const age = num(r[0]);
    const sexFemale = clean(r[1]) === 'female' ? 1 : 0;
    const tb = num(r[2]);
    const alp = num(r[4]);
    const alt = num(r[5]);
    const ast = num(r[6]);
    const albumin = num(r[8]);
    const label = num(r[10]);
    if (!Number.isFinite(label)) continue;
    samples.push({ age, sexFemale, tb, alp, alt, ast, albumin, y: label === 1 ? 1 : 0 });
  }
  return samples;
}

function buildCkd() {
  const text = fs.readFileSync(path.join(RAW_DIR, 'ckd.csv'), 'utf8');
  const rows = parseCsv(text);
  // Header (converted from ARFF): id,age,bp,sg,al,su,...,hemo,...,class
  const headers = rows[0].map((h) => clean(h));
  const idx = (name) => headers.indexOf(name);
  const iAge = idx('age');
  const iHemo = idx('hemo');
  const iBu = idx('bu');
  const iSc = idx('sc');
  const iClass = idx('class');
  if ([iAge, iHemo, iBu, iSc, iClass].some((i) => i < 0)) {
    throw new Error(`CKD header missing expected columns (got: ${headers.join(',')})`);
  }
  const data = rows.slice(1);
  const samples = [];
  for (const r of data) {
    const age = num(r[iAge]);
    const hemoglobin = num(r[iHemo]);
    const bun = num(r[iBu]);
    const creatinine = num(r[iSc]);
    const cls = clean(r[iClass]);
    if (cls !== 'ckd' && cls !== 'notckd') continue;
    samples.push({ age, hemoglobin, bun, creatinine, y: cls === 'ckd' ? 1 : 0 });
  }
  return samples;
}

function buildMatrix(samples, extractors, label) {
  const X = [];
  const y = [];
  let dropped = 0;
  for (const s of samples) {
    const feats = extractors.map((fn) => fn(s));
    if (feats.some((v) => !Number.isFinite(v))) {
      dropped += 1;
      continue;
    }
    X.push(feats);
    y.push(label(s));
  }
  return { X, y, dropped, total: samples.length };
}

// ------------------------------------------------------------------ main

function main() {
  for (const f of ['pima.csv', 'ilpd.csv', 'ckd.csv']) {
    if (!fs.existsSync(path.join(RAW_DIR, f))) {
      console.error(`Missing ${f} in ${RAW_DIR}. Run: npm run dataset:fetch`);
      process.exit(1);
    }
  }

  const artifacts = [];
  const rows = [];

  // ---- Diabetes (PIMA) -------------------------------------------------
  const pima = buildPima();
  const pimaFull = buildMatrix(pima, [(s) => s.glucose, (s) => s.bmi, (s) => s.age, (s) => s.bp], (s) => s.y);
  const pimaReduced = buildMatrix(pima, [(s) => s.glucose, (s) => s.age], (s) => s.y);
  console.log(`PIMA: ${pima.length} raw samples · full-feature subset ${pimaFull.X.length} · reduced subset ${pimaReduced.X.length}`);

  const pimaNotes =
    'Trained on the PIMA dataset. IMPORTANT: the dataset glucose field is a 2-hour oral glucose ' +
    'tolerance test value, while the application typically provides fasting glucose — treat outputs ' +
    'as rough educational estimates, not clinical probabilities. Dataset population: Pima women ' +
    'aged 21+ (not representative). See docs/ML.md for full limitations.';

  const full = trainModel({
    key: 'diabetes_full',
    name: 'diabetes-full-lr',
    targetId: 'diabetes_risk',
    title: 'Diabetes-related risk score',
    description: 'Logistic regression on glucose, BMI, age and diastolic blood pressure (PIMA-trained).',
    features: ['glucose', 'bmi', 'age', 'bp'],
    X: pimaFull.X,
    y: pimaFull.y,
    datasetMeta: DATASETS_META.pima,
    notes: pimaNotes,
  });
  artifacts.push(full.artifact);
  rows.push(full.row);

  const reduced = trainModel({
    key: 'diabetes_reduced',
    name: 'diabetes-reduced-lr',
    targetId: 'diabetes_risk',
    title: 'Diabetes-related risk score (glucose + age)',
    description: 'Reduced-input logistic regression used when BMI / blood pressure are unavailable (PIMA-trained).',
    features: ['glucose', 'age'],
    X: pimaReduced.X,
    y: pimaReduced.y,
    datasetMeta: DATASETS_META.pima,
    notes: pimaNotes,
  });
  artifacts.push(reduced.artifact);
  rows.push(reduced.row);

  // ---- Liver (ILPD) ----------------------------------------------------
  const ilpd = buildIlpd();
  const ilpdM = buildMatrix(
    ilpd,
    [(s) => s.age, (s) => s.sexFemale, (s) => s.tb, (s) => s.alp, (s) => s.alt, (s) => s.ast, (s) => s.albumin],
    (s) => s.y
  );
  console.log(`ILPD: ${ilpd.length} raw samples · usable subset ${ilpdM.X.length} (dropped ${ilpdM.dropped})`);

  const liver = trainModel({
    key: 'liver_full',
    name: 'liver-lr',
    targetId: 'liver_risk',
    title: 'Liver-related abnormality risk score',
    description:
      'Logistic regression on bilirubin, ALP, ALT, AST and albumin (ILPD-trained). Estimates probability of the dataset\'s liver-patient label — not a specific disease diagnosis.',
    features: ['age', 'sex_female', 'total_bilirubin', 'alp', 'alt', 'ast', 'albumin'],
    X: ilpdM.X,
    y: ilpdM.y,
    datasetMeta: DATASETS_META.ilpd,
    notes:
      'Trained on ILPD. The dataset label marks "liver patient" status, not a specific disease. ' +
      'Small dataset with extreme outliers; do not present outputs as diagnoses. See docs/ML.md.',
  });
  artifacts.push(liver.artifact);
  rows.push(liver.row);

  // ---- Kidney (CKD) ----------------------------------------------------
  const ckd = buildCkd();
  const ckdFull = buildMatrix(
    ckd,
    [(s) => s.age, (s) => s.hemoglobin, (s) => s.bun, (s) => s.creatinine],
    (s) => s.y
  );
  const ckdReduced = buildMatrix(
    ckd,
    [(s) => s.age, (s) => s.hemoglobin, (s) => s.creatinine],
    (s) => s.y
  );
  console.log(`CKD: ${ckd.length} raw samples · full subset ${ckdFull.X.length} · reduced subset ${ckdReduced.X.length}`);

  const ckdNotes =
    'Trained on the UCI Chronic Kidney Disease dataset. The dataset "blood urea" field is mapped ' +
    'to BUN — a small semantic caveat. Many missing values; only complete rows were used. ' +
    'Estimates are educational and NOT clinical probabilities. See docs/ML.md.';

  const kidneyFull = trainModel({
    key: 'kidney_full',
    name: 'kidney-full-lr',
    targetId: 'kidney_risk',
    title: 'Kidney-related risk score',
    description: 'Logistic regression on age, hemoglobin, BUN and creatinine (UCI CKD-trained).',
    features: ['age', 'hemoglobin', 'bun', 'creatinine'],
    X: ckdFull.X,
    y: ckdFull.y,
    datasetMeta: DATASETS_META.ckd,
    notes: ckdNotes,
  });
  artifacts.push(kidneyFull.artifact);
  rows.push(kidneyFull.row);

  const kidneyReduced = trainModel({
    key: 'kidney_reduced',
    name: 'kidney-reduced-lr',
    targetId: 'kidney_risk',
    title: 'Kidney-related risk score (no BUN)',
    description: 'Reduced-input logistic regression used when BUN is unavailable (UCI CKD-trained).',
    features: ['age', 'hemoglobin', 'creatinine'],
    X: ckdReduced.X,
    y: ckdReduced.y,
    datasetMeta: DATASETS_META.ckd,
    notes: ckdNotes,
  });
  artifacts.push(kidneyReduced.artifact);
  rows.push(kidneyReduced.row);

  // ---- write artifacts ---------------------------------------------------
  for (const a of artifacts) {
    fs.writeFileSync(path.join(MODELS_DIR, `${a.key}.model.json`), JSON.stringify(a, null, 2));
  }
  fs.writeFileSync(
    path.join(MODELS_DIR, 'manifest.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        note:
          'Metrics are from held-out test splits / CV of the training pipeline — NOT real-world clinical performance. See docs/ML.md.',
        models: artifacts.map((a) => ({
          key: a.key,
          targetId: a.targetId,
          version: a.version,
          trainedAt: a.trainedAt,
          features: a.features,
          metrics: a.metrics,
          cv: a.cv,
        })),
      },
      null,
      2
    )
  );

  console.log('\nWrote artifacts to ' + MODELS_DIR + ':');
  for (const a of artifacts) console.log(`  - ${a.key}.model.json (v${a.version})`);
  console.log('\nHeld-out test metrics (honest reporting — see docs/ML.md):\n');
  console.log(formatMetricsTable(rows));
  console.log('\nReminder: these metrics describe held-out splits of specific research datasets and are not a guarantee of real-world performance.');
}

main();
