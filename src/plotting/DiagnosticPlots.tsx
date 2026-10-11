import type { DiagnosticSummary } from '../observables/statisticalDiagnostics';
import type { LatticeSegmentSnapshot } from '../engine/latticeRun';
import { spatialDisplayValue } from '../observables/latticePhysics';
import { PlotFrame, tick } from './PlotFrame';

export function AutocorrelationPlot({
  diagnostic,
  exact,
}: {
  diagnostic: DiagnosticSummary;
  exact?: number[];
}) {
  const points = diagnostic.acf;
  const maximum = Math.max(1, diagnostic.maximumLag, (exact?.length ?? 1) - 1);
  const all = [...points.map((point) => point.rho), ...(exact ?? [])];
  const low = Math.min(-0.1, ...all);
  const high = Math.max(1, ...all);
  return (
    <PlotFrame
      label={`Autocorrelation of ${diagnostic.target}; retained-measurement lag, window ${diagnostic.window}`}
      viewport={`0:${maximum}`}
    >
      {(f) => {
        const X = (lag: number) =>
          f.left + (lag / maximum) * (f.right - f.left);
        const Y = (rho: number) =>
          f.bottom - ((rho - low) / (high - low)) * (f.bottom - f.top);
        return (
          <>
            <line
              x1={f.left}
              x2={f.right}
              y1={Y(0)}
              y2={Y(0)}
              stroke="#87958d"
            />
            <line
              x1={f.left}
              x2={f.left}
              y1={f.top}
              y2={f.bottom}
              stroke="#87958d"
            />
            {diagnostic.window > 0 && (
              <line
                x1={X(diagnostic.window)}
                x2={X(diagnostic.window)}
                y1={f.top}
                y2={f.bottom}
                stroke="#c87d44"
                strokeDasharray="5 4"
              />
            )}
            {exact && (
              <polyline
                fill="none"
                stroke="#645399"
                strokeWidth="2"
                points={exact
                  .map((rho, lag) => `${X(lag)},${Y(rho)}`)
                  .join(' ')}
              />
            )}
            <polyline
              fill="none"
              stroke="#14625a"
              strokeWidth="2"
              points={points
                .map(({ lag, rho }) => `${X(lag)},${Y(rho)}`)
                .join(' ')}
            />
            <text x={f.left} y={f.height - 21} fontSize="11">
              0
            </text>
            <text x={f.right} y={f.height - 21} textAnchor="end" fontSize="11">
              {maximum} measurement lags
            </text>
            <text x={f.left + 3} y={f.top + 12} fontSize="11">
              ρ = {tick(high)}
            </text>
            <text x={f.left + 3} y={f.bottom - 4} fontSize="11">
              {tick(low)}
            </text>
          </>
        );
      }}
    </PlotFrame>
  );
}

export function BlockingPlot({
  diagnostic,
}: {
  diagnostic: DiagnosticSummary;
}) {
  const values = diagnostic.blocking;
  const last = values.at(-1)?.blockSize ?? 1;
  const high = Math.max(
    0.01,
    ...values.map((v) => v.standardError),
    diagnostic.standardError ?? 0,
  );
  return (
    <PlotFrame
      label={`Blocking standard error of ${diagnostic.target} by nonoverlapping block size`}
      viewport={`1:${last}`}
    >
      {(f) => {
        const X = (size: number) =>
          f.left +
          (Math.log2(size) / Math.max(1, Math.log2(last))) * (f.right - f.left);
        const Y = (se: number) => f.bottom - (se / high) * (f.bottom - f.top);
        return (
          <>
            <line
              x1={f.left}
              x2={f.right}
              y1={f.bottom}
              y2={f.bottom}
              stroke="#87958d"
            />
            <polyline
              fill="none"
              stroke="#14625a"
              strokeWidth="2"
              points={values
                .map((v) => `${X(v.blockSize)},${Y(v.standardError)}`)
                .join(' ')}
            />
            {values.map((v) => (
              <circle
                key={v.blockSize}
                cx={X(v.blockSize)}
                cy={Y(v.standardError)}
                r="3"
                fill="#14625a"
              />
            ))}
            {diagnostic.standardError !== null && (
              <line
                x1={f.left}
                x2={f.right}
                y1={Y(diagnostic.standardError)}
                y2={Y(diagnostic.standardError)}
                stroke="#c87d44"
                strokeDasharray="5 4"
              />
            )}
            <text x={f.left} y={f.height - 21} fontSize="11">
              1
            </text>
            <text x={f.right} y={f.height - 21} textAnchor="end" fontSize="11">
              {last} observations/block
            </text>
            <text x={f.left + 3} y={f.top + 12} fontSize="11">
              SE ≤ {tick(high)}
            </text>
          </>
        );
      }}
    </PlotFrame>
  );
}

export function SpatialPlot({
  segment,
  axis,
  maximum,
}: {
  segment: LatticeSegmentSnapshot;
  axis: 'x' | 'y';
  maximum: number;
}) {
  const boundaries = segment.settings.parameters;
  const connected = boundaries.periodicX && boundaries.periodicY;
  const entries = (axis === 'x' ? segment.spatialX : segment.spatialY).filter(
    (point) => point.r <= maximum,
  );
  const meanM = segment.m.mean ?? 0;
  const points = entries.map((point) => ({
    r: point.r,
    value:
      point.moments.mean === null
        ? null
        : spatialDisplayValue(boundaries, point.moments.mean, meanM).value,
  }));
  const available = points.filter(
    (point): point is { r: number; value: number } => point.value !== null,
  );
  const low = Math.min(-1, ...available.map((p) => p.value));
  const high = Math.max(1, ...available.map((p) => p.value));
  const maxR = Math.max(1, entries.at(-1)?.r ?? 1);
  return (
    <PlotFrame
      label={`${connected ? 'Connected' : 'Raw'} ${axis}-axis pair correlation over ${segment.samples} retained measurements`}
      viewport={`0:${maxR}`}
    >
      {(f) => {
        const X = (r: number) => f.left + (r / maxR) * (f.right - f.left);
        const Y = (v: number) =>
          f.bottom - ((v - low) / (high - low)) * (f.bottom - f.top);
        return (
          <>
            <line
              x1={f.left}
              x2={f.right}
              y1={Y(0)}
              y2={Y(0)}
              stroke="#87958d"
            />
            <line
              x1={f.left}
              x2={f.left}
              y1={f.top}
              y2={f.bottom}
              stroke="#87958d"
            />
            <polyline
              fill="none"
              stroke="#14625a"
              strokeWidth="2"
              points={available.map((p) => `${X(p.r)},${Y(p.value)}`).join(' ')}
            />
            {available.map((p) => (
              <circle
                key={p.r}
                cx={X(p.r)}
                cy={Y(p.value)}
                r="4"
                fill="#14625a"
              />
            ))}
            <text x={f.left} y={f.height - 21} fontSize="11">
              0
            </text>
            <text x={f.right} y={f.height - 21} textAnchor="end" fontSize="11">
              r = {maxR} sites
            </text>
            <text x={f.left + 3} y={f.top + 12} fontSize="11">
              {tick(high)}
            </text>
            <text x={f.left + 3} y={f.bottom - 4} fontSize="11">
              {tick(low)}
            </text>
          </>
        );
      }}
    </PlotFrame>
  );
}
