import type { Rng } from './rng';
import { standardNormal } from './normalDraw';
import { leapfrog, validateHmcSampler } from './leapfrog';
import type { HmcSampler, LeapfrogResult, HmcTrace } from './leapfrog';
import type { FieldLattice } from '../domain/fieldLattice';
import type { Phi4FieldParameters } from '../models/phi4Field';
import {
  phi4Action,
  phi4Gradient,
  Phi4ArithmeticError,
} from '../models/phi4Field';

/** Dimensionless auxiliary H=S_spatial+Σp²/2, with identity mass.
 * No beta, Euclidean spacing, physical momentum or zero-mode projection. */
export function phi4HmcHamiltonian(
  lattice: FieldLattice,
  parameters: Phi4FieldParameters,
  position: readonly number[],
  momentum: readonly number[],
) {
  const action = phi4Action(lattice, parameters, position);
  if (
    momentum.length !== lattice.size ||
    momentum.some((value) => !Number.isFinite(value))
  )
    throw new Error('HMC momentum must have V finite values.');
  let kinetic = 0;
  for (const value of momentum) kinetic += (value * value) / 2;
  const total = action + kinetic;
  if (!Number.isFinite(kinetic) || !Number.isFinite(total))
    throw new Phi4ArithmeticError('Spatial HMC Hamiltonian overflowed.');
  return { action, kinetic, total };
}

/** Pure deterministic proposal; typed arithmetic overflow alone is recoverable.
 * Every parallel bond enters through the unchanged full spatial gradient. */
export function leapfrogPhi4(
  lattice: FieldLattice,
  parameters: Phi4FieldParameters,
  position: readonly number[],
  momentum: readonly number[],
  sampler: HmcSampler,
): LeapfrogResult {
  // Count attempted force calls, including one that overflows. The shared
  // integrator preserves QM's released successful-evaluation convention.
  let gradientEvaluations = 0;
  const result = leapfrog(
    position,
    momentum,
    sampler,
    (x, p) => phi4HmcHamiltonian(lattice, parameters, x, p),
    (x) => {
      gradientEvaluations++;
      return phi4Gradient(lattice, parameters, x);
    },
    (cause) => cause instanceof Phi4ArithmeticError,
  );
  return { ...result, gradientEvaluations };
}

/** One refreshed whole-field trajectory: exactly 2V momentum uniforms plus one
 * decision uniform, including automatic acceptance or numerical divergence. */
export function hmcPhi4Transition(
  lattice: FieldLattice,
  parameters: Phi4FieldParameters,
  current: readonly number[],
  sampler: HmcSampler,
  rng: Rng,
): { field: number[]; trace: HmcTrace } {
  validateHmcSampler(sampler);
  // Invalid settings or an invalid starting field are not proposal rejections.
  // Validate before consuming the seeded momentum stream.
  phi4HmcHamiltonian(lattice, parameters, current, Array(lattice.size).fill(0));
  const momentum = Array.from({ length: lattice.size }, () =>
    standardNormal(rng),
  );
  const start = phi4HmcHamiltonian(lattice, parameters, current, momentum);
  const trajectory = leapfrogPhi4(
    lattice,
    parameters,
    current,
    momentum,
    sampler,
  );
  const proposed =
    trajectory.status === 'ok'
      ? phi4HmcHamiltonian(
          lattice,
          parameters,
          trajectory.position,
          trajectory.momentum,
        )
      : null;
  const deltaH = proposed ? proposed.total - start.total : null;
  const finiteDelta = deltaH !== null && Number.isFinite(deltaH);
  const acceptanceProbability = finiteDelta
    ? Math.exp(Math.min(0, -deltaH))
    : 0;
  const decisionUniform = rng.uniform();
  const accepted = decisionUniform < acceptanceProbability;
  const divergence = trajectory.status === 'diverged' || !finiteDelta;
  return {
    field:
      accepted && trajectory.status === 'ok'
        ? trajectory.position
        : [...current],
    trace: {
      kind: 'hmc',
      stepSize: sampler.stepSize,
      leapfrogSteps: sampler.leapfrogSteps,
      trajectoryDuration: sampler.stepSize * sampler.leapfrogSteps,
      startAction: start.action,
      startKinetic: start.kinetic,
      startHamiltonian: start.total,
      proposedAction: proposed?.action ?? null,
      proposedKinetic: proposed?.kinetic ?? null,
      proposedHamiltonian: proposed?.total ?? null,
      deltaH: finiteDelta ? deltaH : null,
      acceptanceProbability,
      decisionUniform,
      accepted,
      outcome: divergence ? 'divergence' : accepted ? 'accepted' : 'rejected',
      gradientEvaluations: trajectory.gradientEvaluations,
      completedLeapfrogSteps: trajectory.completedLeapfrogSteps,
      energyErrors: trajectory.energyErrors,
      divergenceReason:
        trajectory.status === 'diverged'
          ? trajectory.reason
          : finiteDelta
            ? null
            : 'Nonfinite ΔH.',
    },
  };
}
