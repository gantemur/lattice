import { expect, it } from 'vitest';
import { graphPreset } from '../domain/graph';
import { createRng } from '../algorithms/rng';
import { gaussianReference } from './gaussian';
import {
  cholesky,
  conditionalPotential,
  directGaussianScalar,
  gaussianConditional,
  gaussianScalar,
  localDifference,
  precision,
  quarticReference,
  scalarAction,
  scalarPreset,
  scalarReference,
  scalarObservable,
  scalarTargets,
  validateScalar,
} from './scalarField';
it('matches M0 one-site Gaussian and independent closed-form 2×2 inversion', () => {
  const one = scalarPreset('baseline');
  one.parameters.a.v0 = 2;
  one.parameters.h.v0 = 3;
  const r = gaussianScalar(one),
    m0 = gaussianReference({ a: 2, h: 3 });
  expect(r.mean[0]).toBeCloseTo(m0.mean, 14);
  expect(r.covariance[0]![0]).toBeCloseTo(m0.variance, 14);
  expect(r.logZ).toBeCloseTo(m0.logPartition, 14);
  const pair = scalarPreset('pair');
  pair.parameters.a.v0 = 2;
  pair.parameters.a.v1 = 3;
  pair.parameters.kappa.e0 = 1.5;
  pair.parameters.h.v0 = 1;
  pair.parameters.h.v1 = -2;
  const g = gaussianScalar(pair),
    det = 3.5 * 4.5 - 1.5 ** 2;
  expect(g.Q).toEqual([
    [3.5, -1.5],
    [-1.5, 4.5],
  ]);
  expect(g.covariance[0]![0]).toBeCloseTo(4.5 / det, 14);
  expect(g.covariance[0]![1]).toBeCloseTo(1.5 / det, 14);
  expect(g.mean[0]).toBeCloseTo((4.5 - 3) / det, 14);
  expect(g.mean[1]).toBeCloseTo((1.5 - 7) / det, 14);
  expect(g.logZ).toBeCloseTo(
    Math.log(2 * Math.PI) -
      0.5 * Math.log(det) +
      (g.mean[0]! - 2 * g.mean[1]!) / 2,
    14,
  );
  expect(scalarTargets(pair)).toContain('v0·v1');
  expect(scalarObservable(pair, [2, 3], 'v0·v1')).toBe(6);
  expect(scalarReference(pair, 'v0·v1')?.mean).toBeCloseTo(
    g.correlations[0]![1]!,
    14,
  );
  const x = [0.3, -0.8],
    c = gaussianConditional(pair, x, 0);
  expect(c.mean).toBeCloseTo((1 + 1.5 * x[1]!) / 3.5, 14);
  expect(c.variance).toBeCloseTo(1 / 3.5, 14);
});
it('counts all torus parallel bonds, excludes self-links, and validates every local difference', () => {
  const model = scalarPreset('four-quartic');
  model.parameters.domain = graphPreset('torus');
  for (const e of model.parameters.domain.edges)
    model.parameters.kappa[e.id] = 0.4 + Number(e.id.slice(1)) / 10;
  model.parameters.domain.edges.push({ id: 'self', tail: 'v0', head: 'v0' });
  model.parameters.kappa.self = 3;
  validateScalar(model);
  const x = [0.2, -1.2, 0.8, 1.4],
    Q = precision(model);
  expect(Q[0]![0]).toBeCloseTo(
    model.parameters.a.v0! +
      model.parameters.domain.edges
        .filter(
          (e) => e.tail !== e.head && (e.tail === 'v0' || e.head === 'v0'),
        )
        .reduce((sum, e) => sum + model.parameters.kappa[e.id]!, 0),
    12,
  );
  const original = scalarAction(model, x);
  for (let i = 0; i < 4; i++)
    for (const p of [-2, 0, 0.7, 3]) {
      const y = x.slice();
      y[i] = p;
      const d = localDifference(model, x, i, p);
      expect(d.total).toBeCloseTo(scalarAction(model, y) - original, 12);
      expect(
        conditionalPotential(model, x, i, p) -
          conditionalPotential(model, x, i, x[i]!),
      ).toBeCloseTo(d.total, 12);
    }
  expect(localDifference(model, x, 0, 2).edges).toHaveLength(4);
  const without = structuredClone(model);
  without.parameters.domain.edges.pop();
  delete without.parameters.kappa.self;
  expect(scalarAction(model, x)).toBeCloseTo(scalarAction(without, x), 14);
  expect(() => cholesky([[0]])).toThrow(/positive definite/);
});
it('direct Gaussian covariance is Q inverse rather than Q', () => {
  const model = scalarPreset('pair'),
    rng = createRng(91),
    g = gaussianScalar(model),
    N = 40000;
  let sx = 0,
    sy = 0,
    sxx = 0,
    sxy = 0;
  for (let k = 0; k < N; k++) {
    const [x, y] = directGaussianScalar(model, rng);
    sx += x!;
    sy += y!;
    sxx += x! * x!;
    sxy += x! * y!;
  }
  expect(sx / N).toBeCloseTo(g.mean[0]!, 1);
  expect(sxx / N - (sx / N) ** 2).toBeCloseTo(g.covariance[0]![0]!, 1);
  expect(sxy / N - (sx * sy) / N ** 2).toBeCloseTo(g.covariance[0]![1]!, 1);
});
it('quadrature normalizes symmetric and tilted wells and approaches Gaussian', () => {
  const pure = quarticReference(0, 4, 0);
  expect(pure.logPartition).toBeCloseTo(0.5948753441381321, 9);
  expect(pure.secondMoment).toBeCloseTo(0.33798912003364236, 9);
  expect(pure.fourthMoment).toBeCloseTo(0.25, 9);
  const q = quarticReference(-2, 1, 0);
  expect(q.mean).toBeCloseTo(0, 10);
  expect(q.variance).toBeGreaterThan(1);
  expect(q.density(1)).toBeGreaterThan(q.density(0));
  const tilted = quarticReference(-4, 0.5, 1.2);
  expect(tilted.mean).toBeCloseTo(2.902668074276822, 8);
  expect(tilted.variance).toBeCloseTo(0.16153599112183237, 8);
  expect(tilted.logPartition).toBeCloseTo(11.30832887595069, 8);
  expect(tilted.variance).toBeGreaterThan(0);
  const g = quarticReference(2, 0, 0.4),
    near = quarticReference(2, 0.0001, 0.4);
  expect(near.mean).toBeCloseTo(g.mean, 3);
  expect(near.variance).toBeCloseTo(g.variance, 3);
  const strong = quarticReference(-10, 0.01, 4);
  expect(Number.isFinite(strong.logPartition)).toBe(true);
  expect(strong.mean).toBeCloseTo(31.818610738940635, 7);
  expect(strong.variance).toBeCloseTo(0.04909228347946672, 7);
  expect(strong.logPartition).toBeCloseTo(2626.3004121978187, 7);
  expect(() => quarticReference(-1, 0, 0)).toThrow();
  const bad = scalarPreset('baseline');
  bad.parameters.a.v0 = 0;
  expect(() => validateScalar(bad)).toThrow();
  bad.parameters.lambda.v0 = -1;
  expect(() => validateScalar(bad)).toThrow();
});
it('independent quartic sites use their own reference while coupled quartic marginals are unavailable', () => {
  const m = scalarPreset('four-quartic');
  for (const e of m.parameters.domain.edges) m.parameters.kappa[e.id] = 0;
  expect(scalarReference(m, 'v0')?.kind).toBe('Numerical quadrature reference');
  m.parameters.kappa.e0 = 0.5;
  expect(scalarReference(m, 'v0')).toBeNull();
});
