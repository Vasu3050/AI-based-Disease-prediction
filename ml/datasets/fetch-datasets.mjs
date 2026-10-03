#!/usr/bin/env node
/**
 * Dataset fetch pipeline for MediPredict AI.
 *
 * Downloads the public datasets used to train the ML models into
 * `ml/datasets/raw/` and validates their shape. Raw data is NOT committed to
 * git (see .gitignore) — rerun this script whenever you need it.
 *
 * Usage:
 *   npm run dataset:fetch
 *
 * Sources & licenses: see ml/datasets/dataset-meta.mjs and docs/DATASETS.md.
 * The script tries multiple mirrors per dataset and fails with clear manual
 * instructions when automatic fetching is not possible.
 */
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { DATASETS_META } from './dataset-meta.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RAW_DIR = path.join(HERE, 'raw');
fs.mkdirSync(RAW_DIR, { recursive: true });

const USER_AGENT = 'medipredict-ai-dataset-fetcher/1.0 (+educational project)';

// ------------------------------------------------------------------ helpers

async function fetchBuffer(url, timeoutMs = 120000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return Buffer.from(await res.arrayBuffer());
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Minimal ZIP reader supporting the two compression methods used by the
 * relevant public archives (stored + deflate). Scans local file headers.
 */
function extractZipEntry(buf, matcher) {
  let i = 0;
  while (i <= buf.length - 30) {
    const sig = buf.readUInt32LE(i);
    if (sig !== 0x04034b50) {
      i += 1;
      continue;
    }
    const method = buf.readUInt16LE(i + 8);
    const compSize = buf.readUInt32LE(i + 18);
    const nameLen = buf.readUInt16LE(i + 26);
    const extraLen = buf.readUInt16LE(i + 28);
    const name = buf.slice(i + 30, i + 30 + nameLen).toString('utf8');
    const dataStart = i + 30 + nameLen + extraLen;
    if (compSize > 0 && matcher(name)) {
      const data = buf.slice(dataStart, dataStart + compSize);
      if (method === 0) return { name, data };
      if (method === 8) return { name, data: zlib.inflateRawSync(data) };
      throw new Error(`Unsupported ZIP compression method ${method} for ${name}`);
    }
    if (compSize > 0) i = dataStart + compSize;
    else i += 30; // streamed entry (rare here) — skip forward
  }
  throw new Error('Requested file not found inside ZIP archive');
}

/** Extract a .rar using the system `tar` (bsdtar/libarchive reads RAR4). */
function extractRar(rarPath, outDir) {
  try {
    execFileSync('tar', ['-xf', rarPath, '-C', outDir], { stdio: 'pipe' });
  } catch (err) {
    throw new Error(
      `Could not extract RAR archive with system tar (${err.message}). ` +
        `Manually extract 'chronic_kidney_disease_full.arff' into ${RAW_DIR} and re-run.`
    );
  }
}

/** Parse an ARFF file: returns { attributes, rows } (rows = string arrays). */
function parseArff(text) {
  const lines = text.split(/\r?\n/);
  const attributes = [];
  const rows = [];
  let inData = false;
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('%')) continue;
    const lower = t.toLowerCase();
    if (lower.startsWith('@attribute')) {
      const m = /^@attribute\s+'?([^'\s]+)'?/i.exec(t);
      if (m) attributes.push(m[1]);
      continue;
    }
    if (lower.startsWith('@data')) {
      inData = true;
      continue;
    }
    if (lower.startsWith('@')) continue;
    if (inData) {
      rows.push(t.split(',').map((v) => v.trim()));
    }
  }
  return { attributes, rows };
}

function assertShape(text, { minRows, minCols, label }) {
  const rows = text
    .trim()
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '');
  const cols = rows[0]?.split(',').length ?? 0;
  if (rows.length < minRows) throw new Error(`${label}: expected ≥${minRows} rows, got ${rows.length}`);
  if (cols < minCols) throw new Error(`${label}: expected ≥${minCols} columns, got ${cols}`);
  return { rows: rows.length, cols };
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

// ------------------------------------------------------------------ dataset specs

const PIMA_URLS = [
  'https://raw.githubusercontent.com/jbrownlee/Datasets/master/pima-indians-diabetes.data.csv',
  'https://raw.githubusercontent.com/plotly/datasets/master/diabetes.csv',
];

const ILPD_URLS = [
  {
    url: 'https://archive.ics.uci.edu/ml/machine-learning-databases/00225/Indian%20Liver%20Patient%20Dataset%20(ILPD).csv',
    kind: 'csv',
  },
  {
    url: 'https://archive.ics.uci.edu/static/public/225/ilpd+indian+liver+patient+dataset.zip',
    kind: 'zip',
    entryPattern: /ILPD.*\.csv$/i,
  },
];

const CKD_ZIP_URL = 'https://archive.ics.uci.edu/static/public/336/chronic+kidney+disease.zip';

async function fetchPima() {
  const errors = [];
  for (const url of PIMA_URLS) {
    try {
      const buf = await fetchBuffer(url);
      const text = buf.toString('utf8');
      const shape = assertShape(text, { minRows: 760, minCols: 9, label: 'PIMA' });
      return { text, sourceUrl: url, bufHash: sha256(buf), shape };
    } catch (err) {
      errors.push(`${url} → ${err.message}`);
    }
  }
  throw new Error(`All PIMA mirrors failed:\n  ${errors.join('\n  ')}`);
}

async function fetchIlpd() {
  const errors = [];
  for (const candidate of ILPD_URLS) {
    try {
      const buf = await fetchBuffer(candidate.url);
      let text;
      if (candidate.kind === 'csv') {
        text = buf.toString('utf8');
      } else {
        const entry = extractZipEntry(buf, (name) => candidate.entryPattern.test(name));
        text = entry.data.toString('utf8');
      }
      const shape = assertShape(text, { minRows: 570, minCols: 10, label: 'ILPD' });
      return { text, sourceUrl: candidate.url, bufHash: sha256(buf), shape };
    } catch (err) {
      errors.push(`${candidate.url} → ${err.message}`);
    }
  }
  throw new Error(`All ILPD sources failed:\n  ${errors.join('\n  ')}`);
}

async function fetchCkd() {
  const errors = [];
  try {
    const buf = await fetchBuffer(CKD_ZIP_URL);
    const rarEntry = extractZipEntry(buf, (name) => /\.rar$/i.test(name));
    const rarPath = path.join(RAW_DIR, '.tmp_ckd.rar');
    fs.writeFileSync(rarPath, rarEntry.data);
    const extractDir = path.join(RAW_DIR, '.tmp_ckd');
    fs.rmSync(extractDir, { recursive: true, force: true });
    fs.mkdirSync(extractDir, { recursive: true });
    try {
      extractRar(rarPath, extractDir);
    } finally {
      fs.rmSync(rarPath, { force: true });
    }
    // Prefer the "full" ARFF (includes all rows with missing values marked '?').
    const files = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (/\.arff$/i.test(entry.name)) files.push(p);
      }
    };
    walk(extractDir);
    const arffPath = files.find((f) => /full/i.test(f)) ?? files[0];
    if (!arffPath) throw new Error('No .arff file found inside RAR archive');
    const arffText = fs.readFileSync(arffPath, 'utf8');
    const { attributes, rows } = parseArff(arffText);
    if (rows.length < 300 || attributes.length < 20) {
      throw new Error(`CKD ARFF shape unexpected: ${rows.length} rows, ${attributes.length} attributes`);
    }
    // Convert to CSV (header + rows), keeping raw values (including '?').
    const csvText = [attributes.join(','), ...rows.map((r) => r.join(','))].join('\n');
    fs.rmSync(extractDir, { recursive: true, force: true });
    return {
      text: csvText,
      sourceUrl: CKD_ZIP_URL,
      bufHash: sha256(buf),
      shape: { rows: rows.length, cols: attributes.length },
    };
  } catch (err) {
    errors.push(`${CKD_ZIP_URL} → ${err.message}`);
  }
  throw new Error(
    `CKD fetch failed:\n  ${errors.join('\n  ')}\n` +
      `Manual fallback: extract 'chronic_kidney_disease_full.arff' from https://archive.ics.uci.edu/dataset/336/chronic+kidney+disease into ${RAW_DIR} and re-run (the script will convert it).`
  );
}

// ------------------------------------------------------------------ main

const OUTPUTS = [
  { id: 'pima', file: 'pima.csv', fetch: fetchPima, meta: DATASETS_META.pima },
  { id: 'ilpd', file: 'ilpd.csv', fetch: fetchIlpd, meta: DATASETS_META.ilpd },
  { id: 'ckd', file: 'ckd.csv', fetch: fetchCkd, meta: DATASETS_META.ckd },
];

async function main() {
  console.log('MediPredict AI — dataset fetch pipeline');
  console.log(`Target directory: ${RAW_DIR}\n`);

  const sources = [];
  const failures = [];

  for (const ds of OUTPUTS) {
    process.stdout.write(`• ${ds.id}: fetching… `);
    try {
      const result = await ds.fetch();
      fs.writeFileSync(path.join(RAW_DIR, ds.file), result.text, 'utf8');
      sources.push({
        id: ds.id,
        file: ds.file,
        sourceUrl: result.sourceUrl,
        sha256: result.bufHash,
        rows: result.shape.rows,
        cols: result.shape.cols,
        name: ds.meta.name,
        license: ds.meta.license,
        fetchedAt: new Date().toISOString(),
      });
      console.log(`OK (${result.shape.rows} rows, ${result.shape.cols} cols)`);
    } catch (err) {
      failures.push({ id: ds.id, error: err.message });
      console.log('FAILED');
      console.error(`  ${String(err.message).split('\n').join('\n  ')}`);
    }
  }

  if (sources.length > 0) {
    fs.writeFileSync(
      path.join(RAW_DIR, 'sources.json'),
      JSON.stringify({ generatedAt: new Date().toISOString(), datasets: sources }, null, 2)
    );
    console.log(`\nWrote ${sources.length} dataset(s) + sources.json`);
  }
  if (failures.length > 0) {
    console.error(`\n${failures.length} dataset(s) failed. See messages above.`);
    process.exitCode = 1;
  } else {
    console.log('\nAll datasets ready. Next: npm run train:models');
  }
}

main().catch((err) => {
  console.error('Fatal fetch error:', err);
  process.exit(1);
});
