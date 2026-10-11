import type { Rng } from './rng';
import { standardNormal } from './normalDraw';
import { forwardRealFourier, inverseFourier } from '../models/fieldFourier';
import type { SpectralFieldReference } from '../models/gaussianFieldSpectral';

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
  const field = inverseFourier(coefficients, basis).map((value, site) => {
    if (Math.abs(value.im) > 1e-9)
      throw new Error('Spectral draw violated conjugate reality.');
    return value.re + reference.mean[site]!;
  });
  if (measure === 'mean-zero') {
    // Remove only accumulated floating-point residual, not a random mode.
    const residual =
      field.reduce((sum, value) => sum + value, 0) / field.length;
    for (let site = 0; site < field.length; site++) field[site]! -= residual;
  }
  return field;
}
