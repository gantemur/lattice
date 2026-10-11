import { createFieldLattice } from '../domain/fieldLattice';
import { fieldAction } from './gaussianField';
import type { GaussianFieldParameters } from './gaussianField';

/** Physical units ℏ=k_B=m=1. Time sites are periodic, x_N=x_0. */
export type OscillatorParameters = {
  sites: number;
  beta: number;
  omega: number;
};
export const defaultOscillator: OscillatorParameters = {
  sites: 16,
  beta: 8,
  omega: 1,
};

export function validateOscillator(p: OscillatorParameters): void {
  if (!Number.isInteger(p.sites) || p.sites < 4 || p.sites > 64)
    throw new Error('Time sites N must be an integer from 4 to 64.');
  if (!Number.isFinite(p.beta) || p.beta < 2 || p.beta > 16)
    throw new Error('Inverse temperature β must be from 2 to 16.');
  if (!Number.isFinite(p.omega) || p.omega < 0.25 || p.omega > 4)
    throw new Error('Frequency ω must be from 0.25 to 4.');
}

export function oscillatorSpacing(p: OscillatorParameters): number {
  validateOscillator(p);
  return p.beta / p.sites;
}

/** S=Σ[(x_{j+1}-x_j)²/(2a)+aω²x_j²/2]. No mean-zero projection. */
export function oscillatorField(
  p: OscillatorParameters,
): GaussianFieldParameters {
  const a = oscillatorSpacing(p);
  return {
    shape: { kind: 'chain', length: p.sites, periodic: true },
    r: a * p.omega ** 2,
    kappaX: 1 / a,
    kappaY: 0,
    source: 0,
  };
}

export function oscillatorAction(
  p: OscillatorParameters,
  path: readonly number[],
) {
  const a = oscillatorSpacing(p);
  if (path.length !== p.sites || path.some((x) => !Number.isFinite(x)))
    throw new Error('Oscillator path must have N finite values.');
  let action = 0;
  for (let j = 0; j < p.sites; j++) {
    const x = path[j]!;
    action += (path[(j + 1) % p.sites]! - x) ** 2 / (2 * a);
    action += (a * p.omega ** 2 * x ** 2) / 2;
  }
  return action;
}

/** Independent equality check useful at the Gaussian adapter boundary. */
export function mappedOscillatorAction(
  p: OscillatorParameters,
  path: readonly number[],
) {
  const mapped = oscillatorField(p);
  return fieldAction(createFieldLattice(mapped.shape), mapped, path);
}
