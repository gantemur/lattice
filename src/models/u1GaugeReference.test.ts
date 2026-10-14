import { expect, it } from 'vitest';
import { besselI, openPlaquetteDensity, u1Reference } from './u1GaugeReference';

// Independent periodic integrals: no production model, Bessel, Wilson or RNG call.
function angularIntegral(K: number, n: number, grid: number) {
  let sum = 0;
  for (let i = 0; i < grid; i++) {
    const theta = (2 * Math.PI * (i + 0.5)) / grid;
    sum += Math.exp(K * Math.cos(theta)) * Math.cos(n * theta);
  }
  return sum / grid;
}
function torusIntegral(K: number, grid: number) {
  let Z = 0,
    face = 0,
    pair = 0,
    realProduct = 0;
  for (let i = 0; i < grid; i++)
    for (let j = 0; j < grid; j++)
      for (let k = 0; k < grid; k++) {
        const a = (2 * Math.PI * (i + 0.5)) / grid;
        const b = (2 * Math.PI * (j + 0.5)) / grid;
        const c = (2 * Math.PI * (k + 0.5)) / grid;
        const weight = Math.exp(
          K * (Math.cos(a) + Math.cos(b) + Math.cos(c) + Math.cos(a + b + c)),
        );
        Z += weight;
        face += weight * Math.cos(a);
        pair += weight * Math.cos(a + b);
        realProduct += weight * Math.cos(a) * Math.cos(b);
      }
  return {
    Z: Z / grid ** 3,
    face: face / Z,
    pair: pair / Z,
    realProduct: realProduct / Z,
  };
}
for (const K of [0, -0.7, 0.7, -2, 2, -4, 4])
  it(`K=${K}: Bessel series, independent 1D quadrature and Haar density`, () => {
    for (const n of [0, 1, 2, 3, 6]) {
      const result = besselI(n, K),
        coarse = angularIntegral(K, n, 64),
        fine = angularIntegral(K, n, 128);
      expect(result.resolved).toBe(true);
      expect(Math.abs(coarse - fine)).toBeLessThan(2e-13);
      expect(Math.abs(result.value - fine)).toBeLessThan(2e-13);
      expect(besselI(-n, K)).toEqual(result);
      expect(result.error).toBeLessThan(2e-12);
    }
    const r = u1Reference('square', K);
    expect(r.status).toBe('resolved');
    let total = 0;
    for (let i = 0; i < 128; i++)
      total +=
        (openPlaquetteDensity((2 * Math.PI * i) / 128, K, r) * 2 * Math.PI) /
        128;
    expect(total).toBeCloseTo(1, 12);
  });
it('matches supplied numerical anchors and K parity', () => {
  expect(besselI(0, 0.7).value).toBeCloseTo(1.126303018306809, 13);
  expect(u1Reference('square', 0.7).values!.meanPlaquette).toBeCloseTo(
    0.330177289532671,
    13,
  );
  const positive = u1Reference('torus', 0.7).values!,
    negative = u1Reference('torus', -0.7).values!;
  expect(positive.Z).toBeCloseTo(1.647524496051455, 12);
  expect(positive.meanPlaquette).toBeCloseTo(0.359714439270084, 12);
  expect(positive.pair).toBeCloseTo(0.21365098179592, 12);
  expect(negative.Z).toBe(positive.Z);
  expect(negative.meanPlaquette).toBe(-positive.meanPlaquette);
  expect(negative.pair).toBe(positive.pair);
  for (const g of ['square', 'torus'] as const)
    expect(u1Reference(g, 0).values!.Z).toBe(1);
});
for (const K of [-0.7, 0.7, 4])
  it(`K=${K}: torus character sums versus independent 3D refined quadrature`, () => {
    const coarse = torusIntegral(K, 24),
      fine = torusIntegral(K, 48),
      r = u1Reference('torus', K),
      v = r.values!;
    expect(r.status).toBe('resolved');
    const errors = {
      Z: Math.abs(fine.Z / v.Z - 1),
      face: Math.abs(fine.face - v.meanPlaquette),
      pair: Math.abs(fine.pair - v.pair!),
    };
    expect(Math.abs(coarse.Z / fine.Z - 1)).toBeLessThan(2e-9);
    expect(Math.abs(coarse.face - fine.face)).toBeLessThan(2e-9);
    expect(Math.abs(coarse.pair - fine.pair)).toBeLessThan(2e-9);
    for (const value of Object.values(errors))
      expect(value).toBeLessThan(2e-10);
    expect(Math.abs(fine.pair - fine.realProduct)).toBeGreaterThan(0.001);
    const h = 1e-4;
    // Fourth-order derivative of log Z, independent of the insertion formula.
    const logZ = (x: number) => u1Reference('torus', x).values!.logZ;
    if (Math.abs(K) < 4)
      expect(
        (-logZ(K + 2 * h) +
          8 * logZ(K + h) -
          8 * logZ(K - h) +
          logZ(K - 2 * h)) /
          (48 * h),
      ).toBeCloseTo(v.meanPlaquette, 9);
    console.info('U1 quadrature', {
      K,
      grids: [24, 48],
      coarse,
      fine,
      errors,
      order: r.maxOrder,
      bounds: r.error,
    });
  });
it('under-resolution and unsupported precision never publish trusted values', () => {
  for (const K of [0.7, -0.7, 4]) {
    const r = u1Reference('torus', K, { maxOrder: 0 });
    expect(r.status).toBe('under-resolved');
    expect(r.values).toBeNull();
  }
  expect(u1Reference('torus', 4, { tolerance: 1e-16 }).status).toBe(
    'unsupported-accuracy',
  );
  expect(besselI(0, 4, 1).resolved).toBe(false);
  expect(() => besselI(1.5, 1)).toThrow();
  expect(() => u1Reference('torus', 5)).toThrow();
  for (const K of [-4, -2, 0, 2, 4])
    expect(u1Reference('torus', K, { tolerance: 1e-12 }).status).toBe(
      'resolved',
    );
});
