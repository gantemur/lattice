import { expect, it } from 'vitest';
import { createRng } from './rng';
import type { Rng } from './rng';
import { standardNormal } from './normalDraw';
import { checkedRealInverse, drawSpectralField } from './spectralFieldSampler';
import { createFieldLattice } from '../domain/fieldLattice';
import { fieldAction } from '../models/gaussianField';
import type { GaussianFieldParameters } from '../models/gaussianField';
import { forwardRealFourier, inverseFourier } from '../models/fieldFourier';
import { spectralGaussianField } from '../models/gaussianFieldSpectral';
import { sampledModePower } from '../observables/fieldSpectrum';

const p: GaussianFieldParameters = {
  measure: 'mean-zero',
  shape: { kind: 'chain', length: 4, periodic: true },
  r: 0,
  kappaX: 2,
  kappaY: 0,
  source: 0,
};

it('uses exactly two uniforms per real site and removes the constant mode', () => {
  const reference = spectralGaussianField(p);
  let count = 0;
  const underlying = createRng(123);
  const rng: Rng = {
    uniform() {
      count++;
      return underlying.uniform();
    },
  };
  const field = drawSpectralField(reference, rng);
  expect(count).toBe(8);
  expect(field.reduce((sum, value) => sum + value, 0)).toBeCloseTo(0, 12);
  expect(forwardRealFourier(field, reference.basis)[0]!.re).toBeCloseTo(0, 12);
  expect(drawSpectralField(reference, createRng(123))).toEqual(field);
});

it('ensemble covariance, mode power and mean action match the finite reference', () => {
  const reference = spectralGaussianField(p);
  const rng = createRng(91);
  const n = reference.basis.size;
  const count = 10000;
  const sums = Array(n).fill(0) as number[];
  const pairs = Array.from({ length: n }, () => Array(n).fill(0) as number[]);
  let actionSum = 0;
  let directPowerSum = 0;
  const lattice = createFieldLattice(p.shape);
  for (let sample = 0; sample < count; sample++) {
    const field = drawSpectralField(reference, rng);
    expect(field.reduce((sum, value) => sum + value, 0)).toBeCloseTo(0, 11);
    const mode = forwardRealFourier(field, reference.basis)[1]!;
    directPowerSum += (mode.re ** 2 + mode.im ** 2) / n;
    actionSum += fieldAction(lattice, p, field);
    for (let i = 0; i < n; i++) {
      sums[i]! += field[i]!;
      for (let j = 0; j < n; j++) pairs[i]![j]! += field[i]! * field[j]!;
    }
  }
  const siteMeans = sums.map((value) => value / count);
  const pairProducts = pairs.map((row) => row.map((value) => value / count));
  const aggregatePower = sampledModePower(
    reference.basis,
    1,
    pairProducts,
    siteMeans,
    reference.mean,
  );
  expect(aggregatePower).toBeCloseTo(directPowerSum / count, 9);
  expect(aggregatePower).toBeCloseTo(1 / reference.eigenvalues[1]!, 1);
  expect(actionSum / count).toBeCloseTo((n - 1) / 2, 1);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      expect(pairProducts[i]![j]!).toBeCloseTo(reference.covariance[i]![j]!, 1);
});

it('massive spectral draws include the sourced zero mode and independent covariance', () => {
  const massive: GaussianFieldParameters = {
    ...p,
    measure: 'ordinary',
    r: 1,
    source: 0.6,
  };
  const reference = spectralGaussianField(massive);
  const rng = createRng(92);
  const count = 12000;
  let mean = 0;
  let meanSquare = 0;
  for (let i = 0; i < count; i++) {
    const field = drawSpectralField(reference, rng);
    const average = field.reduce((sum, value) => sum + value, 0) / field.length;
    mean += average;
    meanSquare += average * average;
  }
  mean /= count;
  meanSquare /= count;
  expect(mean).toBeCloseTo(massive.source / massive.r, 1);
  expect(meanSquare - mean * mean).toBeCloseTo(
    1 / (reference.basis.size * massive.r),
    1,
  );
});

const smallStiffnessCases: GaussianFieldParameters[] = [
  {
    measure: 'mean-zero',
    shape: { kind: 'chain', length: 64, periodic: true },
    r: 0,
    kappaX: 1e-12,
    kappaY: 0,
    source: 0,
  },
  {
    measure: 'mean-zero',
    shape: {
      kind: 'rectangle',
      lx: 8,
      ly: 8,
      periodicX: true,
      periodicY: true,
    },
    r: 0,
    kappaX: 1e-12,
    kappaY: 1e-12,
    source: 0,
  },
];

it.each(smallStiffnessCases)(
  'small positive stiffness retains a real, mean-zero seeded field and exact scale',
  (parameters) => {
    const reference = spectralGaussianField(parameters);
    const { basis, eigenvalues } = reference;
    const seed = 12345;
    // Replay the N real normals independently of the sampler to inspect the
    // unrounded complex inverse and its scale before zero-mean projection.
    const replayRng = createRng(seed);
    const whiteNoise = Array.from({ length: basis.size }, () =>
      standardNormal(replayRng),
    );
    const filtered = forwardRealFourier(whiteNoise, basis).map(
      (coefficient, mode) =>
        mode === 0
          ? { re: 0, im: 0 }
          : {
              re: coefficient.re / Math.sqrt(eigenvalues[mode]!),
              im: coefficient.im / Math.sqrt(eigenvalues[mode]!),
            },
    );
    const inverse = inverseFourier(filtered, basis);
    const coefficientScale =
      filtered.reduce(
        (sum, coefficient) => sum + Math.hypot(coefficient.re, coefficient.im),
        0,
      ) / basis.size;
    const largestImaginary = Math.max(
      ...inverse.map((value) => Math.abs(value.im)),
    );
    expect(largestImaginary / coefficientScale).toBeLessThan(1e-12);

    let uniforms = 0;
    const source = createRng(seed);
    const countedRng: Rng = {
      uniform() {
        uniforms++;
        return source.uniform();
      },
    };
    const field = drawSpectralField(reference, countedRng);
    expect(uniforms).toBe(2 * basis.size);
    expect(drawSpectralField(reference, createRng(seed))).toEqual(field);
    const fieldScale = Math.hypot(...field) / Math.sqrt(basis.size);
    const mean = field.reduce((sum, value) => sum + value, 0) / basis.size;
    expect(Math.abs(mean) / fieldScale).toBeLessThan(1e-12);
    const rawMean =
      inverse.reduce((sum, value) => sum + value.re, 0) / basis.size;
    inverse.forEach((value, site) =>
      expect(
        Math.abs(field[site]! - (value.re - rawMean)) / fieldScale,
      ).toBeLessThan(1e-12),
    );

    // The finite spectral reference gives the variance of a selected site.
    // An independent ensemble checks that the large amplitude is physical,
    // not a numerical instability introduced by the reality check.
    const ensembleRng = createRng(8128);
    let secondMoment = 0;
    const samples = 3000;
    for (let sample = 0; sample < samples; sample++) {
      const draw = drawSpectralField(reference, ensembleRng);
      secondMoment += draw[0]! ** 2;
    }
    const relativeVarianceError = Math.abs(
      secondMoment / samples / reference.covariance[0]![0]! - 1,
    );
    expect(relativeVarianceError).toBeLessThan(0.1);
  },
);

it('rejects a deliberately non-conjugate Fourier coefficient', () => {
  const reference = spectralGaussianField(p);
  const realInput = [0.5, -1, 2, 0.25];
  const conjugateCoefficients = forwardRealFourier(realInput, reference.basis);
  checkedRealInverse(conjugateCoefficients, reference.basis).forEach(
    (value, site) => expect(value).toBeCloseTo(realInput[site]!, 12),
  );
  const corrupted = conjugateCoefficients.map((value) => ({ ...value }));
  corrupted[1]!.im += 0.1; // Leave its partner at k=3 unchanged.
  expect(() => checkedRealInverse(corrupted, reference.basis, 2)).toThrow(
    /conjugate reality/,
  );
});

it('uses the pre-filter scale when retained coefficients nearly cancel', () => {
  const twoSite: GaussianFieldParameters = {
    measure: 'mean-zero',
    shape: { kind: 'chain', length: 2, periodic: true },
    r: 0,
    kappaX: 3,
    kappaY: 0,
    source: 0,
  };
  const reference = spectralGaussianField(twoSite);
  let uniforms = 0;
  const equalNormals: Rng = {
    uniform() {
      uniforms++;
      return 0.5;
    },
  };
  const field = drawSpectralField(reference, equalNormals);
  expect(uniforms).toBe(4);
  expect(field[0]).toBeCloseTo(0, 14);
  expect(field[1]).toBeCloseTo(0, 14);
});
