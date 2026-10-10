import type { SegmentSnapshot } from '../engine/protocol';
import { gaussianReference } from '../models/gaussian';
import { InlineMath } from '../ui/Math';
import { PlotFrame, tick } from './PlotFrame';
import { segmentColor } from './viewport';
import type { PlotViewport } from './viewport';

export function ConvergencePlot({
  segments,
  viewport,
  absoluteError,
}: {
  segments: SegmentSnapshot[];
  viewport: PlotViewport;
  absoluteError: boolean;
}) {
  const bounds = absoluteError ? viewport.error : viewport.mean;
  let zeros = 0;
  for (const s of segments)
    for (const p of s.convergence)
      if (p.mean === gaussianReference(s.parameters).mean) zeros += 1;
  return (
    <>
      <PlotFrame
        label={
          absoluteError
            ? 'Log–log absolute error of running mean'
            : 'Running mean with exact mean and pointwise one-standard-error bands'
        }
        viewport={JSON.stringify({ ...bounds, nMax: viewport.nMax })}
      >
        {({ left, right, top, bottom, width, height, compact }) => {
          const x = (n: number) =>
            left + (Math.log10(n) / Math.log10(viewport.nMax)) * (right - left);
          const transform = (v: number) => (absoluteError ? Math.log10(v) : v);
          const y = (v: number) =>
            bottom -
            ((transform(v) - transform(bounds.min)) /
              (transform(bounds.max) - transform(bounds.min))) *
              (bottom - top);
          return (
            <>
              <text x={0} y="16">
                {absoluteError ? '|mean − exact| (log)' : 'Running mean'}
              </text>
              {[0, 0.5, 1].map((t) => {
                const v = absoluteError
                  ? Math.exp(
                      Math.log(bounds.min) +
                        t * Math.log(bounds.max / bounds.min),
                    )
                  : bounds.min + t * (bounds.max - bounds.min);
                return (
                  <g key={t}>
                    <line
                      className="grid-line"
                      x1={left}
                      x2={right}
                      y1={y(v)}
                      y2={y(v)}
                    />
                    <text x={left - 5} y={y(v) + 4} textAnchor="end">
                      {tick(v)}
                    </text>
                  </g>
                );
              })}
              {segments.map((segment) => {
                const ref = gaussianReference(segment.parameters),
                  color = segmentColor(segment.id);
                if (!segment.moments.count) return null;
                const n = segment.moments.count;
                const grid = Array.from({ length: 64 }, (_, i) =>
                  Math.exp((i / 63) * Math.log(n)),
                );
                const line = (values: number[], f: (n: number) => number) =>
                  values
                    .map((v, i) => `${i ? 'L' : 'M'}${x(v)},${y(f(v))}`)
                    .join(' ');
                const se = (v: number) => ref.standardDeviation / Math.sqrt(v);
                let pen = false;
                const trajectory = segment.convergence
                  .map((p) => {
                    const value = absoluteError
                      ? Math.abs(p.mean - ref.mean)
                      : p.mean;
                    if (absoluteError && value === 0) {
                      pen = false;
                      return '';
                    }
                    const command = `${pen ? 'L' : 'M'}${x(p.count)},${y(value)}`;
                    pen = true;
                    return command;
                  })
                  .join(' ');
                return (
                  <g key={segment.id}>
                    {absoluteError ? (
                      <path
                        d={line(
                          grid,
                          (v) => ref.standardDeviation / Math.sqrt(v),
                        )}
                        fill="none"
                        stroke={color}
                        strokeDasharray="5 3"
                      />
                    ) : (
                      <>
                        <path
                          d={`${line(grid, (v) => ref.mean + se(v))} ${grid
                            .slice()
                            .reverse()
                            .map((v) => `L${x(v)},${y(ref.mean - se(v))}`)
                            .join(' ')} Z`}
                          fill={color}
                          fillOpacity="0.1"
                        />
                        <line
                          x1={left}
                          x2={x(n)}
                          y1={y(ref.mean)}
                          y2={y(ref.mean)}
                          stroke={color}
                          strokeDasharray="5 3"
                        />
                      </>
                    )}
                    <path
                      d={trajectory}
                      stroke={color}
                      strokeWidth="1.8"
                      fill="none"
                    />
                    {segment.convergence.map((p) => {
                      const v = absoluteError
                        ? Math.abs(p.mean - ref.mean)
                        : p.mean;
                      return absoluteError && v === 0 ? null : (
                        <circle
                          key={p.count}
                          cx={x(p.count)}
                          cy={y(v)}
                          r="2"
                          fill={color}
                        />
                      );
                    })}
                  </g>
                );
              })}
              {(compact
                ? [1, viewport.nMax]
                : [1, Math.sqrt(viewport.nMax), viewport.nMax]
              ).map((n, i) => (
                <text
                  key={i}
                  x={x(n)}
                  y={bottom + 20}
                  textAnchor={
                    i === 0 ? 'start' : n === viewport.nMax ? 'end' : 'middle'
                  }
                >
                  {tick(n)}
                </text>
              ))}
              <text x={width / 2} y={height - 3} textAnchor="middle">
                N · segment draws (log)
              </text>
            </>
          );
        }}
      </PlotFrame>
      <p className="plot-note">
        {absoluteError ? (
          <>
            Solid: absolute error. Dashed:{' '}
            <InlineMath>{String.raw`\sigma N^{-1/2}`}</InlineMath> RMS reference
            (slope −½).{' '}
            {zeros > 0 &&
              `${zeros} zero-error checkpoints omitted from the logarithmic view. `}
          </>
        ) : (
          <>
            Solid: running mean. Dashed: exact mean. Shading:{' '}
            <InlineMath>{String.raw`\mu\pm\sigma/\sqrt{N}`}</InlineMath> (≈68%
            pointwise coverage).{' '}
          </>
        )}
        Single-trajectory error is not monotone. Bands are not simultaneous.
      </p>
      {!segments.some((s) => s.moments.count) && (
        <p className="plot-note">
          Step or Run to collect convergence checkpoints.
        </p>
      )}
    </>
  );
}
