export const DIAGNOSTIC_CAPACITY = 8192;
export const MAX_ACF_LAG = 128;
export type DiagnosticTarget = 'm' | 'absM' | 'e';
export type DiagnosticStatus =
  | 'insufficient'
  | 'constant'
  | 'unresolved'
  | 'drift'
  | 'window-sensitive'
  | 'ok';
export type DiagnosticSummary = {
  status: DiagnosticStatus;
  message: string;
  warnings: string[];
  target: DiagnosticTarget;
  used: number;
  total: number;
  evicted: number;
  firstMeasurement: number;
  lastMeasurement: number;
  strideSweeps: number;
  mean: number | null;
  variance: number | null;
  tauMeasurements: number | null;
  tauSweeps: number | null;
  ess: number | null;
  standardError: number | null;
  window: number;
  maximumLag: number;
  acf: { lag: number; rho: number }[];
  blocking: { blockSize: number; blocks: number; standardError: number }[];
  cappedEss: boolean;
};

/** γ(k) uses the full-window mean and denominator n−k; γ(0) uses n. */
export function analyzeSeries(
  values: readonly number[],
  target: DiagnosticTarget,
  strideSweeps: number,
  total = values.length,
): DiagnosticSummary {
  const n = values.length;
  const base = {
    target,
    used: n,
    total,
    evicted: Math.max(0, total - n),
    firstMeasurement: n ? total - n + 1 : 0,
    lastMeasurement: total,
    strideSweeps,
    tauMeasurements: null,
    tauSweeps: null,
    ess: null,
    standardError: null,
    window: 0,
    maximumLag: 0,
    acf: [] as { lag: number; rho: number }[],
    blocking: [] as {
      blockSize: number;
      blocks: number;
      standardError: number;
    }[],
    cappedEss: false,
    warnings: [] as string[],
  };
  if (n < 64)
    return {
      ...base,
      status: 'insufficient',
      message: 'At least 64 consecutive retained measurements are needed.',
      mean: n ? values.reduce((a, b) => a + b, 0) / n : null,
      variance: null,
    };
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const centered = values.map((v) => v - mean);
  const gamma0 = centered.reduce((sum, v) => sum + v * v, 0) / n;
  let scale = 1;
  for (const value of values) scale = Math.max(scale, Math.abs(value));
  if (gamma0 <= (32 * Number.EPSILON * scale) ** 2)
    return {
      ...base,
      status: 'constant',
      message:
        'The recent observable is constant or numerically indistinguishable from constant.',
      mean,
      variance: gamma0,
    };

  const maximumLag = Math.min(MAX_ACF_LAG, Math.floor(n / 10));
  const rho = [1];
  for (let lag = 1; lag <= maximumLag; lag++) {
    let sum = 0;
    for (let i = 0; i < n - lag; i++) sum += centered[i]! * centered[i + lag]!;
    rho.push(sum / ((n - lag) * gamma0));
  }

  // Geyer's initial-positive pair cutoff, then the first self-consistent
  // window W >= 5 τ(W). A still-positive tail at the hard lag limit is unresolved.
  let positiveLimit = maximumLag;
  let stoppedByNegativePair = false;
  for (let k = 1; k + 1 <= maximumLag; k += 2)
    if (rho[k]! + rho[k + 1]! <= 0) {
      positiveLimit = k - 1;
      stoppedByNegativePair = true;
      break;
    }
  let tau = 0.5;
  let window = 0;
  let selfConsistent = false;
  for (let k = 1; k <= positiveLimit; k++) {
    tau += rho[k]!;
    window = k;
    if (k >= 5 * Math.max(0.5, tau)) {
      selfConsistent = true;
      break;
    }
  }
  const unresolved = !selfConsistent && !stoppedByNegativePair;
  const cappedEss = tau < 0.5;
  const effectiveTau = Math.max(0.5, tau);
  const ess = Math.min(n, n / (2 * effectiveTau));
  const sampleVariance = (gamma0 * n) / (n - 1);
  const standardError = Math.sqrt((2 * effectiveTau * sampleVariance) / n);
  const half =
    0.5 +
    rho
      .slice(1, Math.max(1, Math.floor(window / 2) + 1))
      .reduce((a, b) => a + b, 0);
  const sensitive = window >= 8 && Math.abs(tau - half) > 0.3 * effectiveTau;
  const firstMean =
    values.slice(0, n / 2).reduce((a, b) => a + b, 0) / Math.floor(n / 2);
  const secondMean =
    values.slice(Math.floor(n / 2)).reduce((a, b) => a + b, 0) /
    Math.ceil(n / 2);
  const drift =
    Math.abs(firstMean - secondMean) >
    4 * Math.sqrt((4 * effectiveTau * gamma0) / n);
  const blocking: DiagnosticSummary['blocking'] = [];
  for (let blockSize = 1; Math.floor(n / blockSize) >= 16; blockSize *= 2) {
    const blocks = Math.floor(n / blockSize);
    let blockMean = 0;
    let blockM2 = 0;
    for (let b = 0; b < blocks; b++) {
      let sum = 0;
      for (let j = 0; j < blockSize; j++) sum += values[b * blockSize + j]!;
      const v = sum / blockSize;
      const delta = v - blockMean;
      blockMean += delta / (b + 1);
      blockM2 += delta * (v - blockMean);
    }
    blocking.push({
      blockSize,
      blocks,
      standardError: Math.sqrt(blockM2 / ((blocks - 1) * blocks)),
    });
  }
  const status: DiagnosticStatus = drift
    ? 'drift'
    : unresolved
      ? 'unresolved'
      : sensitive
        ? 'window-sensitive'
        : 'ok';
  const messages: Record<DiagnosticStatus, string> = {
    insufficient: '',
    constant: '',
    unresolved:
      'Correlation remains unresolved at the available lag/window; τ, ESS and SE are not quoted.',
    drift:
      'Recent halves have substantially different means; stationary uncertainty is not quoted.',
    'window-sensitive':
      'τ changes substantially with the summation window; treat it as provisional.',
    ok: cappedEss
      ? 'Negative empirical correlation would imply ESS above n; ESS is capped at n.'
      : 'Recent-window estimate; fixed warm-up does not establish equilibrium.',
  };
  const warnings = [
    ...(unresolved
      ? ['Lag limit reached before a stable autocorrelation window.']
      : []),
    ...(drift ? ['First- and second-half means differ substantially.'] : []),
    ...(sensitive
      ? ['The estimate changes substantially when W is halved.']
      : []),
    ...(cappedEss ? ['Noisy negative correlation was capped at ESS=n.'] : []),
  ];
  return {
    ...base,
    status,
    message: messages[status],
    warnings,
    mean,
    variance: gamma0,
    tauMeasurements:
      status === 'unresolved' || status === 'drift' ? null : effectiveTau,
    tauSweeps:
      status === 'unresolved' || status === 'drift'
        ? null
        : effectiveTau * strideSweeps,
    ess: status === 'unresolved' || status === 'drift' ? null : ess,
    standardError:
      status === 'unresolved' || status === 'drift' ? null : standardError,
    window,
    maximumLag,
    acf: rho.map((value, lag) => ({ lag, rho: value })),
    blocking,
    cappedEss,
  };
}

/** Three aligned 8192-observation rings; only compact analyses leave the worker. */
export class DiagnosticHistory {
  private readonly records = {
    m: new Float64Array(DIAGNOSTIC_CAPACITY),
    absM: new Float64Array(DIAGNOSTIC_CAPACITY),
    e: new Float64Array(DIAGNOSTIC_CAPACITY),
  };
  private count = 0;
  private summaries: Record<DiagnosticTarget, DiagnosticSummary>;
  constructor(private readonly strideSweeps: number) {
    this.summaries = {
      m: analyzeSeries([], 'm', strideSweeps),
      absM: analyzeSeries([], 'absM', strideSweeps),
      e: analyzeSeries([], 'e', strideSweeps),
    };
  }
  record(m: number, absM: number, e: number) {
    const index = this.count % DIAGNOSTIC_CAPACITY;
    this.records.m[index] = m;
    this.records.absM[index] = absM;
    this.records.e[index] = e;
    this.count++;
    if (
      this.count === 1 ||
      (this.count <= 256 ? this.count % 16 === 0 : this.count % 256 === 0)
    )
      this.refresh();
  }
  private ordered(target: DiagnosticTarget) {
    const n = Math.min(this.count, DIAGNOSTIC_CAPACITY);
    return Array.from(
      { length: n },
      (_, i) =>
        this.records[target][(this.count - n + i) % DIAGNOSTIC_CAPACITY]!,
    );
  }
  private refresh() {
    for (const target of ['m', 'absM', 'e'] as const)
      this.summaries[target] = analyzeSeries(
        this.ordered(target),
        target,
        this.strideSweeps,
        this.count,
      );
  }
  snapshot() {
    return structuredClone(this.summaries);
  }
}
