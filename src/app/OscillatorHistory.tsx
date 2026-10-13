import type { FieldSnapshot } from '../engine/fieldRun';
import { formatNumber } from '../plotting/PlotFrame';
import { segmentColor } from '../plotting/viewport';

/** Recent retained path averages against algorithmic update number.
 * Each segment is drawn separately, so evictions and parameter boundaries
 * never become fictitious connecting transitions. */
export function OscillatorHistory({ snapshot }: { snapshot: FieldSnapshot }) {
  const segments = snapshot.segments.map((segment) => ({
    id: segment.id,
    sampler: segment.settings.sampler.kind,
    measurements: segment.measurements,
    evicted: segment.discardedMeasurements,
    points: segment.recent.map((record) => ({
      update: record.update,
      average: record.average,
    })),
  }));
  const points = segments.flatMap((segment) => segment.points);
  const first = points.length
    ? Math.min(...points.map((point) => point.update))
    : 0;
  const last = points.length
    ? Math.max(...points.map((point) => point.update))
    : 1;
  const values = points.map((point) => point.average);
  const low = Math.min(-0.1, ...values);
  const high = Math.max(0.1, ...values);
  const x = (update: number) =>
    45 + (510 * (update - first)) / Math.max(1, last - first);
  const y = (average: number) => 180 - (145 * (average - low)) / (high - low);
  return (
    <section className="field-results" aria-label="Recent path-average history">
      <h2>Recent path-average history</h2>
      <svg
        className="field-history"
        viewBox="0 0 600 220"
        role="img"
        aria-label="Retained path averages against global Monte Carlo update number"
      >
        <line x1="45" y1="180" x2="555" y2="180" stroke="#87958d" />
        <line x1="45" y1="35" x2="45" y2="180" stroke="#87958d" />
        <text x="3" y="36" fontSize="11">
          {formatNumber(high)}
        </text>
        <text x="3" y="179" fontSize="11">
          {formatNumber(low)}
        </text>
        <text x="45" y="209" fontSize="11">
          update {first}
        </text>
        <text x="550" y="209" textAnchor="end" fontSize="11">
          update {last}
        </text>
        {segments.map((segment) => (
          <g key={segment.id}>
            <polyline
              fill="none"
              stroke={segmentColor(segment.id)}
              strokeWidth="2"
              points={segment.points
                .map((point) => `${x(point.update)},${y(point.average)}`)
                .join(' ')}
            />
            {segment.points.map((point) => (
              <circle
                key={point.update}
                cx={x(point.update)}
                cy={y(point.average)}
                r="2.5"
                fill={segmentColor(segment.id)}
              />
            ))}
          </g>
        ))}
      </svg>
      <div className="field-segment-legend">
        {segments.map((segment) => (
          <span key={segment.id} style={{ color: segmentColor(segment.id) }}>
            ● segment {segment.id} (
            {segment.sampler === 'hmc'
              ? 'whole-path HMC trajectories'
              : segment.sampler === 'metropolis'
                ? 'local site attempts'
                : segment.sampler}
            ): {segment.measurements} retained paths, {segment.evicted} recent
            vectors evicted
          </span>
        ))}
      </div>
      <p className="plot-note">
        The horizontal axis is a global algorithmic transition index, not
        Euclidean or physical time. A local site attempt and an HMC trajectory
        each increment it once but have different computational cost. Only the
        latest 256 retained vectors per segment have individual path averages
        here; full-segment aggregates remain separate.
      </p>
    </section>
  );
}
