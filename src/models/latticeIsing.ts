import { createIndexedLattice } from '../domain/indexedLattice';
import type { IndexedLattice, LatticeShape } from '../domain/indexedLattice';

export type LatticeParameters = LatticeShape & {
  jx: number;
  jy: number;
  field: number;
  temperature: number;
};
export const defaultLatticeParameters: LatticeParameters = {
  lx: 32,
  ly: 32,
  periodicX: true,
  periodicY: true,
  jx: 1,
  jy: 1,
  field: 0,
  temperature: 2.269185314213022,
};
export function validateLatticeParameters(p: LatticeParameters): void {
  createIndexedLattice(p);
  if (
    ![p.jx, p.jy, p.field].every((n) => Number.isFinite(n) && Math.abs(n) <= 10)
  )
    throw new Error(
      'Couplings and field must be finite and between −10 and 10.',
    );
  if (
    !Number.isFinite(p.temperature) ||
    p.temperature < 0.05 ||
    p.temperature > 100
  )
    throw new Error('Temperature must be finite and between 0.05 and 100.');
}
export function magnetization(spins: Int8Array): number {
  let sum = 0;
  for (const spin of spins) sum += spin;
  return sum;
}
export function totalEnergy(
  lattice: IndexedLattice,
  p: LatticeParameters,
  spins: Int8Array,
): number {
  let energy = -p.field * magnetization(spins);
  for (let b = 0; b < lattice.tails.length; b++)
    energy -=
      (lattice.axes[b] === 0 ? p.jx : p.jy) *
      spins[lattice.tails[b]!]! *
      spins[lattice.heads[b]!]!;
  return energy;
}
export type LocalTerm = {
  neighbor: number;
  axis: 'x' | 'y';
  spin: number;
  contribution: number;
};
export function localTerms(
  lattice: IndexedLattice,
  p: LatticeParameters,
  spins: Int8Array,
  site: number,
): LocalTerm[] {
  const terms: LocalTerm[] = [];
  for (let slot = 0; slot < lattice.degree[site]!; slot++) {
    const offset = 4 * site + slot,
      neighbor = lattice.neighbors[offset]!;
    const axis = lattice.neighborAxes[offset] === 0 ? 'x' : 'y';
    terms.push({
      neighbor,
      axis,
      spin: spins[neighbor]!,
      contribution: (axis === 'x' ? p.jx : p.jy) * spins[neighbor]!,
    });
  }
  return terms;
}
export function localField(
  lattice: IndexedLattice,
  p: LatticeParameters,
  spins: Int8Array,
  site: number,
): number {
  let sum = p.field;
  for (let slot = 0; slot < lattice.degree[site]!; slot++) {
    const offset = 4 * site + slot;
    sum +=
      (lattice.neighborAxes[offset] === 0 ? p.jx : p.jy) *
      spins[lattice.neighbors[offset]!]!;
  }
  return sum;
}
export function flipEnergy(
  lattice: IndexedLattice,
  p: LatticeParameters,
  spins: Int8Array,
  site: number,
): number {
  return 2 * spins[site]! * localField(lattice, p, spins, site);
}
export function plusProbability(betaField: number): number {
  return betaField >= 0
    ? 1 / (1 + Math.exp(-2 * betaField))
    : Math.exp(2 * betaField) / (1 + Math.exp(2 * betaField));
}
export function criticalTemperature(p: LatticeParameters): number | null {
  if (p.field !== 0 || p.jx <= 0 || p.jy <= 0 || p.ly < 2 || p.lx < 2)
    return null;
  let low = 0.00001,
    high = Math.max(p.jx, p.jy) * 10;
  for (let i = 0; i < 80; i++) {
    const mid = (low + high) / 2;
    const product = Math.sinh((2 * p.jx) / mid) * Math.sinh((2 * p.jy) / mid);
    if (product > 1) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}
