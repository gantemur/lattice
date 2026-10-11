/** Translation average of one retained path, without subtracting its mean. */
export function pathCorrelator(path: readonly number[]): number[] {
  const n = path.length;
  if (n < 4 || path.some((x) => !Number.isFinite(x)))
    throw new Error('A correlator needs a finite path of at least four sites.');
  return Array.from({ length: Math.floor(n / 2) + 1 }, (_, lag) => {
    let sum = 0;
    for (let j = 0; j < n; j++) sum += path[j]! * path[(j + lag) % n]!;
    return sum / n;
  });
}

/** Project full-segment pair aggregates; recent plotted vectors may be evicted. */
export function segmentCorrelator(
  pairProducts: readonly (readonly number[])[],
): number[] {
  const n = pairProducts.length;
  if (n < 4 || pairProducts.some((row) => row.length !== n))
    throw new Error(
      'Pair-product matrix must be square with at least four sites.',
    );
  return Array.from({ length: Math.floor(n / 2) + 1 }, (_, lag) => {
    let sum = 0;
    for (let j = 0; j < n; j++) sum += pairProducts[j]![(j + lag) % n]!;
    return sum / n;
  });
}

/** At the last stored lag, reconstruct its neighbor by periodic reflection. */
export function effectiveGap(
  correlation: readonly number[],
  lag: number,
  a: number,
  sites: number,
): number | null {
  if (
    !Number.isInteger(sites) ||
    sites < 4 ||
    correlation.length !== Math.floor(sites / 2) + 1 ||
    !Number.isInteger(lag) ||
    lag < 1 ||
    lag >= correlation.length ||
    !(a > 0)
  )
    return null;
  const left = correlation[lag - 1];
  const center = correlation[lag];
  // For even N, C(N/2+1)=C(N/2−1); for odd N, C((N+1)/2)=C((N−1)/2).
  const right =
    correlation[lag + 1] ??
    (sites % 2 === 0 ? correlation[lag - 1] : correlation[lag]);
  if (![left, center, right].every((x) => Number.isFinite(x)) || !(center! > 0))
    return null;
  const argument = (left! + right!) / (2 * center!);
  return argument >= 1 ? Math.acosh(argument) / a : null;
}

export const minimumEffectiveGapPaths = 64;

/** Presentation gate only: the arcosh estimator above remains a pure formula.
 * 64 retained paths is an educational minimum, not an equilibration test or
 * an effective-sample-size calculation for a correlated local chain. */
export function assessSampledGap(
  correlation: readonly number[] | null,
  measurements: number,
  lag: number,
  a: number,
  sites: number,
): {
  status: 'insufficient-samples' | 'invalid-ratio' | 'provisional';
  value: number | null;
} {
  if (measurements < minimumEffectiveGapPaths)
    return { status: 'insufficient-samples', value: null };
  const value = correlation ? effectiveGap(correlation, lag, a, sites) : null;
  return value === null
    ? { status: 'invalid-ratio', value: null }
    : { status: 'provisional', value };
}
