import type { GaugeGeometry } from '../domain/gaugeGeometry';

export type BesselResult = {
  value: number;
  error: number;
  terms: number;
  resolved: boolean;
};
/** Positive power series for |K|≤4. Success includes a geometric remainder and
 * a conservative floating-point allowance, not just a small last term. */
export function besselI(
  order: number,
  x: number,
  maxTerms = 128,
): BesselResult {
  if (
    !Number.isInteger(order) ||
    Math.abs(order) > 128 ||
    !Number.isFinite(x) ||
    Math.abs(x) > 4 ||
    !Number.isInteger(maxTerms) ||
    maxTerms < 1 ||
    maxTerms > 1024
  )
    throw new Error('Supported Bessel orders |n|≤128, |x|≤4 and 1–1024 terms.');
  const n = Math.abs(order),
    a = Math.abs(x);
  if (a === 0)
    return { value: n === 0 ? 1 : 0, error: 0, terms: 1, resolved: true };
  let term = 1;
  for (let j = 1; j <= n; j++) term *= a / (2 * j);
  let sum = term,
    tail = Infinity,
    terms = 1;
  for (let k = 0; k < maxTerms; k++) {
    const ratio = (a * a) / (4 * (k + 1) * (n + k + 1));
    // Subsequent ratios decrease, so this bounds ALL omitted positive terms.
    tail = ratio < 1 ? (term * ratio) / (1 - ratio) : Infinity;
    if (tail <= 2 * Number.EPSILON * sum || terms === maxTerms) break;
    term *= ratio;
    sum += term;
    terms++;
  }
  const rounding = 4 * Number.EPSILON * (n + 3 * terms + 1) * sum;
  return {
    value: x < 0 && n % 2 ? -sum : sum,
    error: tail + rounding,
    terms,
    resolved: Number.isFinite(tail) && tail <= 2 * Number.EPSILON * sum,
  };
}
export type U1ReferenceValues = {
  Z: number;
  logZ: number;
  meanPlaquette: number;
  action: number;
  pair: number | null;
  imaginaryMean: number;
  windingMean: number | null;
  I0: number;
};
export type U1Reference = {
  status: 'resolved' | 'under-resolved' | 'unsupported-accuracy';
  reason: string;
  maxOrder: number;
  /** Relative error for Z, absolute errors for dimensionless loop means. */
  error: { partitionRelative: number; plaquette: number; pair: number } | null;
  values: U1ReferenceValues | null;
};
/** Character expansion independent of geometry observables, samplers and RNG.
 * Sum n=-N..N, with shifted-index bounds for the one-/two-face insertions.
 * Error allowances are conservative engineering bounds, not interval arithmetic. */
export function u1Reference(
  geometry: GaugeGeometry,
  K: number,
  options: { tolerance?: number; maxOrder?: number } = {},
): U1Reference {
  if (
    !['square', 'torus'].includes(geometry) ||
    !Number.isFinite(K) ||
    Math.abs(K) > 4
  )
    throw new Error('Use a supported geometry and K in [−4,4].');
  const tolerance = options.tolerance ?? 1e-12,
    limit = options.maxOrder ?? 64;
  if (!Number.isInteger(limit) || limit < 0 || limit > 64)
    throw new Error('Use a character cutoff from 0 to 64.');
  if (!Number.isFinite(tolerance) || tolerance < 1e-12 || tolerance > 1e-3)
    return {
      status: 'unsupported-accuracy',
      reason:
        'Supported numerical tolerance is 10⁻¹²–10⁻³; smaller roundoff guarantees are unavailable.',
      maxOrder: 0,
      error: null,
      values: null,
    };
  const a = Math.abs(K),
    sign = K < 0 ? -1 : 1;
  const coefficients = Array.from({ length: limit + 2 }, (_, n) =>
    besselI(n, a),
  );
  const zero = coefficients[0]!,
    one = coefficients[1]!;
  if (geometry === 'square') {
    const mean = (sign * one.value) / zero.value;
    const error = {
      partitionRelative: zero.error / zero.value,
      plaquette:
        (one.error + Math.abs(mean) * zero.error) / (zero.value - zero.error),
      pair: 0,
    };
    const resolved =
      zero.resolved &&
      one.resolved &&
      Math.max(error.partitionRelative, error.plaquette) <= tolerance;
    return {
      status: resolved ? 'resolved' : 'under-resolved',
      reason: 'Analytical I₀ and I₁/I₀ evaluated by bounded power series.',
      maxOrder: 1,
      error,
      values: resolved
        ? {
            Z: zero.value,
            logZ: Math.log(zero.value),
            meanPlaquette: mean,
            action: -K * mean,
            pair: null,
            imaginaryMean: 0,
            windingMean: null,
            I0: zero.value,
          }
        : null,
    };
  }
  let error: U1Reference['error'] = null;
  for (let N = 0; N <= limit; N++) {
    const sums = [0, 0, 0],
      errors = [0, 0, 0];
    for (let n = -N; n <= N; n++) {
      const left = coefficients[Math.abs(n)]!,
        right = coefficients[Math.abs(n + 1)]!;
      for (let p = 0; p <= 2; p++) {
        const value = right.value ** p * left.value ** (4 - p);
        const upper =
          (right.value + right.error) ** p *
          (left.value + left.error) ** (4 - p);
        sums[p]! += value;
        errors[p]! += upper - value;
      }
    }
    // I_(N+j) ≤ I_N q^j, q=|K|/[2(N+1)]. The negative tail of an
    // insertion includes I_(m-1), hence q^(4-p), NOT the partition's q^4.
    const q = a / (2 * (N + 1));
    if (q >= 1) continue;
    const upperN = coefficients[N]!.value + coefficients[N]!.error;
    for (let p = 0; p <= 2; p++) {
      const tail = (upperN ** 4 * (q ** (4 - p) + q ** (4 + p))) / (1 - q ** 4);
      errors[p]! += tail + 8 * Number.EPSILON * (2 * N + 1) * sums[p]!;
    }
    const Z = sums[0]!,
      denominator = Z - errors[0]!;
    if (!(denominator > 0)) continue;
    const mean = (sign * sums[1]!) / Z,
      pair = sums[2]! / Z;
    error = {
      partitionRelative: errors[0]! / Z,
      plaquette: (errors[1]! + Math.abs(mean) * errors[0]!) / denominator,
      pair: (errors[2]! + pair * errors[0]!) / denominator,
    };
    if (
      coefficients.slice(0, N + 2).every((c) => c.resolved) &&
      Math.max(...Object.values(error)) <= tolerance
    )
      return {
        status: 'resolved',
        reason: `Character sum n=−${N}…${N}; bounded tails and floating-point allowance.`,
        maxOrder: N,
        error,
        values: {
          Z,
          logZ: Math.log(Z),
          meanPlaquette: mean,
          action: -4 * K * mean,
          pair,
          imaginaryMean: 0,
          windingMean: 0,
          I0: zero.value,
        },
      };
  }
  return {
    status: 'under-resolved',
    reason:
      'Character cutoff exhausted before all partition and Wilson numerator error gates passed.',
    maxOrder: limit,
    error,
    values: null,
  };
}
/** Density relative to dθ, not Haar dθ/(2π); only the OPEN plaquette marginal. */
export function openPlaquetteDensity(
  angle: number,
  K: number,
  reference: U1Reference,
): number {
  if (
    !Number.isFinite(angle) ||
    !Number.isFinite(K) ||
    Math.abs(K) > 4 ||
    !reference.values ||
    reference.values.pair !== null
  )
    throw new Error('A resolved open-plaquette reference is required.');
  return Math.exp(K * Math.cos(angle)) / (2 * Math.PI * reference.values.I0);
}
