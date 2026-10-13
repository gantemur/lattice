/** Small identity-mass integrator shared by QM paths and spatial fields.
 * Model wrappers own validation, action conventions and recoverable errors.
 * Arithmetic ordering deliberately preserves the released QM golden replay. */
export type HmcHamiltonian = { action: number; kinetic: number; total: number };
export type HmcSampler = {
  kind: 'hmc';
  stepSize: number;
  leapfrogSteps: number;
};

export function validateHmcSampler(sampler: HmcSampler) {
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

export function kineticEnergy(momentum: readonly number[]) {
  let energy = 0;
  for (const value of momentum) energy += (value * value) / 2;
  if (!Number.isFinite(energy))
    throw new Error('HMC kinetic energy overflowed.');
  return energy;
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
export function leapfrog(
  position: readonly number[],
  momentum: readonly number[],
  sampler: HmcSampler,
  hamiltonian: (
    position: readonly number[],
    momentum: readonly number[],
  ) => HmcHamiltonian,
  gradientAt: (position: readonly number[]) => number[],
  isArithmeticOverflow: (cause: unknown) => boolean,
): LeapfrogResult {
  validateHmcSampler(sampler);
  const start = hamiltonian(position, momentum);
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
    let gradient = gradientAt(x);
    evaluations++;
    for (let j = 0; j < p.length; j++)
      p[j]! -= (sampler.stepSize * gradient[j]!) / 2;
    for (let step = 0; step < sampler.leapfrogSteps; step++) {
      for (let j = 0; j < x.length; j++) x[j]! += sampler.stepSize * p[j]!;
      if (x.some((value) => !Number.isFinite(value)))
        return divergence('Position became nonfinite during leapfrog.');
      gradient = gradientAt(x);
      evaluations++;
      // Finish this complete step before inspecting its Hamiltonian. On an
      // interior step the next half kick then combines with this one into
      // the usual full kick, without another force evaluation.
      for (let j = 0; j < p.length; j++)
        p[j]! -= (sampler.stepSize * gradient[j]!) / 2;
      if (p.some((value) => !Number.isFinite(value)))
        return divergence('Momentum became nonfinite during leapfrog.');
      const energy = hamiltonian(x, p).total;
      const defect = energy - start.total;
      if (!Number.isFinite(defect))
        return divergence('Hamiltonian difference became nonfinite.');
      errors.push(defect);
      if (step + 1 < sampler.leapfrogSteps)
        for (let j = 0; j < p.length; j++)
          p[j]! -= (sampler.stepSize * gradient[j]!) / 2;
    }
  } catch (cause) {
    if (isArithmeticOverflow(cause))
      return divergence(
        cause instanceof Error ? cause.message : 'Numerical overflow.',
      );
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

export type HmcTrace = {
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
