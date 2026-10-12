import type {
  LatticeSegmentSnapshot,
  LatticeSnapshot,
  Measurement,
} from '../engine/latticeRun';
import { PlotFrame, tick } from './PlotFrame';
import { segmentColor } from './viewport';
import {
  AutocorrelationPlot,
  BlockingPlot,
  SpatialPlot,
} from './DiagnosticPlots';

export type LatticePlot =
  | 'm-history'
  | 'abs-history'
  | 'e-history'
  | 'm-histogram'
  | 'e-histogram'
  | 'm-mean'
  | 'abs-mean'
  | 'e-mean'
  | 'acceptance'
  | 'm-acf'
  | 'abs-acf'
  | 'e-acf'
  | 'm-blocking'
  | 'e-blocking'
  | 'spatial-x'
  | 'spatial-y';
export const latticePlotNames: Record<LatticePlot, string> = {
  'm-history': 'Magnetization history',
  'abs-history': '|m| history',
  'e-history': 'Energy density history',
  'm-histogram': 'Magnetization histogram',
  'e-histogram': 'Energy histogram',
  'm-mean': 'Running mean of m',
  'abs-mean': 'Running mean of |m|',
  'e-mean': 'Running mean of e',
  acceptance: 'Update outcomes',
  'm-acf': 'Autocorrelation of m',
  'abs-acf': 'Autocorrelation of |m|',
  'e-acf': 'Autocorrelation of e',
  'm-blocking': 'Blocking SE of m',
  'e-blocking': 'Blocking SE of e',
  'spatial-x': 'Spatial correlation · x',
  'spatial-y': 'Spatial correlation · y',
};
export const latticePlotChoices = Object.entries(latticePlotNames) as [
  LatticePlot,
  string,
][];
const field = (
  plot: LatticePlot,
): keyof Pick<Measurement, 'm' | 'absM' | 'e'> =>
  plot.startsWith('abs') ? 'absM' : plot.startsWith('e-') ? 'e' : 'm';

function History({
  snapshot,
  plot,
  windowSize,
  end,
}: {
  snapshot: LatticeSnapshot;
  plot: LatticePlot;
  windowSize: number;
  end: number;
}) {
  const key = field(plot),
    start = Math.max(0, end - windowSize);
  const segments = snapshot.segments
    .map((s) => ({
      id: s.id,
      points: s.measurements.filter((m) => m.sweep > start && m.sweep <= end),
    }))
    .filter((s) => s.points.length);
  const values = segments.flatMap((s) => s.points.map((p) => p[key]));
  const low =
    plot === 'e-history'
      ? Math.min(-0.1, ...values)
      : plot === 'abs-history'
        ? 0
        : -1;
  const high = plot === 'e-history' ? Math.max(0.1, ...values) : 1;
  return (
    <PlotFrame
      label={`${latticePlotNames[plot]}, sweeps ${start}–${end}`}
      viewport={`${start}:${end}`}
    >
      {(f) => {
        const X = (sweep: number) =>
          f.left +
          ((sweep - start) / Math.max(1, end - start)) * (f.right - f.left);
        const Y = (value: number) =>
          f.bottom -
          ((value - low) / Math.max(1e-9, high - low)) * (f.bottom - f.top);
        return (
          <>
            <line
              x1={f.left}
              y1={f.bottom}
              x2={f.right}
              y2={f.bottom}
              stroke="#87958d"
            />
            <line
              x1={f.left}
              y1={f.top}
              x2={f.left}
              y2={f.bottom}
              stroke="#87958d"
            />
            <text x={f.left} y={f.height - 22} fontSize="11">
              {tick(start)}
            </text>
            <text x={f.right} y={f.height - 22} textAnchor="end" fontSize="11">
              {tick(end)} sweeps
            </text>
            <text x={f.left + 4} y={f.top + 12} fontSize="11">
              {tick(high)}
            </text>
            <text x={f.left + 4} y={f.bottom - 5} fontSize="11">
              {tick(low)}
            </text>
            {segments.map((s) => (
              <polyline
                key={s.id}
                fill="none"
                stroke={segmentColor(s.id)}
                strokeWidth="2"
                points={s.points
                  .map((p) => `${X(p.sweep)},${Y(p[key])}`)
                  .join(' ')}
              />
            ))}
          </>
        );
      }}
    </PlotFrame>
  );
}

function Histogram({
  segments,
  plot,
}: {
  segments: LatticeSegmentSnapshot[];
  plot: LatticePlot;
}) {
  const energy = plot === 'e-histogram';
  const all = segments.map((s) => ({
    id: s.id,
    histogram: energy ? s.eHistogram : s.mHistogram,
    count: s.samples,
  }));
  const low = Math.min(...all.map((s) => s.histogram.min)),
    high = Math.max(...all.map((s) => s.histogram.max));
  const maximum = Math.max(
    1,
    ...all.flatMap((s) =>
      s.histogram.bins.map((b) => b / Math.max(1, s.count)),
    ),
  );
  return (
    <PlotFrame label={latticePlotNames[plot]} viewport={`${low}:${high}`}>
      {(f) => (
        <>
          <line
            x1={f.left}
            y1={f.bottom}
            x2={f.right}
            y2={f.bottom}
            stroke="#87958d"
          />
          <text x={f.left} y={f.height - 22} fontSize="11">
            {tick(low)}
          </text>
          <text x={f.right} y={f.height - 22} textAnchor="end" fontSize="11">
            {tick(high)}
          </text>
          <text x={f.left + 3} y={f.top + 12} fontSize="11">
            fraction ≤ {tick(maximum)}
          </text>
          {all.map(({ id, histogram, count }) =>
            histogram.bins.map((b, i) => {
              const x0 =
                histogram.min +
                (i * (histogram.max - histogram.min)) / histogram.bins.length;
              const x1 =
                histogram.min +
                ((i + 1) * (histogram.max - histogram.min)) /
                  histogram.bins.length;
              const x =
                f.left + ((x0 - low) / (high - low)) * (f.right - f.left);
              const width = Math.max(
                1,
                ((x1 - x0) / (high - low)) * (f.right - f.left),
              );
              const height =
                (b / Math.max(1, count) / maximum) * (f.bottom - f.top);
              return (
                <rect
                  key={`${id}:${i}`}
                  x={x}
                  y={f.bottom - height}
                  width={width}
                  height={height}
                  fill={segmentColor(id)}
                  opacity="0.4"
                />
              );
            }),
          )}
        </>
      )}
    </PlotFrame>
  );
}

function Mean({
  segments,
  plot,
}: {
  segments: LatticeSegmentSnapshot[];
  plot: LatticePlot;
}) {
  const key = plot === 'm-mean' ? 'm' : plot === 'abs-mean' ? 'absM' : 'e';
  const all = segments.flatMap((s) =>
    (key === 'm'
      ? s.meanCheckpoints
      : key === 'absM'
        ? s.absMeanCheckpoints
        : s.eMeanCheckpoints
    ).map((p) => ({ count: p.count, value: p.mean, id: s.id })),
  );
  const maxCount = Math.max(1, ...segments.map((s) => s.samples));
  const values = segments
    .map((s) => s[key].mean)
    .filter((v): v is number => v !== null);
  const low = Math.min(0, ...all.map((p) => p.value), ...values),
    high = Math.max(0.1, ...all.map((p) => p.value), ...values);
  return (
    <PlotFrame label={latticePlotNames[plot]} viewport={`1:${maxCount}`}>
      {(f) => (
        <>
          <line
            x1={f.left}
            y1={f.bottom}
            x2={f.right}
            y2={f.bottom}
            stroke="#87958d"
          />
          <text x={f.left} y={f.height - 22} fontSize="11">
            1
          </text>
          <text x={f.right} y={f.height - 22} textAnchor="end" fontSize="11">
            {maxCount} measurements
          </text>
          <text x={f.left + 4} y={f.top + 12} fontSize="11">
            {tick(high)}
          </text>
          <text x={f.left + 4} y={f.bottom - 4} fontSize="11">
            {tick(low)}
          </text>
          {segments.map((s) => {
            // Full-history geometric checkpoints are worker-owned; the last endpoint is included.
            const points =
              key === 'm'
                ? s.meanCheckpoints
                : key === 'absM'
                  ? s.absMeanCheckpoints
                  : s.eMeanCheckpoints;
            return (
              <polyline
                key={s.id}
                fill="none"
                stroke={segmentColor(s.id)}
                strokeWidth="2"
                points={points
                  .map(
                    (p) =>
                      `${f.left + (Math.log(Math.max(1, p.count)) / Math.log(Math.max(2, maxCount))) * (f.right - f.left)},${f.bottom - ((p.mean - low) / Math.max(1e-9, high - low)) * (f.bottom - f.top)}`,
                  )
                  .join(' ')}
              />
            );
          })}
        </>
      )}
    </PlotFrame>
  );
}

function Outcomes({ segments }: { segments: LatticeSegmentSnapshot[] }) {
  return (
    <div className="acceptance-plot">
      {segments.map((s) => (
        <div className="acceptance-row" key={s.id}>
          <strong style={{ color: segmentColor(s.id) }}>
            S{s.id} ·{' '}
            {s.settings.sampler === 'metropolis' ? 'Metropolis' : 'heat bath'}
          </strong>
          <span>
            {s.settings.sampler === 'metropolis'
              ? `Accepted moves ${s.accepted} · rejected ${s.rejected} · lazy stay ${s.self} · acceptance ${s.updates ? ((100 * (s.accepted + s.self)) / s.updates).toFixed(1) : '—'}% · movement ${s.updates ? ((100 * s.accepted) / s.updates).toFixed(1) : '—'}%`
              : `Changed ${s.changed} · unchanged resamples ${s.unchanged} · acceptance N/A`}
          </span>
          <div className="acceptance-bar">
            <span
              className="accepted-part"
              style={{
                width: `${(100 * (s.settings.sampler === 'metropolis' ? s.accepted : s.changed)) / Math.max(1, s.updates)}%`,
              }}
            />
            <span
              className="rejected-part"
              style={{
                width: `${(100 * s.rejected) / Math.max(1, s.updates)}%`,
              }}
            />
            <span className="self-part" style={{ flex: 1 }} />
          </div>
          <small>
            Includes {s.warmupUpdates} warm-up updates; {s.updates} total
            segment updates.
          </small>
        </div>
      ))}
    </div>
  );
}

/** Scientific projections stay independent of gallery placement and worker scheduling. */
export function LatticePlotView({
  snapshot,
  plot,
  windowSize,
  end,
  spatialMaximum,
}: {
  snapshot: LatticeSnapshot;
  plot: LatticePlot;
  windowSize: number;
  end: number;
  spatialMaximum: number;
}) {
  const earliest = Math.min(
    snapshot.sweeps,
    ...snapshot.segments.flatMap((segment) =>
      segment.measurements.map((measurement) => measurement.sweep),
    ),
  );
  const current = snapshot.segments.at(-1)!;
  return (
    <section className="lattice-plot-view" aria-label={latticePlotNames[plot]}>
      {plot.endsWith('history') ? (
        <History
          snapshot={snapshot}
          plot={plot}
          windowSize={windowSize}
          end={end}
        />
      ) : plot.endsWith('histogram') ? (
        <Histogram segments={snapshot.segments} plot={plot} />
      ) : plot.endsWith('mean') ? (
        <Mean segments={snapshot.segments} plot={plot} />
      ) : plot.endsWith('acf') ? (
        <AutocorrelationPlot
          diagnostic={
            current.diagnostics[
              plot.startsWith('abs')
                ? 'absM'
                : plot.startsWith('e-')
                  ? 'e'
                  : 'm'
            ]
          }
        />
      ) : plot.endsWith('blocking') ? (
        <BlockingPlot
          diagnostic={current.diagnostics[plot.startsWith('e-') ? 'e' : 'm']}
        />
      ) : plot.startsWith('spatial') ? (
        <SpatialPlot
          segment={current}
          axis={plot.endsWith('x') ? 'x' : 'y'}
          maximum={spatialMaximum}
        />
      ) : (
        <Outcomes segments={snapshot.segments} />
      )}
      <p className="plot-note">
        {plot.endsWith('history')
          ? `Global sweep window ${Math.max(0, end - windowSize)}–${end}. Earliest retained sweep ${earliest}; gaps and segments are never joined.`
          : plot.endsWith('histogram')
            ? 'Each color is one parameter segment; full-segment counts, not only visible history.'
            : plot.endsWith('mean')
              ? 'Correlated MCMC means; no independent-sample error band or mixing guarantee.'
              : plot.endsWith('acf')
                ? 'Worker-computed recent-window ρ(k); lag is in retained measurements, not spin updates. Dashed line marks the summation window.'
                : plot.endsWith('blocking')
                  ? 'Nonoverlapping blocks; the remainder is omitted. Orange is the autocorrelation-window SE when supported.'
                  : plot.startsWith('spatial')
                    ? 'Current segment only. Fully periodic: G(r)−〈m〉²; open or mixed boundaries: raw G(r). Ordered positive-axis origin pairs, not all pairs.'
                    : 'Counts include warm-up. Heat bath has no acceptance test.'}
      </p>
    </section>
  );
}
