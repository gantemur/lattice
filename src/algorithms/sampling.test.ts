import { describe, expect, it } from 'vitest';
import { createRng } from './rng';
import { sampleGaussian } from './gaussianSampler';
import {
  emptyMoments,
  recordMoment,
  summarizeMoments,
} from '../observables/moments';

describe('Mulberry32 midpoint v1', () => {
  it('matches uint32 regression vectors for seed 1', () => {
    const rng = createRng(1);
    const words = Array.from({ length: 5 }, () =>
      Math.floor(rng.uniform() * 4294967296),
    );
    expect(words).toEqual([
      2693262067, 11749833, 2265367787, 4213581821, 4159151403,
    ]);
  });
  it('replays seeds, supports zero and excludes both endpoints', () => {
    const first = createRng(0);
    const replay = createRng(0);
    const values = Array.from({ length: 50000 }, () => first.uniform());
    expect(values).toEqual(
      Array.from({ length: 50000 }, () => replay.uniform()),
    );
    expect(Math.min(...values)).toBeGreaterThan(0);
    expect(Math.max(...values)).toBeLessThan(1);
    expect(createRng(0xffffffff).uniform()).not.toBe(values[0]);
  });
  it.each([-1, 0.5, 4294967296, NaN, Infinity])(
    'rejects invalid seed %s',
    (seed) => {
      expect(() => createRng(seed)).toThrow();
    },
  );
});

describe('independent Gaussian sampler', () => {
  it('consumes exactly two uniforms per update and applies the correct shift/scale', () => {
    const values = [Math.exp(-0.5), 0.5];
    let calls = 0;
    expect(
      sampleGaussian({ a: 4, h: 2 }, { uniform: () => values[calls++]! }),
    ).toBeCloseTo(0, 14);
    expect(calls).toBe(2);
  });
  it.each([
    { a: 1, h: 0 },
    { a: 4, h: -2 },
    { a: 0.05, h: 10 },
  ])(
    'recovers analytic moments for %o within six standard deviations',
    (parameters) => {
      const rng = createRng(20261010);
      const moments = emptyMoments();
      const n = 200000;
      for (let i = 0; i < n; i += 1)
        recordMoment(moments, sampleGaussian(parameters, rng));
      const actual = summarizeMoments(moments);
      const variance = 1 / parameters.a;
      expect(Math.abs(actual.mean! - parameters.h / parameters.a)).toBeLessThan(
        6 * Math.sqrt(variance / n),
      );
      expect(Math.abs(actual.variance! - variance)).toBeLessThan(
        6 * variance * Math.sqrt(2 / (n - 1)),
      );
    },
  );
});
