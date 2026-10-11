import { expect, it } from 'vitest';
import { createFieldLattice } from '../domain/fieldLattice';
import { fieldPrecision } from './gaussianField';
import type { GaussianFieldParameters } from './gaussianField';
import {
  createFourierBasis,
  fieldEigenvalues,
  forwardRealFourier,
  inverseFourier,
} from './fieldFourier';

/** Independent tiny-lattice DFT oracle: use complex multiplication from the
 * phase definition directly, rather than the production trigonometric table. */
function oracleForward(values: number[], lx: number, ly: number) {
  return values.map((_, mode) => {
    let re = 0;
    let im = 0;
    for (let site = 0; site < values.length; site++) {
      const angle =
        -2 *
        Math.PI *
        (((mode % lx) * (site % lx)) / lx +
          (Math.floor(mode / lx) * Math.floor(site / lx)) / ly);
      re += values[site]! * Math.cos(angle);
      im += values[site]! * Math.sin(angle);
    }
    return { re, im };
  });
}

for (const shape of [
  { kind: 'chain' as const, length: 2, periodic: true },
  { kind: 'chain' as const, length: 6, periodic: true },
  {
    kind: 'rectangle' as const,
    lx: 2,
    ly: 2,
    periodicX: true,
    periodicY: true,
  },
  {
    kind: 'rectangle' as const,
    lx: 3,
    ly: 4,
    periodicX: true,
    periodicY: true,
  },
])
  it(`DFT inverse, Parseval, conjugate reality and Q modes: ${JSON.stringify(shape)}`, () => {
    const basis = createFourierBasis(shape);
    const values = Array.from(
      { length: basis.size },
      (_, i) => Math.sin(i + 1) + i / 7,
    );
    const transform = forwardRealFourier(values, basis);
    const oracle = oracleForward(values, basis.lx, basis.ly);
    for (let mode = 0; mode < basis.size; mode++) {
      expect(transform[mode]!.re).toBeCloseTo(oracle[mode]!.re, 11);
      expect(transform[mode]!.im).toBeCloseTo(oracle[mode]!.im, 11);
      const kx = mode % basis.lx;
      const ky = Math.floor(mode / basis.lx);
      const opposite =
        ((basis.lx - kx) % basis.lx) + basis.lx * ((basis.ly - ky) % basis.ly);
      expect(transform[mode]!.re).toBeCloseTo(transform[opposite]!.re, 11);
      expect(transform[mode]!.im).toBeCloseTo(-transform[opposite]!.im, 11);
    }
    const inverse = inverseFourier(transform, basis);
    inverse.forEach((value, site) => {
      expect(value.re).toBeCloseTo(values[site]!, 11);
      expect(value.im).toBeCloseTo(0, 11);
    });
    expect(
      transform.reduce((sum, value) => sum + value.re ** 2 + value.im ** 2, 0) /
        basis.size,
    ).toBeCloseTo(
      values.reduce((sum, value) => sum + value ** 2, 0),
      10,
    );
    const p: GaussianFieldParameters = {
      shape,
      r: 1.3,
      kappaX: 0.7,
      kappaY: 1.1,
      source: 0,
    };
    const Q = fieldPrecision(createFieldLattice(shape), p);
    const eigenvalues = fieldEigenvalues(p, basis);
    for (let mode = 0; mode < basis.size; mode++)
      for (let site = 0; site < basis.size; site++) {
        const actual = Q[site]!.reduce(
          (sum, value, other) => sum + value * basis.cosine[mode]![other]!,
          0,
        );
        expect(actual).toBeCloseTo(
          eigenvalues[mode]! * basis.cosine[mode]![site]!,
          10,
        );
      }
  });

it('length-two and 2×2 periodic parallel bonds yield hand-checkable modes', () => {
  const chain = { kind: 'chain' as const, length: 2, periodic: true };
  expect(
    fieldEigenvalues(
      { shape: chain, r: 2, kappaX: 3, kappaY: 0, source: 0 },
      createFourierBasis(chain),
    ),
  ).toEqual([2, 14]);
  const square = {
    kind: 'rectangle' as const,
    lx: 2,
    ly: 2,
    periodicX: true,
    periodicY: true,
  };
  expect(createFieldLattice(square).bonds).toHaveLength(8);
  expect(
    fieldEigenvalues(
      { shape: square, r: 2, kappaX: 3, kappaY: 5, source: 0 },
      createFourierBasis(square),
    ),
  ).toEqual([2, 14, 22, 34]);
});
