import type { SegmentSnapshot } from '../engine/protocol';
import { segmentColor } from './viewport';

export function ScalarAcceptancePlot({
  segments,
}: {
  segments: SegmentSnapshot[];
}) {
  return (
    <div
      className="acceptance-plot"
      role="group"
      aria-label="Real scalar acceptance diagnostics"
    >
      {segments.map((s) => (
        <div key={s.id} className="acceptance-row">
          <strong style={{ color: segmentColor(s.id) }}>S{s.id}</strong>
          {s.sampler.kind === 'metropolis' ? (
            <>
              <span>
                {s.updates
                  ? `${((100 * s.accepted) / s.updates).toFixed(1)}% accepted`
                  : 'No proposals yet'}
              </span>
              <div
                className="acceptance-bar"
                role="img"
                aria-label={`Segment ${s.id}: ${s.accepted} accepted moves, ${s.rejected} rejected proposals`}
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
              </div>
              <small>
                {s.accepted} accepted moves · {s.rejected} rejected proposals ·
                {s.updates} attempts including {s.warmupUpdates} warm-up
              </small>
            </>
          ) : (
            <>
              <span>Acceptance N/A · no accept/reject test</span>
              <small>
                {s.sampler.kind === 'direct'
                  ? `${s.updates} independent whole-vector Gaussian draws`
                  : `${s.updates} coordinate Gaussian heat-bath resamplings`}
                , including {s.warmupUpdates} warm-up updates.
              </small>
            </>
          )}
        </div>
      ))}
      <p className="plot-note">
        Green: accepted moves · orange: rejected proposals. Metropolis counts
        include warm-up; a high acceptance rate does not establish mixing.
        Direct Gaussian and coordinate heat bath have no acceptance rate.
      </p>
    </div>
  );
}
