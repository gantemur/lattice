import type { Rng } from './rng';
import { standardNormal } from './normalDraw';
import { forwardRealFourier, inverseFourier } from '../models/fieldFourier';
import type { Complex, FourierBasis } from '../models/fieldFourier';
import type { SpectralFieldReference } from '../models/gaussianFieldSpectral';

/** The inverse of conjugate-paired coefficients is real up to roundoff.
 * An N-term DFT accumulates O(N ε) error. Usually the filtered coefficient
 * norm sets its scale. When white-noise terms nearly cancel in a retained
 * mode, however, forward error is still set by the unfiltered white-noise
 * magnitude times the largest retained 1/√λ. The factor 16 covers forward,
 * inverse and trig rounding at N≤64; a truly unpaired mode still fails.
 * The deterministic mean is added later and does not enlarge this tolerance.
 */
export function checkedRealInverse(
  coefficients: readonly Complex[],
  basis: FourierBasis,
  forwardRoundoffScale = 0,
): number[] {
  const coefficientScale =
    coefficients.reduce(
      (sum, value) => sum + Math.hypot(value.re, value.im),
      0,
    ) / basis.size;
  const imaginaryTolerance =
    16 *
    basis.size *
    Number.EPSILON *
    Math.max(coefficientScale, forwardRoundoffScale);
  return inverseFourier(coefficients, basis).map((value) => {
    if (Math.abs(value.im) > imaginaryTolerance)
      throw new Error('Spectral draw violated conjugate reality.');
    return value.re;
  });
}

/** Filter real-space white noise in Fourier space. Conjugate frequency pairs
 * inherit their relation from the real input and receive the same λ filter. */
export function drawSpectralField(
  reference: SpectralFieldReference,
  rng: Rng,
): number[] {
  const { basis, eigenvalues, measure } = reference;
  const whiteNoise = Array.from({ length: basis.size }, () =>
    standardNormal(rng),
  );
  const coefficients = forwardRealFourier(whiteNoise, basis).map(
    (value, mode) => {
      if (measure === 'mean-zero' && mode === 0) return { re: 0, im: 0 };
      const scale = Math.sqrt(eigenvalues[mode]!);
      return { re: value.re / scale, im: value.im / scale };
    },
  );
  const largestWhiteNoise = Math.max(...whiteNoise.map(Math.abs));
  const largestRetainedFilter = Math.max(
    ...eigenvalues.map((lambda, mode) =>
      measure === 'mean-zero' && mode === 0 ? 0 : 1 / Math.sqrt(lambda),
    ),
  );
  const field = checkedRealInverse(
    coefficients,
    basis,
    largestWhiteNoise * largestRetainedFilter,
  ).map((value, site) => value + reference.mean[site]!);
  if (measure === 'mean-zero') {
    // Remove only accumulated floating-point residual, not a random mode.
    const residual =
      field.reduce((sum, value) => sum + value, 0) / field.length;
    for (let site = 0; site < field.length; site++) field[site]! -= residual;
  }
  return field;
}
