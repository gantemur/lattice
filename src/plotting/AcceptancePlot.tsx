import type { SegmentSnapshot } from '../engine/protocol';
import { segmentColor } from './viewport';
export function AcceptancePlot({ segments }: { segments: SegmentSnapshot[] }) {
  const chains = segments.filter(
    (s) =>
      s.sampler.kind === 'metropolis' ||
      (s.model.kind === 'ising' && s.sampler.kind === 'heat-bath'),
  );
  return (
    <div
      className="acceptance-plot"
      role="group"
      aria-label="Sampling acceptance and movement diagnostics"
    >
      {chains.length ? (
        chains.map((s) => (
          <div key={s.id} className="acceptance-row">
            <strong style={{ color: segmentColor(s.id) }}>S{s.id}</strong>
            <span>
              {s.updates
                ? s.sampler.kind === 'heat-bath'
                  ? `${((100 * s.accepted) / s.updates).toFixed(1)}% moved · heat bath (no acceptance test)`
                  : `${((100 * (s.accepted + s.self)) / s.updates).toFixed(1)}% accepted · ${((100 * s.accepted) / s.updates).toFixed(1)}% moved`
                : 'No proposals yet'}
            </span>
            <div
              className="acceptance-bar"
              role="img"
              aria-label={`Segment ${s.id}: ${s.accepted} accepted moves, ${s.rejected} rejected, ${s.self} ${s.sampler.kind === 'heat-bath' ? 'unchanged resamples' : 'self-proposals'}`}
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
        Heat-bath self counts mean unchanged resamples. Acceptance includes
        self; movement excludes it. High acceptance does not guarantee mixing.
        No autocorrelation or ESS estimate.
      </p>
    </div>
  );
}
