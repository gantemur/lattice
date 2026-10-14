import { expect, it } from 'vitest';
import {
  circularDifference,
  conjugatePhase,
  linkPhases,
  multiplyPhase,
  phase,
  plaquetteAngles,
  plaquettePhases,
  u1Action,
  u1GaugeModel,
  u1GaugeTransform,
  u1Gradient,
  u1LocalDifference,
  u1Observables,
  validateAngles,
  wilsonPhase,
  wrapAngle,
} from './u1Gauge';
import type { Phase } from './u1Gauge';
const closePhase = (a: Phase, b: Phase) => {
  expect(a.re).toBeCloseTo(b.re, 12);
  expect(a.im).toBeCloseTo(b.im, 12);
};
it('canonical branch, circular differences and nontrivial inversion', () => {
  for (const a of [-Math.PI, Math.PI, 3 * Math.PI, -3 * Math.PI])
    expect(wrapAngle(a)).toBe(-Math.PI);
  expect(wrapAngle(-0)).toBe(0);
  expect(circularDifference(Math.PI - 1e-8, -Math.PI + 1e-8)).toBeCloseTo(
    -2e-8,
    14,
  );
  expect(() => wrapAngle(Infinity)).toThrow();
  closePhase(phase(-0.71), conjugatePhase(phase(0.71)));
  expect(phase(0.71).im).toBeGreaterThan(0.6);
  closePhase(multiplyPhase(phase(0.71), phase(-0.71)), { re: 1, im: 0 });
});
for (const geometry of ['square', 'torus'] as const) {
  it(`${geometry}: independent complex products detect incorrect orientation`, () => {
    const m = u1GaugeModel(geometry, 0.7),
      angles = m.domain.edges.map((_, i) => wrapAngle(0.23 + i * 0.71));
    expect(angles).toHaveLength(geometry === 'square' ? 4 : 8);
    expect(m.domain.faces).toHaveLength(geometry === 'square' ? 1 : 4);
    expect(new Set(m.domain.edges.map((e) => e.id)).size).toBe(angles.length);
    expect(m.domain.edges.filter((e) => e.wraps)).toHaveLength(
      geometry === 'square' ? 0 : 4,
    );
    expect(() =>
      validateAngles(
        m,
        angles.map(() => Math.PI),
      ),
    ).toThrow();
    expect(() => validateAngles(m, [NaN])).toThrow();
    linkPhases(m, angles).forEach((p, i) => closePhase(p, phase(angles[i]!)));
    for (const loop of m.loops) {
      // Oracle multiplies complex numbers occurrence by occurrence; it does not
      // use production phase addition or the precomputed incidence matrix.
      let re = 1,
        im = 0;
      for (const edge of loop.boundary) {
        const theta = angles[Number(edge.edgeId.slice(1))]! * edge.sign;
        const c = Math.cos(theta),
          s = Math.sin(theta);
        [re, im] = [re * c - im * s, re * s + im * c];
      }
      const p = wilsonPhase(m, angles, loop.boundary);
      closePhase(p, { re, im });
      const reverse = [...loop.boundary]
        .reverse()
        .map((e) => ({ ...e, sign: -e.sign as 1 | -1 }));
      closePhase(wilsonPhase(m, angles, reverse), conjugatePhase(p));
    }
    if (geometry === 'torus') {
      const p = plaquettePhases(m, angles);
      closePhase(p.reduce(multiplyPhase, { re: 1, im: 0 }), { re: 1, im: 0 });
      closePhase(
        wilsonPhase(m, angles, m.loops.find((l) => l.id === 'pair')!.boundary),
        multiplyPhase(p[0]!, p[1]!),
      );
      for (const [id, a, b] of [
        ['wx', 0, 2],
        ['wy', 1, 5],
      ] as const)
        closePhase(
          wilsonPhase(m, angles, m.loops.find((l) => l.id === id)!.boundary),
          phase(angles[a]! + angles[b]!),
        );
    }
  });
  for (const K of [-4, -0.7, 0, 0.7, 4])
    it(`${geometry} K=${K}: full actions, branch-crossing differences and gradient`, () => {
      const m = u1GaugeModel(geometry, K),
        angles = m.domain.edges.map((_, i) => wrapAngle(3.05 - i * 0.71));
      // Hand-checkable θ_e0=π/2 and all others zero: one open face or two
      // periodic faces have cos=0; remaining torus faces have cos=1.
      const simple = angles.map((_, i) => (i === 0 ? Math.PI / 2 : 0));
      expect(u1Action(m, simple)).toBeCloseTo(
        geometry === 'square' ? 0 : -2 * K,
        12,
      );
      const gradient = u1Gradient(m, angles);
      for (const [e, edge] of m.domain.edges.entries()) {
        for (const delta of [-2.7, -0.2, 0.8, Math.PI]) {
          const after = [...angles];
          after[e] = wrapAngle(after[e]! + delta);
          expect(u1LocalDifference(m, angles, edge.id, delta)).toBeCloseTo(
            u1Action(m, after) - u1Action(m, angles),
            11,
          );
        }
        const plus = [...angles],
          minus = [...angles],
          h = 1e-5;
        plus[e] = wrapAngle(plus[e]! + h);
        minus[e] = wrapAngle(minus[e]! - h);
        expect(gradient[e]).toBeCloseTo(
          (u1Action(m, plus) - u1Action(m, minus)) / (2 * h),
          8,
        );
      }
    });
  it(`${geometry}: gauge invariance, composition, inverse and uniform vertex phase`, () => {
    const m = u1GaugeModel(geometry, -0.7);
    for (let fixture = 0; fixture < 32; fixture++) {
      const angles = m.domain.edges.map((_, i) =>
        wrapAngle(0.3 + Math.sin(fixture + i) * 8),
      );
      const a = Object.fromEntries(
        m.domain.vertices.map((v, i) => [v.id, Math.cos(fixture + i) * 2.9]),
      );
      const b = Object.fromEntries(
        m.domain.vertices.map((v, i) => [v.id, Math.sin(fixture - i) * 2.1]),
      );
      const transformed = u1GaugeTransform(m, angles, a);
      const before = u1Observables(m, angles),
        after = u1Observables(m, transformed);
      for (const id of Object.keys(before))
        expect(after[id]).toBeCloseTo(before[id]!, 12);
      const inverse = u1GaugeTransform(
        m,
        transformed,
        Object.fromEntries(Object.entries(a).map(([v, x]) => [v, -x])),
      );
      const composed = u1GaugeTransform(m, transformed, b);
      const combined = u1GaugeTransform(
        m,
        angles,
        Object.fromEntries(
          m.domain.vertices.map((v) => [v.id, a[v.id]! + b[v.id]!]),
        ),
      );
      const uniform = u1GaugeTransform(m, angles, {
        v0: 1.73,
        v1: 1.73,
        v2: 1.73,
        v3: 1.73,
      });
      angles.forEach((angle, e) => {
        expect(circularDifference(inverse[e]!, angle)).toBeCloseTo(0, 12);
        expect(circularDifference(uniform[e]!, angle)).toBeCloseTo(0, 12);
        expect(circularDifference(composed[e]!, combined[e]!)).toBeCloseTo(
          0,
          12,
        );
      });
    }
    expect(() =>
      u1GaugeTransform(m, Array(m.domain.edges.length).fill(0), { v9: 1 }),
    ).toThrow();
  });
}
it('global torus constraint is modulo 2π, not literal principal-angle sum zero', () => {
  const m = u1GaugeModel('torus', 1);
  // Four plaquette angles π/2: their sum is 2π while their product is one.
  const a = [0, 0, 0, Math.PI / 2, 0, -Math.PI, Math.PI / 2, Math.PI / 2];
  const faces = plaquetteAngles(m, a);
  expect(Math.abs(faces.reduce((s, x) => s + x, 0))).toBeCloseTo(
    2 * Math.PI,
    12,
  );
  closePhase(plaquettePhases(m, a).reduce(multiplyPhase, { re: 1, im: 0 }), {
    re: 1,
    im: 0,
  });
});
it('invalid models and local requests fail before mutation', () => {
  for (const K of [NaN, Infinity, 4.01])
    expect(() => u1GaugeModel('square', K)).toThrow();
  expect(() => u1GaugeModel('ring' as 'square', 1)).toThrow();
  const m = u1GaugeModel('square', 1);
  expect(() => u1LocalDifference(m, [0, 0, 0, 0], 'e8', 1)).toThrow();
});
