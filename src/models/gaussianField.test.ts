import { expect, it } from 'vitest';
import { createRng } from '../algorithms/rng';
import { drawGaussianField } from '../algorithms/gaussianFieldSampler';
import { createFieldLattice } from '../domain/fieldLattice';
import { gaussianReference } from './gaussian';
import {
  fieldAction,
  fieldConditional,
  fieldGradient,
  fieldLocalDifference,
  fieldLocalTerms,
  fieldObservables,
  fieldPrecision,
  validateGaussianField,
} from './gaussianField';
import type { GaussianFieldParameters } from './gaussianField';
import { exactGaussianField, lowerCholesky } from './gaussianFieldReference';
import { gaussianScalar, scalarPreset } from './scalarField';

const two: GaussianFieldParameters = {
  shape: { kind: 'chain', length: 2, periodic: false },
  r: 2,
  kappaX: 3,
  kappaY: 0,
  source: 2,
};

it('solves the hand-checkable open two-site precision and inverse', () => {
  // Q=[[5,-3],[-3,5]], det Q=16, C=Q⁻¹=[[5,3],[3,5]]/16.
  const lattice = createFieldLattice(two.shape);
  expect(fieldPrecision(lattice, two)).toEqual([
    [5, -3],
    [-3, 5],
  ]);
  const exact = exactGaussianField(two);
  expect(exact.mean[0]).toBeCloseTo(1, 12);
  expect(exact.mean[1]).toBeCloseTo(1, 12);
  expect(exact.covariance[0]![0]).toBeCloseTo(5 / 16, 12);
  expect(exact.covariance[0]![1]).toBeCloseTo(3 / 16, 12);
  expect(exact.logPartition).toBeCloseTo(
    Math.log(2 * Math.PI) - Math.log(4) + 2,
    12,
  );
  expect(fieldAction(lattice, two, [1, -2])).toBeCloseTo(
    0.5 * (1 + 4) * 2 + 0.5 * 3 * 9 - 2 * -1,
  );
  expect(fieldObservables(lattice, two, [1, -2], 0, 1)).toEqual({
    site: 1,
    average: -0.5,
    actionDensity: fieldAction(lattice, two, [1, -2]) / 2,
    pair: -2,
  });
});

it('two periodic parallel bonds both enter Q and local conditionals', () => {
  // Both +x records join sites 0 and 1: Q=[[8,-6],[-6,8]].
  const p = {
    ...two,
    shape: { kind: 'chain' as const, length: 2, periodic: true },
  };
  const lattice = createFieldLattice(p.shape);
  expect(fieldPrecision(lattice, p)).toEqual([
    [8, -6],
    [-6, 8],
  ]);
  expect(fieldConditional(lattice, p, [0, 3], 0)).toEqual({
    mean: 20 / 8,
    variance: 1 / 8,
  });
  expect(fieldLocalDifference(lattice, p, [0, 3], 0, 1)).toBeCloseTo(
    fieldAction(lattice, p, [1, 3]) - fieldAction(lattice, p, [0, 3]),
    12,
  );
  const terms = fieldLocalTerms(lattice, p, [0, 3], 0);
  expect(terms.onsiteGradient).toBe(-2);
  expect(terms.incident.map((term) => term.gradient)).toEqual([-9, -9]);
});

it('anisotropic open/periodic 2×2 precision has the expected weighted neighbors', () => {
  const p: GaussianFieldParameters = {
    shape: {
      kind: 'rectangle',
      lx: 2,
      ly: 2,
      periodicX: false,
      periodicY: true,
    },
    r: 2,
    kappaX: 3,
    kappaY: 5,
    source: 0,
  };
  const lattice = createFieldLattice(p.shape);
  const Q = fieldPrecision(lattice, p);
  expect(Q[0]).toEqual([15, -3, -10, 0]);
  expect(Q[1]).toEqual([-3, 15, 0, -10]);
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) expect(Q[i]![j]).toBe(Q[j]![i]);
  const exact = exactGaussianField(p);
  for (let i = 0; i < 4; i++) {
    let sum = 0;
    for (let j = 0; j < 4; j++) sum += Q[i]![j]! * exact.covariance[j]![i]!;
    expect(sum).toBeCloseTo(1, 11);
    expect(exact.covariance[i]![i]).toBeGreaterThan(0);
  }
});

it('independent-site limit agrees with 0D and graph-scalar Gaussian references', () => {
  const p = { ...two, kappaX: 0 };
  const exact = exactGaussianField(p);
  const site = gaussianReference({ a: p.r, h: p.source });
  for (let i = 0; i < 2; i++) {
    expect(exact.mean[i]).toBeCloseTo(site.mean, 12);
    expect(exact.covariance[i]![i]).toBeCloseTo(site.variance, 12);
  }
  expect(exact.covariance[0]![1]).toBeCloseTo(0, 12);
  expect(exact.logPartition).toBeCloseTo(2 * site.logPartition, 12);
  const graph = scalarPreset('pair');
  for (const vertex of graph.parameters.domain.vertices) {
    graph.parameters.a[vertex.id] = p.r;
    graph.parameters.h[vertex.id] = p.source;
  }
  graph.parameters.kappa[graph.parameters.domain.edges[0]!.id] = 0;
  expect(gaussianScalar(graph).covariance[0]![0]).toBeCloseTo(
    exact.covariance[0]![0]!,
    12,
  );
});

it('resolves the supported 8×8 limit at the largest stiffness and smallest mass coefficient', () => {
  const p: GaussianFieldParameters = {
    shape: {
      kind: 'rectangle',
      lx: 8,
      ly: 8,
      periodicX: true,
      periodicY: true,
    },
    r: 0.05,
    kappaX: 10,
    kappaY: 10,
    source: 1,
  };
  const lattice = createFieldLattice(p.shape);
  const reference = exactGaussianField(p, lattice);
  // A uniform source excites the constant mode, which has precision r.
  expect(reference.mean.every((mean) => Math.abs(mean - 20) < 1e-9)).toBe(true);
  expect(reference.covariance[0]![0]).toBeGreaterThan(0);
  expect(Number.isFinite(reference.logPartition)).toBe(true);
});

it('checks gradient and local action difference against independent full-action calculations', () => {
  const p: GaussianFieldParameters = {
    shape: {
      kind: 'rectangle',
      lx: 2,
      ly: 2,
      periodicX: true,
      periodicY: true,
    },
    r: 1.7,
    kappaX: 0.8,
    kappaY: 2.1,
    source: -0.3,
  };
  const lattice = createFieldLattice(p.shape);
  const rng = createRng(72);
  for (let trial = 0; trial < 30; trial++) {
    const field = Array.from({ length: 4 }, () => 4 * rng.uniform() - 2);
    const gradient = fieldGradient(lattice, p, field);
    for (let site = 0; site < 4; site++) {
      const proposed = 4 * rng.uniform() - 2;
      const changed = [...field];
      changed[site] = proposed;
      expect(
        fieldLocalDifference(lattice, p, field, site, proposed),
      ).toBeCloseTo(
        fieldAction(lattice, p, changed) - fieldAction(lattice, p, field),
        11,
      );
      const plus = [...field];
      plus[site] = plus[site]! + 1e-5;
      const minus = [...field];
      minus[site] = minus[site]! - 1e-5;
      expect(gradient[site]).toBeCloseTo(
        (fieldAction(lattice, p, plus) - fieldAction(lattice, p, minus)) / 2e-5,
        8,
      );
    }
  }
});

it('direct Cholesky draws reproduce two-site means and covariance statistically', () => {
  const reference = exactGaussianField(two);
  const rng = createRng(9351);
  let mean0 = 0,
    mean1 = 0,
    cross = 0;
  const count = 20_000;
  for (let n = 0; n < count; n++) {
    const [x, y] = drawGaussianField(reference, rng);
    mean0 += x!;
    mean1 += y!;
    cross += x! * y!;
  }
  mean0 /= count;
  mean1 /= count;
  cross /= count;
  // Mean fluctuations are about sqrt((5/16)/20000)≈0.004; 0.025 is loose.
  expect(mean0).toBeCloseTo(1, 1);
  expect(Math.abs(mean0 - 1)).toBeLessThan(0.025);
  expect(Math.abs(mean1 - 1)).toBeLessThan(0.025);
  expect(Math.abs(cross - mean0 * mean1 - 3 / 16)).toBeLessThan(0.025);
});

it('rejects nonnormalizable, non-finite and singular inputs', () => {
  expect(() => validateGaussianField({ ...two, r: 0 })).toThrow();
  expect(() => validateGaussianField({ ...two, kappaX: -1 })).toThrow();
  expect(() =>
    fieldAction(createFieldLattice(two.shape), two, [Infinity, 0]),
  ).toThrow();
  expect(() =>
    lowerCholesky([
      [1, 1],
      [1, 1],
    ]),
  ).toThrow();
  expect(() =>
    fieldObservables(createFieldLattice(two.shape), two, [1, 2], -1, 1),
  ).toThrow();
});
