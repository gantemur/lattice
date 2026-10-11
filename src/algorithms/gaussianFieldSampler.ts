import type { Rng } from './rng';
import type { FieldLattice } from '../domain/fieldLattice';
import {
  fieldConditional,
  fieldLocalDifference,
} from '../models/gaussianField';
import type { GaussianFieldParameters } from '../models/gaussianField';
import type { GaussianFieldReference } from '../models/gaussianFieldReference';

export type FieldSampler =
  | { kind: 'direct' }
  | { kind: 'heat-bath' }
  | { kind: 'metropolis'; width: number };
export type FieldTrace = {
  kind: FieldSampler['kind'];
  site: number | null;
  before: number | null;
  proposed: number | null;
  after: number | null;
  deltaAction: number | null;
  acceptanceProbability: number | null;
  decisionUniform: number | null;
  accepted: boolean | null;
  outcome: 'draw' | 'resampled' | 'accepted' | 'rejected';
};

export function validateFieldSampler(sampler: FieldSampler, size: number) {
  if (sampler.kind === 'direct') {
    if (size > 64)
      throw new Error('Direct dense sampling is limited to 64 sites.');
  } else if (sampler.kind === 'metropolis') {
    if (
      !Number.isFinite(sampler.width) ||
      sampler.width < 0.01 ||
      sampler.width > 10
    )
      throw new Error('Metropolis proposal width must be from 0.01 to 10.');
  } else if (sampler.kind !== 'heat-bath')
    throw new Error('Unknown field sampler.');
}

function standardNormal(rng: Rng) {
  // An uncached Box–Muller cosine draw always consumes exactly two midpoint
  // uniforms. Keeping this order stable makes Step and batches replayable.
  const radiusUniform = rng.uniform();
  const angleUniform = rng.uniform();
  return (
    Math.sqrt(-2 * Math.log(radiusUniform)) *
    Math.cos(2 * Math.PI * angleUniform)
  );
}

export function drawGaussianField(reference: GaussianFieldReference, rng: Rng) {
  // Q=LLᵀ. For independent standard normals z, solve Lᵀ(phi−μ)=z;
  // Cov(phi)=L⁻ᵀ L⁻¹=Q⁻¹. Two uniforms are used per field component.
  const n = reference.mean.length;
  const z = Array.from({ length: n }, () => standardNormal(rng));
  const noise = Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let value = z[i]!;
    for (let j = i + 1; j < n; j++)
      value -= reference.cholesky[j]![i]! * noise[j]!;
    noise[i] = value / reference.cholesky[i]![i]!;
  }
  return reference.mean.map((mean, i) => mean + noise[i]!);
}

export function fieldTransition(
  lattice: FieldLattice,
  p: GaussianFieldParameters,
  sampler: FieldSampler,
  current: readonly number[],
  rng: Rng,
  reference: GaussianFieldReference | null,
): { field: number[]; trace: FieldTrace } {
  if (sampler.kind === 'direct') {
    if (!reference)
      throw new Error('Direct sampler requires a dense reference.');
    return {
      field: drawGaussianField(reference, rng),
      trace: {
        kind: 'direct',
        site: null,
        before: null,
        proposed: null,
        after: null,
        deltaAction: null,
        acceptanceProbability: null,
        decisionUniform: null,
        accepted: null,
        outcome: 'draw',
      },
    };
  }
  const site = Math.min(
    lattice.size - 1,
    Math.floor(rng.uniform() * lattice.size),
  );
  const before = current[site]!;
  if (sampler.kind === 'heat-bath') {
    const conditional = fieldConditional(lattice, p, current, site);
    const proposed =
      conditional.mean + Math.sqrt(conditional.variance) * standardNormal(rng);
    const field = [...current];
    field[site] = proposed;
    return {
      field,
      trace: {
        kind: 'heat-bath',
        site,
        before,
        proposed,
        after: proposed,
        deltaAction: fieldLocalDifference(lattice, p, current, site, proposed),
        acceptanceProbability: null,
        decisionUniform: null,
        accepted: null,
        outcome: 'resampled',
      },
    };
  }
  const proposed = before + sampler.width * (2 * rng.uniform() - 1);
  const deltaAction = fieldLocalDifference(lattice, p, current, site, proposed);
  const acceptanceProbability = Math.exp(Math.min(0, -deltaAction));
  const decisionUniform = rng.uniform();
  const accepted = decisionUniform < acceptanceProbability;
  const field = [...current];
  if (accepted) field[site] = proposed;
  return {
    field,
    trace: {
      kind: 'metropolis',
      site,
      before,
      proposed,
      after: field[site]!,
      deltaAction,
      acceptanceProbability,
      decisionUniform,
      accepted,
      outcome: accepted ? 'accepted' : 'rejected',
    },
  };
}
