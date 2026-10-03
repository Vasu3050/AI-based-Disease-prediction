/**
 * Training library for MediPredict AI.
 * Pure Node.js (no external dependencies) — intentionally simple,
 * interpretable logistic regression with L2 regularization (IRLS/Newton),
 * plus honest evaluation utilities.
 */

// ------------------------------------------------------------------ RNG & splitting

/** Deterministic PRNG (mulberry32) so training runs are reproducible. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleInPlace(arr, rng) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/** Stratified split of indices by binary label. */
export function stratifiedSplit(labels, testFraction, seed) {
  const rng = mulberry32(seed);
  const pos = [];
  const neg = [];
  labels.forEach((y, i) => (y === 1 ? pos : neg).push(i));
  shuffleInPlace(pos, rng);
  shuffleInPlace(neg, rng);
  const nTestPos = Math.max(1, Math.round(pos.length * testFraction));
  const nTestNeg = Math.max(1, Math.round(neg.length * testFraction));
  const test = [...pos.slice(0, nTestPos), ...neg.slice(0, nTestNeg)];
  const train = [...pos.slice(nTestPos), ...neg.slice(nTestNeg)];
  shuffleInPlace(train, rng);
  shuffleInPlace(test, rng);
  return { train, test };
}

export function stratifiedKFolds(labels, k, seed) {
  const rng = mulberry32(seed);
  const pos = [];
  const neg = [];
  labels.forEach((y, i) => (y === 1 ? pos : neg).push(i));
  shuffleInPlace(pos, rng);
  shuffleInPlace(neg, rng);
  const folds = Array.from({ length: k }, () => []);
  pos.forEach((idx, i) => folds[i % k].push(idx));
  neg.forEach((idx, i) => folds[i % k].push(idx));
  return folds;
}

// ------------------------------------------------------------------ stats

export function computeMeanStd(matrix) {
  const n = matrix.length;
  const k = matrix[0].length;
  const mean = new Array(k).fill(0);
  const std = new Array(k).fill(0);
  for (const row of matrix) for (let j = 0; j < k; j += 1) mean[j] += row[j];
  for (let j = 0; j < k; j += 1) mean[j] /= n;
  for (const row of matrix) for (let j = 0; j < k; j += 1) std[j] += (row[j] - mean[j]) ** 2;
  for (let j = 0; j < k; j += 1) {
    std[j] = Math.sqrt(std[j] / Math.max(1, n - 1));
    if (!Number.isFinite(std[j]) || std[j] === 0) std[j] = 1; // guard constant features
  }
  return { mean, std };
}

export function standardizeRow(row, mean, std) {
  return row.map((v, j) => (v - mean[j]) / std[j]);
}

// ------------------------------------------------------------------ logistic regression (IRLS)

function sigmoid(x) {
  if (x >= 0) {
    const e = Math.exp(-x);
    return 1 / (1 + e);
  }
  const e = Math.exp(x);
  return e / (1 + e);
}

/** Solve A·x = b via Gauss-Jordan elimination (small matrices only). */
function solveLinearSystem(A, b) {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col += 1) {
    // pivot
    let pivot = col;
    for (let r = col + 1; r < n; r += 1) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    if (Math.abs(M[pivot][col]) < 1e-12) M[col][col] += 1e-8; // tiny ridge safeguard
    [M[col], M[pivot]] = [M[pivot], M[col]];
    const div = M[col][col];
    for (let c = col; c <= n; c += 1) M[col][c] /= div;
    for (let r = 0; r < n; r += 1) {
      if (r === col) continue;
      const factor = M[r][col];
      if (factor === 0) continue;
      for (let c = col; c <= n; c += 1) M[r][c] -= factor * M[col][c];
    }
  }
  return M.map((row) => row[n]);
}

/**
 * Fit logistic regression via iteratively reweighted least squares.
 * X: standardized feature matrix (no intercept column), y: 0/1 labels.
 * Returns { intercept, coefficients }.
 */
export function fitLogisticIRLS(X, y, { l2 = 0.01, maxIter = 100, tol = 1e-8 } = {}) {
  const n = X.length;
  const k = X[0].length;
  let beta = new Array(k + 1).fill(0); // [intercept, coef...]

  for (let iter = 0; iter < maxIter; iter += 1) {
    // Working quantities
    const p = new Array(n);
    const w = new Array(n);
    const z = new Array(n);
    for (let i = 0; i < n; i += 1) {
      const eta = beta[0] + X[i].reduce((s, xj, j) => s + xj * beta[j + 1], 0);
      const pi = sigmoid(eta);
      p[i] = pi;
      w[i] = Math.max(pi * (1 - pi), 1e-9);
      z[i] = eta + (y[i] - pi) / w[i];
    }

    // Build (X'WX + λI) and X'Wz  (with intercept column handled explicitly)
    const dim = k + 1;
    const XtWX = Array.from({ length: dim }, () => new Array(dim).fill(0));
    const XtWz = new Array(dim).fill(0);
    for (let i = 0; i < n; i += 1) {
      const xi = [1, ...X[i]];
      for (let a = 0; a < dim; a += 1) {
        XtWz[a] += xi[a] * w[i] * z[i];
        for (let b = 0; b < dim; b += 1) {
          XtWX[a][b] += xi[a] * w[i] * xi[b];
        }
      }
    }
    for (let a = 1; a < dim; a += 1) XtWX[a][a] += l2; // don't regularize intercept

    const next = solveLinearSystem(XtWX, XtWz);
    let maxDiff = 0;
    for (let a = 0; a < dim; a += 1) maxDiff = Math.max(maxDiff, Math.abs(next[a] - beta[a]));
    beta = next;
    if (maxDiff < tol) break;
  }

  return { intercept: beta[0], coefficients: beta.slice(1) };
}

export function predictProba(X, model) {
  return X.map((row) => {
    const eta = model.intercept + row.reduce((s, xj, j) => s + xj * model.coefficients[j], 0);
    return sigmoid(eta);
  });
}

// ------------------------------------------------------------------ metrics

/** ROC-AUC via the rank (Mann–Whitney) formula with tie-aware average ranks. */
export function rocAuc(scores, labels) {
  const pairs = scores.map((s, i) => [s, labels[i]]);
  pairs.sort((a, b) => a[0] - b[0]);
  // average ranks for ties
  const ranks = new Array(pairs.length);
  let i = 0;
  while (i < pairs.length) {
    let j = i;
    while (j + 1 < pairs.length && pairs[j + 1][0] === pairs[i][0]) j += 1;
    const avgRank = (i + 1 + j + 1) / 2;
    for (let t = i; t <= j; t += 1) ranks[t] = avgRank;
    i = j + 1;
  }
  let posCount = 0;
  let negCount = 0;
  let rankSumPos = 0;
  for (let idx = 0; idx < pairs.length; idx += 1) {
    if (pairs[idx][1] === 1) {
      posCount += 1;
      rankSumPos += ranks[idx];
    } else {
      negCount += 1;
    }
  }
  if (posCount === 0 || negCount === 0) return 0.5;
  return (rankSumPos - (posCount * (posCount + 1)) / 2) / (posCount * negCount);
}

/** Average precision (PR-AUC, step interpolation — standard AP). */
export function averagePrecision(scores, labels) {
  const pairs = scores.map((s, i) => [s, labels[i]]);
  pairs.sort((a, b) => b[0] - a[0]);
  let tp = 0;
  let fp = 0;
  let ap = 0;
  let positives = labels.reduce((s, y) => s + y, 0);
  if (positives === 0) return 0;
  for (const [, label] of pairs) {
    if (label === 1) {
      tp += 1;
      ap += tp / (tp + fp);
    } else {
      fp += 1;
    }
  }
  return ap / positives;
}

export function confusionAt(scores, labels, threshold = 0.5) {
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;
  for (let i = 0; i < scores.length; i += 1) {
    const pred = scores[i] >= threshold ? 1 : 0;
    if (pred === 1 && labels[i] === 1) tp += 1;
    else if (pred === 1 && labels[i] === 0) fp += 1;
    else if (pred === 0 && labels[i] === 0) tn += 1;
    else fn += 1;
  }
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const accuracy = (tp + tn) / Math.max(1, scores.length);
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  return { tp, fp, tn, fn, precision, recall, accuracy, f1 };
}

export function brierScore(scores, labels) {
  let s = 0;
  for (let i = 0; i < scores.length; i += 1) s += (scores[i] - labels[i]) ** 2;
  return s / Math.max(1, scores.length);
}

export function mean(arr) {
  return arr.reduce((s, x) => s + x, 0) / Math.max(1, arr.length);
}

export function stdev(arr) {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, arr.length - 1));
}

// ------------------------------------------------------------------ report formatting

export function formatMetricsTable(rows) {
  const header = ['model', 'n(train/test)', 'prev', 'ROC-AUC', 'PR-AUC', 'Acc', 'Prec', 'Rec', 'F1', 'Brier', 'CV AUC'];
  const lines = [header.join('\t')];
  for (const r of rows) {
    lines.push(
      [
        r.name,
        `${r.nTrain}/${r.nTest}`,
        r.prevalence.toFixed(3),
        r.rocAuc.toFixed(3),
        r.prAuc.toFixed(3),
        r.accuracy.toFixed(3),
        r.precision.toFixed(3),
        r.recall.toFixed(3),
        r.f1.toFixed(3),
        r.brier.toFixed(3),
        `${r.cvAucMean.toFixed(3)}±${r.cvAucStd.toFixed(3)}`,
      ].join('\t')
    );
  }
  return lines.join('\n');
}
