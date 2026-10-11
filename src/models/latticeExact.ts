import { createIndexedLattice } from '../domain/indexedLattice';
import {
  magnetization,
  totalEnergy,
  validateLatticeParameters,
} from './latticeIsing';
import type { LatticeParameters } from './latticeIsing';

/** Exact 16-state reference in physical M2 units, independent of M1a UI limits. */
export function exactLatticeTwoByTwo(p: LatticeParameters) {
  validateLatticeParameters(p);
  if (p.lx !== 2 || p.ly !== 2)
    throw new Error('The 16-state reference requires a 2×2 lattice.');

  const lattice = createIndexedLattice(p);
  const energies: number[] = [];
  const magnetizations: number[] = [];
  for (let code = 0; code < 16; code++) {
    const spins = Int8Array.from({ length: 4 }, (_, i) =>
      code & (1 << i) ? 1 : -1,
    );
    energies.push(totalEnergy(lattice, p, spins));
    magnetizations.push(magnetization(spins) / 4);
  }

  // Subtract the lowest action before exponentiation, so even T=0.05 and
  // maximal signed couplings remain finite. Tiny probabilities may underflow.
  const actions = energies.map((energy) => energy / p.temperature);
  const minimumAction = Math.min(...actions);
  const weights = actions.map((action) => Math.exp(minimumAction - action));
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  const probabilities = weights.map((weight) => weight / weightSum);
  const distribution = new Map<number, number>([
    [-1, 0],
    [-0.5, 0],
    [0, 0],
    [0.5, 0],
    [1, 0],
  ]);
  let meanM = 0;
  let meanAbsM = 0;
  let secondM = 0;
  let meanE = 0;
  let secondE = 0;
  probabilities.forEach((probability, code) => {
    const m = magnetizations[code]!;
    const e = energies[code]! / 4;
    meanM += probability * m;
    meanAbsM += probability * Math.abs(m);
    secondM += probability * m * m;
    meanE += probability * e;
    secondE += probability * e * e;
    distribution.set(m, distribution.get(m)! + probability);
  });
  return {
    logPartition: Math.log(weightSum) - minimumAction,
    probabilities,
    meanM,
    meanAbsM,
    secondM,
    meanE,
    secondE,
    magnetizationDistribution: [...distribution],
    bondCount: lattice.tails.length,
  };
}
