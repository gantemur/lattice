import { describe, expect, it } from 'vitest';
import { createFieldLattice } from '../domain/fieldLattice';
import { fieldPrecision } from '../models/gaussianField';
import {
  quarticPathAction,
  quarticPathGradient,
  quarticQuadraticPart,
} from '../models/quarticOscillator';
import type { QuarticOscillatorParameters } from '../models/quarticOscillator';
import {
  hmcQuarticTransition,
  leapfrogQuartic,
  quarticHmcHamiltonian,
} from './quarticHmc';

const well: QuarticOscillatorParameters = {
  sites: 4,
  beta: 4,
  r: -2,
  lambda: 1,
  h: 0.3,
};
const path = [0.3, -0.2, 0.7, -0.5];
const momentum = [0.4, 0.2, -0.3, 0.1];

function finiteDifference(
  p: QuarticOscillatorParameters,
  x: number[],
  site: number,
) {
  // Centered difference of the full action, independent of the force formula.
  const scale = Math.max(1, Math.abs(x[site]!));
  const displacement = 1e-5 * scale;
  const plus = [...x];
  const minus = [...x];
  plus[site]! += displacement;
  minus[site]! -= displacement;
  return (
    (quarticPathAction(p, plus) - quarticPathAction(p, minus)) /
    (2 * displacement)
  );
}

function determinant(matrix: number[][]) {
  // Independent Gaussian elimination for the finite-difference Jacobian.
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

describe('quartic HMC mathematical kernel', () => {
  it('has a hand-checkable four-site force with the closing bond and tilt', () => {
    const x = [0, 1, -1, 2];
    expect(quarticPathGradient(well, x)).toEqual([-3.3, 1.7, -4.3, 8.7]);
  });

  it('matches centered full-action differences across Gaussian, wells and time spacings', () => {
    for (const p of [
      { sites: 4, beta: 2, r: 1, lambda: 0, h: 0.4 },
      well,
      { sites: 6, beta: 12, r: -3, lambda: 2, h: -0.6 },
      { sites: 8, beta: 4, r: 2, lambda: 0.5, h: 0 },
    ]) {
      const x = Array.from(
        { length: p.sites },
        (_, j) => 0.2 * Math.sin(1.3 * j) - 0.1 * j,
      );
      const gradient = quarticPathGradient(p, x);
      for (let j = 0; j < p.sites; j++) {
        const estimate = finiteDifference(p, x, j);
        // Centered differencing balances O(d²) truncation against
        // cancellation; a relative scale avoids privileging small forces.
        expect(Math.abs(gradient[j]! - estimate)).toBeLessThanOrEqual(
          1e-7 * Math.max(1, Math.abs(estimate)),
        );
      }
    }
  });

  it('agrees with the independent Gaussian precision matrix at λ=0', () => {
    const p = { sites: 4, beta: 3, r: 1.5, lambda: 0, h: 0.4 };
    const coefficients = quarticQuadraticPart(p);
    const Q = fieldPrecision(
      createFieldLattice(coefficients.shape),
      coefficients,
    );
    const x = [0.3, -0.5, 0.7, 0.2];
    quarticPathGradient(p, x).forEach((value, i) =>
      expect(value).toBeCloseTo(
        Q[i]!.reduce((sum, q, j) => sum + q * x[j]!, -coefficients.source),
        12,
      ),
    );
  });

  it('is reversible for interacting and asymmetric paths without mutating inputs', () => {
    for (const p of [well, { ...well, h: 0 }]) {
      for (const [stepSize, leapfrogSteps] of [
        [0.02, 5],
        [0.05, 8],
        [0.1, 12],
      ] as const) {
        const x = [...path];
        const mom = [...momentum];
        const sampler = { kind: 'hmc' as const, stepSize, leapfrogSteps };
        const forward = leapfrogQuartic(p, x, mom, sampler);
        expect(forward.status).toBe('ok');
        if (forward.status !== 'ok') continue;
        const backward = leapfrogQuartic(
          p,
          forward.position,
          forward.momentum,
          sampler,
        );
        expect(backward.status).toBe('ok');
        if (backward.status !== 'ok') continue;
        forward.position.forEach((_, j) => {
          expect(backward.position[j]!).toBeCloseTo(x[j]!, 11);
          expect(backward.momentum[j]!).toBeCloseTo(mom[j]!, 11);
        });
        expect(x).toEqual(path);
        expect(mom).toEqual(momentum);
        expect(forward.gradientEvaluations).toBe(leapfrogSteps + 1);
        expect(forward.energyErrors).toHaveLength(leapfrogSteps);
      }
    }
  });

  it('preserves phase-space volume for a finite-difference 8×8 Jacobian', () => {
    const z = [...path, ...momentum];
    const sampler = { kind: 'hmc' as const, stepSize: 0.02, leapfrogSteps: 3 };
    function map(input: number[]) {
      const result = leapfrogQuartic(
        well,
        input.slice(0, 4),
        input.slice(4),
        sampler,
      );
      if (result.status !== 'ok') throw new Error('Unexpected divergence.');
      return [...result.position, ...result.momentum];
    }
    const displacement = 1e-5;
    const jacobian = Array.from({ length: 8 }, () => Array<number>(8).fill(0));
    for (let column = 0; column < 8; column++) {
      const plus = [...z];
      const minus = [...z];
      plus[column]! += displacement;
      minus[column]! -= displacement;
      const fPlus = map(plus);
      const fMinus = map(minus);
      for (let row = 0; row < 8; row++)
        jacobian[row]![column] =
          (fPlus[row]! - fMinus[row]!) / (2 * displacement);
    }
    expect(Math.abs(determinant(jacobian))).toBeCloseTo(1, 7);
  });

  it('shows second-order global energy-defect scaling at fixed MD duration', () => {
    const errors = [8, 16, 32].map((leapfrogSteps) => {
      const result = leapfrogQuartic(well, path, momentum, {
        kind: 'hmc',
        stepSize: 0.4 / leapfrogSteps,
        leapfrogSteps,
      });
      expect(result.status).toBe('ok');
      return result.status === 'ok'
        ? Math.abs(result.energyErrors.at(-1)!)
        : NaN;
    });
    // At fixed τ, a second-order method approaches a fourfold reduction.
    expect(errors[0]! / errors[1]!).toBeGreaterThan(3.5);
    expect(errors[0]! / errors[1]!).toBeLessThan(4.5);
    expect(errors[1]! / errors[2]!).toBeGreaterThan(3.5);
    expect(errors[1]! / errors[2]!).toBeLessThan(4.5);
  });

  it('uses complete augmented ΔH, consumes 2N+1 uniforms and preserves rejected paths', () => {
    const uniforms = [0.61, 0.12, 0.43, 0.31, 0.72, 0.54, 0.27, 0.81, 0.999];
    function attempt(decision: number, stepSize = 0.1) {
      let draws = 0;
      const values = [...uniforms.slice(0, 8), decision];
      const result = hmcQuarticTransition(
        well,
        path,
        {
          kind: 'hmc',
          stepSize,
          leapfrogSteps: 12,
        },
        { uniform: () => values[draws++]! },
      );
      expect(draws).toBe(9);
      expect(result.trace.decisionUniform).toBe(decision);
      expect(result.trace.deltaH).toBeCloseTo(
        result.trace.proposedHamiltonian! - result.trace.startHamiltonian,
        12,
      );
      expect(result.trace.deltaH).not.toBeCloseTo(
        result.trace.proposedAction! - result.trace.startAction,
        5,
      );
      return result;
    }
    const accepted = attempt(0);
    expect(accepted.trace.accepted).toBe(true);
    expect(accepted.field).not.toEqual(path);
    const downhill = attempt(0.999);
    expect(downhill.trace.deltaH).toBeLessThan(0);
    expect(downhill.trace.acceptanceProbability).toBe(1);
    expect(downhill.trace.accepted).toBe(true);
    const rejected = attempt(0.999, 0.25);
    expect(rejected.trace.deltaH).toBeGreaterThan(0);
    expect(rejected.trace.acceptanceProbability).toBeCloseTo(
      Math.exp(-rejected.trace.deltaH!),
      12,
    );
    expect(rejected.trace.accepted).toBe(false);
    expect(rejected.field).toEqual(path);
  });

  it('rejects numerical divergence after the same uniform budget', () => {
    const huge = [1e30, 0, 0, 0];
    let draws = 0;
    const result = hmcQuarticTransition(
      well,
      huge,
      { kind: 'hmc', stepSize: 0.25, leapfrogSteps: 32 },
      {
        uniform: () => {
          draws++;
          return 0.37;
        },
      },
    );
    expect(draws).toBe(9);
    expect(result.trace.outcome).toBe('divergence');
    expect(result.trace.accepted).toBe(false);
    expect(result.trace.deltaH).toBeNull();
    expect(result.field).toEqual(huge);
  });

  it('refreshes momentum independently on the next trajectory', () => {
    const values = [...Array(8).fill(0.5), 0, ...Array(8).fill(0.2), 0];
    let draws = 0;
    const rng = { uniform: () => values[draws++]! };
    const sampler = { kind: 'hmc' as const, stepSize: 0.05, leapfrogSteps: 4 };
    const first = hmcQuarticTransition(well, path, sampler, rng);
    const second = hmcQuarticTransition(well, first.field, sampler, rng);
    expect(draws).toBe(18);
    expect(first.trace.startKinetic).not.toBe(second.trace.startKinetic);
  });

  it('rejects invalid settings, momentum shape and nonfinite force', () => {
    expect(() =>
      leapfrogQuartic(well, path, momentum, {
        kind: 'hmc',
        stepSize: 0.001,
        leapfrogSteps: 4,
      }),
    ).toThrow(/step size/);
    expect(() => quarticHmcHamiltonian(well, path, [1, 2])).toThrow(/momentum/);
    expect(() => quarticPathGradient(well, [1, 2, Infinity, 4])).toThrow(
      /finite/,
    );
  });
});
