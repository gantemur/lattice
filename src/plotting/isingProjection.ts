import type { SegmentSnapshot } from '../engine/protocol';
import { observableValue } from '../models/ising';
import { support } from '../models/singleVariable';
/** Read-only projection of worker measurements; never redraws random samples. */
export function projectSegments(
  segments: SegmentSnapshot[],
  target: string,
): SegmentSnapshot[] {
  return segments.map((segment) => {
    if (segment.model.kind !== 'ising' || !segment.ising) return segment;
    const model = { ...segment.model, observable: target },
      entry = segment.ising.observables[target]!;
    const states = support(model),
      bins = states.map(() => 0);
    segment.ising.counts.forEach((count, state) => {
      bins[states.indexOf(observableValue(model, state))]! += count;
    });
    const project = (state: number | null) =>
      state === null ? null : observableValue(model, state);
    return {
      ...segment,
      model,
      ...entry,
      histogram: {
        min: states[0]! - 0.5,
        max: states.at(-1)! + 0.5,
        bins,
        below: 0,
        above: 0,
      },
      initialValue: project(segment.initialValue),
      trajectory: segment.trajectory.map((t) => ({
        ...t,
        current: project(t.current),
        result: project(t.result)!,
      })) as SegmentSnapshot['trajectory'],
    };
  });
}
