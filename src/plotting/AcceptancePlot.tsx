import type { SegmentSnapshot } from '../engine/protocol';
import { segmentColor } from './viewport';
export function AcceptancePlot({ segments }: { segments: SegmentSnapshot[] }) {
  const chains = segments.filter((s) => s.sampler.kind === 'metropolis');
  return (
    <div
      className="acceptance-plot"
      role="group"
      aria-label="Metropolis acceptance diagnostics"
    >
      {chains.length ? (
        chains.map((s) => (
          <div key={s.id} className="acceptance-row">
            <strong style={{ color: segmentColor(s.id) }}>S{s.id}</strong>
            <span>
              {s.updates
                ? `${((100 * (s.accepted + s.self)) / s.updates).toFixed(1)}% accepted · ${((100 * s.accepted) / s.updates).toFixed(1)}% moved`
                : 'No proposals yet'}
            </span>
            <div
              className="acceptance-bar"
              role="img"
              aria-label={`Segment ${s.id}: ${s.accepted} accepted moves, ${s.rejected} rejected, ${s.self} self-proposals`}
            >
              <span
                className="accepted-part"
                style={{
                  width: `${(100 * s.accepted) / Math.max(1, s.updates)}%`,
                }}
              />
              <span
                className="rejected-part"
                style={{
                  width: `${(100 * s.rejected) / Math.max(1, s.updates)}%`,
                }}
              />
              <span
                className="self-part"
                style={{ width: `${(100 * s.self) / Math.max(1, s.updates)}%` }}
              />
            </div>
            <small>
              {s.accepted} moves · {s.rejected} rejections · {s.self} self
            </small>
          </div>
        ))
      ) : (
        <p>
          No Metropolis segment. Exact direct / single-spin heat-bath draws have
          no acceptance test.
        </p>
      )}
      <p className="plot-note">
        Green: moves · orange: rejected · gray: self. Counts include warm-up.
        Acceptance includes self; movement excludes it. High acceptance does not
        guarantee mixing. No autocorrelation or ESS estimate.
      </p>
    </div>
  );
}
