import type { Rng } from './rng';
import type { FieldTrace } from './gaussianFieldSampler';
import { validateFieldSampler } from './gaussianFieldSampler';
import type { FieldLattice } from '../domain/fieldLattice';
import { validateFieldValues } from '../models/gaussianField';
import {
  Phi4ArithmeticError,
  phi4LocalDifference,
  validatePhi4Field,
} from '../models/phi4Field';
import type { Phi4FieldParameters } from '../models/phi4Field';

/** Symmetric random-site Metropolis: exactly site, displacement, decision.
 * Even downhill and overflowed proposals consume all three uniforms. */
export function phi4Transition(
  lattice: FieldLattice,
  p: Phi4FieldParameters,
  current: readonly number[],
  width: number,
  rng: Rng,
): { field: number[]; trace: FieldTrace } {
  validatePhi4Field(p);
  validateFieldValues(lattice, current);
  validateFieldSampler({ kind: 'metropolis', width }, lattice.size);
  const site = Math.min(
    lattice.size - 1,
    Math.floor(rng.uniform() * lattice.size),
  );
  const before = current[site]!;
  const proposed = before + width * (2 * rng.uniform() - 1);
  let deltaAction: number | null = null;
  if (Number.isFinite(proposed)) {
    try {
      deltaAction = phi4LocalDifference(lattice, p, current, site, proposed);
    } catch (cause) {
      if (!(cause instanceof Phi4ArithmeticError)) throw cause;
    }
  }
  const acceptanceProbability =
    deltaAction === null ? 0 : Math.exp(Math.min(0, -deltaAction));
  const decisionUniform = rng.uniform();
  const accepted = decisionUniform < acceptanceProbability;
  const field = [...current];
  if (accepted) field[site] = proposed;
  return {
    field,
    trace: {
      kind: 'metropolis',
      site,
      before,
      proposed,
      after: field[site]!,
      deltaAction,
      acceptanceProbability,
      decisionUniform,
      accepted,
      outcome: accepted ? 'accepted' : 'rejected',
    },
  };
}
