import type { Rng } from './rng';
import type { PottsModel } from '../models/potts';
import { fkComponents, fkProbabilities, requireFK } from '../models/fk';
import type { FKComponents } from '../models/fk';
import { exactFK } from '../models/fkExact';
export type ClusterSampler = 'fk-direct' | 'sw';
export type PottsClusterTrace = FKComponents & {
  sampler: ClusterSampler;
  before: Uint8Array;
  after: Uint8Array;
  flags: Uint8Array;
  componentColors: Uint8Array;
  changedSites: number;
  uniformCount: number;
  bondVisits: number;
  colorAssignments: number;
};
/** η|σ: exactly one uniform for EVERY physical bond in stored order, including
 * disagreeing endpoints and K=0. Independent parallel trials are never folded.
 * σ|η: one uniform per canonically ordered component, including isolates.
 * No Metropolis test; unchanged final colors are valid complete trajectories. */
export function pottsClusterTransition(
  model: PottsModel,
  sampler: ClusterSampler,
  state: Uint8Array,
  rng: Rng,
): PottsClusterTrace {
  requireFK(model);
  if (sampler !== 'sw' && sampler !== 'fk-direct')
    throw new Error('Unknown cluster sampler.');
  const reference = sampler === 'fk-direct' ? exactFK(model) : null;
  const before = state.slice(),
    p = fkProbabilities(model);
  let flags: Uint8Array,
    uniformCount = 0;
  if (reference) {
    const u = rng.uniform();
    uniformCount++;
    let code = reference.cdf.findIndex((c) => u < c);
    if (code < 0) code = reference.cdf.length - 1;
    flags = reference.states[code]!.slice();
  } else {
    flags = new Uint8Array(model.bonds.length);
    model.bonds.forEach((b, e) => {
      const u = rng.uniform();
      uniformCount++;
      flags[e] = Number(before[b.tail] === before[b.head] && u < p[e]!);
    });
  }
  const components = fkComponents(model.size, model.bonds, flags);
  const componentColors = Uint8Array.from({ length: components.count }, () => {
    uniformCount++;
    return Math.floor(rng.uniform() * model.q);
  });
  let changedSites = 0;
  for (let i = 0; i < model.size; i++) {
    state[i] = componentColors[components.labels[i]!]!;
    if (state[i] !== before[i]) changedSites++;
  }
  return {
    ...components,
    sampler,
    before,
    after: state.slice(),
    flags,
    componentColors,
    changedSites,
    uniformCount,
    bondVisits: model.bonds.length,
    colorAssignments: components.count,
  };
}
