import type { IsingModel } from '../models/ising';
import {
  conditionalPlus,
  exactIsing,
  flipDifference,
  neighborhood,
  spinAt,
} from '../models/ising';
import type { Sampler, Transition } from './transitions';
import type { Rng } from './rng';
export type IsingTrace = ReturnType<typeof neighborhood> & {
  index: number;
  siteUniform: number;
  proposalUniform?: number;
  oldSpin: number;
  newSpin: number;
  proposedSpin: number;
};
export function isingTransition(
  model: IsingModel,
  sampler: Sampler,
  current: number | null,
  rng: Rng,
): Transition {
  if (sampler.kind === 'direct') {
    const u = rng.uniform(),
      probabilities = exactIsing(model).probabilities;
    let total = 0,
      result = probabilities.length - 1;
    for (let i = 0; i < probabilities.length; i++) {
      total += probabilities[i]!;
      if (u < total) {
        result = i;
        break;
      }
    }
    return { kind: 'direct', current, result, outcome: 'draw' };
  }
  if (current === null)
    throw new Error('Local sampling requires a configuration.');
  const siteUniform = rng.uniform(),
    index = Math.floor(siteUniform * model.parameters.domain.vertices.length),
    oldSpin = spinAt(current, index);
  const local = neighborhood(model, current, index);
  if (sampler.kind === 'heat-bath') {
    const probabilityPlus = conditionalPlus(model, current, index),
      uniform = rng.uniform(),
      newSpin = uniform < probabilityPlus ? 1 : -1,
      result = newSpin === oldSpin ? current : current ^ (1 << index);
    return {
      kind: 'heat-bath',
      current,
      result,
      probabilityPlus,
      uniform,
      outcome: newSpin === oldSpin ? 'self' : 'resampled',
      ising: {
        ...local,
        index,
        siteUniform,
        oldSpin,
        newSpin,
        proposedSpin: newSpin,
      },
    };
  }
  const proposalUniform = rng.uniform(),
    lazy = proposalUniform < 0.5,
    proposed = lazy ? current : current ^ (1 << index),
    delta = lazy ? 0 : flipDifference(model, current, index),
    alpha = Math.exp(Math.min(0, -delta)),
    uniform = rng.uniform(),
    accepted = uniform < alpha,
    result = accepted ? proposed : current;
  return {
    kind: 'metropolis',
    current,
    attempted: proposed,
    proposed,
    delta,
    alpha,
    uniform,
    accepted,
    result,
    outcome: lazy ? 'self' : accepted ? 'accepted' : 'rejected',
    selfReason: lazy ? 'lazy' : null,
    ising: {
      ...local,
      index,
      siteUniform,
      proposalUniform,
      oldSpin,
      newSpin: spinAt(result, index),
      proposedSpin: spinAt(proposed, index),
    },
  };
}
