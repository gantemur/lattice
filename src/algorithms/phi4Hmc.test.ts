import { describe, expect, it } from 'vitest';
import { createFieldLattice } from '../domain/fieldLattice';
import {
  defaultPhi4Field,
  phi4Action,
  phi4Gradient,
} from '../models/phi4Field';
import type { Phi4FieldParameters } from '../models/phi4Field';
import { fieldPrecision } from '../models/gaussianField';
import { spatialQmMapping } from '../models/phi4Reference';
import { quarticPathGradient } from '../models/quarticOscillator';
import { leapfrogQuartic, quarticHmcHamiltonian } from './quarticHmc';
import { hmcPhi4Transition, leapfrogPhi4, phi4HmcHamiltonian } from './phi4Hmc';

const well: Phi4FieldParameters = {
  ...defaultPhi4Field,
  shape: { kind: 'chain', length: 4, periodic: true },
  r: -2,
  lambda: 1,
  kappaX: 1,
  source: 0.3,
};
const x = [0.3, -0.2, 0.7, -0.5],
  p = [0.4, 0.2, -0.3, 0.1];
const tune = { kind: 'hmc' as const, stepSize: 0.06, leapfrogSteps: 12 };
function determinant(matrix: number[][]) {
  const rows = matrix.map((row) => [...row]);
  let det = 1;
  for (let k = 0; k < rows.length; k++) {
    let pivot = k;
    for (let i = k + 1; i < rows.length; i++)
      if (Math.abs(rows[i]![k]!) > Math.abs(rows[pivot]![k]!)) pivot = i;
    if (pivot !== k) {
      [rows[pivot], rows[k]] = [rows[k]!, rows[pivot]!];
      det = -det;
    }
    const diagonal = rows[k]![k]!;
    det *= diagonal;
    if (diagonal === 0) return 0;
    for (let i = k + 1; i < rows.length; i++) {
      const factor = rows[i]![k]! / diagonal;
      for (let j = k + 1; j < rows.length; j++)
        rows[i]![j]! -= factor * rows[k]![j]!;
    }
  }
  return det;
}

describe('spatial identity-mass HMC mechanics', () => {
  it('uses the full force on open, periodic, parallel and anisotropic mixed geometries', () => {
    const shapes: Phi4FieldParameters['shape'][] = [
      { kind: 'chain', length: 2, periodic: true },
      { kind: 'chain', length: 4, periodic: false },
      { kind: 'chain', length: 4, periodic: true },
      { kind: 'rectangle', lx: 2, ly: 2, periodicX: true, periodicY: true },
      { kind: 'rectangle', lx: 2, ly: 3, periodicX: true, periodicY: false },
    ];
    for (const shape of shapes)
      for (const physical of [
        { r: 2, lambda: 0, source: 0.4 },
        { r: 1, lambda: 0.5, source: 0 },
        { r: -2, lambda: 1, source: 0.3 },
      ]) {
        const parameters = {
          ...well,
          ...physical,
          shape,
          kappaY: shape.kind === 'chain' ? 0 : 0.5,
        };
        const lattice = createFieldLattice(shape),
          field = Array.from(
            { length: lattice.size },
            (_, i) => 0.3 * Math.sin(i + 0.2) - 0.1 * i,
          );
        const force = phi4Gradient(lattice, parameters, field);
        for (let i = 0; i < field.length; i++) {
          const plus = [...field],
            minus = [...field],
            h = 1e-5;
          plus[i]! += h;
          minus[i]! -= h;
          const estimate =
            (phi4Action(lattice, parameters, plus) -
              phi4Action(lattice, parameters, minus)) /
            (2 * h);
          expect(Math.abs(force[i]! - estimate)).toBeLessThan(
            1e-7 * Math.max(1, Math.abs(estimate)),
          );
        }
        if (parameters.lambda === 0) {
          const Q = fieldPrecision(lattice, parameters);
          force.forEach((v, i) =>
            expect(v).toBeCloseTo(
              Q[i]!.reduce(
                (sum, q, j) => sum + q * field[j]!,
                -parameters.source,
              ),
              12,
            ),
          );
        }
      }
  });
  it('has a hand-checkable dimer kick, drift and final momentum flip', () => {
    const parameters = {
      ...well,
      shape: { kind: 'chain' as const, length: 2, periodic: true },
      r: -1,
      lambda: 0.5,
      kappaX: 2,
      source: 0,
    };
    const lattice = createFieldLattice(parameters.shape);
    // Two parallel bonds: S(1,-1)=7.25, g=(7.5,-7.5).
    const result = leapfrogPhi4(lattice, parameters, [1, -1], [0.5, -0.5], {
      ...tune,
      stepSize: 0.1,
      leapfrogSteps: 1,
    });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.position).toEqual([1.0125, -1.0125]);
    const force = 7 * 1.0125 + 0.5 * 1.0125 ** 3;
    expect(result.momentum[0]).toBeCloseTo(-(0.125 - 0.05 * force), 14);
    expect(result.gradientEvaluations).toBe(2);
  });
  it('is involutive and agrees with independent backwards integration without input mutation', () => {
    for (const source of [0, 0.3])
      for (const [stepSize, leapfrogSteps] of [
        [0.02, 5],
        [0.05, 8],
        [0.1, 12],
      ] as const) {
        const parameters = { ...well, source },
          lattice = createFieldLattice(parameters.shape),
          settings = { ...tune, stepSize, leapfrogSteps };
        const field = [...x],
          momentum = [...p],
          forward = leapfrogPhi4(
            lattice,
            parameters,
            field,
            momentum,
            settings,
          );
        expect(forward.status).toBe('ok');
        if (forward.status !== 'ok') continue;
        const back = leapfrogPhi4(
          lattice,
          parameters,
          forward.position,
          forward.momentum,
          settings,
        );
        expect(back.status).toBe('ok');
        if (back.status !== 'ok') continue;
        // Undo the flip, then explicitly integrate with -epsilon using ordinary
        // complete velocity-Verlet steps, independent of the combined-kick loop.
        const bx = [...forward.position],
          bp = forward.momentum.map((v) => -v);
        for (let k = 0; k < leapfrogSteps; k++) {
          const g = phi4Gradient(lattice, parameters, bx);
          for (let j = 0; j < bx.length; j++) bp[j]! += (stepSize * g[j]!) / 2;
          for (let j = 0; j < bx.length; j++) bx[j]! -= stepSize * bp[j]!;
          const next = phi4Gradient(lattice, parameters, bx);
          for (let j = 0; j < bx.length; j++)
            bp[j]! += (stepSize * next[j]!) / 2;
        }
        x.forEach((v, j) => {
          expect(back.position[j]).toBeCloseTo(v, 11);
          expect(back.momentum[j]).toBeCloseTo(p[j]!, 11);
          expect(bx[j]).toBeCloseTo(v, 11);
          expect(bp[j]).toBeCloseTo(p[j]!, 11);
        });
        expect(field).toEqual(x);
        expect(momentum).toEqual(p);
        expect(forward.gradientEvaluations).toBe(leapfrogSteps + 1);
      }
  });
  it('preserves absolute volume in an independently differenced dimer phase-space Jacobian', () => {
    const parameters = {
        ...well,
        shape: { kind: 'chain' as const, length: 2, periodic: true },
      },
      lattice = createFieldLattice(parameters.shape),
      z = [0.3, -0.2, 0.4, 0.2],
      h = 1e-5;
    const map = (v: number[]) => {
      const result = leapfrogPhi4(
        lattice,
        parameters,
        v.slice(0, 2),
        v.slice(2),
        tune,
      );
      if (result.status !== 'ok') throw Error('Unexpected divergence');
      return [...result.position, ...result.momentum];
    };
    const J = Array.from({ length: 4 }, () => Array<number>(4).fill(0));
    for (let col = 0; col < 4; col++) {
      const plus = [...z],
        minus = [...z];
      plus[col]! += h;
      minus[col]! -= h;
      const a = map(plus),
        b = map(minus);
      for (let row = 0; row < 4; row++)
        J[row]![col] = (a[row]! - b[row]!) / (2 * h);
    }
    expect(Math.abs(determinant(J))).toBeCloseTo(1, 7);
  });
  it('shows second-order energy defects at fixed auxiliary duration', () => {
    const lattice = createFieldLattice(well.shape);
    const errors = [8, 16, 32].map((L) => {
      const r = leapfrogPhi4(lattice, well, x, p, {
        ...tune,
        stepSize: 0.4 / L,
        leapfrogSteps: L,
      });
      expect(r.status).toBe('ok');
      return r.status === 'ok' ? Math.abs(r.energyErrors.at(-1)!) : NaN;
    });
    for (let k = 0; k < 2; k++) {
      expect(errors[k]! / errors[k + 1]!).toBeGreaterThan(3.5);
      expect(errors[k]! / errors[k + 1]!).toBeLessThan(4.5);
    }
    console.info('Spatial HMC fixed-duration energy defects', errors);
  });
  it('uses complete ΔH, exact draws, real rejection and automatic acceptance', () => {
    const lattice = createFieldLattice(well.shape),
      values = [0.61, 0.12, 0.43, 0.31, 0.72, 0.54, 0.27, 0.81];
    const attempt = (decision: number, stepSize: number) => {
      let draws = 0;
      const result = hmcPhi4Transition(
        lattice,
        well,
        x,
        { ...tune, stepSize },
        { uniform: () => [...values, decision][draws++]! },
      );
      expect(draws).toBe(9);
      expect(result.trace.deltaH).toBe(
        result.trace.proposedHamiltonian! - result.trace.startHamiltonian,
      );
      expect(result.trace.deltaH).not.toBeCloseTo(
        result.trace.proposedAction! - result.trace.startAction,
        5,
      );
      return result;
    };
    const downhill = attempt(0.999, 0.1);
    expect(downhill.trace.deltaH).toBeLessThan(0);
    expect(downhill.trace.acceptanceProbability).toBe(1);
    expect(downhill.trace.accepted).toBe(true);
    const rejected = attempt(0.999, 0.25);
    expect(rejected.trace.deltaH).toBeGreaterThan(0);
    expect(rejected.trace.acceptanceProbability).toBe(
      Math.exp(-rejected.trace.deltaH!),
    );
    expect(rejected.field).toEqual(x);
    expect(rejected.trace.accepted).toBe(false);
    const accepted = attempt(0, 0.25);
    expect(accepted.trace.accepted).toBe(true);
    expect(accepted.field).not.toEqual(x);
  });
  it('rejects overflow with the full draw budget but throws for invalid starting states and settings', () => {
    const lattice = createFieldLattice(well.shape),
      huge = [1e30, 0, 0, 0];
    let draws = 0;
    const result = hmcPhi4Transition(
      lattice,
      well,
      huge,
      { ...tune, stepSize: 0.25, leapfrogSteps: 32 },
      {
        uniform: () => {
          draws++;
          return 0.37;
        },
      },
    );
    expect(draws).toBe(9);
    expect(result.trace.outcome).toBe('divergence');
    expect(result.trace.deltaH).toBeNull();
    expect(result.trace.divergenceReason).toMatch(/overflow/);
    expect(result.field).toEqual(huge);
    for (const [parameters, field, sampler] of [
      [{ ...well, lambda: 0 }, x, tune],
      [well, [NaN, 0, 0, 0], tune],
      [well, [1, 2], tune],
      [well, x, { ...tune, stepSize: 0 }],
    ] as const) {
      draws = 0;
      expect(() =>
        hmcPhi4Transition(lattice, parameters, field, sampler, {
          uniform: () => {
            draws++;
            return 0.5;
          },
        }),
      ).toThrow();
      expect(draws).toBe(0);
    }
  });
  it('counts an overflowing force call as actual work without corrupting the field', () => {
    const lattice = createFieldLattice(well.shape),
      field = [1e70, 0, 0, 0];
    let draws = 0;
    const result = hmcPhi4Transition(
      lattice,
      well,
      field,
      { ...tune, stepSize: 0.25, leapfrogSteps: 32 },
      {
        uniform: () => {
          draws++;
          return 0.37;
        },
      },
    );
    expect(result.trace.outcome).toBe('divergence');
    expect(result.trace.gradientEvaluations).toBe(2);
    expect(result.trace.completedLeapfrogSteps).toBe(0);
    expect(result.field).toEqual(field);
    expect(draws).toBe(9);
  });
  it('matches the mapped QM action, force, proposal and ΔH within summation roundoff', () => {
    const parameters = defaultPhi4Field,
      lattice = createFieldLattice(parameters.shape),
      qm = spatialQmMapping(parameters).parameters!;
    const field = Array.from({ length: 16 }, (_, i) => 0.3 * Math.sin(i) - 0.1),
      momentum = field.map((_, i) => 0.2 * Math.cos(i));
    const a = phi4HmcHamiltonian(lattice, parameters, field, momentum),
      b = quarticHmcHamiltonian(qm, field, momentum);
    expect(a.total).toBeCloseTo(b.total, 12);
    const g = quarticPathGradient(qm, field);
    phi4Gradient(lattice, parameters, field).forEach((v, i) =>
      expect(v).toBeCloseTo(g[i]!, 12),
    );
    const spatial = leapfrogPhi4(lattice, parameters, field, momentum, tune),
      path = leapfrogQuartic(qm, field, momentum, tune);
    expect(spatial.status).toBe('ok');
    expect(path.status).toBe('ok');
    if (spatial.status !== 'ok' || path.status !== 'ok') return;
    spatial.position.forEach((v, i) => {
      expect(v).toBeCloseTo(path.position[i]!, 12);
      expect(spatial.momentum[i]).toBeCloseTo(path.momentum[i]!, 12);
    });
    expect(spatial.energyErrors.at(-1)).toBeCloseTo(
      path.energyErrors.at(-1)!,
      12,
    );
  });
});
