import type { Rng } from './rng';
import type { IndexedLattice } from '../domain/indexedLattice';
import {
  flipEnergy,
  localField,
  localTerms,
  plusProbability,
} from '../models/latticeIsing';
import type { LatticeParameters, LocalTerm } from '../models/latticeIsing';

export type LatticeSampler = 'metropolis' | 'heat-bath';
export type LatticeTrace = {
  update: number;
  site: number;
  x: number;
  y: number;
  oldSpin: number;
  proposedSpin: number;
  newSpin: number;
  terms: LocalTerm[];
  field: number;
  deltaH: number;
  deltaS: number;
  siteUniform: number;
  proposalUniform?: number;
  decisionUniform: number;
  probability: number;
  outcome: 'accepted' | 'rejected' | 'self' | 'changed' | 'unchanged';
};
/** Mutates one spin at most; returns the actual worker transition. */
export function latticeTransition(
  lattice: IndexedLattice,
  p: LatticeParameters,
  sampler: LatticeSampler,
  spins: Int8Array,
  rng: Rng,
  update: number,
  inspect = true,
): LatticeTrace {
  const siteUniform = rng.uniform(),
    site = Math.floor(siteUniform * lattice.size);
  const oldSpin = spins[site]!;
  const field = localField(lattice, p, spins, site);
  const deltaH = flipEnergy(lattice, p, spins, site),
    deltaS = deltaH / p.temperature;
  const terms = inspect ? localTerms(lattice, p, spins, site) : [];
  if (sampler === 'metropolis') {
    const proposalUniform = rng.uniform(),
      flip = proposalUniform >= 0.5;
    const proposedSpin = flip ? -oldSpin : oldSpin;
    const probability = flip ? Math.exp(Math.min(0, -deltaS)) : 1;
    const decisionUniform = rng.uniform();
    const accepted = decisionUniform < probability;
    const newSpin = flip && accepted ? -oldSpin : oldSpin;
    spins[site] = newSpin;
    return {
      update,
      site,
      x: site % lattice.lx,
      y: Math.floor(site / lattice.lx),
      oldSpin,
      proposedSpin,
      newSpin,
      terms,
      field,
      deltaH: flip ? deltaH : 0,
      deltaS: flip ? deltaS : 0,
      siteUniform,
      proposalUniform,
      decisionUniform,
      probability,
      outcome: !flip ? 'self' : accepted ? 'accepted' : 'rejected',
    };
  }
  const probability = plusProbability(field / p.temperature);
  const decisionUniform = rng.uniform();
  const newSpin = decisionUniform < probability ? 1 : -1;
  spins[site] = newSpin;
  return {
    update,
    site,
    x: site % lattice.lx,
    y: Math.floor(site / lattice.lx),
    oldSpin,
    proposedSpin: newSpin,
    newSpin,
    terms,
    field,
    deltaH,
    deltaS,
    siteUniform,
    decisionUniform,
    probability,
    outcome: newSpin === oldSpin ? 'unchanged' : 'changed',
  };
}
