import type { FieldShape } from '../domain/fieldLattice';
import { validateFieldShape } from '../domain/fieldLattice';
import type { GaussianFieldParameters } from './gaussianField';

/**
 * Elementary finite DFT for a periodic field. Both sites and frequencies use
 * row-major index x+Lx*y. Forward has no scale and a negative phase; inverse
 * has 1/N and a positive phase. A real input has F(-k)=conj(F(k)); at a
 * self-conjugate (including Nyquist) mode its imaginary part is roundoff.
 */
export type Complex = { re: number; im: number };
export type FourierBasis = {
  shape: FieldShape;
  size: number;
  lx: number;
  ly: number;
  cosine: number[][];
  sine: number[][];
};

export function isFullyPeriodic(shape: FieldShape) {
  return shape.kind === 'chain'
    ? shape.periodic
    : shape.periodicX && shape.periodicY;
}

export function createFourierBasis(shape: FieldShape): FourierBasis {
  validateFieldShape(shape);
  if (!isFullyPeriodic(shape))
    throw new Error('Fourier fields require periodicity in every direction.');
  const lx = shape.kind === 'chain' ? shape.length : shape.lx;
  const ly = shape.kind === 'chain' ? 1 : shape.ly;
  const size = lx * ly;
  const cosine: number[][] = [];
  const sine: number[][] = [];
  for (let mode = 0; mode < size; mode++) {
    const kx = mode % lx;
    const ky = Math.floor(mode / lx);
    const cosRow: number[] = [];
    const sinRow: number[] = [];
    for (let site = 0; site < size; site++) {
      const x = site % lx;
      const y = Math.floor(site / lx);
      const phase = 2 * Math.PI * ((kx * x) / lx + (ky * y) / ly);
      cosRow.push(Math.cos(phase));
      sinRow.push(Math.sin(phase));
    }
    cosine.push(cosRow);
    sine.push(sinRow);
  }
  return { shape: structuredClone(shape), size, lx, ly, cosine, sine };
}

export function forwardRealFourier(
  values: readonly number[],
  basis: FourierBasis,
): Complex[] {
  if (values.length !== basis.size)
    throw new Error('Fourier input length mismatch.');
  return basis.cosine.map((cosRow, mode) => {
    let re = 0;
    let im = 0;
    for (let site = 0; site < basis.size; site++) {
      re += values[site]! * cosRow[site]!;
      im -= values[site]! * basis.sine[mode]![site]!;
    }
    return { re, im };
  });
}

export function inverseFourier(
  coefficients: readonly Complex[],
  basis: FourierBasis,
): Complex[] {
  if (coefficients.length !== basis.size)
    throw new Error('Fourier input length mismatch.');
  const result: Complex[] = [];
  for (let site = 0; site < basis.size; site++) {
    let re = 0;
    let im = 0;
    for (let mode = 0; mode < basis.size; mode++) {
      const c = basis.cosine[mode]![site]!;
      const s = basis.sine[mode]![site]!;
      const value = coefficients[mode]!;
      re += value.re * c - value.im * s;
      im += value.re * s + value.im * c;
    }
    result.push({ re: re / basis.size, im: im / basis.size });
  }
  return result;
}

export function fieldEigenvalues(
  p: GaussianFieldParameters,
  basis: FourierBasis,
): number[] {
  return Array.from({ length: basis.size }, (_, mode) => {
    const kx = mode % basis.lx;
    const ky = Math.floor(mode / basis.lx);
    return (
      p.r +
      4 * p.kappaX * Math.sin((Math.PI * kx) / basis.lx) ** 2 +
      (basis.ly === 1
        ? 0
        : 4 * p.kappaY * Math.sin((Math.PI * ky) / basis.ly) ** 2)
    );
  });
}
