import type { Rng } from './rng';
import { TAU, wrapXY, xyConditional, xyDifference } from '../models/xy';
import type { XYModel } from '../models/xy';
export type XYSampler = 'metropolis' | 'heat-bath';
export type XYTrace = {
  sampler: XYSampler;
  site: number;
  before: number;
  proposed: number;
  after: number;
  proposedDelta: number;
  actualDelta: number;
  outcome: 'accepted' | 'rejected' | 'resampled';
  probability: number | null;
  decision: number | null;
  draws: number;
  trials: number;
  R: number | null;
  mu: number | null;
};
export function validateXYWidth(width: number) {
  if (!Number.isFinite(width) || width < 0.02 || width > Math.PI)
    throw new Error('XY proposal half-width must be 0.02–π radians.');
}
/** Rejection from uniform δ has envelope exp(R). Each accepted δ has density
 * exp(R cosδ)/(2π I₀(R)). R=0 uses one relative Haar draw. At R≤68 (even
 * 16 parallel graph records) mean work is ~√(2πR)<21 trials. 10000 trials
 * is a generous malformed-RNG guard; exhaustion throws, NEVER substitutes a
 * biased fallback. No state is mutated until a complete conditional draw. */
export function drawXYConditional(
  R: number,
  mu: number | null,
  before: number,
  rng: Rng,
  limit = 10000,
) {
  if (
    !Number.isFinite(R) ||
    R < 0 ||
    R > 68 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 10000
  )
    throw new Error('Invalid XY conditional strength or trial bound.');
  if (R === 0)
    return {
      angle: wrapXY(before + TAU * rng.uniform() - Math.PI),
      draws: 1,
      trials: 1,
    };
  if (mu === null || !Number.isFinite(mu))
    throw new Error('A nonzero conditional field needs a direction.');
  for (let trial = 1; trial <= limit; trial++) {
    const delta = TAU * rng.uniform() - Math.PI,
      decision = rng.uniform();
    if (decision < Math.exp(R * (Math.cos(delta) - 1)))
      return { angle: wrapXY(mu + delta), draws: 2 * trial, trials: trial };
  }
  throw new Error(
    'XY conditional rejection safety bound exhausted; sampling stopped.',
  );
}
/** Validated engine-owned state is updated in place only after a completed
 * transition. Metropolis draws site/displacement/decision even downhill. */
export function xyTransition(
  model: XYModel,
  state: Float64Array,
  sampler: XYSampler,
  width: number,
  rng: Rng,
): XYTrace {
  validateXYWidth(width);
  if (!['metropolis', 'heat-bath'].includes(sampler))
    throw new Error('Unknown XY sampler.');
  const site = Math.floor(rng.uniform() * model.size),
    before = state[site]!;
  if (sampler === 'metropolis') {
    const proposed = wrapXY(before + width * (2 * rng.uniform() - 1));
    const delta = xyDifference(model, state, site, proposed),
      decision = rng.uniform();
    const probability = Math.exp(Math.min(0, -delta)),
      accepted = decision < probability;
    if (accepted) state[site] = proposed;
    return {
      sampler,
      site,
      before,
      proposed,
      after: state[site]!,
      proposedDelta: delta,
      actualDelta: accepted ? delta : 0,
      outcome: accepted ? 'accepted' : 'rejected',
      probability,
      decision,
      draws: 3,
      trials: 0,
      R: null,
      mu: null,
    };
  }
  const { R, mu } = xyConditional(model, state, site);
  const draw = drawXYConditional(R, mu, before, rng);
  const delta = xyDifference(model, state, site, draw.angle);
  state[site] = draw.angle;
  return {
    sampler,
    site,
    before,
    proposed: draw.angle,
    after: draw.angle,
    proposedDelta: delta,
    actualDelta: delta,
    outcome: 'resampled',
    probability: null,
    decision: null,
    draws: 1 + draw.draws,
    trials: draw.trials,
    R,
    mu,
  };
}
