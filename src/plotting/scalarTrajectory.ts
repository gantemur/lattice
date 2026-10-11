import type { SegmentSnapshot } from '../engine/protocol';
import type { ScalarTrace } from '../engine/scalarRun';
import type { ScalarModel } from '../models/scalarField';
import { scalarObservable } from '../models/scalarField';

export type ScalarTrajectoryRecord = {
  trace: ScalarTrace;
  before: number | null;
  result: number;
  xBefore: number;
  xResult: number;
};
export type ScalarTrajectorySegment = {
  segment: SegmentSnapshot;
  records: ScalarTrajectoryRecord[];
};

/** A read-only projection of retained transitions onto a global-update window. */
export function scalarTrajectoryWindow(
  segments: SegmentSnapshot[],
  target: string,
  windowLength: 100 | 500 | 1000,
  requestedEnd: number | null,
): {
  firstShown: number;
  lastShown: number;
  last: number;
  earliestRetained: number;
  visible: ScalarTrajectorySegment[];
  retained: number;
} {
  const last = Math.max(1, ...segments.map((s) => s.startUpdate + s.updates));
  const firstRecords = segments
    .map((s) => s.scalar?.trajectory[0]?.update)
    .filter((n): n is number => n !== undefined);
  const earliestRetained = firstRecords.length
    ? Math.min(...firstRecords)
    : last;
  const lastShown = Math.max(
    earliestRetained,
    Math.min(requestedEnd ?? last, last),
  );
  const firstShown = Math.max(0, lastShown - windowLength);
  // Global update numbers determine x coordinates; the displayed window,
  // rather than the lifetime run length, determines the pixel scale.
  const width = Math.max(1, lastShown - firstShown);
  const visible = segments
    .filter((s) => s.model.kind === 'scalar' && s.scalar)
    .map((segment) => ({
      segment,
      records: segment
        .scalar!.trajectory.filter(
          (trace) => trace.update > firstShown && trace.update <= lastShown,
        )
        .map((trace) => {
          const model = segment.model as ScalarModel;
          return {
            trace,
            before: trace.before
              ? scalarObservable(model, trace.before, target)
              : null,
            result: scalarObservable(model, trace.result, target),
            xBefore:
              (Math.max(firstShown, trace.update - 1) - firstShown) / width,
            xResult: (trace.update - firstShown) / width,
          };
        }),
    }));
  return {
    firstShown,
    lastShown,
    last,
    earliestRetained,
    visible,
    retained: visible.reduce((n, s) => n + s.records.length, 0),
  };
}
