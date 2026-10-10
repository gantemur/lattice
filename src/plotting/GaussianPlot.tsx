import { useEffect, useRef, useState } from 'react';
import { gaussianDensity, gaussianReference } from '../models/gaussian';
import type { GaussianParameters } from '../models/gaussian';
import type { Snapshot } from '../engine/protocol';

export function formatNumber(value: number | null): string {
  if (value === null) return '—';
  return new Intl.NumberFormat('en', { maximumFractionDigits: 4 }).format(
    value,
  );
}

export function GaussianPlot({
  parameters,
  snapshot,
  showHistogram,
}: {
  parameters: GaussianParameters;
  snapshot: Snapshot | null;
  showHistogram: boolean;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(400);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      if (entry && entry.contentRect.width > 0)
        setWidth(Math.max(120, Math.round(entry.contentRect.width)));
    });
    observer.observe(svg.current!);
    return () => observer.disconnect();
  }, []);
  // Keep labels at readable pixel sizes instead of shrinking a desktop SVG.
  const compact = width < 250;
  const height = compact ? 174 : 264;
  const left = compact ? 30 : 44;
  const right = width - 12;
  const bottom = height - 48;
  const plotWidth = right - left;
  const reference = gaussianReference(parameters);
  const min = reference.mean - 4 * reference.standardDeviation;
  const max = reference.mean + 4 * reference.standardDeviation;
  const histogram = snapshot?.histogram;
  const count = snapshot?.moments.count ?? 0;
  const binWidth = histogram ? (max - min) / histogram.bins.length : 1;
  const densities =
    histogram?.bins.map((bin) => (count ? bin / (count * binWidth) : 0)) ?? [];
  const yMax =
    Math.max(
      gaussianDensity(reference.mean, parameters),
      ...(showHistogram ? densities : []),
    ) * 1.15;
  const xScale = (x: number) => left + ((x - min) / (max - min)) * plotWidth;
  const yScale = (y: number) => bottom - (y / yMax) * (bottom - 36);
  const path = Array.from({ length: 161 }, (_, i) => {
    const x = min + (i / 160) * (max - min);
    return `${i ? 'L' : 'M'}${xScale(x).toFixed(2)},${yScale(gaussianDensity(x, parameters)).toFixed(2)}`;
  }).join(' ');
  return (
    <>
      <svg
        ref={svg}
        className={`density-chart ${compact ? 'compact-chart' : ''}`}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Gaussian probability density for x. Analytic mean ${formatNumber(reference.mean)}, variance ${formatNumber(reference.variance)}. ${count} retained samples.`}
      >
        <text x={compact ? 0 : left} y="18" className="axis-title">
          {compact ? 'Density p(x)' : 'Probability density p(x)'}
        </text>
        {[0, 0.5, 1].map((fraction) => (
          <g key={fraction}>
            <line
              className="grid-line"
              x1={left}
              x2={right}
              y1={yScale(fraction * yMax)}
              y2={yScale(fraction * yMax)}
            />
            <text x={left - 6} y={yScale(fraction * yMax) + 4} textAnchor="end">
              {Number((fraction * yMax).toPrecision(compact ? 2 : 3))}
            </text>
          </g>
        ))}
        {showHistogram &&
          densities.map((density, i) => (
            <rect
              key={i}
              className="histogram-bar"
              x={xScale(min + i * binWidth) + 0.5}
              y={yScale(density)}
              width={Math.max(0.5, plotWidth / densities.length - 0.7)}
              height={bottom - yScale(density)}
            />
          ))}
        <path d={path} className="density-line" />
        {(compact ? [-4, 4] : [-4, -2, 0, 2, 4]).map((offset) => {
          const x = reference.mean + offset * reference.standardDeviation;
          return (
            <text
              key={offset}
              x={xScale(x)}
              y={bottom + 21}
              textAnchor={
                offset === -4 ? 'start' : offset === 4 ? 'end' : 'middle'
              }
            >
              {compact ? Number(x.toPrecision(3)) : Number(x.toFixed(2))}
            </text>
          );
        })}
        <text
          x={width / 2}
          y={height - 3}
          textAnchor="middle"
          className="axis-title"
        >
          x · dimensionless
        </text>
      </svg>
      <div className="plot-legend">
        <span>
          <i className="line-key" />
          Analytic density
        </span>
        {showHistogram && (
          <span>
            <i className="bar-key" />
            Sampled histogram
          </span>
        )}
      </div>
      <p className="plot-note">
        View: μ ± 4σ.{' '}
        {formatNumber((histogram?.below ?? 0) + (histogram?.above ?? 0))}{' '}
        samples outside; normalization includes every sample.
      </p>
    </>
  );
}
