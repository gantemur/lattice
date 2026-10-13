import type { Rng } from './rng';
import { standardNormal } from './normalDraw';
import {
  quarticPathAction,
  quarticPathGradient,
  validateQuarticOscillator,
} from '../models/quarticOscillator';
import type { QuarticOscillatorParameters } from '../models/quarticOscillator';

export type QuarticHmcSampler = {
  kind: 'hmc';
  stepSize: number;
  leapfrogSteps: number;
};

export function validateQuarticHmcSampler(sampler: QuarticHmcSampler) {
  if (
    !Number.isFinite(sampler.stepSize) ||
    sampler.stepSize < 0.002 ||
    sampler.stepSize > 0.25
  )
    throw new Error('HMC step size ε must be from 0.002 to 0.25.');
  if (
    !Number.isInteger(sampler.leapfrogSteps) ||
    sampler.leapfrogSteps < 1 ||
    sampler.leapfrogSteps > 32
  )
    throw new Error('HMC leapfrog steps L must be an integer from 1 to 32.');
}

function kineticEnergy(momentum: readonly number[]) {
  let energy = 0;
  for (const value of momentum) energy += (value * value) / 2;
  if (!Number.isFinite(energy))
    throw new Error('HMC kinetic energy overflowed.');
  return energy;
}

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

export type LeapfrogResult =
  | {
      status: 'ok';
      position: number[];
      /** Reversed final momentum makes this deterministic proposal involutive. */
      momentum: number[];
      gradientEvaluations: number;
      completedLeapfrogSteps: number;
      /** H_MD(k)−H_MD(0), after each of at most 32 complete steps. */
      energyErrors: number[];
    }
  | {
      status: 'diverged';
      reason: string;
      gradientEvaluations: number;
      completedLeapfrogSteps: number;
      energyErrors: number[];
    };

/** Kick-drift-kick leapfrog. Both inputs are copied; no RNG or decision occurs.
 * Kicks and drifts are phase-space shears with determinant one. Their
 * composition is reversible and preserves volume, but not H exactly at ε>0. */
export function leapfrogQuartic(
  parameters: QuarticOscillatorParameters,
  position: readonly number[],
  momentum: readonly number[],
  sampler: QuarticHmcSampler,
): LeapfrogResult {
  validateQuarticHmcSampler(sampler);
  const start = quarticHmcHamiltonian(parameters, position, momentum);
  const x = [...position];
  const p = [...momentum];
  const errors: number[] = [];
  let evaluations = 0;
  const divergence = (reason: string): LeapfrogResult => ({
    status: 'diverged',
    reason,
    gradientEvaluations: evaluations,
    completedLeapfrogSteps: errors.length,
    energyErrors: errors,
  });
  try {
    let gradient = quarticPathGradient(parameters, x);
    evaluations++;
    for (let j = 0; j < p.length; j++)
      p[j]! -= (sampler.stepSize * gradient[j]!) / 2;
    for (let step = 0; step < sampler.leapfrogSteps; step++) {
      for (let j = 0; j < x.length; j++) x[j]! += sampler.stepSize * p[j]!;
      if (x.some((value) => !Number.isFinite(value)))
        return divergence('Position became nonfinite during leapfrog.');
      gradient = quarticPathGradient(parameters, x);
      evaluations++;
      // Finish this complete step before inspecting its Hamiltonian. On an
      // interior step the next half kick then combines with this one into
      // the usual full kick, without another force evaluation.
      for (let j = 0; j < p.length; j++)
        p[j]! -= (sampler.stepSize * gradient[j]!) / 2;
      if (p.some((value) => !Number.isFinite(value)))
        return divergence('Momentum became nonfinite during leapfrog.');
      const energy = quarticHmcHamiltonian(parameters, x, p).total;
      const defect = energy - start.total;
      if (!Number.isFinite(defect))
        return divergence('Hamiltonian difference became nonfinite.');
      errors.push(defect);
      if (step + 1 < sampler.leapfrogSteps)
        for (let j = 0; j < p.length; j++)
          p[j]! -= (sampler.stepSize * gradient[j]!) / 2;
    }
  } catch (cause) {
    if (cause instanceof Error && cause.message.includes('overflowed'))
      return divergence(cause.message);
    throw cause;
  }
  return {
    status: 'ok',
    position: x,
    momentum: p.map((value) => -value),
    gradientEvaluations: evaluations,
    completedLeapfrogSteps: errors.length,
    energyErrors: errors,
  };
}

export type QuarticHmcTrace = {
  kind: 'hmc';
  stepSize: number;
  leapfrogSteps: number;
  trajectoryDuration: number;
  startAction: number;
  startKinetic: number;
  startHamiltonian: number;
  proposedAction: number | null;
  proposedKinetic: number | null;
  proposedHamiltonian: number | null;
  deltaH: number | null;
  acceptanceProbability: number;
  decisionUniform: number;
  accepted: boolean;
  outcome: 'accepted' | 'rejected' | 'divergence';
  gradientEvaluations: number;
  completedLeapfrogSteps: number;
  energyErrors: number[];
  divergenceReason: string | null;
};

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
