import { createFieldLattice } from '../domain/fieldLattice';
import type { FieldLattice } from '../domain/fieldLattice';
import {
  fieldMeasure,
  fieldPrecision,
  validateGaussianField,
} from './gaussianField';
import type { GaussianFieldParameters } from './gaussianField';

/**
 * Dense, small-lattice Gaussian reference. Q=LLᵀ is positive definite because
 * r>0 and each nonnegative-stiffness bond contributes a positive-semidefinite
 * square. Solving Qμ=j1 and QC=I gives exact finite-volume moments up to
 * floating-point rounding; this is not an infinite-volume/Fourier reference.
 */
export const MAX_DENSE_FIELD_SITES = 64;

export function lowerCholesky(Q: readonly (readonly number[])[]): number[][] {
  const n = Q.length;
  if (!n || Q.some((row) => row.length !== n))
    throw new Error('Precision matrix must be nonempty and square.');
  const L = Array.from({ length: n }, () => Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let entry = Q[i]![j]!;
      for (let k = 0; k < j; k++) entry -= L[i]![k]! * L[j]![k]!;
      if (i === j) {
        if (!Number.isFinite(entry) || entry <= 1e-12)
          throw new Error(
            'Gaussian precision is singular or not positive definite.',
          );
        L[i]![i] = Math.sqrt(entry);
      } else L[i]![j] = entry / L[j]![j]!;
    }
  }
  return L;
}

export function solveLower(
  L: readonly (readonly number[])[],
  rhs: readonly number[],
) {
  const result: number[] = [];
  for (let i = 0; i < rhs.length; i++) {
    let value = rhs[i]!;
    for (let j = 0; j < i; j++) value -= L[i]![j]! * result[j]!;
    result.push(value / L[i]![i]!);
  }
  return result;
}

export function solveUpperFromLower(
  L: readonly (readonly number[])[],
  rhs: readonly number[],
) {
  const result = Array<number>(rhs.length).fill(0);
  for (let i = rhs.length - 1; i >= 0; i--) {
    let value = rhs[i]!;
    for (let j = i + 1; j < rhs.length; j++) value -= L[j]![i]! * result[j]!;
    result[i] = value / L[i]![i]!;
  }
  return result;
}

export type GaussianFieldReference = {
  mean: number[];
  covariance: number[][];
  cholesky: number[][];
  logPartition: number;
};

export function exactGaussianField(
  p: GaussianFieldParameters,
  lattice: FieldLattice = createFieldLattice(p.shape),
): GaussianFieldReference {
  validateGaussianField(p);
  if (fieldMeasure(p) !== 'ordinary')
    throw new Error('Dense Cholesky requires an ordinary massive measure.');
  if (lattice.size > MAX_DENSE_FIELD_SITES)
    throw new Error(
      `Dense reference is limited to ${MAX_DENSE_FIELD_SITES} sites.`,
    );
  const Q = fieldPrecision(lattice, p);
  const L = lowerCholesky(Q);
  const source = Array<number>(lattice.size).fill(p.source);
  const mean = solveUpperFromLower(L, solveLower(L, source));
  const covariance = Array.from({ length: lattice.size }, () =>
    Array<number>(lattice.size).fill(0),
  );
  for (let column = 0; column < lattice.size; column++) {
    const unit = Array<number>(lattice.size).fill(0);
    unit[column] = 1;
    const solved = solveUpperFromLower(L, solveLower(L, unit));
    for (let row = 0; row < lattice.size; row++)
      covariance[row]![column] = solved[row]!;
  }
  // Refuse to label an unstable solve exact. The supported parameter range is
  // well conditioned, but this residual also catches accidental solver errors.
  for (let row = 0; row < lattice.size; row++)
    for (let column = 0; column < lattice.size; column++) {
      let product = 0;
      for (let k = 0; k < lattice.size; k++)
        product += Q[row]![k]! * covariance[k]![column]!;
      if (Math.abs(product - (row === column ? 1 : 0)) > 1e-8)
        throw new Error(
          'Dense Gaussian reference failed its Q·C identity check.',
        );
    }
  const logPartition =
    (lattice.size / 2) * Math.log(2 * Math.PI) -
    L.reduce((sum, row, i) => sum + Math.log(row[i]!), 0) +
    source.reduce((sum, value, i) => sum + (value * mean[i]!) / 2, 0);
  return { mean, covariance, cholesky: L, logPartition };
}

export function exactFieldPair(
  reference: GaussianFieldReference,
  a: number,
  b: number,
) {
  if (
    !Number.isInteger(a) ||
    !Number.isInteger(b) ||
    a < 0 ||
    b < 0 ||
    a >= reference.mean.length ||
    b >= reference.mean.length
  )
    throw new Error('Pair site is outside the dense reference.');
  return {
    covariance: reference.covariance[a]![b]!,
    product:
      reference.covariance[a]![b]! + reference.mean[a]! * reference.mean[b]!,
  };
}
