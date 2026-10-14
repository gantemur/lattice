import type { PottsModel } from './potts';
import {
  decodeFK,
  fkComponents,
  fkLogWeight,
  fkIneligibility,
  requireFK,
} from './fk';

export function canEnumerateFK(model: PottsModel): boolean {
  return !fkIneligibility(model) && model.size <= 4 && model.bonds.length <= 8;
}
/** Exhaustive reference, capped independently of q^V. Impossible p=0 words
 * remain in the table with probability zero. Log-sum-exp avoids normalization
 * failure for concentrated measures and keeps the absolute Potts shift visible. */
function enumerateFK(model: PottsModel) {
  requireFK(model);
  if (!canEnumerateFK(model)) throw new Error('Exact FK requires V≤4 and E≤8.');
  const states = Array.from({ length: 2 ** model.bonds.length }, (_, code) =>
    decodeFK(code, model.bonds.length),
  );
  const components = states.map((flags) =>
    fkComponents(model.size, model.bonds, flags),
  );
  const logWeights = states.map((flags) => fkLogWeight(model, flags));
  const maximum = Math.max(...logWeights),
    scaled = logWeights.map((w) => Math.exp(w - maximum));
  const total = scaled.reduce((a, b) => a + b, 0),
    probabilities = scaled.map((w) => w / total);
  const logPartition = Math.log(total) + maximum;
  const bonds = Array<number>(model.bonds.length).fill(0);
  const connectivity = Array.from({ length: model.size }, () =>
    Array<number>(model.size).fill(0),
  );
  const clusterCounts = Array<number>(model.size + 1).fill(0),
    bondCounts = Array<number>(model.bonds.length + 1).fill(0);
  const largestSizes = Array<number>(model.size + 1).fill(0),
    clusterSizes = Array<number>(model.size + 1).fill(0);
  let meanClusters = 0,
    meanOccupied = 0,
    meanLargest = 0,
    cumulative = 0;
  const cdf: number[] = [];
  states.forEach((flags, code) => {
    const p = probabilities[code]!,
      c = components[code]!;
    cumulative += p;
    cdf.push(cumulative);
    clusterCounts[c.count]! += p;
    bondCounts[c.occupied]! += p;
    largestSizes[c.largest]! += p;
    for (const size of c.sizes) clusterSizes[size]! += p;
    meanClusters += p * c.count;
    meanOccupied += p * c.occupied;
    meanLargest += p * c.largest;
    flags.forEach((flag, e) => {
      bonds[e]! += p * flag;
    });
    for (let i = 0; i < model.size; i++)
      for (let j = 0; j < model.size; j++)
        if (c.labels[i] === c.labels[j]) connectivity[i]![j]! += p;
  });
  cdf[cdf.length - 1] = 1;
  return {
    states,
    components,
    logWeights,
    weights: logWeights.map(Math.exp),
    probabilities,
    cdf,
    logPartition,
    logPottsPartition: logPartition + model.bonds.reduce((s, b) => s + b.K, 0),
    bonds,
    connectivity,
    clusterCounts,
    bondCounts,
    largestSizes,
    clusterSizes,
    meanClusters,
    meanOccupied,
    meanLargest,
  };
}
export type FKExact = ReturnType<typeof enumerateFK>;
const cache = new WeakMap<PottsModel, FKExact>();
export function exactFK(model: PottsModel): FKExact {
  let reference = cache.get(model);
  if (!reference) {
    reference = enumerateFK(model);
    cache.set(model, reference);
  }
  return reference;
}
