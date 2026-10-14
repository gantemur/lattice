import type { PottsModel, PottsState } from '../models/potts';
/** Test-only breadth-first oracle: deliberately does not call production DSU,
 * weights, conditional probabilities, decoding, or cluster samplers. */
export function bfsComponents(model: PottsModel, flags: ArrayLike<number>) {
  const labels = Array<number>(model.size).fill(-1),
    sizes: number[] = [];
  for (let start = 0; start < model.size; start++) {
    if (labels[start] !== -1) continue;
    const label = sizes.length,
      queue = [start];
    labels[start] = label;
    for (let next = 0; next < queue.length; next++) {
      const site = queue[next]!;
      model.bonds.forEach((b, e) => {
        if (!flags[e]) return;
        const other = b.tail === site ? b.head : b.head === site ? b.tail : -1;
        if (other >= 0 && labels[other] === -1) {
          labels[other] = label;
          queue.push(other);
        }
      });
    }
    sizes.push(queue.length);
  }
  return { labels, sizes, count: sizes.length };
}
export function independentJoint(
  model: PottsModel,
  state: PottsState,
  flags: ArrayLike<number>,
): number {
  let weight = 1;
  model.bonds.forEach((b, e) => {
    weight *= flags[e]
      ? state[b.tail] === state[b.head]
        ? 1 - Math.exp(-b.K)
        : 0
      : Math.exp(-b.K);
  });
  return weight;
}
export function conditionalBonds(
  model: PottsModel,
  state: PottsState,
  flags: ArrayLike<number>,
): number {
  let weight = 1;
  model.bonds.forEach((b, e) => {
    const p = state[b.tail] === state[b.head] ? 1 - Math.exp(-b.K) : 0;
    weight *= flags[e] ? p : 1 - p;
  });
  return weight;
}
