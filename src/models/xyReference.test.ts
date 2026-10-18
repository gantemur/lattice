import { expect, it } from 'vitest';
import { xyGraph } from '../domain/xyDomain';
import { xyModel } from './xy';
import {
  xyBessel,
  xyConditionalDensity,
  xyReference,
  xyRotorReference,
} from './xyReference';
import { integrateXY, angularQuadrature } from '../test/xyOracle';
for (const h of [0, -0.7, 0.7, -2, 2, -4, 4, -8, 8])
  it(`independent Bessel angular integral at ${h}`, () => {
    for (const n of [0, 1, 2, 5, 12]) {
      let sum = 0;
      for (let j = 0; j < 2048; j++) {
        const a = (2 * Math.PI * (j + 0.5)) / 2048;
        sum += (Math.exp(h * Math.cos(a)) * Math.cos(n * a)) / 2048;
      }
      const b = xyBessel(n, h);
      expect(b.resolved).toBe(true);
      expect(Math.abs(b.value - sum)).toBeLessThan(2e-11);
    }
    if (Math.abs(h) <= 4) {
      const ref = xyRotorReference(h),
        oracle = angularQuadrature(h);
      expect(ref.Z).toBeCloseTo(oracle.Z, 11);
      expect(ref.mean).toBeCloseTo(oracle.x, 12);
      expect(ref.cosineSecond).toBeCloseTo(oracle.second, 12);
    }
  });
it('hand-checked rotor, signed triangle and eight-bond torus anchors', () => {
  expect(xyRotorReference(0.7).Z).toBeCloseTo(1.126303018306809, 13);
  expect(xyRotorReference(0.7).mean).toBeCloseTo(0.330177289532671, 13);
  for (const [g, K, Z] of [
    ['triangle', 0.7, 1.532159015191],
    ['triangle', -0.7, 1.326441767065],
    ['torus', 0.7, 7.069401867411065],
  ] as const) {
    const r = xyReference(xyModel({ h: 0, geometry: xyGraph(g, K) }));
    expect(r.values?.Z).toBeCloseTo(Z, 10);
  }
});
it('periodic 2×2 with zero horizontal coupling retains two independent vertical pairs', () => {
  const ky = 0.7;
  const model = xyModel({
    h: 0,
    geometry: {
      kind: 'lattice',
      shape: { lx: 2, ly: 2, periodicX: true, periodicY: true },
      kx: 0,
      ky,
    },
  });
  expect(model.size).toBe(4);
  expect(model.bonds).toHaveLength(8);
  expect(model.bonds.filter((bond) => bond.axis === 0)).toHaveLength(4);
  expect(model.bonds.filter((bond) => bond.axis === 1)).toHaveLength(4);

  // Each vertical pair has two physical bonds, hence argument 2*ky.
  // Midpoint averages independently integrate the normalized angular measure.
  const quadraturePoints = 2048;
  let i0 = 0,
    i1 = 0;
  for (let j = 0; j < quadraturePoints; j++) {
    const angle = (2 * Math.PI * (j + 0.5)) / quadraturePoints;
    const cosine = Math.cos(angle);
    const weight = Math.exp(2 * ky * cosine);
    i0 += weight;
    i1 += weight * cosine;
  }
  i0 /= quadraturePoints;
  i1 /= quadraturePoints;
  const cosineMean = i1 / i0;

  const reference = xyReference(model);
  expect(['character-sum', 'analytical']).toContain(reference.status);
  expect(reference.values).not.toBeNull();
  expect(Math.abs(reference.values!.Z - i0 ** 2)).toBeLessThan(1e-10);
  expect(reference.values!.bonds).toHaveLength(model.bonds.length);
  model.bonds.forEach((bond, index) => {
    // Independent column rotations make every horizontal cosine mean zero.
    const expected = bond.axis === 1 ? cosineMean : 0;
    expect(Math.abs(reference.values!.bonds[index]! - expected)).toBeLessThan(
      1e-10,
    );
  });
  expect(Math.abs(reference.values!.action + 4 * ky * cosineMean)).toBeLessThan(
    1e-10,
  );
});
for (const geometry of [
  'site',
  'dimer',
  'chain3',
  'triangle',
  'square',
  'torus',
  'ring',
] as const)
  for (const K of [0, -0.7, 0.7])
    it(`${geometry} K=${K}: character/tree versus independent 24→48 angular quadrature`, () => {
      const m = xyModel({ h: 0, geometry: xyGraph(geometry, K) });
      const coarse = integrateXY(m, 24),
        fine = integrateXY(m, 48),
        ref = xyReference(m);
      expect(ref.values).not.toBeNull();
      expect(Math.abs(coarse.Z - fine.Z)).toBeLessThan(1e-9);
      expect(ref.values!.Z).toBeCloseTo(fine.Z, 9);
      expect(ref.values!.action).toBeCloseTo(fine.action, 9);
      ref.values!.bonds.forEach((b, i) =>
        expect(b).toBeCloseTo(fine.bonds[i]!, 10),
      );
      if (K === 0) expect(ref.values!.Z).toBe(1);
    });
for (const h of [-2, 0.7, 4])
  for (const K of [0, -0.7, 0.7])
    it(`field dimer K=${K} h=${h}: controlled quadrature and product law`, () => {
      const m = xyModel({ h, geometry: xyGraph('dimer', K) }),
        r = xyReference(m),
        oracle = integrateXY(m, 192);
      expect(r.status).toBe('quadrature');
      expect(r.values!.Z).toBeCloseTo(oracle.Z, 8);
      expect(r.values!.mx).toBeCloseTo(oracle.mx, 10);
      expect(r.values!.action).toBeCloseTo(oracle.action, 10);
      expect(r.values!.bonds[0]).toBeCloseTo(oracle.bonds[0]!, 10);
      if (K === 0) {
        const one = xyRotorReference(h);
        expect(r.values!.Z).toBeCloseTo(one.Z ** 2, 10);
        expect(r.values!.bonds[0]).toBeCloseTo(one.mean ** 2, 11);
      }
    });
for (const periodicX of [false, true])
  for (const periodicY of [false, true])
    it(`anisotropic signed 2×2 ${periodicX}/${periodicY}: independent 3D integral`, () => {
      const m = xyModel({
        h: 0,
        geometry: {
          kind: 'lattice',
          shape: { lx: 2, ly: 2, periodicX, periodicY },
          kx: -0.9,
          ky: 1.2,
        },
      });
      const ref = xyReference(m),
        a = integrateXY(m, 32),
        b = integrateXY(m, 64);
      expect(Math.abs(a.Z - b.Z)).toBeLessThan(1e-8);
      expect(ref.values!.Z).toBeCloseTo(b.Z, 8);
      ref.values!.bonds.forEach((v, i) =>
        expect(v).toBeCloseTo(b.bonds[i]!, 10),
      );
    });
it('nonuniform signed cycle, self constant, numerical gates and unavailable references', () => {
  const g = xyGraph('square');
  if (g.kind !== 'graph') throw Error();
  g.couplings = { e0: 0, e1: -0.7, e2: 1.2, e3: 0.3 };
  g.domain.edges.push({ id: 'self', tail: 'v0', head: 'v0' });
  g.couplings.self = 0.4;
  const m = xyModel({ h: 0, geometry: g }),
    q = integrateXY(m, 48),
    r = xyReference(m);
  expect(r.values!.Z).toBeCloseTo(q.Z, 10);
  expect(r.values!.bonds[4]).toBe(1);
  expect(
    xyReference(xyModel({ h: 0, geometry: xyGraph('torus', 4) }), {
      maxOrder: 0,
    }).status,
  ).toBe('under-resolved');
  expect(
    xyReference(xyModel({ h: 4, geometry: xyGraph('dimer', 4) }), {
      grids: [4, 8, 16],
    }).status,
  ).toBe('under-resolved');
  expect(
    xyReference(xyModel({ h: 1, geometry: xyGraph('triangle') })).status,
  ).toBe('unavailable');
  expect(xyBessel(0, 8, 1).resolved).toBe(false);
});
for (const R of [0, 0.001, 0.7, 4, 20, 68])
  it(`conditional density normalization/moments at R=${R}`, () => {
    const mu = 3.12,
      oracle = angularQuadrature(R, mu);
    let norm = 0,
      x = 0,
      y = 0;
    for (let i = 0; i < 4096; i++) {
      const a = -Math.PI + (2 * Math.PI * (i + 0.5)) / 4096,
        w = (xyConditionalDensity(a, R, mu) * 2 * Math.PI) / 4096;
      norm += w;
      x += w * Math.cos(a);
      y += w * Math.sin(a);
    }
    expect(norm).toBeCloseTo(1, 11);
    expect(x).toBeCloseTo(oracle.x, 11);
    expect(y).toBeCloseTo(oracle.y, 11);
  });

for (const geometry of ['triangle', 'torus'] as const)
  for (const K of [-4, 4])
    it(`${geometry} at bound K=${K}: signed cancellation gate and independent refined integral`, () => {
      const m = xyModel({ h: 0, geometry: xyGraph(geometry, K) }),
        ref = xyReference(m);
      const coarse = integrateXY(m, 48),
        fine = integrateXY(m, 96);
      expect(Math.abs(coarse.Z / fine.Z - 1)).toBeLessThan(1e-9);
      if (ref.status === 'under-resolved') {
        expect(ref.values).toBeNull();
        expect(ref.error).toBeGreaterThan(1e-10);
      } else {
        expect(Math.abs(ref.values!.Z / fine.Z - 1)).toBeLessThan(1e-9);
        expect(ref.values!.action).toBeCloseTo(fine.action, 8);
        ref.values!.bonds.forEach((v, i) =>
          expect(v).toBeCloseTo(fine.bonds[i]!, 9),
        );
      }
      console.info(
        'M5e reference bound',
        geometry,
        K,
        ref.status,
        ref.resolution,
        ref.error,
        'quadrature relative refinement',
        Math.abs(coarse.Z / fine.Z - 1),
      );
    });
