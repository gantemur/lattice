import { useState } from 'react';
import type { SegmentSnapshot } from '../engine/protocol';
import { modelReference, variableName } from '../models/singleVariable';
import { PlotFrame, tick } from './PlotFrame';
import { segmentColor } from './viewport';
import type { Range } from './viewport';

export function TrajectoryPlot({
  segments,
  bounds,
}: {
  segments: SegmentSnapshot[];
  bounds: Range;
}) {
  const [windowLength, setWindowLength] = useState(100);
  const [end, setEnd] = useState<number | null>(null);
  const [references, setReferences] = useState(true);
  const last = Math.max(1, ...segments.map((s) => s.startUpdate + s.updates));
  const lastShown = Math.max(1, Math.min(end ?? last, last)),
    firstShown = Math.max(0, lastShown - windowLength);
  const visible = segments.map((segment) => ({
    segment,
    records: segment.trajectory.filter(
      (t) => t.update > firstShown && t.update <= lastShown,
    ),
  }));
  const discrete = segments[0]!.model.kind !== 'gaussian';
  const padding = discrete
    ? 0.35
    : Math.max(0.01, (bounds.max - bounds.min) * 0.04);
  const min = bounds.min - padding,
    max = bounds.max + padding;
  const kept = visible.reduce((n, s) => n + s.records.length, 0);
  return (
    <>
      <details className="trajectory-options">
        <summary>Window & history</summary>
        <div className="plot-controls">
          <label>
            Window
            <select
              aria-label="Trajectory window"
              value={windowLength}
              onChange={(e) => setWindowLength(Number(e.target.value))}
            >
              {[100, 500, 1000].map((n) => (
                <option key={n} value={n}>
                  {n} updates
                </option>
              ))}
            </select>
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={end === null}
              onChange={(e) => setEnd(e.target.checked ? null : lastShown)}
            />
            Follow latest
          </label>
        </div>
        <div className="plot-controls">
          <button
            className="button"
            disabled={lastShown <= 1}
            onClick={() => setEnd(Math.max(1, lastShown - windowLength))}
          >
            Older
          </button>
          <label>
            End update
            <input
              aria-label="Trajectory end update"
              type="number"
              inputMode="numeric"
              min="1"
              max={last}
              value={lastShown}
              onChange={(e) =>
                setEnd(
                  Math.max(
                    1,
                    Math.min(last, Math.trunc(Number(e.target.value)) || 1),
                  ),
                )
              }
            />
          </label>
          <button
            className="button"
            disabled={lastShown >= last}
            onClick={() => setEnd(Math.min(last, lastShown + windowLength))}
          >
            Newer
          </button>
        </div>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={references}
            onChange={(e) => setReferences(e.target.checked)}
          />
          Exact mean and distribution σ (not error bars)
        </label>
      </details>
      <PlotFrame
        label="Sample trajectory by elementary update"
        viewport={JSON.stringify({ min, max, firstShown, lastShown })}
      >
        {({ left, right, top, bottom, width, height, compact }) => {
          const x = (n: number) =>
            left +
            ((n - firstShown) / Math.max(1, lastShown - firstShown)) *
              (right - left);
          const y = (v: number) =>
            bottom - ((v - min) / (max - min)) * (bottom - top);
          const ticks = [
            ...new Set(
              [bounds.min, (bounds.min + bounds.max) / 2, bounds.max].map(
                (v) =>
                  discrete && segments[0]!.model.kind !== 'ising'
                    ? Math.round(v)
                    : v,
              ),
            ),
          ];
          return (
            <>
              <text x="0" y="16">
                {variableName(segments[0]!.model)} · configuration
              </text>
              {ticks.map((v) => (
                <g key={v}>
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
              ))}
              {visible.map(({ segment, records }) => {
                if (!records.length) return null;
                const color = segmentColor(segment.id),
                  ref = modelReference(segment.model);
                const start = Math.max(firstShown, records[0]!.update - 1),
                  finish = records.at(-1)!.update;
                return (
                  <g key={segment.id}>
                    {references && (
                      <>
                        <line
                          x1={x(start)}
                          x2={x(finish)}
                          y1={y(ref.mean)}
                          y2={y(ref.mean)}
                          stroke={color}
                          strokeDasharray="5 3"
                        />
                        {[
                          ref.mean - ref.standardDeviation,
                          ref.mean + ref.standardDeviation,
                        ]
                          .filter((v) => v >= min && v <= max)
                          .map((v) => (
                            <line
                              key={v}
                              x1={x(start)}
                              x2={x(finish)}
                              y1={y(v)}
                              y2={y(v)}
                              stroke={color}
                              strokeDasharray="1 4"
                              opacity="0.5"
                            />
                          ))}
                      </>
                    )}
                    {records.map((t) => (
                      <g key={t.update} opacity={t.warmup ? 0.35 : 1}>
                        {t.kind !== 'direct' && t.current !== null && (
                          <path
                            d={`M${x(Math.max(firstShown, t.update - 1))},${y(t.current)} H${x(t.update)} V${y(t.result)}`}
                            stroke={color}
                            strokeWidth="1.1"
                            fill="none"
                          />
                        )}
                        {t.outcome === 'rejected' ? (
                          <path
                            d={`M${x(t.update) - 2.5},${y(t.result) - 2.5} l5,5 m-5,0 l5,-5`}
                            stroke={color}
                            strokeWidth="1.5"
                          >
                            <title>
                              Update {t.update}: rejected, state {t.result}
                            </title>
                          </path>
                        ) : t.outcome === 'self' ? (
                          <rect
                            x={x(t.update) - 2.5}
                            y={y(t.result) - 2.5}
                            width="5"
                            height="5"
                            fill="white"
                            stroke={color}
                          >
                            <title>
                              Update {t.update}:{' '}
                              {t.kind === 'heat-bath'
                                ? 'unchanged resample'
                                : 'self-proposal'}
                              , state {t.result}
                            </title>
                          </rect>
                        ) : (
                          <circle
                            cx={x(t.update)}
                            cy={y(t.result)}
                            r="2.2"
                            fill={color}
                          >
                            <title>
                              Update {t.update}: {t.outcome}, state {t.result}
                            </title>
                          </circle>
                        )}
                      </g>
                    ))}
                  </g>
                );
              })}
              {(compact
                ? [firstShown, lastShown]
                : [
                    firstShown,
                    Math.round((firstShown + lastShown) / 2),
                    lastShown,
                  ]
              ).map((n, i) => (
                <text
                  key={i}
                  x={x(n)}
                  y={bottom + 20}
                  textAnchor={
                    i === 0 ? 'start' : n === lastShown ? 'end' : 'middle'
                  }
                >
                  {n.toLocaleString('en')}
                </text>
              ))}
              <text x={width / 2} y={height - 3} textAnchor="middle">
                {compact
                  ? 'Update (algorithmic)'
                  : 'Elementary update · not physical time'}
              </text>
            </>
          );
        }}
      </PlotFrame>
      <p className="plot-note">
        Direct: points. Chains: steps. ● moved/resampled · × rejected · □ self.
        Faint: warm-up. Dashed: exact mean; dotted: distribution ±σ.
      </p>
      <p className="plot-note" data-testid="trajectory-retention">
        {kept} exact transitions shown · latest 1000 per segment retained.
        Removed history is never reconstructed.
      </p>
    </>
  );
}
