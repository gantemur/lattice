import type { PottsModel, PottsState } from './potts';
import type { PottsBond } from '../domain/pottsDomain';

/** These restrictions belong to the FK representation, not to Potts physics. */
export function fkIneligibility(model: PottsModel): string | null {
  if (model.h !== 0)
    return 'FK and Swendsen–Wang require h=0: uniform cluster coloring does not represent a nonzero source.';
  if (model.bonds.some((b) => b.K < 0))
    return 'FK and Swendsen–Wang require every physical K≥0: negative couplings give negative occupation probabilities.';
  return null;
}
export function requireFK(model: PottsModel): void {
  const reason = fkIneligibility(model);
  if (reason) throw new Error(reason);
}
export function fkProbabilities(model: PottsModel): number[] {
  requireFK(model);
  return model.bonds.map((b) => -Math.expm1(-b.K));
}
export type FKComponents = {
  labels: Uint16Array;
  sizes: number[];
  count: number;
  occupied: number;
  largest: number;
};
/** Union by size and path compression. The final ascending-site scan gives
 * canonical labels ordered by each component's smallest vertex, independent
 * of union-tree roots. Isolates count; parallel flags stay distinct; self-links
 * contribute occupation but never merge components. O((V+E) α(V)) work. */
export function fkComponents(
  size: number,
  bonds: readonly Pick<PottsBond, 'tail' | 'head'>[],
  flags: ArrayLike<number>,
): FKComponents {
  if (flags.length !== bonds.length)
    throw new Error('One FK flag is required per physical bond.');
  const parent = Int32Array.from({ length: size }, (_, i) => i),
    weight = new Int32Array(size).fill(1);
  function root(i: number): number {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]!]!;
      i = parent[i]!;
    }
    return i;
  }
  let occupied = 0;
  bonds.forEach((b, e) => {
    if (flags[e] !== 0 && flags[e] !== 1)
      throw new Error('FK flags must be 0 or 1.');
    if (!flags[e]) return;
    occupied++;
    let a = root(b.tail),
      c = root(b.head);
    if (a === c) return;
    if (weight[a]! < weight[c]!) [a, c] = [c, a];
    parent[c] = a;
    weight[a]! += weight[c]!;
  });
  const labels = new Uint16Array(size),
    roots = new Map<number, number>(),
    sizes: number[] = [];
  for (let i = 0; i < size; i++) {
    const r = root(i);
    if (!roots.has(r)) {
      roots.set(r, sizes.length);
      sizes.push(0);
    }
    const label = roots.get(r)!;
    labels[i] = label;
    sizes[label]!++;
  }
  return {
    labels,
    sizes,
    count: sizes.length,
    occupied,
    largest: Math.max(0, ...sizes),
  };
}
export function decodeFK(code: number, edges: number): Uint8Array {
  return Uint8Array.from({ length: edges }, (_, e) => (code >>> e) & 1);
}
/** Log Bernoulli factors use log(1-p)=-K exactly; open K=0 is impossible.
 * Summing spin colors contributes q^k and hence k log q to the FK weight. */
export function fkLogWeight(model: PottsModel, flags: Uint8Array): number {
  const p = fkProbabilities(model),
    components = fkComponents(model.size, model.bonds, flags);
  return (
    components.count * Math.log(model.q) +
    model.bonds.reduce(
      (sum, b, e) => sum + (flags[e] ? Math.log(p[e]!) : -b.K),
      0,
    )
  );
}
export function edwardsSokalLogWeight(
  model: PottsModel,
  colors: PottsState,
  flags: Uint8Array,
): number {
  const p = fkProbabilities(model);
  fkComponents(model.size, model.bonds, flags); // Validate one flag per physical bond.
  let logWeight = 0;
  for (let e = 0; e < model.bonds.length; e++) {
    const b = model.bonds[e]!;
    if (flags[e] && colors[b.tail] !== colors[b.head]) return -Infinity;
    logWeight += flags[e] ? Math.log(p[e]!) : -b.K;
  }
  return logWeight;
}
