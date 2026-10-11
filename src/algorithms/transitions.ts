import { isingTransition } from './isingTransition';
import type { IsingTrace } from './isingTransition';
import type { Model } from '../models/singleVariable';
import {
  actionDifference,
  probability,
  validState,
  validateModel,
} from '../models/singleVariable';
import { sampleGaussian } from './gaussianSampler';
import type { Rng } from './rng';

export type Sampler =
  | { kind: 'direct' }
  | { kind: 'heat-bath'; warmup?: number }
  | { kind: 'metropolis'; width: number; warmup: number };
export type Settings = { model: Model; sampler: Sampler };
export type Transition = { ising?: IsingTrace } & (
  | {
      kind: 'direct';
      current: number | null;
      result: number;
      outcome: 'draw';
    }
  | {
      kind: 'heat-bath';
      current: number | null;
      result: number;
      outcome: 'resampled' | 'self';
      probabilityPlus: number;
      uniform: number;
    }
  | {
      kind: 'metropolis';
      current: number;
      attempted: number;
      proposed: number;
      delta: number;
      alpha: number;
      uniform: number;
      accepted: boolean;
      result: number;
      outcome: 'accepted' | 'rejected' | 'self';
      selfReason: 'lazy' | 'boundary' | null;
    }
);
export function validateSettings({ model, sampler }: Settings): void {
  validateModel(model);
  if (model.kind === 'scalar') {
    if (
      sampler.kind === 'direct' &&
      model.parameters.domain.vertices.some(
        (v) => model.parameters.lambda[v.id] !== 0,
      )
    )
      throw new Error('Direct sampling requires a Gaussian scalar field.');
    if (
      sampler.kind === 'heat-bath' &&
      model.parameters.domain.vertices.some(
        (v) => model.parameters.lambda[v.id] !== 0,
      )
    )
      throw new Error('Coordinate Gaussian heat bath requires λ = 0.');
  }
  if (
    sampler.kind === 'heat-bath' &&
    model.kind !== 'spin' &&
    model.kind !== 'ising' &&
    model.kind !== 'scalar'
  )
    throw new Error('Heat bath is available for the single spin only.');
  if (
    sampler.kind === 'heat-bath' &&
    (model.kind === 'ising' || model.kind === 'scalar') &&
    (!Number.isInteger(sampler.warmup ?? 200) ||
      (sampler.warmup ?? 200) < 0 ||
      (sampler.warmup ?? 200) > 10000)
  )
    throw new Error('Warm-up must be an integer from 0 to 10000 updates.');
  if (sampler.kind === 'metropolis') {
    if (
      !Number.isFinite(sampler.width) ||
      sampler.width < 0.01 ||
      sampler.width > 50
    )
      throw new Error('Use proposal half-width δ between 0.01 and 50.');
    if (
      !Number.isInteger(sampler.warmup) ||
      sampler.warmup < 0 ||
      sampler.warmup > 10000
    )
      throw new Error('Warm-up must be an integer from 0 to 10000 updates.');
  } else if (sampler.kind !== 'direct' && sampler.kind !== 'heat-bath')
    throw new Error('Unknown sampler.');
}
export function samplerName(sampler: Sampler): string {
  return sampler.kind === 'direct'
    ? 'Direct independent'
    : sampler.kind === 'heat-bath'
      ? 'Heat bath'
      : 'Metropolis';
}
export function metropolisProposal(
  model: Model,
  current: number,
  width: number,
  uniform: number,
) {
  if (model.kind === 'scalar')
    throw new Error('Use vector Metropolis transition.');
  if (model.kind === 'gaussian')
    return {
      attempted: current + width * (2 * uniform - 1),
      proposed: current + width * (2 * uniform - 1),
      selfReason: null,
    };
  if (model.kind === 'spin')
    return {
      attempted: uniform < 0.5 ? current : -current,
      proposed: uniform < 0.5 ? current : -current,
      selfReason: uniform < 0.5 ? ('lazy' as const) : null,
    };
  const attempted = current + (uniform < 0.5 ? -1 : 1),
    boundary = !validState(model, attempted);
  return {
    attempted,
    proposed: boundary ? current : attempted,
    selfReason: boundary ? ('boundary' as const) : null,
  };
}
export function transition(
  { model, sampler }: Settings,
  current: number | null,
  rng: Rng,
): Transition {
  if (model.kind === 'scalar') throw new Error('Use vector scalar transition.');
  if (model.kind === 'ising')
    return isingTransition(model, sampler, current, rng);
  if (sampler.kind === 'heat-bath') {
    if (model.kind !== 'spin')
      throw new Error('Heat bath is available for the single spin only.');
    const probabilityPlus = probability(model, 1),
      uniform = rng.uniform();
    return {
      kind: 'heat-bath',
      current,
      result: uniform < probabilityPlus ? 1 : -1,
      outcome: 'resampled',
      probabilityPlus,
      uniform,
    };
  }
  if (sampler.kind === 'direct') {
    let result: number;
    if (model.kind === 'gaussian')
      result = sampleGaussian(model.parameters, rng);
    else if (model.kind === 'spin')
      result = rng.uniform() < probability(model, 1) ? 1 : -1;
    else {
      result = 0;
      for (let i = 0; i < model.parameters.n; i++)
        if (rng.uniform() < model.parameters.p) result++;
    }
    return {
      kind: sampler.kind,
      current,
      result,
      outcome: 'draw',
    };
  }
  if (current === null || !validState(model, current))
    throw new Error('Metropolis needs a valid current configuration.');
  const proposal = metropolisProposal(
    model,
    current,
    sampler.width,
    rng.uniform(),
  );
  const delta = actionDifference(model, current, proposal.proposed);
  const alpha = Math.exp(Math.min(0, -delta));
  // Always consume the acceptance draw, including self and downhill proposals.
  const uniform = rng.uniform(),
    accepted = uniform < alpha;
  return {
    kind: 'metropolis',
    current,
    ...proposal,
    delta,
    alpha,
    uniform,
    accepted,
    result: accepted ? proposal.proposed : current,
    outcome:
      proposal.proposed === current
        ? 'self'
        : accepted
          ? 'accepted'
          : 'rejected',
  };
}
