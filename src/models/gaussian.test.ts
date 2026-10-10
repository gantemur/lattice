import { describe, expect, it } from 'vitest';
import {
  gaussianAction,
  gaussianDensity,
  gaussianReference,
  validateGaussian,
} from './gaussian';

// Independent composite Simpson quadrature, used only as a numerical test oracle.
function integrate(f: (x: number) => number, lo: number, hi: number): number {
  const intervals = 12000;
  const step = (hi - lo) / intervals;
  let sum = f(lo) + f(hi);
  for (let i = 1; i < intervals; i += 1)
    sum += (i % 2 ? 4 : 2) * f(lo + i * step);
  return (sum * step) / 3;
}

describe('dimensionless Gaussian model', () => {
  it('evaluates S = a x² / 2 − h x without an extra beta', () => {
    expect(gaussianAction(0, { a: 4, h: 3 })).toBe(0);
    expect(gaussianAction(2, { a: 4, h: 3 })).toBe(2);
    expect(gaussianAction(-2, { a: 4, h: 3 })).toBe(14);
    expect(gaussianAction(0.75, { a: 4, h: 3 })).toBe(-1.125);
  });

  it.each([
    { a: 1, h: 0 },
    { a: 4, h: 2 },
    { a: 0.5, h: -1 },
    { a: 20, h: 10 },
    { a: 0.05, h: -10 },
  ])(
    'normalizes the density and matches independent quadrature for %o',
    (parameters) => {
      const exact = gaussianReference(parameters);
      const lo = exact.mean - 10 * exact.standardDeviation;
      const hi = exact.mean + 10 * exact.standardDeviation;
      expect(
        integrate((x) => gaussianDensity(x, parameters), lo, hi),
      ).toBeCloseTo(1, 11);
      expect(
        integrate((x) => x * gaussianDensity(x, parameters), lo, hi),
      ).toBeCloseTo(exact.mean, 9);
      expect(
        integrate(
          (x) => (x - exact.mean) ** 2 * gaussianDensity(x, parameters),
          lo,
          hi,
        ),
      ).toBeCloseTo(exact.variance, 10);
      expect(
        integrate((x) => x * x * gaussianDensity(x, parameters), lo, hi),
      ).toBeCloseTo(exact.secondMoment, 7);
      for (const offset of [-2, 0, 2]) {
        const x = exact.mean + offset * exact.standardDeviation;
        expect(
          Math.exp(-gaussianAction(x, parameters) - exact.logPartition),
        ).toBeCloseTo(gaussianDensity(x, parameters), 11);
      }
    },
  );

  it('gives known exact moments and stable log Z', () => {
    expect(gaussianReference({ a: 4, h: 2 })).toMatchObject({
      mean: 0.5,
      variance: 0.25,
      secondMoment: 0.5,
    });
    expect(gaussianReference({ a: 1, h: 0 }).logPartition).toBeCloseTo(
      Math.log(Math.sqrt(2 * Math.PI)),
      14,
    );
    expect(
      Number.isFinite(gaussianReference({ a: 0.05, h: 10 }).logPartition),
    ).toBe(true);
  });

  it.each([0, -1, NaN, Infinity, 0.001, 21])(
    'rejects invalid or unsupported a=%s',
    (a) => {
      expect(() => validateGaussian({ a, h: 0 })).toThrow();
    },
  );
  it.each([NaN, Infinity, -Infinity, -11, 11])(
    'rejects invalid or unsupported h=%s',
    (h) => {
      expect(() => gaussianReference({ a: 1, h })).toThrow();
    },
  );
});
