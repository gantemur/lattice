import { expect, it } from 'vitest';
import { createFieldLattice } from '../domain/fieldLattice';
import { fieldPrecision } from './gaussianField';
import type { GaussianFieldParameters } from './gaussianField';
import {
  exactGaussianField,
  lowerCholesky,
  solveLower,
  solveUpperFromLower,
} from './gaussianFieldReference';
import { spectralGaussianField } from './gaussianFieldSpectral';

const shapes = [
  { kind: 'chain' as const, length: 2, periodic: true },
  { kind: 'chain' as const, length: 7, periodic: true },
  {
    kind: 'rectangle' as const,
    lx: 2,
    ly: 2,
    periodicX: true,
    periodicY: true,
  },
  {
    kind: 'rectangle' as const,
    lx: 3,
    ly: 4,
    periodicX: true,
    periodicY: true,
  },
];

it.each(shapes)(
  'massive spectral reference matches dense finite-volume reference',
  (shape) => {
    const p: GaussianFieldParameters = {
      shape,
      r: 0.7,
      kappaX: 1.5,
      kappaY: 0.4,
      source: -0.3,
    };
    const spectral = spectralGaussianField(p);
    const dense = exactGaussianField(p);
    expect(spectral.logPartition).toBeCloseTo(dense.logPartition, 9);
    spectral.mean.forEach((value, i) =>
      expect(value).toBeCloseTo(dense.mean[i]!, 10),
    );
    spectral.covariance.forEach((row, i) =>
      row.forEach((value, j) =>
        expect(value).toBeCloseTo(dense.covariance[i]![j]!, 9),
      ),
    );
    const n = spectral.mean.length;
    const averageVariance =
      spectral.covariance.flat().reduce((sum, value) => sum + value, 0) /
      n ** 2;
    expect(averageVariance).toBeCloseTo(1 / (n * p.r), 10);
  },
);

it.each(shapes)(
  'mean-zero covariance is the augmented-matrix pseudoinverse',
  (shape) => {
    const p: GaussianFieldParameters = {
      measure: 'mean-zero',
      shape,
      r: 0,
      kappaX: 1.3,
      kappaY: 0.8,
      source: 0,
    };
    const ref = spectralGaussianField(p);
    const Q = fieldPrecision(createFieldLattice(shape), p);
    const n = Q.length;
    const augmented = Q.map((row) => row.map((value) => value + 1 / n));
    const L = lowerCholesky(augmented);
    for (let column = 0; column < n; column++) {
      const unit = Array(n).fill(0);
      unit[column] = 1;
      const solved = solveUpperFromLower(L, solveLower(L, unit));
      for (let row = 0; row < n; row++) {
        expect(ref.covariance[row]![column]!).toBeCloseTo(
          solved[row]! - 1 / n,
          9,
        );
        expect(ref.covariance[row]![column]!).toBeCloseTo(
          ref.covariance[column]![row]!,
          10,
        );
        const product = Q[row]!.reduce(
          (sum, value, k) => sum + value * ref.covariance[k]![column]!,
          0,
        );
        expect(product).toBeCloseTo((row === column ? 1 : 0) - 1 / n, 9);
      }
    }
    ref.covariance.forEach((row) =>
      expect(row.reduce((sum, value) => sum + value, 0)).toBeCloseTo(0, 9),
    );
    for (let trial = 0; trial < 8; trial++) {
      const vector = Array.from({ length: n }, (_, i) =>
        Math.sin((i + 1) * (trial + 2)),
      );
      const quadratic = vector.reduce(
        (sum, value, i) =>
          sum +
          value *
            vector.reduce(
              (inner, other, j) => inner + ref.covariance[i]![j]! * other,
              0,
            ),
        0,
      );
      expect(quadratic).toBeGreaterThanOrEqual(-1e-9);
    }
  },
);

it('two-site constrained covariance has the parallel-bond factor', () => {
  const p: GaussianFieldParameters = {
    measure: 'mean-zero',
    shape: { kind: 'chain', length: 2, periodic: true },
    r: 0,
    kappaX: 3,
    kappaY: 0,
    source: 0,
  };
  const C = spectralGaussianField(p).covariance;
  expect(C[0]![0]!).toBeCloseTo(1 / 24, 12);
  expect(C[0]![1]!).toBeCloseTo(-1 / 24, 12);
});

it('invalid singular and nonperiodic configurations report actionable errors', () => {
  const base: GaussianFieldParameters = {
    measure: 'mean-zero',
    shape: { kind: 'chain', length: 4, periodic: true },
    r: 0,
    kappaX: 1,
    kappaY: 0,
    source: 0,
  };
  expect(() => exactGaussianField(base)).toThrow(/ordinary massive/);
  expect(() => spectralGaussianField({ ...base, source: 1 })).toThrow(/source/);
  expect(() => spectralGaussianField({ ...base, kappaX: 0 })).toThrow(
    /stiffness/,
  );
  expect(() =>
    spectralGaussianField({
      ...base,
      shape: { kind: 'chain', length: 4, periodic: false },
    }),
  ).toThrow(/periodicity/);
  expect(() => spectralGaussianField({ ...base, measure: 'ordinary' })).toThrow(
    /r/,
  );
});
