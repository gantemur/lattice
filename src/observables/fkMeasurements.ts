import type { PottsModel } from '../models/potts';
import type { PottsClusterTrace } from '../algorithms/pottsClusterSampler';
import { emptyMoments, recordMoment } from './moments';

/** Only actual auxiliary samples enter these totals. No inferred clusters from
 * spin-color domains, no per-frame measurements and no full large NxN matrix. */
export function emptyFKMeasurements(model: PottsModel) {
  return {
    work: { trajectories: 0, bondVisits: 0, colorAssignments: 0, uniforms: 0 },
    moments: {
      occupied: emptyMoments(),
      occupiedFraction: emptyMoments(),
      clusters: emptyMoments(),
      largestFraction: emptyMoments(),
    },
    bondCounts: Array<number>(model.bonds.length).fill(0),
    pairCounts:
      model.size <= 4
        ? Array.from({ length: model.size }, () =>
            Array<number>(model.size).fill(0),
          )
        : null,
    clusterCounts: Array<number>(model.size + 1).fill(0),
    occupiedCounts: Array<number>(model.bonds.length + 1).fill(0),
    largestSizes: Array<number>(model.size + 1).fill(0),
    // Frequency of components of each size, not a size-biased site histogram.
    clusterSizes: Array<number>(model.size + 1).fill(0),
  };
}
export type FKMeasurements = ReturnType<typeof emptyFKMeasurements>;
export function recordFKWork(target: FKMeasurements, trace: PottsClusterTrace) {
  target.work.trajectories++;
  target.work.bondVisits += trace.bondVisits;
  target.work.colorAssignments += trace.colorAssignments;
  target.work.uniforms += trace.uniformCount;
}
export function recordFKMeasurement(
  target: FKMeasurements,
  trace: PottsClusterTrace,
): Record<string, number> {
  const values = {
    occupied: trace.occupied,
    occupiedFraction: trace.flags.length
      ? trace.occupied / trace.flags.length
      : 0,
    clusters: trace.count,
    largestFraction: trace.largest / trace.labels.length,
  };
  for (const key of Object.keys(values) as (keyof typeof values)[])
    recordMoment(target.moments[key], values[key]);
  trace.flags.forEach((flag, e) => {
    target.bondCounts[e]! += flag;
  });
  if (target.pairCounts)
    for (let i = 0; i < trace.labels.length; i++)
      for (let j = 0; j < trace.labels.length; j++)
        if (trace.labels[i] === trace.labels[j]) target.pairCounts[i]![j]!++;
  target.clusterCounts[trace.count]!++;
  target.occupiedCounts[trace.occupied]!++;
  target.largestSizes[trace.largest]!++;
  trace.sizes.forEach((size) => {
    target.clusterSizes[size]!++;
  });
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [`fk.${key}`, value]),
  );
}
