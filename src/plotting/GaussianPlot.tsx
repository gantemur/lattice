import { gaussianDensity, gaussianReference } from '../models/gaussian';
import type { SegmentSnapshot } from '../engine/protocol';
import type { PlotViewport } from './viewport';
import { segmentColor } from './viewport';
import { PlotFrame, tick } from './PlotFrame';
export { formatNumber } from './PlotFrame';

export function GaussianPlot({
  segments,
  viewport,
  showHistogram,
}: {
  segments: SegmentSnapshot[];
  viewport: PlotViewport;
  showHistogram: boolean;
}) {
  const { min, max, yMax } = viewport.density;
  const tails = segments.reduce(
    (sum, segment) => sum + segment.histogram.above + segment.histogram.below,
    0,
  );
  return (
    <>
      <PlotFrame
        label="Gaussian probability density and segment histograms"
        viewport={JSON.stringify(viewport.density)}
      >
        {({ left, right, top, bottom, width, height, compact }) => {
          const x = (v: number) =>
            left + ((v - min) / (max - min)) * (right - left);
          const y = (v: number) => bottom - (v / yMax) * (bottom - top);
          return (
            <>
              <text x={compact ? 0 : left} y="16">
                Density p(x)
              </text>
              {[0, 0.5, 1].map((t) => (
                <g key={t}>
                  <line
                    className="grid-line"
                    x1={left}
                    x2={right}
                    y1={y(t * yMax)}
                    y2={y(t * yMax)}
                  />
                  <text x={left - 5} y={y(t * yMax) + 4} textAnchor="end">
                    {tick(t * yMax)}
                  </text>
                </g>
              ))}
              {segments.map((segment) => {
                const color = segmentColor(segment.id);
                const hist = segment.histogram;
                const bw = (hist.max - hist.min) / hist.bins.length;
                const ref = gaussianReference(segment.parameters);
                const path = Array.from({ length: 161 }, (_, i) => {
                  const v =
                    ref.mean + ((i / 160) * 8 - 4) * ref.standardDeviation;
                  return `${i ? 'L' : 'M'}${x(v)},${y(gaussianDensity(v, segment.parameters))}`;
                }).join(' ');
                const sampled = hist.bins
                  .map((n, i) => {
                    const level = segment.moments.count
                      ? n / (segment.moments.count * bw)
                      : 0;
                    return `${i ? 'L' : 'M'}${x(hist.min + i * bw)},${y(level)} L${x(hist.min + (i + 1) * bw)},${y(level)}`;
                  })
                  .join(' ');
                return (
                  <g key={segment.id} aria-label={`Segment ${segment.id}`}>
                    {showHistogram && segment.moments.count > 0 && (
                      <path
                        d={`${sampled} L${x(hist.max)},${bottom} L${x(hist.min)},${bottom} Z`}
                        fill={color}
                        fillOpacity="0.09"
                        stroke={color}
                        strokeWidth="1.3"
                      />
                    )}
                    <path
                      d={path}
                      fill="none"
                      stroke={color}
                      strokeWidth="2"
                      strokeDasharray="5 3"
                    />
                  </g>
                );
              })}
              {(compact ? [0, 1] : [0, 0.5, 1]).map((t) => (
                <text
                  key={t}
                  x={x(min + t * (max - min))}
                  y={bottom + 20}
                  textAnchor={t === 0 ? 'start' : t === 1 ? 'end' : 'middle'}
                >
                  {tick(min + t * (max - min))}
                </text>
              ))}
              <text x={width / 2} y={height - 3} textAnchor="middle">
                x · dimensionless
              </text>
            </>
          );
        }}
      </PlotFrame>
      <p className="plot-note">
        Dashed: analytic density.{' '}
        {showHistogram
          ? 'Filled: sampled, normalized per segment.'
          : 'Histograms hidden.'}{' '}
        {tails} draws outside ±4σ bins; included in moments and normalization.
      </p>
    </>
  );
}
