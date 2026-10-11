import { describe, expect, it } from 'vitest';
import { createIndexedLattice } from '../domain/indexedLattice';
import { graphPreset } from '../domain/graph';
import {
  conditionalPlus,
  exactIsing,
  flipDifference,
  isingAction,
  spinAt,
} from './ising';
import type { IsingModel } from './ising';
import {
  criticalTemperature,
  flipEnergy,
  localField,
  plusProbability,
  totalEnergy,
} from './latticeIsing';
import type { LatticeParameters } from './latticeIsing';
import { createRng } from '../algorithms/rng';
import { latticeTransition } from '../algorithms/latticeTransition';

function parameters(periodicX: boolean, periodicY: boolean): LatticeParameters {
  return {
    lx: 2,
    ly: 2,
    periodicX,
    periodicY,
    jx: -0.7,
    jy: 1.3,
    field: 0.2,
    temperature: 2.4,
  };
}
function finiteModel(p: LatticeParameters): IsingModel {
  const domain = graphPreset(p.periodicX ? 'torus' : 'square');
  return {
    kind: 'ising',
    parameters: {
      domain,
      couplings: Object.fromEntries(
        domain.edges.map((e) => [
          e.id,
          (e.axis === 0 ? p.jx : p.jy) / p.temperature,
        ]),
      ),
      fields: Object.fromEntries(
        domain.vertices.map((v) => [v.id, p.field / p.temperature]),
      ),
    },
  };
}
describe('indexed Ising lattice', () => {
  it('counts open, cylindrical and periodic bonds, preserving parallel length-two records', () => {
    for (const [x, y, expectedX, expectedY] of [
      [false, false, 8, 9],
      [true, false, 12, 9],
      [false, true, 8, 12],
      [true, true, 12, 12],
    ] as const) {
      const l = createIndexedLattice({
        lx: 3,
        ly: 4,
        periodicX: x,
        periodicY: y,
      });
      expect([l.horizontalBonds, l.verticalBonds]).toEqual([
        expectedX,
        expectedY,
      ]);
    }
    const torus = createIndexedLattice({
      lx: 2,
      ly: 2,
      periodicX: true,
      periodicY: true,
    });
    expect([
      torus.horizontalBonds,
      torus.verticalBonds,
      torus.tails.length,
    ]).toEqual([4, 4, 8]);
    expect([...torus.degree]).toEqual([4, 4, 4, 4]);
    expect([...torus.neighbors.slice(0, 4)].sort()).toEqual([1, 1, 2, 2]);
  });
  it.each([false, true])(
    'agrees with independently enumerated M1a 2×2 for periodic=%s',
    (periodic) => {
      const p = parameters(periodic, periodic),
        l = createIndexedLattice(p),
        model = finiteModel(p);
      const actions: number[] = [];
      for (let code = 0; code < 16; code++) {
        const spins = Int8Array.from({ length: 4 }, (_, i) => spinAt(code, i));
        const action = totalEnergy(l, p, spins) / p.temperature;
        actions.push(action);
        expect(action).toBeCloseTo(isingAction(model, code), 12);
        for (let site = 0; site < 4; site++) {
          expect(flipEnergy(l, p, spins, site) / p.temperature).toBeCloseTo(
            flipDifference(model, code, site),
            12,
          );
          expect(
            plusProbability(localField(l, p, spins, site) / p.temperature),
          ).toBeCloseTo(conditionalPlus(model, code, site), 12);
          const flipped = spins.slice();
          flipped[site] = -flipped[site]!;
          expect(
            totalEnergy(l, p, flipped) - totalEnergy(l, p, spins),
          ).toBeCloseTo(flipEnergy(l, p, spins, site), 12);
        }
      }
      const offset = Math.min(...actions),
        logZ =
          Math.log(actions.reduce((sum, a) => sum + Math.exp(offset - a), 0)) -
          offset;
      expect(logZ).toBeCloseTo(exactIsing(model).logPartition, 12);
    },
  );
  it('matches complete energy after long signed anisotropic random trajectories', () => {
    const p: LatticeParameters = { ...parameters(true, false), lx: 16, ly: 13 };
    const l = createIndexedLattice(p),
      spins = Int8Array.from({ length: l.size }, () => 1),
      rng = createRng(991);
    let energy = totalEnergy(l, p, spins),
      m = l.size;
    for (let i = 1; i <= 30000; i++) {
      const t = latticeTransition(
        l,
        p,
        i % 2 ? 'metropolis' : 'heat-bath',
        spins,
        rng,
        i,
        false,
      );
      if (t.oldSpin !== t.newSpin) {
        energy += t.deltaH;
        m -= 2 * t.oldSpin;
      }
      if (i % 971 === 0) {
        expect(energy).toBeCloseTo(totalEnergy(l, p, spins), 7);
        expect(m).toBe([...spins].reduce((a, b) => a + b, 0));
      }
    }
  });
  it('satisfies conditional detailed balance and finite-state stationarity', () => {
    const p = parameters(true, true),
      l = createIndexedLattice(p),
      exact = exactIsing(finiteModel(p));
    for (const sampler of ['metropolis', 'heat-bath'] as const) {
      const matrix = Array.from(
        { length: 16 },
        () => Array(16).fill(0) as number[],
      );
      for (let code = 0; code < 16; code++)
        for (let site = 0; site < 4; site++) {
          const spins = Int8Array.from({ length: 4 }, (_, i) =>
            spinAt(code, i),
          );
          const flipped = code ^ (1 << site),
            old = spins[site]!;
          const field = localField(l, p, spins, site);
          const change =
            sampler === 'metropolis'
              ? 0.5 *
                Math.exp(
                  Math.min(0, -flipEnergy(l, p, spins, site) / p.temperature),
                )
              : old === 1
                ? 1 - plusProbability(field / p.temperature)
                : plusProbability(field / p.temperature);
          matrix[code]![flipped]! += change / 4;
          matrix[code]![code]! += (1 - change) / 4;
        }
      for (let a = 0; a < 16; a++) {
        expect(matrix[a]!.reduce((x, y) => x + y, 0)).toBeCloseTo(1, 12);
        for (let b = 0; b < 16; b++)
          expect(exact.probabilities[a]! * matrix[a]![b]!).toBeCloseTo(
            exact.probabilities[b]! * matrix[b]![a]!,
            12,
          );
        expect(
          exact.probabilities.reduce(
            (sum, p, i) => sum + p * matrix[i]![a]!,
            0,
          ),
        ).toBeCloseTo(exact.probabilities[a]!, 12);
      }
    }
  });
  it('applies theoretical Tc only within the ferromagnetic zero-field 2D domain', () => {
    const p = { ...parameters(true, true), jx: 1, jy: 1, field: 0 };
    expect(criticalTemperature(p)).toBeCloseTo(
      2 / Math.log(1 + Math.sqrt(2)),
      10,
    );
    expect(criticalTemperature({ ...p, jy: 2 })).toBeGreaterThan(
      criticalTemperature(p)!,
    );
    expect(criticalTemperature({ ...p, field: 0.01 })).toBeNull();
    expect(criticalTemperature({ ...p, jx: -1 })).toBeNull();
  });
  it('retains finite-volume spin-flip symmetry at zero field', () => {
    const p = { ...parameters(true, true), field: 0 };
    const exact = exactIsing(finiteModel(p));
    const mean = exact.probabilities.reduce(
      (sum, probability, code) =>
        sum +
        (probability *
          Array.from({ length: 4 }, (_, i) => spinAt(code, i)).reduce(
            (a, b) => a + b,
            0,
          )) /
          4,
      0,
    );
    expect(mean).toBeCloseTo(0, 12);
    for (let code = 0; code < 8; code++)
      expect(exact.probabilities[code]).toBeCloseTo(
        exact.probabilities[15 - code]!,
        12,
      );
  });
});
