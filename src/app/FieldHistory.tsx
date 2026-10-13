import type { FieldSnapshot } from '../engine/fieldRun';
import { segmentColor } from '../plotting/viewport';

/** A display-only projection of bounded measurement vectors, never updates. */
export function FieldHistory({
  snapshot,
  site,
  limit,
}: {
  snapshot: FieldSnapshot;
  site: number;
  limit: number;
}) {
  const records = snapshot.segments.flatMap((segment) =>
    segment.recent.map((record) => ({ segment, record })),
  );
  const first = records.length
    ? Math.min(...records.map(({ record }) => record.update))
    : 0;
  const last = records.length
    ? Math.max(...records.map(({ record }) => record.update))
    : 1;
  const x = (update: number) =>
    48 + (522 * (update - first)) / Math.max(1, last - first);
  const y = (value: number) =>
    110 - 82 * Math.max(-1, Math.min(1, value / limit));
  const clipped = records.filter(
    ({ record }) => Math.abs(record.field[site]!) > limit,
  ).length;
  const clippedReferences = snapshot.segments.filter(
    (segment) =>
      segment.recent.length > 0 &&
      segment.reference !== null &&
      Math.abs(segment.reference!.mean[site]!) > limit,
  ).length;
  return (
    <section
      className="field-results"
      aria-label="Selected-site measurement history"
    >
      <h2>
        Retained φ<sub>{site}</sub> measurements
      </h2>
      <svg
        className="field-history"
        viewBox="0 0 600 210"
        role="img"
        aria-label={`Retained selected-site values against global algorithmic update number, display range plus or minus ${limit}`}
      >
        <line x1="48" y1="110" x2="570" y2="110" stroke="#b9c7bf" />
        <text x="3" y="31" fontSize="12">
          +{limit}
        </text>
        <text x="3" y="114" fontSize="12">
          0
        </text>
        <text x="3" y="195" fontSize="12">
          −{limit}
        </text>
        {snapshot.segments.map((segment) => {
          if (!segment.recent.length || !segment.reference) return null;
          const start = segment.recent[0]!.update;
          const end = segment.recent.at(-1)!.update;
          return (
            <line
              key={segment.id}
              x1={x(start)}
              x2={x(end)}
              y1={y(segment.reference!.mean[site]!)}
              y2={y(segment.reference!.mean[site]!)}
              stroke={segmentColor(segment.id)}
              strokeDasharray="5 4"
              strokeWidth="1.5"
            />
          );
        })}
        {records.map(({ segment, record }) => (
          <circle
            key={`${segment.id}:${record.update}`}
            cx={x(record.update)}
            cy={y(record.field[site]!)}
            r="2.6"
            fill={segmentColor(segment.id)}
          />
        ))}
        <text x="48" y="207" fontSize="12">
          update {first}
        </text>
        <text x="485" y="207" fontSize="12">
          update {last}
        </text>
      </svg>
      <div className="field-segment-legend">
        {snapshot.segments.map((segment) => (
          <span key={segment.id} style={{ color: segmentColor(segment.id) }}>
            ● segment {segment.id}: {segment.measurements} measurements,{' '}
            {segment.discardedMeasurements} older vectors evicted
          </span>
        ))}
      </div>
      <p className="plot-note">
        Points are recorded post-warm-up measurements; dashed lines are each
        segment’s exact finite-volume site mean when an analytic reference
        exists. Gaps and evicted measurements are not reconstructed or joined.
        Horizontal position is update count, not physical time.{' '}
        {snapshot.segments.some(
          (segment) => segment.settings.model === 'phi4-field',
        ) && (
          <>
            Across sampler segments, one update can mean a local site attempt or
            a whole-field HMC trajectory; these are not equal work.{' '}
          </>
        )}
        {clipped} displayed point{clipped === 1 ? '' : 's'} clipped.{' '}
        {clippedReferences} exact mean line
        {clippedReferences === 1 ? '' : 's'} clipped.
      </p>
    </section>
  );
}
