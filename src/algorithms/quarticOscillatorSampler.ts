import type { Rng } from './rng';
import type { FieldTrace } from './gaussianFieldSampler';
import {
  quarticLocalDifference,
  validateQuarticOscillator,
} from '../models/quarticOscillator';
import type { QuarticOscillatorParameters } from '../models/quarticOscillator';

/** Random-site Metropolis. Three uniforms are consumed even for an overflowed
 * proposal; rejected proposals retain the exact old path. */
export function quarticTransition(
  parameters: QuarticOscillatorParameters,
  current: readonly number[],
  width: number,
  rng: Rng,
): { field: number[]; trace: FieldTrace } {
  validateQuarticOscillator(parameters);
  if (!Number.isFinite(width) || width < 0.01 || width > 10)
    throw new Error('Metropolis proposal width must be from 0.01 to 10.');
  if (
    current.length !== parameters.sites ||
    current.some((value) => !Number.isFinite(value))
  )
    throw new Error('Current quartic path is invalid.');
  const site = Math.min(
    parameters.sites - 1,
    Math.floor(rng.uniform() * parameters.sites),
  );
  const before = current[site]!;
  const proposed = before + width * (2 * rng.uniform() - 1);
  let deltaAction: number | null = null;
  if (Number.isFinite(proposed)) {
    try {
      deltaAction = quarticLocalDifference(parameters, current, site, proposed);
    } catch (cause) {
      // A finite but enormous proposal can overflow x⁴ or the kinetic term.
      // Only arithmetic overflow is recoverable; invalid settings remain errors.
      if (!(cause instanceof Error) || !cause.message.includes('overflowed'))
        throw cause;
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
