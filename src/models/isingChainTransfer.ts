import type { LatticeParameters } from './latticeIsing';
import { validateLatticeParameters } from './latticeIsing';

/** Ordered spin basis (+1,-1). The boundary factors split the field equally
 * between adjacent bonds; open ends recover their missing halves from v. */
export type Matrix2 = readonly [number, number, number, number];
type Scaled = { matrix: Matrix2; logScale: number };
const identity: Matrix2 = [1, 0, 0, 1];
const multiply = (a: Matrix2, b: Matrix2): Matrix2 => [
  a[0] * b[0] + a[1] * b[2],
  a[0] * b[1] + a[1] * b[3],
  a[2] * b[0] + a[3] * b[2],
  a[2] * b[1] + a[3] * b[3],
];
const trace = (a: Matrix2) => a[0] + a[3];
/** S A: insert one measured spin on the left of the next transfer block. */
const leftSpin = (a: Matrix2): Matrix2 => [a[0], a[1], -a[2], -a[3]];
/** S A S: insert one spin at each end of a transfer block. */
const insertion = (a: Matrix2): Matrix2 => [a[0], -a[1], -a[2], a[3]];

/** T_(s,t)=exp(Kst+b(s+t)/2), with K=J/T and b=h/T. */
export function transferMatrix(K: number, b: number): Matrix2 {
  if (!Number.isFinite(K) || !Number.isFinite(b))
    throw new Error('Transfer couplings must be finite.');
  return [Math.exp(K + b), Math.exp(-K), Math.exp(-K), Math.exp(K - b)];
}

function normalizedTransfer(K: number, b: number) {
  const scale = Math.max(K + b, -K, K - b);
  const matrix: Matrix2 = [
    Math.exp(K + b - scale),
    Math.exp(-K - scale),
    Math.exp(-K - scale),
    Math.exp(K - b - scale),
  ];
  return { matrix, scale };
}

/** The determinant formula avoids subtracting nearly equal eigenvalues.
 * Its sign is physical: antiferromagnetic correlations alternate. */
export function transferSpectrum(K: number, b: number) {
  const { matrix: t, scale } = normalizedTransfer(K, b);
  const gap = Math.hypot(t[0] - t[3], 2 * t[1]);
  const leadingScaled = (t[0] + t[3] + gap) / 2;
  const logLeading = scale + Math.log(leadingScaled);
  const theta = Math.atan2(2 * t[1], t[0] - t[3]) / 2;
  const leadingVector = [Math.cos(theta), Math.sin(theta)] as const;
  const otherVector = [-Math.sin(theta), Math.cos(theta)] as const;
  let logRatio = -Infinity;
  let sign = 0;
  if (K !== 0) {
    sign = Math.sign(K);
    const logAbsDet =
      K > 0
        ? 2 * K + Math.log1p(-Math.exp(-4 * K))
        : -2 * K + Math.log1p(-Math.exp(4 * K));
    logRatio = logAbsDet - 2 * logLeading;
    // Rounding in a nearly degenerate spectrum can give +0, not a genuine
    // finite-temperature unit ratio. Mark the length unresolved below.
    logRatio = Math.min(0, logRatio);
  }
  const ratio = sign * Math.exp(logRatio);
  const correlationLength =
    sign === 0 ? 0 : logRatio < -32 * Number.EPSILON ? -1 / logRatio : null;
  return {
    logLeading,
    leading: Math.exp(logLeading),
    subleading: sign * Math.exp(logLeading + logRatio),
    ratio,
    logAbsRatio: logRatio,
    leadingVector,
    otherVector,
    correlationLength,
    quality:
      correlationLength === null
        ? ('unresolved near-degenerate eigenvalues' as const)
        : sign === 0
          ? ('zero subleading mode' as const)
          : ('resolved' as const),
  };
}

/** Keep every T^k as a positive 2×2 matrix of order one. Adding its log
 * scale back only at the final contraction prevents overflow at N=64 and
 * low T; the trace also stays positive on frustrated odd rings. */
function powers(K: number, b: number, n: number): Scaled[] {
  const base = normalizedTransfer(K, b);
  const result: Scaled[] = [{ matrix: identity, logScale: 0 }];
  for (let k = 1; k <= n; k++) {
    const previous = result[k - 1]!;
    const raw = multiply(previous.matrix, base.matrix);
    const magnitude = Math.max(...raw);
    result.push({
      matrix: raw.map((x) => x / magnitude) as unknown as Matrix2,
      logScale: previous.logScale + base.scale + Math.log(magnitude),
    });
  }
  return result;
}

const contract = (a: Matrix2, v: readonly [number, number]) =>
  v[0] * (a[0] * v[0] + a[1] * v[1]) + v[1] * (a[2] * v[0] + a[3] * v[1]);

/** Exact finite-N reference, apart from floating-point evaluation. For an
 * open chain the returned displacement correlation averages its N-r valid
 * origins, matching the worker's axial-product convention. */
export function finiteChainReference(p: LatticeParameters) {
  validateLatticeParameters(p);
  if (p.ly !== 1) throw new Error('Transfer reference requires a chain.');
  const n = p.lx,
    K = p.jx / p.temperature,
    b = p.field / p.temperature;
  const power = powers(K, b, n);
  const spectrum = transferSpectrum(K, b);
  const vScale = Math.abs(b) / 2;
  const v = [Math.exp(b / 2 - vScale), Math.exp(-b / 2 - vScale)] as const;
  const open = !p.periodicX;
  const denominator = open
    ? contract(power[n - 1]!.matrix, v)
    : trace(power[n]!.matrix);
  const denominatorScale = open
    ? power[n - 1]!.logScale + 2 * vScale
    : power[n]!.logScale;
  const logPartition = denominatorScale + Math.log(denominator);

  const spin = (i: number) => {
    if (!open) return trace(leftSpin(power[n]!.matrix)) / denominator;
    const left = power[i]!,
      right = power[n - 1 - i]!;
    const a = multiply(left.matrix, leftSpin(right.matrix));
    return (
      (contract(a, v) *
        Math.exp(left.logScale + right.logScale - power[n - 1]!.logScale)) /
      denominator
    );
  };
  const pair = (i: number, j: number) => {
    if (i === j) return 1;
    const r = j - i;
    if (!open) {
      const a = multiply(insertion(power[r]!.matrix), power[n - r]!.matrix);
      return (
        (trace(a) *
          Math.exp(
            power[r]!.logScale + power[n - r]!.logScale - power[n]!.logScale,
          )) /
        denominator
      );
    }
    const a = multiply(
      power[i]!.matrix,
      multiply(insertion(power[r]!.matrix), power[n - 1 - j]!.matrix),
    );
    return (
      (contract(a, v) *
        Math.exp(
          power[i]!.logScale +
            power[r]!.logScale +
            power[n - 1 - j]!.logScale -
            power[n - 1]!.logScale,
        )) /
      denominator
    );
  };
  const siteMeans = Array.from({ length: n }, (_, i) => spin(i));
  const meanMagnetization = siteMeans.reduce((sum, m) => sum + m, 0) / n;
  const maxR = Math.min(16, open ? n - 1 : Math.floor(n / 2));
  const correlations = Array.from({ length: maxR + 1 }, (_, r) => {
    const origins = open ? n - r : n;
    let raw = 0,
      centered = 0;
    for (let i = 0; i < origins; i++) {
      const j = open ? i + r : (i + r) % n;
      const value = open ? pair(i, j) : pair(0, r);
      raw += value;
      centered += value - siteMeans[i]! * siteMeans[j]!;
    }
    return {
      r,
      pairs: origins,
      raw: raw / origins,
      connected: centered / origins,
    };
  });
  const nearest = correlations[1]!.raw;
  const bonds = open ? n - 1 : n;
  const meanEnergy =
    (-p.jx * bonds * nearest - p.field * n * meanMagnetization) / n;
  // This finite-volume fluctuation is exact, not an independent-sample SE.
  let secondTotalM = n;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) secondTotalM += 2 * pair(i, j);
  const varianceTotalM = Math.max(
    0,
    secondTotalM - (n * meanMagnetization) ** 2,
  );
  return {
    logPartition,
    siteMeans,
    meanMagnetization,
    meanEnergy,
    nearest,
    susceptibility: varianceTotalM / (n * p.temperature),
    correlations,
    spectrum,
    warning:
      spectrum.correlationLength === null
        ? 'Eigenvalues are too nearly degenerate for a reliable bulk length.'
        : spectrum.correlationLength > n
          ? 'The bulk correlation length exceeds this finite chain; asymptotic decay may not be visible.'
          : null,
  };
}
