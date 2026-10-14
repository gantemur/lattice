import { pottsDomain, validatePottsCoupling } from '../domain/pottsDomain';
import type { PottsGeometrySettings, PottsDomain } from '../domain/pottsDomain';
export type PottsParameters = {
  q: 2 | 3 | 4;
  h: number;
  geometry: PottsGeometrySettings;
};
export type PottsModel = PottsDomain & { q: 2 | 3 | 4; h: number };
export type PottsState = ArrayLike<number>;
export function pottsModel(p: PottsParameters): PottsModel {
  if (![2, 3, 4].includes(p.q)) throw new Error('Potts q must be 2, 3 or 4.');
  validatePottsCoupling(p.h);
  return { ...pottsDomain(p.geometry), q: p.q, h: p.h };
}
export function validatePottsState(model: PottsModel, state: PottsState): void {
  if (state.length !== model.size)
    throw new Error('One categorical color per site is required.');
  for (let i = 0; i < state.length; i++) validateColor(model, state[i]!);
}
function validateColor(model: PottsModel, color: number) {
  if (!Number.isInteger(color) || color < 0 || color >= model.q)
    throw new Error('Color must be an integer from 0 to q−1.');
}
function validateSite(model: PottsModel, state: PottsState, site: number) {
  if (
    state.length !== model.size ||
    !Number.isInteger(site) ||
    site < 0 ||
    site >= model.size
  )
    throw new Error('Invalid Potts site or state length.');
  validateColor(model, state[site]!);
}
/** Counting-measure action S=-Σ_b K_b δ(s_t,s_h)-h Σ_i δ(s_i,0).
 * Each bond contributes once, including the constant -K of any self-link. */
export function pottsAction(model: PottsModel, state: PottsState): number {
  validatePottsState(model, state);
  let action = 0;
  for (let i = 0; i < model.size; i++) if (state[i] === 0) action -= model.h;
  for (const b of model.bonds)
    if (state[b.tail] === state[b.head]) action -= b.K;
  return action;
}
/** Local kernels accept a previously validated state. Check touched colors;
 * no full lattice scan is needed to evaluate a single-site conditional. */
export function pottsLogWeights(
  model: PottsModel,
  state: PottsState,
  site: number,
): number[] {
  validateSite(model, state, site);
  const scores = Array<number>(model.q).fill(0);
  scores[0] = model.h;
  for (const { bond, neighbor } of model.incident[site]!) {
    const color = state[neighbor]!;
    validateColor(model, color);
    scores[color]! += model.bonds[bond]!.K;
  }
  return scores;
}
export function pottsConditional(
  model: PottsModel,
  state: PottsState,
  site: number,
): number[] {
  const scores = pottsLogWeights(model, state, site),
    maximum = Math.max(...scores);
  const weights = scores.map((s) => Math.exp(s - maximum)),
    sum = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => w / sum);
}
export function pottsDifference(
  model: PottsModel,
  state: PottsState,
  site: number,
  proposed: number,
): number {
  validateColor(model, proposed);
  const scores = pottsLogWeights(model, state, site);
  return scores[state[site]!]! - scores[proposed]!;
}
export function pottsBondAgreement(
  model: PottsModel,
  state: PottsState,
): number[] {
  validatePottsState(model, state);
  return model.bonds.map((b) => Number(state[b.tail] === state[b.head]));
}
export function pottsCounts(model: PottsModel, state: PottsState): number[] {
  validatePottsState(model, state);
  const counts = Array<number>(model.q).fill(0);
  for (let i = 0; i < model.size; i++) counts[state[i]!]!++;
  return counts;
}
export function pottsPair(
  model: PottsModel,
  state: PottsState,
  i: number,
  j: number,
): number {
  validateSite(model, state, i);
  validateSite(model, state, j);
  return Number(state[i] === state[j]);
}
/** Categorical fractions, never an arithmetic mean of color labels. Missing
 * bond directions are absent observables, not fabricated zero agreements. */
export function pottsObservables(
  model: PottsModel,
  state: PottsState,
): Record<string, number> {
  const counts = pottsCounts(model, state),
    fractions = counts.map((n) => n / model.size),
    action = pottsAction(model, state);
  const values: Record<string, number> = {
    action,
    actionDensity: action / model.size,
    m0: (model.q * fractions[0]! - 1) / (model.q - 1),
    majority: (model.q * Math.max(...fractions) - 1) / (model.q - 1),
  };
  fractions.forEach((p, a) => {
    values[`p${a}`] = p;
    values[`n${a}`] = counts[a]!;
  });
  const agreement = pottsBondAgreement(model, state);
  if (agreement.length)
    values.agreement = agreement.reduce((a, b) => a + b, 0) / agreement.length;
  for (const [axis, key] of [
    [0, 'agreementX'],
    [1, 'agreementY'],
  ] as const) {
    const indices = model.bonds.flatMap((b, i) => (b.axis === axis ? [i] : []));
    if (indices.length)
      values[key] =
        indices.reduce((s, i) => s + agreement[i]!, 0) / indices.length;
  }
  return values;
}
export type PottsSpatial = { r: number; pairs: number; same: number };
/** Raw finite-volume origin averages, with at most eight lags per axis.
 * No spatial demeaning or connected-covariance claim, including at h≠0. */
export function pottsSpatial(
  model: PottsModel,
  state: PottsState,
  axis: 0 | 1,
): PottsSpatial[] {
  if (!model.shape) return [];
  validatePottsState(model, state);
  const { lx, ly, periodicX, periodicY } = model.shape;
  const length = axis === 0 ? lx : ly,
    periodic = axis === 0 ? periodicX : periodicY;
  return Array.from({ length: Math.min(8, length - 1) + 1 }, (_, r) => {
    let sum = 0,
      pairs = 0;
    for (let y = 0; y < ly; y++)
      for (let x = 0; x < lx; x++) {
        const dx = axis === 0 ? r : 0,
          dy = axis === 1 ? r : 0;
        if (!periodic && (x + dx >= lx || y + dy >= ly)) continue;
        sum += Number(
          state[x + lx * y] === state[((x + dx) % lx) + lx * ((y + dy) % ly)],
        );
        pairs++;
      }
    return { r, pairs, same: sum / pairs };
  });
}
