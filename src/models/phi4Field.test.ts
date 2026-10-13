import { describe, expect, it } from 'vitest';
import { createFieldLattice } from '../domain/fieldLattice';
import type { FieldShape } from '../domain/fieldLattice';
import {
  defaultPhi4Field,
  phi4Action,
  phi4Gradient,
  phi4LocalDifference,
  phi4LocalTerms,
  phi4GaussianParameters,
  validatePhi4Field,
} from './phi4Field';
import {
  fieldAction,
  fieldGradient,
  fieldLocalDifference,
} from './gaussianField';
import { exactGaussianField } from './gaussianFieldReference';
import { spatialQmMapping, decoupledPhi4Reference } from './phi4Reference';
import { quarticPathAction } from './quarticOscillator';
import { quarticTransferStudy } from './quarticTransfer';

const shapes: FieldShape[] = [
  { kind: 'chain', length: 2, periodic: false },
  { kind: 'chain', length: 2, periodic: true },
  { kind: 'chain', length: 4, periodic: true },
  ...[false, true].flatMap((periodicX) =>
    [false, true].map((periodicY) => ({
      kind: 'rectangle' as const,
      lx: 2,
      ly: 2,
      periodicX,
      periodicY,
    })),
  ),
];
// Independent coordinate-loop oracle: no production bond lists or local ΔS.
function coordinateAction(shape: FieldShape, x: number[]) {
  let sum = x.reduce(
    (s, z) => s - (z * z) / 2 + (0.5 * z ** 4) / 4 - 0.3 * z,
    0,
  );
  const lx = shape.kind === 'chain' ? shape.length : shape.lx,
    ly = shape.kind === 'chain' ? 1 : shape.ly;
  for (let y = 0; y < ly; y++)
    for (let i = 0; i < lx; i++) {
      const z = x[i + lx * y]!;
      if (
        i + 1 < lx ||
        (shape.kind === 'chain' ? shape.periodic : shape.periodicX)
      )
        sum += (2 * (z - x[((i + 1) % lx) + lx * y]!) ** 2) / 2;
      if (shape.kind === 'rectangle' && (y + 1 < ly || shape.periodicY))
        sum += (0.7 * (z - x[i + lx * ((y + 1) % ly)]!) ** 2) / 2;
    }
  return sum;
}
describe('spatial quartic action and force', () => {
  it.each(shapes)('counts every bond on %j', (shape) => {
    const lattice = createFieldLattice(shape),
      p = {
        ...defaultPhi4Field,
        shape,
        source: 0.3,
        kappaY: shape.kind === 'chain' ? 0 : 0.7,
      };
    const field = Array.from(
      { length: lattice.size },
      (_, i) => [-0.8, 1.2, 0.4, -1.1][i % 4]!,
    );
    expect(phi4Action(lattice, p, field)).toBeCloseTo(
      coordinateAction(shape, field),
      12,
    );
    const gradient = phi4Gradient(lattice, p, field);
    for (let site = 0; site < lattice.size; site++) {
      const next = field.slice();
      next[site] = 0.7;
      expect(phi4LocalDifference(lattice, p, field, site, 0.7)).toBeCloseTo(
        coordinateAction(shape, next) - coordinateAction(shape, field),
        11,
      );
      const h = 1e-5 * Math.max(1, Math.abs(field[site]!));
      const plus = field.slice(),
        minus = field.slice();
      plus[site]! += h;
      minus[site]! -= h;
      expect(gradient[site]).toBeCloseTo(
        (phi4Action(lattice, p, plus) - phi4Action(lattice, p, minus)) /
          (2 * h),
        7,
      );
    }
  });
  it('has a hand-checkable periodic dimer and quartic conditional', () => {
    const p = { ...defaultPhi4Field, shape: shapes[1]! },
      l = createFieldLattice(p.shape);
    // x=(1,-1): onsite=-3/4, two κ=2 bonds each contribute 4.
    expect(phi4Action(l, p, [1, -1])).toBe(7.25);
    const terms = phi4LocalTerms(l, p, [1, -1], 0);
    expect(terms.incident).toHaveLength(2);
    expect(terms.conditionalQuadratic).toBe(3);
    expect(terms.conditionalSource).toBe(-4);
    expect(phi4Gradient(l, p, [1, -1])).toEqual([7.5, -7.5]);
  });
  it.each(shapes)('reduces to the finite Gaussian on %j', (shape) => {
    const p = {
        ...defaultPhi4Field,
        shape,
        r: 2,
        lambda: 0,
        source: 0.4,
        kappaY: shape.kind === 'chain' ? 0 : 0.7,
      },
      l = createFieldLattice(shape);
    const g = phi4GaussianParameters(p),
      x = Array.from({ length: l.size }, (_, i) => i / 3 - 1);
    expect(phi4Action(l, p, x)).toBeCloseTo(fieldAction(l, g, x), 12);
    expect(phi4Gradient(l, p, x)).toEqual(fieldGradient(l, g, x));
    expect(phi4LocalDifference(l, p, x, 0, 0.1)).toBeCloseTo(
      fieldLocalDifference(l, g, x, 0, 0.1),
      12,
    );
    const ref = exactGaussianField(g);
    ref.mean.forEach((v) => expect(v).toBeCloseTo(0.2, 12));
    // Q C = I is checked independently from coordinate neighbors in other Gaussian tests.
    expect(Number.isFinite(ref.logPartition)).toBe(true);
  });
  it('matches independent anisotropic periodic 2×2 eigenmodes and open dimer', () => {
    const p = {
      ...defaultPhi4Field,
      shape: shapes[6]!,
      lambda: 0,
      r: 2,
      kappaX: 1,
      kappaY: 0.5,
      source: 0.4,
    };
    const ref = exactGaussianField(phi4GaussianParameters(p));
    // Eigenvalues 2,6,4,8 from the four +/- coordinate patterns.
    expect(ref.covariance[0]![0]).toBeCloseTo(
      (1 / 2 + 1 / 6 + 1 / 4 + 1 / 8) / 4,
      12,
    );
    expect(ref.covariance[0]![1]).toBeCloseTo(
      (1 / 2 - 1 / 6 + 1 / 4 - 1 / 8) / 4,
      12,
    );
    expect(ref.logPartition).toBeCloseTo(
      2 * Math.log(2 * Math.PI) -
        Math.log(2 * 6 * 4 * 8) / 2 +
        (4 * 0.4 ** 2) / 4,
      12,
    );
    const d = exactGaussianField(
      phi4GaussianParameters({
        ...p,
        shape: shapes[0]!,
        kappaX: 3,
        kappaY: 0,
        source: 2,
      }),
    );
    expect(d.covariance[0]![0]).toBeCloseTo(5 / 16, 12);
    expect(d.covariance[0]![1]).toBeCloseTo(3 / 16, 12);
  });
  it('rejects invalid measures and values but allows interacting negative r', () => {
    expect(() => validatePhi4Field(defaultPhi4Field)).not.toThrow();
    for (const patch of [
      { lambda: -1 },
      { lambda: 0 },
      { lambda: 0.001 },
      { r: NaN },
      { source: Infinity },
      { kappaX: -1 },
      { kappaY: 1 },
      { measure: 'mean-zero' },
    ])
      expect(() =>
        validatePhi4Field({
          ...defaultPhi4Field,
          ...patch,
        } as typeof defaultPhi4Field),
      ).toThrow();
    for (const shape of [
      { kind: 'chain', length: 1, periodic: true },
      { kind: 'rectangle', lx: 2, ly: 9, periodicX: true, periodicY: true },
      { kind: 'chain', length: 4, periodic: 'yes' },
    ])
      expect(() =>
        validatePhi4Field({
          ...defaultPhi4Field,
          shape,
        } as typeof defaultPhi4Field),
      ).toThrow();
    const l = createFieldLattice(shapes[0]!),
      p = { ...defaultPhi4Field, shape: shapes[0]! };
    expect(() => phi4Action(l, p, [1e100, 0])).toThrow('overflowed');
    expect(() => phi4Gradient(l, p, [1e200, 0])).toThrow('overflowed');
    expect(() => phi4Action(l, p, [NaN, 0])).toThrow();
    expect(() => phi4GaussianParameters(defaultPhi4Field)).toThrow();
  });
});
describe('spatial reference correspondence', () => {
  it.each([
    { r: -1, lambda: 0.5, source: 0 },
    { r: -1, lambda: 0.5, source: 0.2 },
    { r: 0.5, lambda: 0, source: 0.2 },
  ])('has identical QM action %j', (patch) => {
    const p = { ...defaultPhi4Field, ...patch },
      qm = spatialQmMapping(p).parameters!;
    expect(qm).toEqual({
      sites: 16,
      beta: 8,
      r: 2 * p.r,
      lambda: 2 * p.lambda,
      h: 2 * p.source,
    });
    const field = Array.from({ length: 16 }, (_, i) => Math.sin(i) * 1.7 + 0.3),
      l = createFieldLattice(p.shape);
    expect(phi4Action(l, p, field)).toBeCloseTo(
      quarticPathAction(qm, field),
      12,
    );
  });
  it('reuses the validated finite-ring transfer computation without changing units', () => {
    const mapped = spatialQmMapping(defaultPhi4Field).parameters!;
    const study = quarticTransferStudy(mapped);
    expect(study.status).toBe('resolved');
    expect(study.correlatorStatus).toBe('resolved');
    expect(study.gap).toBeCloseTo(0.329211319864, 9);
    expect(study.grids[2].rawCorrelator).toEqual(
      quarticTransferStudy({ sites: 16, beta: 8, r: -2, lambda: 1, h: 0 })
        .grids[2].rawCorrelator,
    );
    expect(1 / (0.5 * study.gap!)).toBeCloseTo(2 / 0.329211319864, 8);
  });
  it('discloses unavailable mappings rather than modifying the spatial model', () => {
    for (const patch of [
      { shape: shapes[0]! },
      { shape: shapes[1]! },
      { kappaX: 0 },
      { source: 10 },
      { r: 20 },
      { shape: shapes[6]!, kappaY: 1 },
    ])
      expect(
        spatialQmMapping({ ...defaultPhi4Field, ...patch }).parameters,
      ).toBeNull();
  });
  it('factorizes the decoupled partition function and moments', () => {
    for (const source of [0, 0.4]) {
      const p = { ...defaultPhi4Field, kappaX: 0, source },
        ref = decoupledPhi4Reference(p);
      expect(ref.logPartition).toBe(16 * ref.site.logPartition);
      expect(ref.distinctPair).toBe(ref.site.mean ** 2);
      if (source === 0) expect(Math.abs(ref.site.mean)).toBeLessThan(1e-12);
      expect(ref.site.tailBound).toBeLessThan(1e-10);
    }
  });
});
