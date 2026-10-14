import type { U1Segment } from '../engine/u1GaugeRun';
import { openPlaquetteDensity, u1Reference } from '../models/u1GaugeReference';
import { segmentColor } from '../plotting/viewport';
import { formatNumber as fmt } from '../plotting/PlotFrame';

/** All bins cover the fixed circle; zero samples are not a zero density estimate.
 * References use each segment's target. Only the open plaquette has the simple
 * von Mises density; winding holonomies have Haar density on the torus. */
export function U1AngleHistogram({
  segments,
  loop,
}: {
  segments: U1Segment[];
  loop: string;
}) {
  const measured = segments.filter((s) => s.samples && s.histograms[loop]);
  const width = (2 * Math.PI) / 24;
  const referenceSegments = segments.filter((s) => s.histograms[loop]);
  const curves = referenceSegments.map((s) => {
    const reference = u1Reference(s.settings.geometry, s.settings.K);
    const density =
      loop === 'wx' || loop === 'wy'
        ? () => 1 / (2 * Math.PI)
        : s.settings.geometry === 'square' && loop === 'f0' && reference.values
          ? (a: number) => openPlaquetteDensity(a, s.settings.K, reference)
          : null;
    return { s, density };
  });
  const maximum =
    Math.max(
      0.25,
      ...measured.flatMap((s) =>
        s.histograms[loop]!.map((n) => n / (s.samples * width)),
      ),
      ...curves.flatMap((c) =>
        c.density
          ? Array.from({ length: 129 }, (_, i) =>
              c.density!(-Math.PI + (2 * Math.PI * i) / 128),
            )
          : [],
      ),
    ) * 1.1;
  const x = (angle: number) => 45 + (410 * (angle + Math.PI)) / (2 * Math.PI);
  const y = (density: number) => 200 - (165 * density) / maximum;
  return (
    <div>
      <svg
        viewBox="0 0 480 250"
        role="img"
        aria-label={`${loop} angle probability density`}
      >
        <line x1="45" x2="455" y1="200" y2="200" stroke="#777" />
        <text x="45" y="18" fontSize="12">
          Density (per radian); max {fmt(maximum)}
        </text>
        {measured.map((s) => (
          <path
            key={s.id}
            d={s.histograms[loop]!.map(
              (n, i) =>
                `${i ? 'L' : 'M'} ${x(-Math.PI + i * width)} ${y(n / (s.samples * width))} L ${x(-Math.PI + (i + 1) * width)} ${y(n / (s.samples * width))}`,
            ).join(' ')}
            fill="none"
            stroke={segmentColor(s.id)}
            strokeWidth="2"
          />
        ))}
        {curves.map(
          ({ s, density }) =>
            density && (
              <path
                key={s.id}
                d={Array.from({ length: 129 }, (_, i) => {
                  const a = -Math.PI + (2 * Math.PI * i) / 128;
                  return `${i ? 'L' : 'M'} ${x(a)} ${y(density(a))}`;
                }).join(' ')}
                fill="none"
                stroke={segmentColor(s.id)}
                strokeDasharray="5 4"
              />
            ),
        )}
        <text x="45" y="220" fontSize="12">
          −π
        </text>
        <text x="244" y="220" fontSize="12">
          0
        </text>
        <text x="445" y="220" fontSize="12">
          π
        </text>
        <text x="110" y="242" fontSize="12">
          Invariant {loop} principal angle (radians)
        </text>
      </svg>
      {referenceSegments.map((s) => (
        <p
          className="plot-note"
          key={s.id}
          style={{ color: segmentColor(s.id) }}
        >
          Segment {s.id}, K={s.settings.K}: {s.samples} measurements; solid
          histogram, dashed theory where available.
        </p>
      ))}
      {!measured.length && <p>No retained measurements yet.</p>}
      <p className="plot-note">
        Full-segment 24-bin density, not a raw link distribution. The open face
        has a von Mises reference; periodic face density is not the open
        formula. Torus winding references are uniform Haar densities. The ±π
        boundary is a coordinate cut on the circle.
      </p>
    </div>
  );
}
export function U1History({
  segments,
  observable,
}: {
  segments: U1Segment[];
  observable: string;
}) {
  return (
    <div>
      {segments.map((s) => {
        const first = s.history[0]?.update ?? 0,
          last = s.history.at(-1)?.update ?? 1;
        const reference = u1Reference(s.settings.geometry, s.settings.K).values;
        const expected =
          observable.endsWith('.im') || observable.startsWith('w')
            ? 0
            : observable === 'pair.re'
              ? reference?.pair
              : reference?.meanPlaquette;
        return (
          <div key={s.id}>
            <p style={{ color: segmentColor(s.id) }}>
              Segment {s.id}, K={s.settings.K}: {s.history.length} recent /{' '}
              {s.samples} retained measurements; global updates {first}–{last}.
            </p>
            <svg
              viewBox="0 0 480 180"
              role="img"
              aria-label={`Segment ${s.id} ${observable} history`}
            >
              <text x="15" y="14" fontSize="12">
                {observable} ∈ [−1,1]; dashed exact mean
              </text>
              <line x1="30" x2="460" y1="80" y2="80" stroke="#ddd" />
              {expected !== null && expected !== undefined && (
                <line
                  x1="30"
                  x2="460"
                  y1={80 - 52 * expected}
                  y2={80 - 52 * expected}
                  stroke={segmentColor(s.id)}
                  strokeDasharray="5 4"
                />
              )}
              {s.history.map((h) => (
                <circle
                  key={h.update}
                  cx={
                    30 + (430 * (h.update - first)) / Math.max(1, last - first)
                  }
                  cy={80 - 52 * h.values[observable]!}
                  r="2"
                  fill={segmentColor(s.id)}
                />
              ))}
              <text x="30" y="153" fontSize="12">
                {first}
              </text>
              <text x="400" y="153" fontSize="12">
                {last}
              </text>
              <text x="100" y="175" fontSize="12">
                Algorithmic update; not physical time
              </text>
            </svg>
          </div>
        );
      })}
      <p className="plot-note">
        Latest 256 measured configurations per segment. Points do not imply
        independent draws; evicted records are not reconstructed or joined.
      </p>
    </div>
  );
}
