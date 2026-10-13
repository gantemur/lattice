import {
  potentialMinimum,
  quarticPotential,
  quarticSpacing,
  validateQuarticOscillator,
} from './quarticOscillator';
import type { QuarticOscillatorParameters } from './quarticOscillator';

export type TransferGrid = {
  nodes: number;
  cutoff: number;
  spacing: number;
  kineticWidth: number;
  leading: number[];
  gap: number | null;
  residuals: number[];
  orthogonalityError: number;
  mean: number | null;
  rawCorrelator: number[] | null;
  connectedCorrelator: number[] | null;
};
export type TransferStudy = {
  parameters: QuarticOscillatorParameters;
  potentialMinimum: number;
  grids: [TransferGrid, TransferGrid, TransferGrid];
  status: 'resolved' | 'under-resolved' | 'unavailable';
  reasons: string[];
  gridGapChange: number | null;
  cutoffGapChange: number | null;
  gap: number | null;
  groundEnergy: number | null;
  firstEnergy: number | null;
  correlatorStatus: 'resolved' | 'under-resolved' | 'unavailable';
  correlatorReasons: string[];
};

/** Analytic finite-a shifted harmonic limit; not used by quartic quadrature.
 * The displacement contributes (h/r)² to the raw thermal correlator. */
export function harmonicLimitReference(
  p: QuarticOscillatorParameters,
  lag: number,
) {
  validateQuarticOscillator(p);
  if (
    p.lambda !== 0 ||
    !(p.r > 0) ||
    !Number.isInteger(lag) ||
    lag < 0 ||
    lag > Math.floor(p.sites / 2)
  )
    throw new Error(
      'Analytic harmonic reference requires λ=0, r>0 and a valid lag.',
    );
  const a = p.beta / p.sites;
  const omega = Math.sqrt(p.r);
  const gap = (2 * Math.asinh((a * omega) / 2)) / a;
  const covariance =
    (a * Math.cosh(gap * (p.beta / 2 - lag * a))) /
    (2 * Math.sinh(a * gap) * Math.sinh((p.beta * gap) / 2));
  const mean = p.h / p.r;
  return { gap, mean, raw: covariance + mean * mean, connected: covariance };
}

type Eigenpairs = { values: number[]; vectors: number[][]; sweeps: number };

/** Cyclic Jacobi rotations on a real symmetric matrix. Keeping all vectors
 * permits a finite-beta trace, while the explicit residual is checked against
 * the original matrix after convergence. */
export function symmetricEigenpairs(
  matrix: readonly (readonly number[])[],
): Eigenpairs {
  const n = matrix.length;
  if (
    n < 2 ||
    n > 121 ||
    matrix.some(
      (row) => row.length !== n || row.some((v) => !Number.isFinite(v)),
    )
  )
    throw new Error(
      'Transfer matrix must be finite, square and have 2–121 rows.',
    );
  const a = matrix.map((row) => [...row]);
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      if (
        Math.abs(a[i]![j]! - a[j]![i]!) >
        1e-12 * Math.max(1, Math.abs(a[i]![j]!))
      )
        throw new Error('Transfer matrix is not symmetric.');
  const v = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => Number(i === j)),
  );
  const scale = Math.max(...a.map((row, i) => Math.abs(row[i]!)));
  if (!(scale > 0)) throw new Error('Transfer matrix has no positive scale.');
  for (let sweep = 0; sweep < 32; sweep++) {
    let largest = 0;
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const off = a[i]![j]!;
        largest = Math.max(largest, Math.abs(off));
        if (Math.abs(off) <= 1e-14 * scale) continue;
        const tau = (a[j]![j]! - a[i]![i]!) / (2 * off);
        const t =
          Math.sign(tau || 1) / (Math.abs(tau) + Math.sqrt(1 + tau * tau));
        const c = 1 / Math.sqrt(1 + t * t);
        const s = c * t;
        a[i]![i] = a[i]![i]! - t * off;
        a[j]![j] = a[j]![j]! + t * off;
        a[i]![j] = a[j]![i] = 0;
        for (let k = 0; k < n; k++) {
          if (k !== i && k !== j) {
            const left = a[k]![i]!;
            const right = a[k]![j]!;
            a[k]![i] = a[i]![k] = c * left - s * right;
            a[k]![j] = a[j]![k] = s * left + c * right;
          }
          const vi = v[k]![i]!;
          const vj = v[k]![j]!;
          v[k]![i] = c * vi - s * vj;
          v[k]![j] = s * vi + c * vj;
        }
      }
    if (largest <= 1e-12 * scale) {
      const order = Array.from({ length: n }, (_, i) => i).sort(
        (i, j) => a[j]![j]! - a[i]![i]!,
      );
      return {
        values: order.map((i) => a[i]![i]!),
        vectors: order.map((i) => v.map((row) => row[i]!)),
        sweeps: sweep + 1,
      };
    }
  }
  throw new Error('Transfer eigensolver did not converge in 32 sweeps.');
}

/** Positive trapezoid weights, including half-weight endpoints. The potential
 * is shifted by its global minimum to avoid large eigenvalues for deep wells. */
export function transferGrid(
  p: QuarticOscillatorParameters,
  nodes: number,
  cutoff: number,
): TransferGrid {
  validateQuarticOscillator(p);
  if (![49, 97, 121].includes(nodes) || !Number.isFinite(cutoff) || cutoff <= 0)
    throw new Error('Unsupported transfer quadrature policy.');
  const a = quarticSpacing(p);
  const vmin = potentialMinimum(p).value;
  const spacing = (2 * cutoff) / (nodes - 1);
  const x = Array.from({ length: nodes }, (_, i) => -cutoff + i * spacing);
  const weights = x.map(
    (_, i) => spacing * (i === 0 || i === nodes - 1 ? 0.5 : 1),
  );
  const matrix = x.map((xi, i) =>
    x.map(
      (xj, j) =>
        (Math.sqrt(weights[i]! * weights[j]!) / Math.sqrt(2 * Math.PI * a)) *
        Math.exp(
          -((xi - xj) ** 2) / (2 * a) -
            (a *
              (quarticPotential(p, xi) -
                vmin +
                (quarticPotential(p, xj) - vmin))) /
              2,
        ),
    ),
  );
  const eig = symmetricEigenpairs(matrix);
  const leading = eig.values.slice(0, 4);
  const residuals = eig.values.map((lambda, mode) => {
    const vec = eig.vectors[mode]!;
    let squared = 0;
    for (let i = 0; i < nodes; i++) {
      let applied = 0;
      for (let j = 0; j < nodes; j++) applied += matrix[i]![j]! * vec[j]!;
      squared += (applied - lambda * vec[i]!) ** 2;
    }
    return Math.sqrt(squared) / eig.values[0]!;
  });
  let orthogonalityError = 0;
  for (let m = 0; m < nodes; m++)
    for (let n = 0; n <= m; n++) {
      let dot = 0;
      for (let i = 0; i < nodes; i++)
        dot += eig.vectors[m]![i]! * eig.vectors[n]![i]!;
      orthogonalityError = Math.max(
        orthogonalityError,
        Math.abs(dot - Number(m === n)),
      );
    }
  const first = leading[0]!;
  const second = leading[1]!;
  const gap =
    first > second && second > 0
      ? -Math.log1p((second - first) / first) / a
      : null;
  // Keep the full eigenbasis: at lag zero even a tiny-eigenvalue mode can
  // contribute through completeness of X|m>. Clamp only negative roundoff;
  // significant negative eigenvalues indicate a broken quadrature/solver.
  if (!(first > 0) || eig.values.some((value) => value < -1e-10 * first))
    throw new Error(
      'Transfer quadrature has a significant negative eigenvalue.',
    );
  const modes = nodes;
  const ratios = eig.values.map((value) => Math.max(0, value) / first);
  let trace = 0;
  let meanNumerator = 0;
  for (let m = 0; m < modes; m++) {
    const thermal = ratios[m]! ** p.sites;
    trace += thermal;
    let diagonal = 0;
    for (let i = 0; i < nodes; i++)
      diagonal += eig.vectors[m]![i]! ** 2 * x[i]!;
    meanNumerator += thermal * diagonal;
  }
  const mean = trace > 0 ? meanNumerator / trace : null;
  const rawCorrelator =
    mean === null
      ? null
      : Array.from({ length: Math.floor(p.sites / 2) + 1 }, (_, lag) => {
          let sum = 0;
          for (let m = 0; m < modes; m++)
            for (let n = 0; n < modes; n++) {
              let transition = 0;
              for (let i = 0; i < nodes; i++)
                transition += eig.vectors[m]![i]! * x[i]! * eig.vectors[n]![i]!;
              sum +=
                ratios[m]! ** (p.sites - lag) *
                ratios[n]! ** lag *
                transition ** 2;
            }
          return sum / trace;
        });
  return {
    nodes,
    cutoff,
    spacing,
    kineticWidth: Math.sqrt(a),
    leading,
    gap,
    residuals,
    orthogonalityError,
    mean,
    rawCorrelator,
    connectedCorrelator:
      mean === null
        ? null
        : (rawCorrelator?.map((value) => value - mean * mean) ?? null),
  };
}

/** Three independent discretizations: halve spacing, then extend the interval
 * by 25% without coarsening. Stability is evidence, not a certified bound. */
export function quarticTransferStudy(
  p: QuarticOscillatorParameters,
): TransferStudy {
  validateQuarticOscillator(p);
  const vmin = potentialMinimum(p);
  const farthestWell = Math.max(
    ...vmin.stationaryPoints.map((point) => Math.abs(point.x)),
  );
  const harmonicWidth = p.lambda === 0 ? 1 / Math.sqrt(Math.sqrt(p.r)) : 0;
  const cutoff = Math.max(
    6,
    farthestWell + 4.5,
    6 * harmonicWidth,
    5 * Math.sqrt(p.beta / p.sites),
  );
  const grids = [
    transferGrid(p, 49, cutoff),
    transferGrid(p, 97, cutoff),
    transferGrid(p, 121, 1.25 * cutoff),
  ] as [TransferGrid, TransferGrid, TransferGrid];
  const [coarse, refined, enlarged] = grids;
  const gap = enlarged.gap;
  const gridGapChange =
    gap !== null && refined.gap !== null && coarse.gap !== null && gap > 0
      ? Math.abs(coarse.gap - refined.gap) / gap
      : null;
  const cutoffGapChange =
    gap !== null && refined.gap !== null && gap > 0
      ? Math.abs(refined.gap - gap) / gap
      : null;
  const reasons: string[] = [];
  if (gap === null || !Number.isFinite(gap))
    reasons.push('Leading eigenvalue ratio is unavailable.');
  else {
    if (gap * (p.beta / p.sites) < 1e-8)
      reasons.push('Leading splitting is too close to numerical degeneracy.');
    if (gridGapChange === null || gridGapChange > 0.03)
      reasons.push(
        'Coordinate-grid refinement changes the gap by more than 3%.',
      );
    if (cutoffGapChange === null || cutoffGapChange > 0.03)
      reasons.push('Cutoff enlargement changes the gap by more than 3%.');
  }
  if (
    grids.some(
      (grid) =>
        grid.residuals[0]! > 1e-8 ||
        grid.residuals[1]! > 1e-8 ||
        grid.orthogonalityError > 1e-8,
    )
  )
    reasons.push('Eigenpair residual or orthogonality exceeds 1e-8.');
  if (enlarged.leading[0]! > 1 + 1e-8)
    reasons.push('Shifted transfer leading eigenvalue exceeds one.');
  const status =
    gap === null
      ? 'unavailable'
      : reasons.length
        ? 'under-resolved'
        : 'resolved';
  const correlatorReasons: string[] = [];
  if (
    grids.some(
      (grid) =>
        grid.residuals.some((residual) => residual > 1e-8) ||
        grid.orthogonalityError > 1e-8,
    )
  )
    correlatorReasons.push(
      'A full-spectrum eigenpair residual or orthogonality check exceeds 1e-8.',
    );
  for (const lag of [0, Math.floor(p.sites / 4), Math.floor(p.sites / 2)]) {
    const values = grids.map((grid) => grid.rawCorrelator?.[lag]);
    if (
      values.some((value) => value === undefined || !Number.isFinite(value))
    ) {
      correlatorReasons.push('Thermal correlator could not be reconstructed.');
      break;
    }
    const scale = Math.max(0.05, Math.abs(values[2]!));
    if (
      Math.abs(values[0]! - values[1]!) / scale > 0.03 ||
      Math.abs(values[1]! - values[2]!) / scale > 0.03
    ) {
      correlatorReasons.push(
        'Thermal correlator changes by more than 3% at a checked lag.',
      );
      break;
    }
  }
  const a = p.beta / p.sites;
  return {
    parameters: { ...p },
    potentialMinimum: vmin.value,
    grids,
    status,
    reasons,
    gridGapChange,
    cutoffGapChange,
    gap: status === 'resolved' ? gap : null,
    groundEnergy:
      status === 'resolved'
        ? vmin.value - Math.log(enlarged.leading[0]!) / a
        : null,
    firstEnergy:
      status === 'resolved' && gap !== null
        ? vmin.value - Math.log(enlarged.leading[0]!) / a + gap
        : null,
    correlatorStatus:
      enlarged.rawCorrelator === null
        ? 'unavailable'
        : correlatorReasons.length
          ? 'under-resolved'
          : 'resolved',
    correlatorReasons,
  };
}
