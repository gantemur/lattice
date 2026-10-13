import type { Rng } from './rng';
import { standardNormal } from './normalDraw';
import {
  quarticPathAction,
  quarticPathGradient,
  validateQuarticOscillator,
} from '../models/quarticOscillator';
import type { QuarticOscillatorParameters } from '../models/quarticOscillator';

import { kineticEnergy, leapfrog, validateHmcSampler } from './leapfrog';
import type { HmcSampler, LeapfrogResult, HmcTrace } from './leapfrog';
export type QuarticHmcSampler = HmcSampler;
export type { LeapfrogResult } from './leapfrog';
export const validateQuarticHmcSampler = validateHmcSampler;

/** Auxiliary HMC Hamiltonian S_a(x)+Σp_j²/2, with identity mass matrix. */
export function quarticHmcHamiltonian(
  parameters: QuarticOscillatorParameters,
  position: readonly number[],
  momentum: readonly number[],
) {
  validateQuarticOscillator(parameters);
  if (
    momentum.length !== parameters.sites ||
    momentum.some((value) => !Number.isFinite(value))
  )
    throw new Error('HMC momentum must have N finite values.');
  const action = quarticPathAction(parameters, position);
  const kinetic = kineticEnergy(momentum);
  const total = action + kinetic;
  if (!Number.isFinite(total)) throw new Error('HMC Hamiltonian overflowed.');
  return { action, kinetic, total };
}

/** Model adapter; the pure shear integrator preserves the released ordering. */
export function leapfrogQuartic(
  parameters: QuarticOscillatorParameters,
  position: readonly number[],
  momentum: readonly number[],
  sampler: QuarticHmcSampler,
): LeapfrogResult {
  return leapfrog(
    position,
    momentum,
    sampler,
    (x, p) => quarticHmcHamiltonian(parameters, x, p),
    (x) => quarticPathGradient(parameters, x),
    (cause) => cause instanceof Error && cause.message.includes('overflowed'),
  );
}

export type QuarticHmcTrace = HmcTrace;

/** One refreshed whole-path trajectory: exactly 2N momentum uniforms plus one
 * decision uniform, including automatic acceptance or numerical divergence. */
export function hmcQuarticTransition(
  parameters: QuarticOscillatorParameters,
  current: readonly number[],
  sampler: QuarticHmcSampler,
  rng: Rng,
): { field: number[]; trace: QuarticHmcTrace } {
  validateQuarticHmcSampler(sampler);
  const momentum = Array.from({ length: parameters.sites }, () =>
    standardNormal(rng),
  );
  const start = quarticHmcHamiltonian(parameters, current, momentum);
  const trajectory = leapfrogQuartic(parameters, current, momentum, sampler);
  const proposed =
    trajectory.status === 'ok'
      ? quarticHmcHamiltonian(
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
