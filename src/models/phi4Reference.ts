import type { Phi4FieldParameters } from './phi4Field';
import { validatePhi4Field, phi4Size } from './phi4Field';
import { quarticReference } from './scalarField';
import { validateQuarticOscillator } from './quarticOscillator';
import type { QuarticOscillatorParameters } from './quarticOscillator';

/** S_space=S_QM with a=1/κ, β=N a and (rQM,λQM,hQM)=(r,λ,j)/a.
 * Availability is narrower than the spatial measure's validity, by design. */
export function spatialQmMapping(
  p: Phi4FieldParameters,
):
  | { parameters: QuarticOscillatorParameters; reason: null }
  | { parameters: null; reason: string } {
  validatePhi4Field(p);
  if (p.shape.kind !== 'chain' || !p.shape.periodic || p.kappaX <= 0)
    return {
      parameters: null,
      reason:
        'Transfer reference requires a periodic 1D chain with positive κx.',
    };
  const parameters = {
    sites: p.shape.length,
    beta: p.shape.length / p.kappaX,
    r: p.r * p.kappaX,
    lambda: p.lambda * p.kappaX,
    h: p.source * p.kappaX,
  };
  try {
    validateQuarticOscillator(parameters);
  } catch (cause) {
    return {
      parameters: null,
      reason: `Converted QM reference is outside its validated bounds: ${cause instanceof Error ? cause.message : String(cause)}`,
    };
  }
  return { parameters, reason: null };
}
/** Called only for an open reference tool; the existing bounded quadrature
 * cache and its tail/convergence failures remain authoritative. */
export function decoupledPhi4Reference(p: Phi4FieldParameters) {
  validatePhi4Field(p);
  if (p.kappaX !== 0 || p.kappaY !== 0)
    throw new Error('Independent-site reference requires zero stiffness.');
  const site = quarticReference(p.r, p.lambda, p.source);
  if (
    ![
      site.mean,
      site.variance,
      site.secondMoment,
      site.fourthMoment,
      site.logPartition,
    ].every(Number.isFinite)
  )
    throw new Error(
      'Single-site quadrature returned unsupported numerical accuracy.',
    );
  return {
    site,
    logPartition: phi4Size(p) * site.logPartition,
    distinctPair: site.mean ** 2,
  };
}
