import type { Rng } from './rng';
import { pottsConditional, pottsDifference } from '../models/potts';
import type { PottsModel } from '../models/potts';
import { exactPotts, pottsStateCount } from '../models/pottsExact';
export type PottsSampler = 'direct' | 'metropolis' | 'heat-bath';
export type PottsTrace = {
  sampler: PottsSampler;
  site: number | null;
  before: number | null;
  proposed: number | null;
  after: number | null;
  outcome: 'draw' | 'self' | 'accepted' | 'rejected' | 'changed' | 'unchanged';
  uniforms: number[];
  probability: number | null;
  delta: number | null;
  actualDelta: number | null;
  conditional: number[] | null;
};
function categorical(probabilities: readonly number[], u: number): number {
  let sum = 0;
  for (let c = 0; c < probabilities.length; c++) {
    sum += probabilities[c]!;
    if (u < sum) return c;
  }
  return probabilities.length - 1;
}
/** One authoritative update, mutating only the chosen color (or a direct whole
 * draw). State/model validation belongs to the run boundary. Lazy Metropolis
 * uses one proposal uniform: half stays, half partitions among OTHER colors. */
export function pottsTransition(
  model: PottsModel,
  sampler: PottsSampler,
  state: Uint8Array,
  rng: Rng,
): PottsTrace {
  if (!['direct', 'metropolis', 'heat-bath'].includes(sampler))
    throw new Error('Unknown Potts sampler.');
  if (sampler === 'direct') {
    if (pottsStateCount(model) === null)
      throw new Error('Direct sampling requires q^V≤256.');
    const reference = exactPotts(model),
      u = rng.uniform();
    const code = categorical(reference.probabilities, u);
    state.set(reference.states[code]!);
    return {
      sampler,
      site: null,
      before: null,
      proposed: null,
      after: null,
      outcome: 'draw',
      uniforms: [u],
      probability: null,
      delta: null,
      actualDelta: null,
      conditional: null,
    };
  }
  const u = rng.uniform(),
    site = Math.floor(u * model.size),
    before = state[site]!;
  if (sampler === 'heat-bath') {
    const conditional = pottsConditional(model, state, site),
      v = rng.uniform(),
      after = categorical(conditional, v);
    const delta = pottsDifference(model, state, site, after);
    state[site] = after;
    return {
      sampler,
      site,
      before,
      proposed: after,
      after,
      outcome: before === after ? 'unchanged' : 'changed',
      uniforms: [u, v],
      probability: null,
      delta,
      actualDelta: delta,
      conditional,
    };
  }
  const v = rng.uniform(),
    w = rng.uniform();
  const alternate = Math.min(
    model.q - 2,
    Math.floor((2 * v - 1) * (model.q - 1)),
  );
  const proposed =
    v < 0.5 ? before : alternate >= before ? alternate + 1 : alternate;
  const delta = pottsDifference(model, state, site, proposed),
    probability = Math.exp(Math.min(0, -delta));
  const accepted = w < probability,
    after = accepted ? proposed : before;
  state[site] = after;
  return {
    sampler,
    site,
    before,
    proposed,
    after,
    outcome: proposed === before ? 'self' : accepted ? 'accepted' : 'rejected',
    uniforms: [u, v, w],
    probability,
    delta,
    actualDelta: accepted ? delta : 0,
    conditional: null,
  };
}
