import { describe, expect, it } from 'vitest';
import { createIndexedLattice } from '../domain/indexedLattice';
import { totalEnergy } from '../models/latticeIsing';
import type { LatticeParameters } from '../models/latticeIsing';
import type { Rng } from './rng';
import { latticeTransition } from './latticeTransition';

const p: LatticeParameters = {
  lx: 2,
  ly: 2,
  periodicX: true,
  periodicY: true,
  jx: 1,
  jy: 1,
  field: 0,
  temperature: 2,
};

function transition(sampler: 'metropolis' | 'heat-bath', draws: number[]) {
  const lattice = createIndexedLattice(p);
  const spins = Int8Array.from([1, 1, 1, 1]);
  const before = totalEnergy(lattice, p, spins);
  let used = 0;
  const rng: Rng = { uniform: () => draws[used++]! };
  const trace = latticeTransition(lattice, p, sampler, spins, rng, 1);
  expect(used).toBe(draws.length);
  expect(trace.flipDeltaH).toBe(8);
  expect(trace.flipDeltaS).toBe(4);
  expect(trace.deltaH).toBe(totalEnergy(lattice, p, spins) - before);
  expect(trace.deltaS).toBe(trace.deltaH / p.temperature);
  return trace;
}

describe('lattice transition inspection costs', () => {
  it('shows proposed and actual cost for an accepted flip', () => {
    const trace = transition('metropolis', [0.1, 0.8, 0.01]);
    expect(trace.outcome).toBe('accepted');
    expect(trace.proposedSpin).toBe(-1);
    expect(trace.deltaH).toBe(8);
  });
  it('keeps hypothetical flip cost but reports zero actual cost for rejection', () => {
    const trace = transition('metropolis', [0.1, 0.8, 0.99]);
    expect(trace.outcome).toBe('rejected');
    expect(trace.proposedSpin).toBe(-1);
    expect(trace.newSpin).toBe(1);
    expect(trace.deltaH).toBe(0);
    expect(trace.deltaS).toBe(0);
  });
  it('reports zero proposed and actual cost for a lazy self-proposal', () => {
    const trace = transition('metropolis', [0.1, 0.2, 0.99]);
    expect(trace.outcome).toBe('self');
    expect(trace.proposedSpin).toBe(1);
    expect(trace.deltaH).toBe(0);
    expect(trace.deltaS).toBe(0);
  });
  it('reports actual flip cost for a changed heat-bath resample', () => {
    const trace = transition('heat-bath', [0.1, 0.99]);
    expect(trace.outcome).toBe('changed');
    expect(trace.deltaH).toBe(8);
  });
  it('reports zero actual cost for an unchanged heat-bath resample', () => {
    const trace = transition('heat-bath', [0.1, 0.01]);
    expect(trace.outcome).toBe('unchanged');
    expect(trace.deltaH).toBe(0);
    expect(trace.deltaS).toBe(0);
  });
});
