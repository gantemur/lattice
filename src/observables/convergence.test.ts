import { expect, it } from 'vitest';
import {
  ConvergenceHistory,
  gaussianStandardError,
  MAX_CHECKPOINTS,
} from './convergence';
import { createRng } from '../algorithms/rng';
import { sampleGaussian } from '../algorithms/gaussianSampler';

it('records logarithmic checkpoints and the latest endpoint without recording every sample', () => {
  const history = new ConvergenceHistory();
  let next = 1;
  const expected: number[] = [];
  for (let n = 1; n <= 10000; n++) {
    history.record(n, n / 2);
    if (n === next) {
      expected.push(n);
      next = Math.ceil(n * 1.125);
    }
  }
  if (expected.at(-1) !== 10000) expected.push(10000);
  expect(history.snapshot()).toEqual(
    expected.map((count) => ({ count, mean: count / 2 })),
  );
  expect(expected.length).toBeLessThan(100);
  const copy = history.snapshot();
  copy[0]!.mean = 123;
  expect(history.snapshot()[0]!.mean).toBe(0.5);
});
it('has a strict bound throughout the safe-integer range', () => {
  const history = new ConvergenceHistory();
  for (let n = 1; Number.isSafeInteger(n); n = Math.ceil(n * 1.125))
    history.record(n, 0);
  expect(history.snapshot().length).toBeLessThanOrEqual(MAX_CHECKPOINTS);
});
it('uses known variance and yields N^(-1/2) scaling', () => {
  expect(gaussianStandardError(4, 100)).toBe(0.2);
  expect(gaussianStandardError(4, 400)).toBe(0.1);
  expect(
    Math.log(gaussianStandardError(4, 400) / gaussianStandardError(4, 100)) /
      Math.log(4),
  ).toBeCloseTo(-0.5, 14);
  expect(() => gaussianStandardError(1, 0)).toThrow();
});
it('independent seeded ensembles have the predicted RMS error and pointwise coverage', () => {
  const replicas = 2000,
    counts = [16, 256];
  const squares = [0, 0],
    covered = [0, 0];
  for (let seed = 0; seed < replicas; seed++) {
    const rng = createRng(seed);
    let mean = 0;
    for (let n = 1; n <= 256; n++) {
      mean += (sampleGaussian({ a: 1, h: 0 }, rng) - mean) / n;
      const index = counts.indexOf(n);
      if (index >= 0) {
        squares[index]! += mean ** 2;
        if (Math.abs(mean) <= 1 / Math.sqrt(n)) covered[index]!++;
      }
    }
  }
  counts.forEach((n, i) => {
    // Six standard deviations for the mean of Gaussian squared errors (chi-square).
    expect(Math.abs(squares[i]! / replicas - 1 / n)).toBeLessThan(
      (6 * Math.sqrt(2 / replicas)) / n,
    );
    const probability = 0.682689492;
    expect(Math.abs(covered[i]! / replicas - probability)).toBeLessThan(
      6 * Math.sqrt((probability * (1 - probability)) / replicas),
    );
  });
});
