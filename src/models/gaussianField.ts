import { createFieldLattice } from '../domain/fieldLattice';
import type { FieldLattice, FieldShape } from '../domain/fieldLattice';

/**
 * Massive field with dimensionless action
 * S(phi)=r/2 Σ_i phi_i² + 1/2 Σ_b κ_b(phi_tail−phi_head)² − j Σ_i phi_i.
 * The reference measure is ordinary ∏_i dphi_i, with no extra β factor.
 * r is a quadratic precision coefficient, not an oscillator particle mass.
 */
export type GaussianFieldParameters = {
  shape: FieldShape;
  r: number;
  kappaX: number;
  kappaY: number;
  source: number;
};

export function validateGaussianField(p: GaussianFieldParameters): void {
  createFieldLattice(p.shape);
  if (!Number.isFinite(p.r) || p.r < 0.05 || p.r > 20)
    throw new Error('Quadratic coefficient r must be from 0.05 to 20.');
  for (const [name, value] of [
    ['κx', p.kappaX],
    ['κy', p.kappaY],
  ] as const)
    if (!Number.isFinite(value) || value < 0 || value > 10)
      throw new Error(`${name} must be from 0 to 10.`);
  if (!Number.isFinite(p.source) || Math.abs(p.source) > 10)
    throw new Error('Uniform source j must be from −10 to 10.');
}

export function validateFieldValues(
  lattice: FieldLattice,
  phi: readonly number[],
) {
  if (
    phi.length !== lattice.size ||
    phi.some((value) => !Number.isFinite(value))
  )
    throw new Error(
      'Field configuration has wrong length or non-finite values.',
    );
}

export function bondStiffness(p: GaussianFieldParameters, axis: 'x' | 'y') {
  return axis === 'x' ? p.kappaX : p.kappaY;
}

export function fieldAction(
  lattice: FieldLattice,
  p: GaussianFieldParameters,
  phi: readonly number[],
): number {
  validateFieldValues(lattice, phi);
  let action = 0;
  for (const value of phi)
    action += (p.r * value * value) / 2 - p.source * value;
  for (const bond of lattice.bonds) {
    const difference = phi[bond.tail]! - phi[bond.head]!;
    action += (bondStiffness(p, bond.axis) * difference * difference) / 2;
  }
  return action;
}

export function fieldPrecision(
  lattice: FieldLattice,
  p: GaussianFieldParameters,
) {
  // S=phiᵀQphi/2−j1ᵀphi. Every bond adds κ[[1,-1],[-1,1]];
  // distinct periodic parallel bonds therefore each change Q.
  const Q = Array.from({ length: lattice.size }, (_, i) =>
    Array.from({ length: lattice.size }, (_, j) => (i === j ? p.r : 0)),
  );
  for (const bond of lattice.bonds) {
    const kappa = bondStiffness(p, bond.axis);
    Q[bond.tail]![bond.tail]! += kappa;
    Q[bond.head]![bond.head]! += kappa;
    Q[bond.tail]![bond.head]! -= kappa;
    Q[bond.head]![bond.tail]! -= kappa;
  }
  return Q;
}

export function fieldGradient(
  lattice: FieldLattice,
  p: GaussianFieldParameters,
  phi: readonly number[],
): number[] {
  validateFieldValues(lattice, phi);
  const gradient = phi.map((value) => p.r * value - p.source);
  for (const bond of lattice.bonds) {
    const contribution =
      bondStiffness(p, bond.axis) * (phi[bond.tail]! - phi[bond.head]!);
    gradient[bond.tail]! += contribution;
    gradient[bond.head]! -= contribution;
  }
  return gradient;
}

export function fieldLocalTerms(
  lattice: FieldLattice,
  p: GaussianFieldParameters,
  phi: readonly number[],
  site: number,
) {
  validateFieldValues(lattice, phi);
  if (!Number.isInteger(site) || site < 0 || site >= lattice.size)
    throw new Error('Invalid field site.');
  const value = phi[site]!;
  return {
    onsite: (p.r * value * value) / 2 - p.source * value,
    onsiteGradient: p.r * value - p.source,
    incident: lattice.incident[site]!.map((bond) => {
      const neighbor = bond.tail === site ? bond.head : bond.tail;
      const difference = value - phi[neighbor]!;
      const stiffness = bondStiffness(p, bond.axis);
      return {
        bondId: bond.id,
        neighbor,
        axis: bond.axis,
        stiffness,
        action: (stiffness * difference * difference) / 2,
        gradient: stiffness * difference,
      };
    }),
  };
}

export function fieldConditional(
  lattice: FieldLattice,
  p: GaussianFieldParameters,
  phi: readonly number[],
  site: number,
) {
  validateFieldValues(lattice, phi);
  if (!Number.isInteger(site) || site < 0 || site >= lattice.size)
    throw new Error('Invalid field site.');
  // Holding neighbors fixed leaves Q_ii phi_i²/2−(j+Σκ phi_neighbor)phi_i.
  let precision = p.r;
  let linear = p.source;
  for (const bond of lattice.incident[site]!) {
    const neighbor = bond.tail === site ? bond.head : bond.tail;
    const kappa = bondStiffness(p, bond.axis);
    precision += kappa;
    linear += kappa * phi[neighbor]!;
  }
  return { mean: linear / precision, variance: 1 / precision };
}

export function fieldLocalDifference(
  lattice: FieldLattice,
  p: GaussianFieldParameters,
  phi: readonly number[],
  site: number,
  proposed: number,
): number {
  validateFieldValues(lattice, phi);
  if (!Number.isFinite(proposed))
    throw new Error('Proposed field is non-finite.');
  if (!Number.isInteger(site) || site < 0 || site >= lattice.size)
    throw new Error('Invalid field site.');
  const old = phi[site]!;
  let delta =
    (p.r * (proposed * proposed - old * old)) / 2 - p.source * (proposed - old);
  for (const bond of lattice.incident[site]!) {
    const neighbor = bond.tail === site ? bond.head : bond.tail;
    const other = phi[neighbor]!;
    delta +=
      (bondStiffness(p, bond.axis) / 2) *
      ((proposed - other) ** 2 - (old - other) ** 2);
  }
  return delta;
}

export function fieldObservables(
  lattice: FieldLattice,
  p: GaussianFieldParameters,
  phi: readonly number[],
  selected: number,
  partner: number,
) {
  validateFieldValues(lattice, phi);
  if (
    !Number.isInteger(selected) ||
    !Number.isInteger(partner) ||
    selected < 0 ||
    partner < 0 ||
    selected >= lattice.size ||
    partner >= lattice.size
  )
    throw new Error('Invalid observable site.');
  return {
    site: phi[selected]!,
    average: phi.reduce((sum, value) => sum + value, 0) / lattice.size,
    actionDensity: fieldAction(lattice, p, phi) / lattice.size,
    pair: phi[selected]! * phi[partner]!,
  };
}
