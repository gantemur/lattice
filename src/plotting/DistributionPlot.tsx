import {
  modelReference,
  probability,
  support,
  variableName,
} from '../models/singleVariable';
import type { SegmentSnapshot } from '../engine/protocol';
import type { PlotViewport } from './viewport';
import { segmentColor } from './viewport';
import { PlotFrame, tick } from './PlotFrame';
export { formatNumber } from './PlotFrame';

export function DistributionPlot({
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
        label="Exact distribution and sampled histogram"
        viewport={JSON.stringify(viewport.density)}
      >
        {({ left, right, top, bottom, width, height, compact }) => {
          const axisValue = (t: number) =>
            segments[0]!.model.kind === 'gaussian'
              ? min + t * (max - min)
              : Math.round(
                  Math.ceil(min) + t * (Math.floor(max) - Math.ceil(min)),
                );
          const x = (v: number) =>
            left + ((v - min) / (max - min)) * (right - left);
          const y = (v: number) => bottom - (v / yMax) * (bottom - top);
          return (
            <>
              <text x={compact ? 0 : left} y="16">
                {segments[0]!.model.kind === 'gaussian'
                  ? 'Density p(x)'
                  : 'Probability mass'}
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
                const ref = modelReference(segment.model);
                if (segment.model.kind !== 'gaussian') {
                  return (
                    <g key={segment.id} aria-label={`Segment ${segment.id}`}>
                      {support(segment.model).map((state, i) => {
                        const w = ((right - left) / (max - min)) * 0.7;
                        const mass = probability(segment.model, state);
                        const sampled = segment.moments.count
                          ? hist.bins[i]! / segment.moments.count
                          : 0;
                        return (
                          <g key={state}>
                            <rect
                              x={x(state) - w / 2}
                              y={y(mass)}
                              width={w}
                              height={bottom - y(mass)}
                              fill="none"
                              stroke={color}
                              strokeWidth="1.5"
                            />
                            {showHistogram && (
                              <rect
                                x={x(state) - w * 0.32}
                                y={y(sampled)}
                                width={w * 0.64}
                                height={bottom - y(sampled)}
                                fill={color}
                                fillOpacity="0.35"
                              />
                            )}
                          </g>
                        );
                      })}
                    </g>
                  );
                }
                const path = Array.from({ length: 161 }, (_, i) => {
                  const v =
                    ref.mean + ((i / 160) * 8 - 4) * ref.standardDeviation;
                  return `${i ? 'L' : 'M'}${x(v)},${y(probability(segment.model, v))}`;
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
                  x={x(axisValue(t))}
                  y={bottom + 20}
                  textAnchor={t === 0 ? 'start' : t === 1 ? 'end' : 'middle'}
                >
                  {tick(axisValue(t))}
                </text>
              ))}
              <text x={width / 2} y={height - 3} textAnchor="middle">
                {variableName(segments[0]!.model)} · dimensionless
              </text>
            </>
          );
        }}
      </PlotFrame>
      <p className="plot-note">
        {segments[0]!.model.kind === 'gaussian' ? (
          <>
            Dashed: analytic density.{' '}
            {showHistogram
              ? 'Filled: sampled, normalized per segment.'
              : 'Histograms hidden.'}{' '}
            {tails} draws outside ±4σ bins; included in moments and
            normalization.
          </>
        ) : (
          <>
            Outline: exact probability mass.{' '}
            {showHistogram
              ? 'Filled bars: sampled mass per segment.'
              : 'Sampled bars hidden.'}{' '}
            Warm-up excluded.
          </>
        )}
      </p>
    </>
  );
}
