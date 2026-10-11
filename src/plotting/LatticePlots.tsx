import { useEffect, useMemo, useState } from 'react';
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
const names: Record<LatticePlot, string> = {
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
const choices = Object.entries(names) as [LatticePlot, string][];
type Assignment = {
  id: number;
  plot: LatticePlot;
  collapsed: boolean;
  expanded: boolean;
};
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
      label={`${names[plot]}, sweeps ${start}–${end}`}
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
    <PlotFrame label={names[plot]} viewport={`${low}:${high}`}>
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
    <PlotFrame label={names[plot]} viewport={`1:${maxCount}`}>
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

export function LatticePlots({ snapshot }: { snapshot: LatticeSnapshot }) {
  const [slots, setSlots] = useState<Assignment[]>([
    { id: 1, plot: 'm-history', collapsed: false, expanded: false },
    { id: 2, plot: 'e-history', collapsed: false, expanded: false },
  ]);
  const [nextId, setNextId] = useState(3),
    [windowSize, setWindowSize] = useState(100),
    [follow, setFollow] = useState(true),
    [end, setEnd] = useState(0),
    [overview, setOverview] = useState(false),
    [detail, setDetail] = useState(1),
    [spatialMaximum, setSpatialMaximum] = useState(4);
  useEffect(() => {
    setSlots([
      { id: 1, plot: 'm-history', collapsed: false, expanded: false },
      { id: 2, plot: 'e-history', collapsed: false, expanded: false },
    ]);
    setNextId(3);
    setWindowSize(100);
    setFollow(true);
    setEnd(0);
    setOverview(false);
    setDetail(1);
    setSpatialMaximum(4);
  }, [snapshot.runId]);
  const earliest = Math.min(
    snapshot.sweeps,
    ...snapshot.segments.flatMap((s) => s.measurements.map((m) => m.sweep)),
  );
  const displayedEnd = follow
    ? snapshot.sweeps
    : Math.min(snapshot.sweeps, Math.max(earliest, end));
  const update = (id: number, patch: Partial<Assignment>) =>
    setSlots((old) => old.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const visible = useMemo(() => slots, [slots]);
  return (
    <section
      className={`lattice-plots ${overview ? 'show-overview' : ''}`}
      aria-label="Lattice plots"
    >
      <div className="section-heading">
        <h2>Measurements & diagnostics</h2>
        <button
          className="button"
          disabled={slots.length >= 6}
          onClick={() => {
            setSlots([
              ...slots,
              {
                id: nextId,
                plot: 'm-histogram',
                collapsed: false,
                expanded: false,
              },
            ]);
            setDetail(nextId);
            setNextId(nextId + 1);
          }}
        >
          Add plot
        </button>
      </div>
      <div className="plot-controls">
        <label>
          Spatial max r{' '}
          <select
            aria-label="Spatial maximum displacement"
            value={spatialMaximum}
            onChange={(e) => setSpatialMaximum(Number(e.target.value))}
          >
            {[1, 2, 3, 4].map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label>
          Window{' '}
          <select
            aria-label="Measurement window"
            value={windowSize}
            onChange={(e) => setWindowSize(Number(e.target.value))}
          >
            <option value="100">100 sweeps</option>
            <option value="500">500 sweeps</option>
            <option value="1000">1000 sweeps</option>
          </select>
        </label>
        <button
          className="button"
          onClick={() => {
            setFollow(false);
            setEnd(Math.max(earliest, displayedEnd - windowSize));
          }}
        >
          Older
        </button>
        <button
          className="button"
          onClick={() => {
            const newer = Math.min(snapshot.sweeps, displayedEnd + windowSize);
            setEnd(newer);
            setFollow(newer === snapshot.sweeps);
          }}
        >
          Newer
        </button>
        <label>
          <input
            type="checkbox"
            checked={follow}
            onChange={(e) => {
              setFollow(e.target.checked);
              if (!e.target.checked) setEnd(snapshot.sweeps);
            }}
          />{' '}
          Follow latest
        </label>
        <label>
          End sweep{' '}
          <input
            aria-label="End sweep"
            type="number"
            min={earliest}
            max={snapshot.sweeps}
            value={displayedEnd}
            onChange={(e) => {
              setFollow(false);
              setEnd(Number(e.target.value));
            }}
          />
        </label>
      </div>
      <div className="mobile-plot-controls">
        <label>
          Detail{' '}
          <select
            aria-label="Lattice detail plot"
            value={detail}
            onChange={(e) => setDetail(Number(e.target.value))}
          >
            {slots.map((s) => (
              <option key={s.id} value={s.id}>
                {names[s.plot]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={overview}
            onChange={(e) => setOverview(e.target.checked)}
          />{' '}
          Overview
        </label>
      </div>
      <div className="plot-grid">
        {visible.map((slot, index) => (
          <article
            key={slot.id}
            className={`plot-card assigned-slot ${slot.expanded ? 'expanded-plot' : ''} ${detail === slot.id ? 'active-detail' : ''}`}
          >
            <div className="plot-card-heading">
              <label>
                Plot {index + 1}
                <select
                  aria-label={`Plot ${index + 1} type`}
                  value={slot.plot}
                  onChange={(e) =>
                    update(slot.id, { plot: e.target.value as LatticePlot })
                  }
                >
                  {choices.map(([key, title]) => (
                    <option key={key} value={key}>
                      {title}
                    </option>
                  ))}
                </select>
              </label>
              <div className="slot-actions">
                <button
                  className="text-button"
                  onClick={() =>
                    update(slot.id, { collapsed: !slot.collapsed })
                  }
                >
                  {slot.collapsed ? 'Open' : 'Collapse'}
                </button>
                <button
                  className="text-button"
                  onClick={() => update(slot.id, { expanded: !slot.expanded })}
                >
                  {slot.expanded ? 'Normal' : 'Expand'}
                </button>
                <button
                  className="text-button"
                  disabled={index === 0}
                  onClick={() =>
                    setSlots((old) => {
                      const next = [...old];
                      [next[index - 1], next[index]] = [
                        next[index]!,
                        next[index - 1]!,
                      ];
                      return next;
                    })
                  }
                >
                  ↑
                </button>
                <button
                  className="text-button"
                  onClick={() => {
                    const remaining = slots.filter((s) => s.id !== slot.id);
                    setSlots(remaining);
                    if (detail === slot.id) setDetail(remaining[0]?.id ?? 0);
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
            {!slot.collapsed &&
              (slot.plot.endsWith('history') ? (
                <History
                  snapshot={snapshot}
                  plot={slot.plot}
                  windowSize={windowSize}
                  end={displayedEnd}
                />
              ) : slot.plot.endsWith('histogram') ? (
                <Histogram segments={snapshot.segments} plot={slot.plot} />
              ) : slot.plot.endsWith('mean') ? (
                <Mean segments={snapshot.segments} plot={slot.plot} />
              ) : slot.plot.endsWith('acf') ? (
                <AutocorrelationPlot
                  diagnostic={
                    snapshot.segments.at(-1)!.diagnostics[
                      slot.plot.startsWith('abs')
                        ? 'absM'
                        : slot.plot.startsWith('e-')
                          ? 'e'
                          : 'm'
                    ]
                  }
                />
              ) : slot.plot.endsWith('blocking') ? (
                <BlockingPlot
                  diagnostic={
                    snapshot.segments.at(-1)!.diagnostics[
                      slot.plot.startsWith('e-') ? 'e' : 'm'
                    ]
                  }
                />
              ) : slot.plot.startsWith('spatial') ? (
                <SpatialPlot
                  segment={snapshot.segments.at(-1)!}
                  axis={slot.plot.endsWith('x') ? 'x' : 'y'}
                  maximum={spatialMaximum}
                />
              ) : (
                <Outcomes segments={snapshot.segments} />
              ))}
            <p className="plot-note">
              {slot.plot.endsWith('history')
                ? `Global sweep window ${Math.max(0, displayedEnd - windowSize)}–${displayedEnd}. Earliest retained sweep ${earliest}; gaps and segments are never joined.`
                : slot.plot.endsWith('histogram')
                  ? 'Each color is one parameter segment; full-segment counts, not only visible history.'
                  : slot.plot.endsWith('mean')
                    ? 'Correlated MCMC means; no independent-sample error band or mixing guarantee.'
                    : slot.plot.endsWith('acf')
                      ? 'Worker-computed recent-window ρ(k); lag is in retained measurements, not spin updates. Dashed line marks the summation window.'
                      : slot.plot.endsWith('blocking')
                        ? 'Nonoverlapping blocks; the remainder is omitted. Orange is the autocorrelation-window SE when supported.'
                        : slot.plot.startsWith('spatial')
                          ? 'Current segment only. Fully periodic: G(r)−〈m〉²; open or mixed boundaries: raw G(r). Ordered positive-axis origin pairs, not all pairs.'
                          : 'Counts include warm-up. Heat bath has no acceptance test.'}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
