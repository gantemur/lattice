import type { Rng } from './rng';

/** Uncached Box–Muller cosine draw: exactly two midpoint uniforms per normal. */
export function standardNormal(rng: Rng) {
  const radiusUniform = rng.uniform();
  const angleUniform = rng.uniform();
  return (
    Math.sqrt(-2 * Math.log(radiusUniform)) *
    Math.cos(2 * Math.PI * angleUniform)
  );
}
