import { describe, expect, it } from 'vitest';
import {
  actionDifference,
  logChoose,
  modelAction,
  modelReference,
  probability,
  support,
  validateModel,
} from './singleVariable';
import type { Model } from './singleVariable';

function choose(n: number, k: number) {
  let c = 1;
  for (let i = 1; i <= k; i++) c *= (n - i + 1) / i;
  return c;
}
describe('single-spin exact enumeration', () => {
  it.each([-10, -2, 0, 0.5, 10])(
    'normalizes and reproduces moments at h=%s',
    (h) => {
      const model: Model = { kind: 'spin', parameters: { h } },
        ref = modelReference(model);
      const weights = [-1, 1].map((s) => Math.exp(h * s)),
        z = weights[0]! + weights[1]!;
      expect(Math.exp(ref.logPartition)).toBeCloseTo(z, 9);
      expect(probability(model, -1) + probability(model, 1)).toBeCloseTo(1, 15);
      expect(ref.mean).toBeCloseTo((weights[1]! - weights[0]!) / z, 14);
      expect(ref.variance).toBeCloseTo(
        (4 * weights[0]! * weights[1]!) / z ** 2,
        14,
      );
      expect(ref.secondMoment).toBeCloseTo(1, 14);
      expect(modelAction(model, -1)).toBe(h);
      expect(actionDifference(model, -1, 1)).toBe(-2 * h);
    },
  );
});
describe('binomial log combinatorics and canonical partition', () => {
  it.each([
    { n: 1, p: 0.5 },
    { n: 8, p: 0.2 },
    { n: 100, p: 0.001 },
    { n: 100, p: 0.999 },
    { n: 100, p: 0.5 },
  ])('normalizes and reproduces moments at %j', (parameters) => {
    const model: Model = { kind: 'binomial', parameters },
      { n, p } = parameters;
    const pmf = support(model).map((k) => probability(model, k));
    expect(pmf.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    const mean = pmf.reduce((sum, q, k) => sum + k * q, 0);
    const variance = pmf.reduce((sum, q, k) => sum + (k - n * p) ** 2 * q, 0);
    expect(mean).toBeCloseTo(n * p, 10);
    expect(variance).toBeCloseTo(n * p * (1 - p), 10);
    const ref = modelReference(model);
    expect(ref.mean).toBe(n * p);
    expect(ref.variance).toBe(n * p * (1 - p));
    expect(ref.logPartition).toBeCloseTo(Math.log((1 + p / (1 - p)) ** n), 10);
    for (let k = 0; k <= n; k++) {
      const oracle = choose(n, k) * p ** k * (1 - p) ** (n - k);
      expect(Math.abs(probability(model, k) / oracle - 1)).toBeLessThan(3e-13);
      expect(Math.log(probability(model, k))).toBeCloseTo(
        -modelAction(model, k) - ref.logPartition,
        10,
      );
      if (k < n)
        expect(actionDifference(model, k, k + 1)).toBeCloseTo(
          -Math.log(((n - k) * p) / ((k + 1) * (1 - p))),
          11,
        );
    }
  });
  it('rejects singular, out-of-range parameters and invalid states', () => {
    for (const parameters of [
      { n: 0, p: 0.5 },
      { n: 101, p: 0.5 },
      { n: 2.5, p: 0.5 },
      { n: 2, p: 0 },
      { n: 2, p: 1 },
      { n: 2, p: NaN },
    ])
      expect(() => validateModel({ kind: 'binomial', parameters })).toThrow();
    expect(() =>
      validateModel({ kind: 'spin', parameters: { h: Infinity } }),
    ).toThrow();
    expect(() => logChoose(3, -1)).toThrow();
    const model: Model = { kind: 'binomial', parameters: { n: 3, p: 0.4 } };
    expect(probability(model, 4)).toBe(0);
    expect(modelAction(model, -1)).toBe(Infinity);
    expect(() => actionDifference(model, 0, -1)).toThrow();
  });
});
it('Gaussian local action difference agrees with full action under extreme supported parameters', () => {
  for (const parameters of [
    { a: 0.05, h: 10 },
    { a: 20, h: -10 },
    { a: 1, h: 0 },
  ]) {
    const model: Model = { kind: 'gaussian', parameters };
    for (const current of [-200, -1, 0, 200])
      for (const proposed of [-150, 0.5, 200])
        expect(actionDifference(model, current, proposed)).toBeCloseTo(
          modelAction(model, proposed) - modelAction(model, current),
          8,
        );
  }
});
