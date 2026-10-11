import { expect, it } from 'vitest';
import { createRng } from './rng';
import type { Rng } from './rng';
import { drawSpectralField } from './spectralFieldSampler';
import { createFieldLattice } from '../domain/fieldLattice';
import { fieldAction } from '../models/gaussianField';
import type { GaussianFieldParameters } from '../models/gaussianField';
import { forwardRealFourier } from '../models/fieldFourier';
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
