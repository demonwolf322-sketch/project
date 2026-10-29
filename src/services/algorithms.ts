/**
 * EVDHM, ARIMA, Random Forest, and Pipeline Algorithms
 * Faithfully mirrors Section 2 & 3 of app.py
 */

export interface ModelMetrics {
  MAE: number;
  RMSE: number;
}

export interface PipelineResult {
  trainRaw: number[];
  testRaw: number[];
  denoisedTrain: number[];
  hybridTest: number[];
  pureTest: number[];
  rfTest: number[];
  future: number[];
  splitIdx: number;
  hybridMetrics: ModelMetrics;
  pureMetrics: ModelMetrics;
  rfMetrics: ModelMetrics;
}

/**
 * Computes eigenvalues and eigenvectors of a real symmetric matrix S (size n x n)
 * Using the classic Jacobi eigenvalue method.
 */
function symmetricEigenDecomposition(S: number[][], maxIter = 100, eps = 1e-10): { eigenvalues: number[]; eigenvectors: number[][] } {
  const n = S.length;
  // Deep copy A = S
  const A: number[][] = S.map((row) => [...row]);
  // V = Identity matrix
  const V: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
  );

  for (let iter = 0; iter < maxIter; iter++) {
    // Find maximum off-diagonal element
    let maxOff = 0;
    let p = 0;
    let q = 1;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const absVal = Math.abs(A[i][j]);
        if (absVal > maxOff) {
          maxOff = absVal;
          p = i;
          q = j;
        }
      }
    }

    if (maxOff < eps) break;

    const app = A[p][p];
    const aqq = A[q][q];
    const apq = A[p][q];

    const theta = (aqq - app) / (2 * apq);
    const t = Math.sign(theta) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
    const c = 1 / Math.sqrt(t * t + 1);
    const s = t * c;

    // Rotate matrix A
    A[p][p] = app - t * apq;
    A[q][q] = aqq + t * apq;
    A[p][q] = 0;
    A[q][p] = 0;

    for (let i = 0; i < n; i++) {
      if (i !== p && i !== q) {
        const aip = A[i][p];
        const aiq = A[i][q];
        A[i][p] = c * aip - s * aiq;
        A[p][i] = A[i][p];
        A[i][q] = s * aip + c * aiq;
        A[q][i] = A[i][q];
      }
    }

    // Accumulate eigenvectors in V
    for (let i = 0; i < n; i++) {
      const vip = V[i][p];
      const viq = V[i][q];
      V[i][p] = c * vip - s * viq;
      V[i][q] = s * vip + c * viq;
    }
  }

  const eigenvalues: number[] = [];
  for (let i = 0; i < n; i++) {
    eigenvalues.push(A[i][i]);
  }

  // Normalize and extract eigenvectors as columns
  const eigenvectors: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let col = 0; col < n; col++) {
    let norm = 0;
    for (let row = 0; row < n; row++) {
      norm += V[row][col] * V[row][col];
    }
    norm = Math.sqrt(norm) || 1;
    for (let row = 0; row < n; row++) {
      eigenvectors[row][col] = V[row][col] / norm;
    }
  }

  // Sort descending by eigenvalue
  const indices = eigenvalues.map((_, i) => i);
  indices.sort((a, b) => eigenvalues[b] - eigenvalues[a]);

  const sortedEigVals = indices.map((idx) => eigenvalues[idx]);
  const sortedEigVecs = Array.from({ length: n }, (_, r) =>
    indices.map((idx) => eigenvectors[r][idx])
  );

  return { eigenvalues: sortedEigVals, eigenvectors: sortedEigVecs };
}

/**
 * 2. EVDHM Decomposition
 * Exact port of evdhm_decompose(series, window_length, num_components) from app.py
 */
export function evdhmDecompose(
  series: number[],
  windowLength = 30,
  numComponents = 3
): number[] {
  const N = series.length;
  if (N === 0) return [];
  const L = Math.max(2, Math.min(windowLength, Math.floor(N / 2)));
  const K = N - L + 1;

  if (K <= 0) return [...series];

  // Hankel matrix H of size L x K
  // H[i][j] = series[i + j]
  const H: number[][] = Array.from({ length: L }, (_, i) =>
    Array.from({ length: K }, (_, j) => series[i + j])
  );

  // Covariance matrix S = H @ H.T of size L x L
  const S: number[][] = Array.from({ length: L }, () => new Array(L).fill(0));
  for (let i = 0; i < L; i++) {
    for (let k = i; k < L; k++) {
      let sum = 0;
      for (let j = 0; j < K; j++) {
        sum += H[i][j] * H[k][j];
      }
      S[i][k] = sum;
      S[k][i] = sum;
    }
  }

  // Eigen-decomposition of S
  const { eigenvectors } = symmetricEigenDecomposition(S);

  const compCount = Math.min(numComponents, L);
  const denoisedLength = K;
  const denoised: number[] = new Array(denoisedLength).fill(0);

  for (let c = 0; c < compCount; c++) {
    // ev is column c of eigenvectors: length L
    const ev: number[] = [];
    let evSum = 0;
    for (let r = 0; r < L; r++) {
      const val = eigenvectors[r][c];
      ev.push(val);
      evSum += val;
    }

    // proj = H.T @ ev: length K
    // proj[j] = sum_{r=0}^{L-1} H[r][j] * ev[r]
    // comp.mean(axis=1) in python:
    // np.outer(proj, ev) has shape (K, L), where comp[j][r] = proj[j] * ev[r]
    // comp.mean(axis=1) averages over r, giving proj[j] * (evSum / L)
    const evMean = evSum / L;
    for (let j = 0; j < K; j++) {
      let projJ = 0;
      for (let r = 0; r < L; r++) {
        projJ += H[r][j] * ev[r];
      }
      denoised[j] += projJ * evMean;
    }
  }

  // Pad / trim to match original length N
  if (denoised.length < N) {
    const padVal = denoised[denoised.length - 1];
    while (denoised.length < N) {
      denoised.push(padVal);
    }
  } else if (denoised.length > N) {
    return denoised.slice(0, N);
  }

  return denoised;
}

/**
 * 3. ARIMA(5, 1, 0)
 * Differences series by 1 (I=1), estimates AR(5) coefficients via Ridge OLS,
 * and recursively forecasts testLen steps.
 */
export function runArima(train: number[], testLen: number, p = 5): number[] {
  if (train.length < p + 2) {
    const last = train[train.length - 1] || 0;
    return new Array(testLen).fill(last);
  }

  // First difference: diff[t] = train[t] - train[t-1]
  const diff: number[] = [];
  for (let t = 1; t < train.length; t++) {
    diff.push(train[t] - train[t - 1]);
  }

  // Construct AR(p) regression: diff[t] = c + phi_1*diff[t-1] + ... + phi_p*diff[t-p]
  const M = diff.length - p;
  if (M <= 0) {
    const last = train[train.length - 1] || 0;
    return new Array(testLen).fill(last);
  }

  // Build X (M x (p + 1)) and y (M)
  const X: number[][] = [];
  const y: number[] = [];
  for (let i = p; i < diff.length; i++) {
    const row = [1]; // intercept
    for (let lag = 1; lag <= p; lag++) {
      row.push(diff[i - lag]);
    }
    X.push(row);
    y.push(diff[i]);
  }

  // Solve (X^T * X + lambda * I) * beta = X^T * y using Gaussian elimination with regularization
  const cols = p + 1;
  const XtX: number[][] = Array.from({ length: cols }, () => new Array(cols).fill(0));
  const Xty: number[] = new Array(cols).fill(0);

  for (let r = 0; r < M; r++) {
    const xRow = X[r];
    const yVal = y[r];
    for (let i = 0; i < cols; i++) {
      Xty[i] += xRow[i] * yVal;
      for (let j = 0; j < cols; j++) {
        XtX[i][j] += xRow[i] * xRow[j];
      }
    }
  }

  // Ridge regularization
  const lambda = 1e-4;
  for (let i = 0; i < cols; i++) {
    XtX[i][i] += lambda;
  }

  // Solve linear system
  const beta = solveLinearSystem(XtX, Xty);

  // Forecast future diffs recursively
  const curDiffWindow = diff.slice(-p);
  const forecastDiffs: number[] = [];

  for (let step = 0; step < testLen; step++) {
    let nextDiff = beta[0]; // intercept
    for (let lag = 1; lag <= p; lag++) {
      const idx = curDiffWindow.length - lag;
      nextDiff += beta[lag] * (idx >= 0 ? curDiffWindow[idx] : 0);
    }
    forecastDiffs.push(nextDiff);
    curDiffWindow.push(nextDiff);
  }

  // Cumulative sum from the last observed level
  let currentLevel = train[train.length - 1];
  const forecast: number[] = [];
  for (let i = 0; i < testLen; i++) {
    currentLevel += forecastDiffs[i];
    forecast.push(Math.round(currentLevel * 100) / 100);
  }

  return forecast;
}

/**
 * 4. Random Forest Regressor on 14 lags
 * Fast Random Forest ensemble (bagging with randomized split evaluation)
 * Port of run_rf(train, test_len, lags=14)
 */
interface DecisionTreeNode {
  featureIdx?: number;
  splitVal?: number;
  left?: DecisionTreeNode;
  right?: DecisionTreeNode;
  leafValue?: number;
}

function buildRegressionTree(
  X: number[][],
  y: number[],
  depth = 0,
  maxDepth = 6,
  minSamples = 4
): DecisionTreeNode {
  if (depth >= maxDepth || y.length <= minSamples) {
    const mean = y.reduce((a, b) => a + b, 0) / (y.length || 1);
    return { leafValue: mean };
  }

  const numFeatures = X[0]?.length || 0;
  if (numFeatures === 0) {
    return { leafValue: y[0] || 0 };
  }

  // Select sqrt(features) random candidates
  const candidateCount = Math.max(2, Math.floor(Math.sqrt(numFeatures)));
  const candidates: number[] = [];
  while (candidates.length < candidateCount) {
    const f = Math.floor(Math.random() * numFeatures);
    if (!candidates.includes(f)) candidates.push(f);
  }

  let bestFeature = -1;
  let bestSplit = 0;
  let bestVarianceReduction = -1;
  const currentVariance = getVariance(y);

  for (const f of candidates) {
    const vals = X.map((row) => row[f]);
    // Try quantiles or a few random splits
    for (let s = 1; s <= 3; s++) {
      const splitVal = vals[Math.floor((s * vals.length) / 4)];
      const leftY: number[] = [];
      const rightY: number[] = [];
      for (let i = 0; i < X.length; i++) {
        if (X[i][f] <= splitVal) leftY.push(y[i]);
        else rightY.push(y[i]);
      }
      if (leftY.length === 0 || rightY.length === 0) continue;
      const reduction =
        currentVariance -
        (leftY.length / y.length) * getVariance(leftY) -
        (rightY.length / y.length) * getVariance(rightY);
      if (reduction > bestVarianceReduction) {
        bestVarianceReduction = reduction;
        bestFeature = f;
        bestSplit = splitVal;
      }
    }
  }

  if (bestFeature === -1 || bestVarianceReduction <= 0) {
    return { leafValue: y.reduce((a, b) => a + b, 0) / (y.length || 1) };
  }

  const leftX: number[][] = [];
  const leftY: number[] = [];
  const rightX: number[][] = [];
  const rightY: number[] = [];

  for (let i = 0; i < X.length; i++) {
    if (X[i][bestFeature] <= bestSplit) {
      leftX.push(X[i]);
      leftY.push(y[i]);
    } else {
      rightX.push(X[i]);
      rightY.push(y[i]);
    }
  }

  return {
    featureIdx: bestFeature,
    splitVal: bestSplit,
    left: buildRegressionTree(leftX, leftY, depth + 1, maxDepth, minSamples),
    right: buildRegressionTree(rightX, rightY, depth + 1, maxDepth, minSamples),
  };
}

function getVariance(arr: number[]): number {
  if (arr.length <= 1) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  let sumSq = 0;
  for (const v of arr) sumSq += (v - mean) * (v - mean);
  return sumSq / arr.length;
}

function predictTree(node: DecisionTreeNode, x: number[]): number {
  if (node.leafValue !== undefined) return node.leafValue;
  if (node.featureIdx !== undefined && node.splitVal !== undefined) {
    if (x[node.featureIdx] <= node.splitVal) {
      return predictTree(node.left!, x);
    } else {
      return predictTree(node.right!, x);
    }
  }
  return 0;
}

export function runRf(train: number[], testLen: number, lags = 14, nEstimators = 25): number[] {
  if (train.length <= lags + 2) {
    const last = train[train.length - 1] || 0;
    return new Array(testLen).fill(last);
  }

  const X: number[][] = [];
  const y: number[] = [];
  for (let i = lags; i < train.length; i++) {
    X.push(train.slice(i - lags, i));
    y.push(train[i]);
  }

  // Train ensemble
  const trees: DecisionTreeNode[] = [];
  const nSamples = X.length;

  for (let e = 0; e < nEstimators; e++) {
    // Bootstrap sample
    const bootX: number[][] = [];
    const bootY: number[] = [];
    for (let s = 0; s < nSamples; s++) {
      const idx = Math.floor(Math.random() * nSamples);
      bootX.push(X[idx]);
      bootY.push(y[idx]);
    }
    trees.push(buildRegressionTree(bootX, bootY, 0, 7, 5));
  }

  // Autoregressive multi-step recursive forecasting
  const preds: number[] = [];
  const window = [...train.slice(-lags)];

  for (let step = 0; step < testLen; step++) {
    const curX = window.slice(-lags);
    let sum = 0;
    for (const tree of trees) {
      sum += predictTree(tree, curX);
    }
    const pVal = Math.round((sum / trees.length) * 100) / 100;
    preds.push(pVal);
    window.push(pVal);
  }

  return preds;
}

/**
 * Metrics: MAE and RMSE
 */
export function computeMetrics(actual: number[], predicted: number[]): ModelMetrics {
  const len = Math.min(actual.length, predicted.length);
  if (len === 0) return { MAE: 0, RMSE: 0 };

  let sumAbs = 0;
  let sumSq = 0;
  for (let i = 0; i < len; i++) {
    const err = actual[i] - predicted[i];
    sumAbs += Math.abs(err);
    sumSq += err * err;
  }

  return {
    MAE: Math.round((sumAbs / len) * 10000) / 10000,
    RMSE: Math.round(Math.sqrt(sumSq / len) * 10000) / 10000,
  };
}

/**
 * 5. Full Pipeline
 * Port of full_pipeline(series, forecast_days) from app.py
 */
export function fullPipeline(series: number[], forecastDays = 14): PipelineResult {
  const split = Math.floor(series.length * 0.8);
  const trainRaw = series.slice(0, split);
  const testRaw = series.slice(split);

  // EVDHM denoising on train
  const wl = Math.min(30, Math.floor(trainRaw.length / 3));
  const denoisedTrain = evdhmDecompose(trainRaw, wl, 3);

  // Hybrid: ARIMA on denoised
  const hybridTest = runArima(denoisedTrain, testRaw.length);

  // Pure ARIMA
  const pureTest = runArima(trainRaw, testRaw.length);

  // Random Forest
  const rfTest = runRf(trainRaw, testRaw.length);

  // Forecast beyond data using EVDHM on full series + ARIMA
  const denoisedFull = evdhmDecompose(series, wl, 3);
  const future = runArima(denoisedFull, forecastDays);

  return {
    trainRaw,
    testRaw,
    denoisedTrain,
    hybridTest,
    pureTest,
    rfTest,
    future,
    splitIdx: split,
    hybridMetrics: computeMetrics(testRaw, hybridTest),
    pureMetrics: computeMetrics(testRaw, pureTest),
    rfMetrics: computeMetrics(testRaw, rfTest),
  };
}

/**
 * Gaussian elimination with partial pivoting for linear equations A * x = b
 */
function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M: number[][] = A.map((row, i) => [...row, b[i]]);

  for (let i = 0; i < n; i++) {
    // Find pivot
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) {
        maxRow = k;
      }
    }

    // Swap rows
    const temp = M[i];
    M[i] = M[maxRow];
    M[maxRow] = temp;

    if (Math.abs(M[i][i]) < 1e-12) continue;

    // Eliminate
    for (let k = i + 1; k < n; k++) {
      const factor = M[k][i] / M[i][i];
      for (let j = i; j <= n; j++) {
        M[k][j] -= factor * M[i][j];
      }
    }
  }

  // Back substitution
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = M[i][n];
    for (let j = i + 1; j < n; j++) {
      sum -= M[i][j] * x[j];
    }
    x[i] = Math.abs(M[i][i]) > 1e-12 ? sum / M[i][i] : 0;
  }

  return x;
}
