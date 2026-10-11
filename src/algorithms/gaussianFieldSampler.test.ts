import { expect, it } from 'vitest';
import { createFieldLattice } from '../domain/fieldLattice';
import { fieldTransition } from './gaussianFieldSampler';
import type { Rng } from './rng';
import { exactGaussianField } from '../models/gaussianFieldReference';
import type { GaussianFieldParameters } from '../models/gaussianField';

const p: GaussianFieldParameters = {
  shape: { kind: 'chain', length: 2, periodic: false },
  r: 2,
  kappaX: 0,
  kappaY: 0,
  source: 0,
};
const lattice = createFieldLattice(p.shape);
function counted(values: number[]) {
  let index = 0;
  const rng: Rng = {
    uniform() {
      return values[index++]!;
    },
  };
  return { rng, count: () => index };
}

it('direct replaces the whole field with two uniforms per component and no acceptance', () => {
  const draws = counted([0.2, 0.3, 0.4, 0.5]);
  const result = fieldTransition(
    lattice,
    p,
    { kind: 'direct' },
    [7, 8],
    draws.rng,
    exactGaussianField(p),
  );
  expect(draws.count()).toBe(4);
  expect(result.field).not.toEqual([7, 8]);
  expect(result.trace).toMatchObject({
    site: null,
    accepted: null,
    outcome: 'draw',
  });
});

it('heat bath uses site then two normal uniforms and changes only that coordinate', () => {
  const draws = counted([0.1, 0.2, 0.3]);
  const result = fieldTransition(
    lattice,
    p,
    { kind: 'heat-bath' },
    [1, -4],
    draws.rng,
    null,
  );
  expect(draws.count()).toBe(3);
  expect(result.field[1]).toBe(-4);
  expect(result.trace).toMatchObject({
    site: 0,
    accepted: null,
    outcome: 'resampled',
  });
});

it('Metropolis records a rejected proposal and consumes a decision uniform', () => {
  const draws = counted([0.1, 0.999, 0.99]);
  const result = fieldTransition(
    lattice,
    p,
    { kind: 'metropolis', width: 1 },
    [0, -4],
    draws.rng,
    null,
  );
  expect(draws.count()).toBe(3);
  expect(result.field).toEqual([0, -4]);
  expect(result.trace.outcome).toBe('rejected');
  expect(result.trace.deltaAction).toBeGreaterThan(0);
  expect(result.trace.acceptanceProbability).toBeCloseTo(
    Math.exp(-result.trace.deltaAction!),
    12,
  );
  expect(result.trace.after).toBe(0);
});
