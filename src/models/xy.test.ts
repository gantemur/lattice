import { describe, expect, it } from 'vitest';
import { createRng } from '../algorithms/rng';
import { xyGeometries, xyGraph } from '../domain/xyDomain';
import {
  xyAction,
  xyConditional,
  xyDifference,
  xyGradient,
  xyModel,
  xyObservables,
  xySpatial,
  rotateXY,
  wrapXY,
} from './xy';
import { xyVortices } from './xyVortices';
import { graphPreset } from '../domain/graph';

describe('XY physical geometry, action and conditional field', () => {
  for (const geometry of Object.keys(
    xyGeometries,
  ) as (keyof typeof xyGeometries)[])
    it(`${geometry}: signed physical bond sum, every local difference and full gradient`, () => {
      const g = xyGraph(geometry);
      if (g.kind !== 'graph') throw Error();
      g.domain.edges.forEach((b, i) => {
        g.couplings[b.id] = [-1.2, 0, 0.8][i % 3]!;
      });
      const model = xyModel({ h: -0.7, geometry: g }),
        a = Float64Array.from({ length: model.size }, (_, i) =>
          wrapXY(0.6 + i * 2.3),
        );
      const independent = (v: ArrayLike<number>) =>
        -model.bonds.reduce(
          (s, b) => s + b.K * Math.cos(v[b.tail]! - v[b.head]!),
          0,
        ) -
        model.h * Array.from(v).reduce((s, t) => s + Math.cos(t), 0);
      expect(xyAction(model, a)).toBeCloseTo(independent(a), 13);
      const gradient = xyGradient(model, a);
      for (let i = 0; i < model.size; i++) {
        const proposed = a.slice();
        proposed[i] = wrapXY(a[i]! + 2.7);
        expect(xyDifference(model, a, i, proposed[i]!)).toBeCloseTo(
          independent(proposed) - independent(a),
          12,
        );
        const plus = a.slice(),
          minus = a.slice();
        plus[i]! += 1e-5;
        minus[i]! -= 1e-5;
        expect(gradient[i]).toBeCloseTo(
          (independent(plus) - independent(minus)) / 2e-5,
          8,
        );
        const c = xyConditional(model, a, i);
        expect(xyDifference(model, a, i, proposed[i]!)).toBeCloseTo(
          -c.hx * (Math.cos(proposed[i]!) - Math.cos(a[i]!)) -
            c.hy * (Math.sin(proposed[i]!) - Math.sin(a[i]!)),
          12,
        );
      }
    });
  it('self-link constant; zero conditional and gradient contribution', () => {
    const domain = graphPreset('site');
    domain.edges.push({ id: 'loop', tail: 'v0', head: 'v0' });
    const m = xyModel({
      h: 0,
      geometry: { kind: 'graph', domain, couplings: { loop: -3 } },
    });
    expect(xyAction(m, [1])).toBe(3);
    expect(xyDifference(m, [1], 0, -2)).toBe(0);
    expect(xyConditional(m, [1], 0).R).toBe(0);
    expect(xyGradient(m, [1])).toEqual([0]);
  });
  it('conditional cancellation, signed h and 120-degree triangle minima', () => {
    const g = xyGraph('chain3', 1),
      m = xyModel({ h: -1, geometry: g });
    expect(xyConditional(m, [0, 0, 0], 0).R).toBe(0);
    const triangle = xyModel({ h: 0, geometry: xyGraph('triangle', -2) });
    for (const sign of [-1, 1]) {
      const angles = [0, (sign * 2 * Math.PI) / 3, (-sign * 2 * Math.PI) / 3];
      expect(xyAction(triangle, angles)).toBeCloseTo(-3, 13);
      expect(
        xyGradient(triangle, angles).every((v) => Math.abs(v) < 1e-14),
      ).toBe(true);
      // Σ pair cos=(|Σ spin|²−3)/2 ≥ −3/2 is an independent lower bound.
      for (let i = 0; i < 101; i++)
        expect(
          xyAction(triangle, [0, wrapXY(i), wrapXY(i * 1.37)]),
        ).toBeGreaterThanOrEqual(-3 - 1e-13);
    }
    expect(triangle.faces).toHaveLength(0);
  });
  for (const periodicX of [false, true])
    for (const periodicY of [false, true])
      it(`indexed faces and physical multiplicity ${periodicX}/${periodicY}`, () => {
        for (const [lx, ly] of [
          [2, 2],
          [3, 4],
          [32, 32],
        ]) {
          const m = xyModel({
            h: 0,
            geometry: {
              kind: 'lattice',
              shape: { lx: lx!, ly: ly!, periodicX, periodicY },
              kx: 0.7,
              ky: -0.2,
            },
          });
          expect(m.bonds).toHaveLength(
            (periodicX ? lx! : lx! - 1) * ly! +
              (periodicY ? ly! : ly! - 1) * lx!,
          );
          expect(m.faces).toHaveLength(
            (periodicX ? lx! : lx! - 1) * (periodicY ? ly! : ly! - 1),
          );
          const incidence = m.bonds.map(() => 0);
          for (const f of m.faces) {
            const walk = f.boundary.map(({ bond, sign }) => {
              const b = m.bonds[bond]!;
              incidence[bond]! += sign;
              return sign === 1 ? [b.tail, b.head] : [b.head, b.tail];
            });
            walk.forEach((w, i) => expect(w[1]).toBe(walk[(i + 1) % 4]![0]));
          }
          if (periodicX && periodicY)
            expect(incidence.every((s) => s === 0)).toBe(true);
          const a = Float64Array.from({ length: m.size }, (_, i) =>
            wrapXY(i * 0.71),
          );
          for (const axis of [0, 1] as const) {
            const series = xySpatial(m, a, axis);
            expect(series[0]!.cosine).toBe(1);
            expect(series).toHaveLength(
              Math.min(8, (axis === 0 ? lx! : ly!) - 1) + 1,
            );
          }
        }
      });
});
describe('principal real lifts and vortex charge, not gauge curvature', () => {
  const positive = [0, Math.PI / 2, -Math.PI / 2, -Math.PI],
    negative = [0, -Math.PI / 2, Math.PI / 2, -Math.PI];
  it('hand fixtures ±1, aligned and smooth zero, opposite orientation', () => {
    const m = xyModel({ h: 0, geometry: xyGraph('square') });
    for (const [a, charge] of [
      [positive, 1],
      [negative, -1],
      [[0, 0, 0, 0], 0],
      [[0, 0.1, 0.2, 0.3], 0],
    ] as const) {
      const v = xyVortices(m, a);
      expect(v.faces[0]!.charge).toBe(charge);
      expect(v.density).toBe(Math.abs(charge));
      const sum = v.faces[0]!.increments.reduce((s, x) => s + x, 0);
      expect(Math.cos(sum)).toBeCloseTo(1, 14);
      expect(Math.sin(sum)).toBeCloseTo(0, 14);
      expect(xyVortices(m, rotateXY(a, 2.1)).faces[0]!.charge).toBe(charge);
      const reversed = {
        ...m,
        faces: m.faces.map((f) => ({
          ...f,
          boundary: [...f.boundary]
            .reverse()
            .map((e) => ({ ...e, sign: -e.sign as 1 | -1 })),
        })),
      };
      expect(xyVortices(reversed, a).faces[0]!.charge).toBe(-charge || 0);
    }
    expect(xyVortices(m, positive).faces[0]!.increments).toEqual(
      Array(4).fill(Math.PI / 2),
    );
  });
  it('torus has balanced nontrivial four-face pattern, eight bonds', () => {
    const m = xyModel({ h: 0, geometry: xyGraph('torus') });
    expect(m.bonds).toHaveLength(8);
    expect(xyVortices(m, positive).faces.map((f) => f.charge)).toEqual([
      1, -1, -1, 1,
    ]);
  });
  it('periodic neutrality for many arbitrary states; open and cylinder boundary terms remain', () => {
    const rng = createRng(12345);
    for (const [periodicX, periodicY] of [
      [true, true],
      [true, false],
      [false, false],
    ]) {
      const m = xyModel({
        h: 0,
        geometry: {
          kind: 'lattice',
          shape: { lx: 4, ly: 5, periodicX: periodicX!, periodicY: periodicY! },
          kx: 1,
          ky: 1,
        },
      });
      let nonzero = false;
      for (let trial = 0; trial < 100; trial++) {
        const a = Float64Array.from(
            { length: m.size },
            () => 2 * Math.PI * rng.uniform() - Math.PI,
          ),
          v = xyVortices(m, a);
        expect(v.ambiguous + v.noninteger).toBe(0);
        if (periodicX && periodicY) expect(v.net).toBe(0);
        else nonzero ||= v.net !== 0;
      }
      if (!periodicY) expect(nonzero).toBe(true);
    }
  });
  it('exact and near antipodal bonds are ambiguous; stored reverse increments are antisymmetric', () => {
    const m = xyModel({ h: 0, geometry: xyGraph('torus') });
    for (const perturbation of [0, -1e-12, 1e-12]) {
      const v = xyVortices(m, [0, wrapXY(Math.PI + perturbation), 0.3, 0.4]);
      expect(v.ambiguous).toBeGreaterThan(0);
      expect(v.density).toBeNull();
      const sum = v.faces
        .flatMap((f) => f.increments)
        .reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(0, 12);
    }
    expect(wrapXY(Math.PI)).toBe(-Math.PI);
  });
  it('global rotation is a single common symmetry; local rotation changes action', () => {
    const m = xyModel({ h: 0, geometry: xyGraph('square') }),
      a = [0, 0.2, -0.4, 0.7];
    const rotated = rotateXY(a, 1.1),
      before = xyObservables(m, a),
      after = xyObservables(m, rotated);
    expect(after.action).toBeCloseTo(before.action!, 13);
    expect(after.mAbs).toBeCloseTo(before.mAbs!, 13);
    expect(after.mx).toBeCloseTo(
      before.mx! * Math.cos(1.1) - before.my! * Math.sin(1.1),
      13,
    );
    const local = [...a];
    local[0] = 1.1;
    expect(xyAction(m, local)).not.toBeCloseTo(xyAction(m, a));
    Array.from(rotateXY(rotated, -1.1)).forEach((v, i) =>
      expect(v).toBeCloseTo(a[i]!, 13),
    );
  });
});

it('pathological periodic 1×4 cell complex keeps self-links and face incidences', () => {
  // Test-only geometry: the teaching UI intentionally starts both axes at 2.
  const domain = {
    id: 'test-1x4',
    name: 'Periodic 1×4',
    vertices: Array.from({ length: 4 }, (_, y) => ({ id: `v${y}` })),
    edges: Array.from({ length: 4 }, (_, y) => [
      { id: `x${y}`, tail: `v${y}`, head: `v${y}`, axis: 0 },
      { id: `y${y}`, tail: `v${y}`, head: `v${(y + 1) % 4}`, axis: 1 },
    ]).flat(),
    faces: Array.from({ length: 4 }, (_, y) => ({
      id: `f${y}`,
      boundary: [
        { edgeId: `x${y}`, sign: 1 as const },
        { edgeId: `y${y}`, sign: 1 as const },
        { edgeId: `x${(y + 1) % 4}`, sign: -1 as const },
        { edgeId: `y${y}`, sign: -1 as const },
      ],
    })),
  };
  const m = xyModel({
    h: 0,
    geometry: {
      kind: 'graph',
      domain,
      couplings: Object.fromEntries(domain.edges.map((e) => [e.id, 0.7])),
    },
  });
  const a = [0, 0.3, -0.5, 1.1],
    b = [...a];
  b[2] = -2;
  expect(m.bonds).toHaveLength(8);
  expect(xyDifference(m, a, 2, b[2]!)).toBeCloseTo(
    xyAction(m, b) - xyAction(m, a),
    12,
  );
  expect(xyVortices(m, a).faces.map((f) => f.charge)).toEqual([0, 0, 0, 0]);
});

it('reports pure vortex-analysis cost separately from rendering and sampler work', () => {
  for (const n of [8, 16, 32]) {
    const m = xyModel({
      h: 0,
      geometry: {
        kind: 'lattice',
        shape: { lx: n, ly: n, periodicX: true, periodicY: true },
        kx: 0.7,
        ky: 0.7,
      },
    });
    const rng = createRng(12345),
      a = Float64Array.from(
        { length: m.size },
        () => 2 * Math.PI * rng.uniform() - Math.PI,
      );
    for (let i = 0; i < 20; i++) xyVortices(m, a);
    const start = performance.now();
    let sum = 0;
    for (let i = 0; i < 500; i++) sum += xyVortices(m, a).net;
    expect(sum).toBe(0);
    console.info(
      `M5e ${n}×${n} vortex analysis: ${(performance.now() - start) / 500} ms/configuration (500 repeats; local JS, no renderer)`,
    );
  }
});
