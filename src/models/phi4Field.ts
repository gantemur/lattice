import { createFieldLattice, validateFieldShape } from '../domain/fieldLattice';
import type { FieldLattice, FieldShape } from '../domain/fieldLattice';
import { validateFieldValues, bondStiffness } from './gaussianField';

/** Ordinary product-Lebesgue measure exp(-S) ∏dφ; no extra beta or constraint.
 * S=Σ(rφ²/2+λφ⁴/4−jφ)+Σ_b κ_b(φ_tail−φ_head)²/2. */
export type Phi4FieldParameters = {
  shape: FieldShape;
  r: number;
  lambda: number;
  kappaX: number;
  kappaY: number;
  source: number;
  measure?: never;
};
export const defaultPhi4Field: Phi4FieldParameters = {
  shape: { kind: 'chain', length: 16, periodic: true },
  r: -1,
  lambda: 0.5,
  kappaX: 2,
  kappaY: 0,
  source: 0,
};
export function validatePhi4Field(p: Phi4FieldParameters) {
  validateFieldShape(p.shape);
  if (p.measure !== undefined)
    throw new Error('Spatial φ⁴ uses ordinary product Lebesgue measure.');
  if (!Number.isFinite(p.r) || p.r < -4 || p.r > 20)
    throw new Error('Spatial quadratic r must be from −4 to 20.');
  if (
    !Number.isFinite(p.lambda) ||
    (p.lambda !== 0 && (p.lambda < 0.01 || p.lambda > 4))
  )
    throw new Error('Spatial λ must be zero or from 0.01 to 4.');
  if (p.lambda === 0 && p.r < 0.05)
    throw new Error(
      'The ordinary Gaussian limit requires r≥0.05; no mean-zero constraint is substituted.',
    );
  if (
    ![p.kappaX, p.kappaY].every((k) => Number.isFinite(k) && k >= 0 && k <= 10)
  )
    throw new Error('Spatial stiffness must be from 0 to 10.');
  if (p.shape.kind === 'chain' && p.kappaY !== 0)
    throw new Error('A chain has no y bonds: κy must be zero.');
  if (!Number.isFinite(p.source) || Math.abs(p.source) > 10)
    throw new Error('Spatial source j must be from −10 to 10.');
}
export class Phi4ArithmeticError extends Error {}
function finite(value: number) {
  if (!Number.isFinite(value))
    throw new Phi4ArithmeticError('Spatial φ⁴ arithmetic overflowed.');
  return value;
}
export function phi4Potential(p: Phi4FieldParameters, value: number) {
  if (!Number.isFinite(value)) throw new Error('Field value must be finite.');
  // Avoid 0*Infinity in the genuinely quadratic limit.
  return finite(
    (p.r * value * value) / 2 +
      (p.lambda === 0 ? 0 : (p.lambda * value ** 4) / 4) -
      p.source * value,
  );
}
export function phi4Action(
  lattice: FieldLattice,
  p: Phi4FieldParameters,
  field: readonly number[],
) {
  validatePhi4Field(p);
  validateFieldValues(lattice, field);
  let action = field.reduce((sum, value) => sum + phi4Potential(p, value), 0);
  for (const bond of lattice.bonds) {
    const stiffness = bondStiffness(p, bond.axis);
    if (stiffness)
      action += (stiffness * (field[bond.tail]! - field[bond.head]!) ** 2) / 2;
  }
  return finite(action);
}
export function phi4LocalTerms(
  lattice: FieldLattice,
  p: Phi4FieldParameters,
  field: readonly number[],
  site: number,
) {
  validatePhi4Field(p);
  validateFieldValues(lattice, field);
  if (!Number.isInteger(site) || site < 0 || site >= lattice.size)
    throw new Error('Invalid spatial field site.');
  const value = field[site]!;
  const incident = lattice.incident[site]!.map((bond) => {
    const neighbor = bond.tail === site ? bond.head : bond.tail;
    const stiffness = bondStiffness(p, bond.axis);
    const difference = value - field[neighbor]!;
    return {
      bondId: bond.id,
      axis: bond.axis,
      neighbor,
      stiffness,
      action: stiffness ? finite((stiffness * difference ** 2) / 2) : 0,
      gradient: stiffness ? finite(stiffness * difference) : 0,
    };
  });
  return {
    onsite: phi4Potential(p, value),
    onsiteGradient: finite(
      p.r * value + (p.lambda === 0 ? 0 : p.lambda * value ** 3) - p.source,
    ),
    incident,
    // U_cond(z)=q z²/2+λ z⁴/4−b z+constant. This is not a marginal law.
    conditionalQuadratic:
      p.r + incident.reduce((sum, bond) => sum + bond.stiffness, 0),
    conditionalSource: finite(
      p.source +
        incident.reduce(
          (sum, bond) => sum + bond.stiffness * field[bond.neighbor]!,
          0,
        ),
    ),
  };
}
export function phi4LocalDifference(
  lattice: FieldLattice,
  p: Phi4FieldParameters,
  field: readonly number[],
  site: number,
  proposed: number,
) {
  const terms = phi4LocalTerms(lattice, p, field, site);
  if (!Number.isFinite(proposed))
    throw new Error('Proposed field must be finite.');
  let delta = phi4Potential(p, proposed) - terms.onsite;
  // Each incident record is distinct, including length-two parallel bonds.
  for (const bond of terms.incident)
    if (bond.stiffness)
      delta +=
        (bond.stiffness * (proposed - field[bond.neighbor]!) ** 2) / 2 -
        bond.action;
  return finite(delta);
}
export function phi4Gradient(
  lattice: FieldLattice,
  p: Phi4FieldParameters,
  field: readonly number[],
) {
  validatePhi4Field(p);
  validateFieldValues(lattice, field);
  const gradient = field.map(
    (value) =>
      p.r * value + (p.lambda === 0 ? 0 : p.lambda * value ** 3) - p.source,
  );
  for (const bond of lattice.bonds) {
    const stiffness = bondStiffness(p, bond.axis);
    const force = stiffness
      ? stiffness * (field[bond.tail]! - field[bond.head]!)
      : 0;
    gradient[bond.tail]! += force;
    gradient[bond.head]! -= force;
  }
  return gradient.map(finite);
}
/** Explicit Gaussian reduction; never interpret a negative-r quartic as Q>0. */
export function phi4GaussianParameters(p: Phi4FieldParameters) {
  validatePhi4Field(p);
  if (p.lambda !== 0) throw new Error('A Gaussian reference requires λ=0.');
  const { lambda: _lambda, ...gaussian } = p;
  return gaussian;
}
export function phi4Size(p: Phi4FieldParameters) {
  return createFieldLattice(p.shape).size;
}
