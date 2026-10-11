import { validateGaussianField, fieldMeasure } from './gaussianField';
import type { GaussianFieldParameters } from './gaussianField';
import { createFourierBasis, fieldEigenvalues } from './fieldFourier';
import type { FourierBasis } from './fieldFourier';

/** Finite-volume reference, with the constrained measure induced by Euclidean
 * length on Σφ=0. This differs by √N from δ(Σφ)∏dφ normalization. */
export type SpectralFieldReference = {
  method: 'spectral';
  measure: 'ordinary' | 'mean-zero';
  mean: number[];
  covariance: number[][];
  logPartition: number;
  eigenvalues: number[];
  basis: FourierBasis;
};

export function spectralGaussianField(
  p: GaussianFieldParameters,
): SpectralFieldReference {
  validateGaussianField(p);
  const basis = createFourierBasis(p.shape);
  const eigenvalues = fieldEigenvalues(p, basis);
  const measure = fieldMeasure(p);
  const retained = eigenvalues.map((lambda, mode) => {
    if (measure === 'mean-zero' && mode === 0) return false;
    if (!(lambda > 0) || !Number.isFinite(lambda))
      throw new Error(
        'Fourier precision has an extra zero or invalid mode; use positive stiffness in every active direction.',
      );
    return true;
  });
  const n = basis.size;
  const meanValue = measure === 'ordinary' ? p.source / p.r : 0;
  const covariance = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      let sum = 0;
      for (let mode = 0; mode < n; mode++)
        if (retained[mode]) {
          const ci = basis.cosine[mode]![i]!;
          const si = basis.sine[mode]![i]!;
          const cj = basis.cosine[mode]![j]!;
          const sj = basis.sine[mode]![j]!;
          sum += (ci * cj + si * sj) / eigenvalues[mode]!;
        }
      return sum / n;
    }),
  );
  if (covariance.some((row) => row.some((value) => !Number.isFinite(value))))
    throw new Error(
      'Fourier covariance exceeds floating-point range; increase stiffness.',
    );
  const dimension = measure === 'ordinary' ? n : n - 1;
  let logPartition = (dimension * Math.log(2 * Math.PI)) / 2;
  for (let mode = 0; mode < n; mode++)
    if (retained[mode]) logPartition -= Math.log(eigenvalues[mode]!) / 2;
  if (measure === 'ordinary') logPartition += (n * p.source * meanValue) / 2;
  return {
    method: 'spectral',
    measure,
    mean: Array(n).fill(meanValue),
    covariance,
    logPartition,
    eigenvalues,
    basis,
  };
}
