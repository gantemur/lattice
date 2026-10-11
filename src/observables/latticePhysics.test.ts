import { describe, expect, it } from 'vitest';
import { createIndexedLattice } from '../domain/indexedLattice';
import { exactLatticeTwoByTwo } from '../models/latticeExact';
import type { LatticeParameters } from '../models/latticeIsing';
import { LatticeRun } from '../engine/latticeRun';
import {
  axialProducts,
  bondProducts,
  equilibriumFluctuations,
} from './latticePhysics';

const base: LatticeParameters = {
  lx: 2,
  ly: 2,
  periodicX: true,
  periodicY: true,
  jx: 1.25,
  jy: -0.7,
  field: 0.3,
  temperature: 1.8,
};

describe('lattice physical observables', () => {
  it.each([
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ])(
    'matches an independent 16-state coordinate enumeration for boundaries %s/%s',
    (periodicX, periodicY) => {
      const p = { ...base, periodicX, periodicY };
      const result = exactLatticeTwoByTwo(p);
      const states = Array.from({ length: 16 }, (_, code) => {
        const s = Array.from({ length: 4 }, (_, i) =>
          code & (1 << i) ? 1 : -1,
        );
        let sx = 0,
          sy = 0;
        for (let y = 0; y < 2; y++)
          for (let x = 0; x < 2; x++) {
            const i = x + 2 * y;
            if (x === 0 || periodicX) sx += s[i]! * s[1 - x + 2 * y]!;
            if (y === 0 || periodicY) sy += s[i]! * s[x + 2 * (1 - y)]!;
          }
        const m = s.reduce((sum, v) => sum + v, 0) / 4;
        const e = (-p.jx * sx - p.jy * sy - 4 * p.field * m) / 4;
        return {
          m,
          e,
          gx: sx / (periodicX ? 4 : 2),
          gy: sy / (periodicY ? 4 : 2),
        };
      });
      const weight = states.map(({ e }) => Math.exp((-4 * e) / p.temperature));
      const Z = weight.reduce((a, b) => a + b, 0);
      const average = (f: (s: (typeof states)[number]) => number) =>
        states.reduce((sum, s, i) => sum + weight[i]! * f(s), 0) / Z;
      const meanM = average((s) => s.m),
        meanE = average((s) => s.e);
      expect(result.meanM).toBeCloseTo(meanM, 12);
      expect(result.fourthM).toBeCloseTo(
        average((s) => s.m ** 4),
        12,
      );
      expect(result.meanGx).toBeCloseTo(
        average((s) => s.gx),
        12,
      );
      expect(result.meanGy).toBeCloseTo(
        average((s) => s.gy),
        12,
      );
      expect(result.susceptibility).toBeCloseTo(
        (4 * average((s) => (s.m - meanM) ** 2)) / p.temperature,
        12,
      );
      expect(result.specificHeat).toBeCloseTo(
        (4 * average((s) => (s.e - meanE) ** 2)) / p.temperature ** 2,
        12,
      );
      expect(result.binder).toBeCloseTo(
        1 - average((s) => s.m ** 4) / (3 * average((s) => s.m ** 2) ** 2),
        12,
      );
    },
  );

  it('retains periodic length-two parallel bonds and normalizes open pairs', () => {
    const spins = Int8Array.from([1, -1, 1, -1]);
    const torus = createIndexedLattice(base);
    const open = createIndexedLattice({
      ...base,
      periodicX: false,
      periodicY: false,
    });
    expect([torus.horizontalBonds, torus.verticalBonds]).toEqual([4, 4]);
    expect(bondProducts(torus, spins)).toEqual({ x: -1, y: 1 });
    expect(bondProducts(open, spins)).toEqual({ x: -1, y: 1 });
    expect(axialProducts(torus, spins, 'x')[1]).toEqual({
      r: 1,
      pairs: 4,
      value: -1,
    });
    expect(axialProducts(open, spins, 'x')[1]).toEqual({
      r: 1,
      pairs: 2,
      value: -1,
    });
  });

  it('reports an unusable Binder denominator explicitly', () => {
    expect(equilibriumFluctuations(4, 2, 0, 0, 0, 0)).toEqual({
      susceptibility: 0,
      binder: null,
      specificHeat: 0,
    });
    expect(() => equilibriumFluctuations(4, 2, 0, 0, -0.1, 0)).toThrow();
  });

  it('records fourth moments and spatial products only on retained measurements', () => {
    const run = new LatticeRun(1, {
      parameters: { ...base },
      sampler: 'metropolis',
      warmupSweeps: 1,
      strideSweeps: 1,
      seed: 4,
      initialization: 'plus',
    });
    run.advance(4);
    expect(run.snapshot().segments[0]!.samples).toBe(0);
    run.advance(4);
    const s = run.snapshot().segments[0]!;
    expect(s.samples).toBe(1);
    expect(s.m4.mean).toBeCloseTo(s.m.mean! ** 4, 12);
    expect(s.gx.count).toBe(1);
    expect(s.gy.count).toBe(1);
    expect(s.spatialX[1]!.moments.mean).toBe(s.gx.mean);
    expect(s.spatialY[1]!.moments.mean).toBe(s.gy.mean);
  });
});
