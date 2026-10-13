import { describe, expect, it } from 'vitest';
import {
  harmonicLimitReference,
  quarticTransferStudy,
  symmetricEigenpairs,
  transferGrid,
} from './quarticTransfer';
import { defaultQuarticOscillator } from './quarticOscillator';
import { potentialMinimum, quarticPotential } from './quarticOscillator';

/** Dirichlet finite-difference Schrödinger oracle, independent of the
 * transfer kernel. Sturm counts bracket its two lowest tridiagonal levels. */
function continuumGap(r: number, lambda: number, h: number) {
  const p = { ...defaultQuarticOscillator, r, lambda, h };
  const nodes = 600;
  const cutoff = 9;
  const dx = (2 * cutoff) / (nodes + 1);
  const off = -1 / (2 * dx * dx);
  const diagonal = Array.from(
    { length: nodes },
    (_, i) => 1 / (dx * dx) + quarticPotential(p, -cutoff + (i + 1) * dx),
  );
  const countBelow = (energy: number) => {
    let count = 0;
    let pivot = diagonal[0]! - energy;
    if (pivot < 0) count++;
    for (let i = 1; i < nodes; i++) {
      if (Math.abs(pivot) < 1e-12) pivot = pivot < 0 ? -1e-12 : 1e-12;
      pivot = diagonal[i]! - energy - (off * off) / pivot;
      if (pivot < 0) count++;
    }
    return count;
  };
  function eigenvalue(index: number) {
    let lower = -10;
    let upper = 50;
    for (let i = 0; i < 90; i++) {
      const mid = (lower + upper) / 2;
      if (countBelow(mid) > index) upper = mid;
      else lower = mid;
    }
    return (lower + upper) / 2;
  }
  return eigenvalue(1) - eigenvalue(0);
}

function multiply(left: number[][], right: number[][]) {
  const n = left.length;
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      let sum = 0;
      for (let k = 0; k < n; k++) sum += left[i]![k]! * right[k]![j]!;
      return sum;
    }),
  );
}
function trace(matrix: number[][]) {
  return matrix.reduce((sum, row, i) => sum + row[i]!, 0);
}

describe('independent transfer quadrature', () => {
  it('resolves a moderate symmetric double well under both refinements', () => {
    const result = quarticTransferStudy(defaultQuarticOscillator);
    expect(result.status).toBe('resolved');
    expect(result.correlatorStatus).toBe('resolved');
  });
  it('agrees with the analytic shifted-harmonic gap and mean', () => {
    const p = { ...defaultQuarticOscillator, r: 1, lambda: 0, h: 0.4 };
    const result = quarticTransferStudy(p);
    const a = p.beta / p.sites;
    const exact = (2 * Math.asinh(a / 2)) / a;
    expect(result.status).toBe('resolved');
    expect(result.gap).toBeCloseTo(exact, 2);
    expect(result.grids[2].mean).toBeCloseTo(0.4, 2);
    const exactCovariance =
      Math.cosh((exact * p.beta) / 2) /
      (2 *
        Math.sqrt(p.r + ((a * p.r) / 2) ** 2) *
        Math.sinh((exact * p.beta) / 2));
    expect(result.grids[2].rawCorrelator?.[0]).toBeCloseTo(
      exactCovariance + 0.4 ** 2,
      2,
    );
    expect(harmonicLimitReference(p, 0).raw).toBeCloseTo(
      exactCovariance + 0.4 ** 2,
      12,
    );
    expect(result.potentialMinimum).toBeCloseTo(-0.08, 12);
    expect(result.groundEnergy).toBeLessThan(0.5);
  });
  it('classifies an unresolved tunneling doublet without reporting zero', () => {
    const result = quarticTransferStudy({
      ...defaultQuarticOscillator,
      sites: 16,
      beta: 8,
      r: -4,
      lambda: 0.05,
      h: 0,
    });
    expect(result.status).toBe('under-resolved');
    expect(result.gap).toBeNull();
  });
  it('matches an independent small-matrix thermal trace at a nonzero lag', () => {
    const p = { ...defaultQuarticOscillator, sites: 4, beta: 4, h: 0.4 };
    const nodes = 49;
    const cutoff = 7;
    const grid = transferGrid(p, nodes, cutoff);
    const dx = (2 * cutoff) / (nodes - 1);
    const x = Array.from({ length: nodes }, (_, i) => -cutoff + i * dx);
    const weights = x.map(
      (_, i) => dx * (i === 0 || i === nodes - 1 ? 0.5 : 1),
    );
    const vmin = potentialMinimum(p).value;
    const matrix = x.map((xi, i) =>
      x.map(
        (xj, j) =>
          (Math.sqrt(weights[i]! * weights[j]!) / Math.sqrt(2 * Math.PI)) *
          Math.exp(
            -((xi - xj) ** 2) / 2 -
              (quarticPotential(p, xi) -
                vmin +
                (quarticPotential(p, xj) - vmin)) /
                2,
          ),
      ),
    );
    const tx = matrix.map((row) => row.map((value, j) => value * x[j]!));
    const coordinate = x.map((value, i) =>
      x.map((_, j) => (i === j ? value : 0)),
    );
    const t2 = multiply(matrix, matrix);
    const t4 = multiply(t2, t2);
    const c1 =
      trace(multiply(multiply(multiply(t2, matrix), coordinate), tx)) /
      trace(t4);
    expect(grid.rawCorrelator?.[1]).toBeCloseTo(c1, 8);
  });
  it('approaches an independent continuum finite-difference gap as a decreases', () => {
    const p = { ...defaultQuarticOscillator, sites: 64, beta: 8 };
    const result = quarticTransferStudy(p);
    const continuum = continuumGap(p.r, p.lambda, p.h);
    expect(result.status).toBe('resolved');
    expect(Math.abs(result.gap! - continuum) / continuum).toBeLessThan(0.03);
  });
  it('tracks the independent first-order weak-quartic prediction', () => {
    const p = {
      ...defaultQuarticOscillator,
      sites: 64,
      beta: 8,
      r: 1,
      lambda: 0.05,
      h: 0,
    };
    const result = quarticTransferStudy(p);
    const firstOrder = 1 + (3 * p.lambda) / 4;
    expect(result.status).toBe('resolved');
    expect(Math.abs(result.gap! - firstOrder)).toBeLessThan(0.02);
  });
  it('rejects nonfinite matrices and checks an elementary eigenpair', () => {
    expect(() =>
      symmetricEigenpairs([
        [1, NaN],
        [NaN, 1],
      ]),
    ).toThrow();
    const pairs = symmetricEigenpairs([
      [2, 1],
      [1, 2],
    ]);
    expect(pairs.values).toEqual([3, 1]);
    expect(
      transferGrid(defaultQuarticOscillator, 49, 7).residuals[0],
    ).toBeLessThan(1e-8);
  });
  it('has even and odd leading parity on a resolved symmetric double well', () => {
    const p = defaultQuarticOscillator;
    const nodes = 49;
    const cutoff = 6;
    const a = p.beta / p.sites;
    const dx = (2 * cutoff) / (nodes - 1);
    const x = Array.from({ length: nodes }, (_, i) => -cutoff + i * dx);
    const weights = x.map(
      (_, i) => dx * (i === 0 || i === nodes - 1 ? 0.5 : 1),
    );
    const vmin = potentialMinimum(p).value;
    const matrix = x.map((xi, i) =>
      x.map(
        (xj, j) =>
          (Math.sqrt(weights[i]! * weights[j]!) / Math.sqrt(2 * Math.PI * a)) *
          Math.exp(
            -((xi - xj) ** 2) / (2 * a) -
              (a *
                (quarticPotential(p, xi) -
                  vmin +
                  (quarticPotential(p, xj) - vmin))) /
                2,
          ),
      ),
    );
    const pairs = symmetricEigenpairs(matrix);
    const reflectedOverlap = (mode: number) =>
      pairs.vectors[mode]!.reduce(
        (sum, value, i) => sum + value * pairs.vectors[mode]![nodes - 1 - i]!,
        0,
      );
    expect(reflectedOverlap(0)).toBeGreaterThan(0.999);
    expect(reflectedOverlap(1)).toBeLessThan(-0.999);
  });
});
