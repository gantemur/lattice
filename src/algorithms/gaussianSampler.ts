import type { GaussianParameters } from '../models/gaussian';
import type { Rng } from './rng';

/** Box–Muller v1. Exactly two uniforms per update; no cached second variate. */
export function sampleGaussian({ a, h }: GaussianParameters, rng: Rng): number {
  const radius = Math.sqrt(-2 * Math.log(rng.uniform()));
  const angle = 2 * Math.PI * rng.uniform();
  return h / a + (radius * Math.cos(angle)) / Math.sqrt(a);
}
