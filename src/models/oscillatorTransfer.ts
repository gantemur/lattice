import type { OscillatorParameters } from './oscillator';
import { oscillatorSpacing } from './oscillator';
import { latticeCorrelator, latticeGap } from './oscillatorReference';

/** Symmetric Trotter kernel of e^(-aV/2)e^(-ap²/2)e^(-aV/2).
 * Positivity as an operator follows from this factorization and the positive
 * kinetic semigroup, not merely from pointwise-positive kernel entries. */
export function transferKernel(
  p: OscillatorParameters,
  x: number,
  y: number,
): number {
  const a = oscillatorSpacing(p);
  if (!Number.isFinite(x) || !Number.isFinite(y))
    throw new Error('Transfer coordinates must be finite.');
  return (
    Math.exp(
      -((x - y) ** 2) / (2 * a) - (a * p.omega ** 2 * (x ** 2 + y ** 2)) / 4,
    ) / Math.sqrt(2 * Math.PI * a)
  );
}

/** Eigenvalues of a small real symmetric matrix by cyclic Jacobi rotations.
 * This intentionally readable solver is for the bounded teaching matrices. */
export function symmetricEigenvalues(
  matrix: readonly (readonly number[])[],
): number[] {
  const n = matrix.length;
  if (!n || n > 65 || matrix.some((row) => row.length !== n))
    throw new Error(
      'Symmetric eigensolver needs a square matrix of at most 65 rows.',
    );
  const A = matrix.map((row) => [...row]);
  if (A.some((row) => row.some((value) => !Number.isFinite(value))))
    throw new Error('Matrix entries must be finite.');
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      if (Math.abs(A[i]![j]! - A[j]![i]!) > 1e-10)
        throw new Error('Matrix must be finite and symmetric.');
  for (let sweep = 0; sweep < 32; sweep++) {
    let largest = 0;
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const off = A[i]![j]!;
        largest = Math.max(largest, Math.abs(off));
        if (Math.abs(off) < 1e-14) continue;
        const tau = (A[j]![j]! - A[i]![i]!) / (2 * off);
        const t =
          Math.sign(tau || 1) / (Math.abs(tau) + Math.sqrt(1 + tau ** 2));
        const c = 1 / Math.sqrt(1 + t ** 2);
        const s = t * c;
        A[i]![i] = A[i]![i]! - t * off;
        A[j]![j] = A[j]![j]! + t * off;
        A[i]![j] = A[j]![i] = 0;
        for (let k = 0; k < n; k++) {
          if (k === i || k === j) continue;
          const left = A[k]![i]!;
          const right = A[k]![j]!;
          A[k]![i] = A[i]![k] = c * left - s * right;
          A[k]![j] = A[j]![k] = s * left + c * right;
        }
      }
    if (largest < 1e-12)
      return A.map((row, i) => row[i]!).sort((x, y) => y - x);
  }
  throw new Error('Small symmetric eigensolver did not converge.');
}

/** Positive trapezoid weights yield a symmetric Nyström matrix. */
export function transferQuadrature(
  p: OscillatorParameters,
  nodes: 33 | 49 | 65 = 49,
) {
  const a = oscillatorSpacing(p);
  const cutoff = Math.max(6 / Math.sqrt(p.omega), 5 * Math.sqrt(a));
  const spacing = (2 * cutoff) / (nodes - 1);
  const grid = Array.from({ length: nodes }, (_, i) => -cutoff + i * spacing);
  const weights = grid.map(
    (_, i) => spacing * (i === 0 || i === nodes - 1 ? 0.5 : 1),
  );
  const matrix = grid.map((x, i) =>
    grid.map(
      (y, j) => Math.sqrt(weights[i]! * weights[j]!) * transferKernel(p, x, y),
    ),
  );
  const eigenvalues = symmetricEigenvalues(matrix);
  const first = eigenvalues[0]!;
  const second = eigenvalues[1]!;
  return {
    nodes,
    cutoff,
    first,
    second,
    gap: first > second && second > 0 ? -Math.log(second / first) / a : null,
  };
}

export type QuadratureQuality = {
  status: 'usable' | 'under-resolved' | 'unavailable';
  relativeGapDiscrepancy: number | null;
  exactGap: number;
  exactLeadingEigenvalue: number;
  gridSpacing: number | null;
  kineticWidth: number;
  reasons: string[];
};

/** Assess this particular finite grid, not the validity of Nyström quadrature.
 * We know the oscillator answer independently: a >5% gap discrepancy marks
 * under-resolution. The exact leading eigenvalue is e^(−aΩ/2)<1, so a
 * computed value above 1+1e−8 is another warning. Both tests diagnose the
 * teaching discretization; neither changes its approximate eigenvalues. */
export function assessTransferQuadrature(
  p: OscillatorParameters,
  numerical: ReturnType<typeof transferQuadrature> | null,
): QuadratureQuality {
  const a = oscillatorSpacing(p);
  const exactGap = latticeGap(p);
  const exactLeadingEigenvalue = Math.exp((-a * exactGap) / 2);
  const kineticWidth = Math.sqrt(a);
  const gridSpacing =
    numerical !== null &&
    Number.isInteger(numerical.nodes) &&
    numerical.nodes >= 2 &&
    Number.isFinite(numerical.cutoff) &&
    numerical.cutoff > 0
      ? (2 * numerical.cutoff) / (numerical.nodes - 1)
      : null;
  const { first, second, gap } = numerical ?? {
    first: NaN,
    second: NaN,
    gap: null,
  };
  const inferredGap = -Math.log(second / first) / a;
  if (
    numerical === null ||
    gridSpacing === null ||
    !Number.isFinite(first) ||
    !Number.isFinite(second) ||
    !(first > second && second > 0) ||
    gap === null ||
    !Number.isFinite(gap) ||
    !(gap > 0) ||
    Math.abs(gap - inferredGap) > 1e-10 * Math.max(1, gap)
  ) {
    return {
      status: 'unavailable',
      relativeGapDiscrepancy: null,
      exactGap,
      exactLeadingEigenvalue,
      gridSpacing,
      kineticWidth,
      reasons: ['The finite-grid eigenvalues or their gap are unusable.'],
    };
  }
  const relativeGapDiscrepancy = Math.abs(gap - exactGap) / exactGap;
  const reasons: string[] = [];
  if (relativeGapDiscrepancy > 0.05)
    reasons.push(
      'The finite-grid gap differs from the exact lattice gap by more than 5%.',
    );
  if (first > 1 + 1e-8)
    reasons.push(
      'The leading grid eigenvalue exceeds the exact transfer bound t₀<1.',
    );
  return {
    status: reasons.length ? 'under-resolved' : 'usable',
    relativeGapDiscrepancy,
    exactGap,
    exactLeadingEigenvalue,
    gridSpacing,
    kineticWidth,
    reasons,
  };
}

export function transferLevels(p: OscillatorParameters) {
  const gap = latticeGap(p);
  const a = oscillatorSpacing(p);
  return {
    ground: gap / 2,
    first: (3 * gap) / 2,
    leadingEigenvalues: [
      Math.exp((-a * gap) / 2),
      Math.exp((-3 * a * gap) / 2),
    ],
  };
}

/** Time-reflection Gram G_ij=C(i+j), with i,j on one positive half-circle. */
export function reflectionExample(p: OscillatorParameters) {
  oscillatorSpacing(p);
  const indices = Array.from(
    { length: Math.min(3, Math.floor(p.sites / 4)) },
    (_, i) => i + 1,
  );
  const matrix = indices.map((i) =>
    indices.map((j) => latticeCorrelator(p, i + j)),
  );
  const eigenvalues = symmetricEigenvalues(matrix);
  return { indices, matrix, eigenvalues, tolerance: 1e-10 };
}
