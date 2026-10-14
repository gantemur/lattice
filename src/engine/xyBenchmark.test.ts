import { expect, it } from 'vitest';
import { XYRun, defaultSmallXY, defaultLatticeXY } from './xyRun';
import type { XYConfiguration } from './xyRun';
import { xyGraph } from '../domain/xyDomain';
import type { XYGeometry } from '../domain/xyDomain';
import { xyModel } from '../models/xy';
import { xyReference } from '../models/xyReference';
import { integrateXY, angularQuadrature } from '../test/xyOracle';

// Fixed seeds, budgets and deterministic regression gates are declared before
// observations. These are correlated-chain comparisons, not independent SEs.
const seeds = [17, 271, 12345, 89231];
function advance(run: XYRun, count: number) {
  while (count > 0) {
    const n = Math.min(2048, count);
    run.advance(n);
    count -= n;
  }
}
const cases: { name: string; geometry: XYGeometry; K: number; h: number }[] = [
  ...[0, -0.7, 0.7, -2, 2].map((h) => ({
    name: `rotor h${h}`,
    geometry: 'site' as const,
    K: 0,
    h,
  })),
  ...[0, -0.7, 0.7].map((K) => ({
    name: `dimer K${K}`,
    geometry: 'dimer' as const,
    K,
    h: 0,
  })),
  { name: 'dimer source', geometry: 'dimer', K: 0.7, h: 0.7 },
  ...[-0.7, 0.7].map((K) => ({
    name: `triangle K${K}`,
    geometry: 'triangle' as const,
    K,
    h: 0,
  })),
  { name: 'open square', geometry: 'square', K: 0.7, h: 0 },
  { name: 'periodic torus', geometry: 'torus', K: 0.7, h: 0 },
];
for (const fixture of cases)
  for (const sampler of ['metropolis', 'heat-bath'] as const)
    it(`multiseed XY ${fixture.name}, ${sampler}`, () => {
      const c: XYConfiguration = {
        ...defaultSmallXY,
        parameters: {
          h: fixture.h,
          geometry: xyGraph(fixture.geometry, fixture.K),
        },
        sampler,
        initialization: 'random',
        warmup: 500,
        stride: 4,
        width: 0.8,
      };
      const model = xyModel(c.parameters),
        oracle = integrateXY(model, model.h === 0 ? 48 : 128),
        analytical = xyReference(model);
      expect(analytical.values!.Z).toBeCloseTo(oracle.Z, 8);
      let mx = 0,
        my = 0,
        action = 0,
        bond = 0,
        draws = 0,
        trials = 0;
      const histogram = Array<number>(24).fill(0);
      for (const seed of seeds) {
        const run = new XYRun({ ...c, seed });
        advance(run, model.size * (500 + 4 * 6000));
        const segment = run.snapshot().segments[0]!;
        expect(segment.samples).toBe(6000);
        mx += segment.moments.mx!.mean / 4;
        my += segment.moments.my!.mean / 4;
        action += segment.moments.action!.mean / 4;
        if (segment.bonds.length)
          bond +=
            segment.bonds.reduce((s, b) => s + b.mean, 0) /
            segment.bonds.length /
            4;
        segment.sites[0]!.histogram.forEach((n, i) => {
          histogram[i]! += n / 24000;
        });
        draws += segment.draws;
        trials += segment.trials;
      }
      expect(Math.abs(mx - oracle.mx)).toBeLessThan(0.06);
      expect(Math.abs(my)).toBeLessThan(0.06);
      expect(
        Math.abs(action - oracle.action) /
          Math.max(1, model.bonds.length + model.size * Math.abs(model.h)),
      ).toBeLessThan(0.04);
      if (model.bonds.length)
        expect(
          Math.abs(
            bond - oracle.bonds.reduce((a, b) => a + b, 0) / model.bonds.length,
          ),
        ).toBeLessThan(0.04);
      if (model.size === 1 || model.h === 0) {
        const density = angularQuadrature(model.size === 1 ? model.h : 0);
        histogram.forEach((v, i) =>
          expect(Math.abs(v - density.bins[i]!)).toBeLessThan(0.03),
        );
      }
      console.info(
        'XY_TINY',
        JSON.stringify({
          case: fixture.name,
          sampler,
          seeds,
          warmup: 500,
          stride: 4,
          retained: 24000,
          updates: 4 * model.size * (500 + 4 * 6000),
          width: 0.8,
          mx,
          my,
          action,
          referenceAction: oracle.action,
          bond,
          draws,
          trials,
        }),
      );
    });
for (const [name, kx, ky, h] of [
  ['Haar', 0, 0, 0],
  ['product source', 0, 0, 0.7],
  ['moderate', 0.5, 0.5, 0],
  ['anisotropic', 0.3, 0.8, 0.2],
  ['signed', -0.4, 0.6, 0],
  ['ordered', 1.4, 1.4, 0],
] as const)
  it(`8×8 XY ${name}: product references or independent algorithm consistency`, () => {
    const results: {
      sampler: string;
      mx: number;
      my: number;
      action: number;
      bond: number;
      density: number;
      draws: number;
      trials: number;
    }[] = [];
    for (const sampler of ['metropolis', 'heat-bath'] as const) {
      let mx = 0,
        my = 0,
        action = 0,
        bond = 0,
        density = 0,
        draws = 0,
        trials = 0;
      for (const seed of seeds) {
        const c: XYConfiguration = {
          ...defaultLatticeXY,
          seed,
          sampler,
          width: 1.5,
          warmup: 300,
          stride: 2,
          parameters: {
            h,
            geometry: {
              kind: 'lattice',
              shape: { lx: 8, ly: 8, periodicX: true, periodicY: true },
              kx,
              ky,
            },
          },
        };
        const run = new XYRun(c);
        advance(run, 64 * (300 + 2 * 1500));
        const seg = run.snapshot().segments[0]!;
        mx += seg.moments.mx!.mean / 4;
        my += seg.moments.my!.mean / 4;
        action += seg.moments.actionDensity!.mean / 4;
        bond += seg.moments.bondCosine!.mean / 4;
        density += seg.vortex!.moments.density.mean / 4;
        draws += seg.draws;
        trials += seg.trials;
        expect(seg.vortex!.coverage).toBe(1500);
        expect(seg.vortex!.moments.net.mean).toBe(0);
        if (kx === 0 && ky === 0) {
          const expected = angularQuadrature(h).x ** 2;
          for (const curve of [seg.spatialX, seg.spatialY])
            for (const p of curve)
              expect(
                Math.abs(p.moments.mean - (p.r === 0 ? 1 : expected)),
              ).toBeLessThan(0.04);
        }
      }
      if (kx === 0 && ky === 0) {
        const exact = angularQuadrature(h);
        expect(Math.abs(mx - exact.x)).toBeLessThan(0.02);
        expect(Math.abs(my)).toBeLessThan(0.02);
        expect(Math.abs(bond - exact.x ** 2)).toBeLessThan(0.02);
      }
      if (name === 'ordered') expect(density).toBeLessThan(0.04);
      if (name === 'Haar') expect(density).toBeGreaterThan(0.25);
      results.push({ sampler, mx, my, action, bond, density, draws, trials });
    }
    expect(Math.abs(results[0]!.action - results[1]!.action)).toBeLessThan(
      0.08,
    );
    expect(Math.abs(results[0]!.bond - results[1]!.bond)).toBeLessThan(0.04);
    expect(Math.abs(results[0]!.density - results[1]!.density)).toBeLessThan(
      0.03,
    );
    console.info(
      'XY_LARGE',
      JSON.stringify({
        name,
        kx,
        ky,
        h,
        seeds,
        size: '8×8',
        warmup: 300,
        stride: 2,
        retained: 6000,
        updates: 4 * 64 * (300 + 2 * 1500),
        width: 1.5,
        results,
      }),
    );
  }, 30000);
