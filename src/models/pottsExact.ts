import { pottsAction, pottsObservables, pottsBondAgreement } from './potts';
import type { PottsModel, PottsState } from './potts';
export function pottsStateCount(model: PottsModel): number | null {
  const count = model.q ** model.size;
  return count <= 256 ? count : null;
}
/** Little-endian base q is an internal code, never a physical color metric. */
export function decodePotts(code: number, size: number, q: number): Uint8Array {
  const state = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    state[i] = code % q;
    code = Math.floor(code / q);
  }
  return state;
}
export function encodePotts(state: PottsState, q: number): number {
  let code = 0,
    place = 1;
  for (let i = 0; i < state.length; i++) {
    code += state[i]! * place;
    place *= q;
  }
  return code;
}
export type PottsExact = ReturnType<typeof enumeratePotts>;
function enumeratePotts(model: PottsModel) {
  const count = pottsStateCount(model);
  if (count === null)
    throw new Error('Exact Potts enumeration requires q^V≤256.');
  const states = Array.from({ length: count }, (_, code) =>
    decodePotts(code, model.size, model.q),
  );
  const actions = states.map((state) => pottsAction(model, state)),
    minimum = Math.min(...actions);
  const weights = actions.map((s) => Math.exp(minimum - s)),
    total = weights.reduce((s, w) => s + w, 0);
  const probabilities = weights.map((w) => w / total);
  const siteProbabilities = Array.from({ length: model.size }, () =>
    Array<number>(model.q).fill(0),
  );
  const pairs = Array.from({ length: model.size }, () =>
    Array<number>(model.size).fill(0),
  );
  const bonds = Array<number>(model.bonds.length).fill(0);
  const means: Record<string, number> = {},
    seconds: Record<string, number> = {};
  const cdf: number[] = [];
  let cumulative = 0;
  states.forEach((state, code) => {
    const p = probabilities[code]!;
    cumulative += p;
    cdf.push(cumulative);
    for (let i = 0; i < model.size; i++) {
      siteProbabilities[i]![state[i]!]! += p;
      for (let j = 0; j < model.size; j++)
        if (state[i] === state[j]) pairs[i]![j]! += p;
    }
    pottsBondAgreement(model, state).forEach((v, b) => {
      bonds[b]! += p * v;
    });
    for (const [key, value] of Object.entries(pottsObservables(model, state))) {
      means[key] = (means[key] ?? 0) + p * value;
      seconds[key] = (seconds[key] ?? 0) + p * value * value;
    }
  });
  cdf[count - 1] = 1; // Only guard final floating-point accumulation, not probabilities.
  return {
    logPartition: Math.log(total) - minimum,
    states,
    actions,
    probabilities,
    cdf,
    siteProbabilities,
    pairs,
    bonds,
    means,
    seconds,
  };
}
const cache = new WeakMap<PottsModel, PottsExact>();
/** Models are immutable after construction; reference work never uses RNG. */
export function exactPotts(model: PottsModel): PottsExact {
  let reference = cache.get(model);
  if (!reference) {
    reference = enumeratePotts(model);
    cache.set(model, reference);
  }
  return reference;
}
export function pottsSiteReference(q: number, h: number) {
  const z = Math.exp(h) + q - 1;
  return { logPartition: Math.log(z), p0: Math.exp(h) / z };
}
export function pottsDimerReference(q: number, K: number) {
  const z = q * (Math.exp(K) + q - 1);
  return {
    logPartition: Math.log(z),
    agreement: Math.exp(K) / (Math.exp(K) + q - 1),
  };
}
export function pottsTriangleReference(q: number, K: number) {
  const all = q * Math.exp(3 * K),
    two = 3 * q * (q - 1) * Math.exp(K),
    distinct = q * (q - 1) * (q - 2),
    z = all + two + distinct;
  return {
    logPartition: Math.log(z),
    agreement: (3 * all + two) / (3 * z),
    minimumAgreements: q === 2 ? 1 : 0,
    groundStates: q === 2 ? 6 : q * (q - 1) * (q - 2),
  };
}
