import { useEffect, useState } from 'react';
import type { SegmentSnapshot } from '../engine/protocol';
import type { Range } from './viewport';
import { segmentColor } from './viewport';
import { PlotFrame, tick } from './PlotFrame';
import { scalarTrajectoryWindow } from './scalarTrajectory';

export function ScalarTrajectoryPlot({
  segments,
  target,
  bounds,
  runId,
  fitVersion,
}: {
  segments: SegmentSnapshot[];
  target: string;
  bounds: Range;
  runId: number;
  fitVersion: number;
}) {
  const [windowLength, setWindowLength] = useState<100 | 500 | 1000>(100);
  const [end, setEnd] = useState<number | null>(null);
  const window = scalarTrajectoryWindow(segments, target, windowLength, end);
  const values = window.visible.flatMap((s) =>
    s.records.flatMap((r) =>
      r.before === null ? [r.result] : [r.before, r.result],
    ),
  );
  const needed = {
    min: Math.min(bounds.min, ...values),
    max: Math.max(bounds.max, ...values),
  };
  const [saved, setSaved] = useState<{
    runId: number;
    range: Range;
  } | null>(null);
  const range =
    saved?.runId === runId
      ? {
          min: Math.min(saved.range.min, needed.min),
          max: Math.max(saved.range.max, needed.max),
        }
      : needed;
  const key = JSON.stringify(range);
  useEffect(() => {
    setSaved({ runId, range });
  }, [key, runId]);
  useEffect(() => {
    if (fitVersion > 0) setSaved({ runId, range: needed });
  }, [fitVersion]);
  const padding = Math.max(0.01, (range.max - range.min) * 0.04);
  const min = range.min - padding,
    max = range.max + padding;
  return (
    <>
      <details className="trajectory-options">
        <summary>Window & history</summary>
        <div className="plot-controls">
          <label>
            Window
            <select
              aria-label="Scalar trajectory window"
              value={windowLength}
              onChange={(e) =>
                setWindowLength(Number(e.target.value) as 100 | 500 | 1000)
              }
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
              onChange={(e) =>
                setEnd(e.target.checked ? null : window.lastShown)
              }
            />
            Follow latest
          </label>
        </div>
        <div className="plot-controls">
          <button
            className="button"
            disabled={window.lastShown <= window.earliestRetained}
            onClick={() =>
              setEnd(
                Math.max(
                  window.earliestRetained,
                  window.lastShown - windowLength,
                ),
              )
            }
          >
            Older
          </button>
          <label>
            End update
            <input
              aria-label="Scalar trajectory end update"
              type="number"
              inputMode="numeric"
              min={window.earliestRetained}
              max={window.last}
              value={window.lastShown}
              onChange={(e) =>
                setEnd(
                  Math.max(
                    window.earliestRetained,
                    Math.min(
                      window.last,
                      Math.trunc(Number(e.target.value)) || 1,
                    ),
                  ),
                )
              }
            />
          </label>
          <button
            className="button"
            disabled={window.lastShown >= window.last}
            onClick={() =>
              setEnd(Math.min(window.last, window.lastShown + windowLength))
            }
          >
            Newer
          </button>
        </div>
      </details>
      <PlotFrame
        label="Scalar sample trajectory by elementary update"
        viewport={JSON.stringify({
          min,
          max,
          firstShown: window.firstShown,
          lastShown: window.lastShown,
        })}
      >
        {({ left, right, top, bottom, width, height, compact }) => {
          const x = (fraction: number) => left + fraction * (right - left);
          const y = (v: number) =>
            bottom - ((v - min) / (max - min)) * (bottom - top);
          const ticks = compact
            ? [window.firstShown, window.lastShown]
            : [
                window.firstShown,
                Math.round((window.firstShown + window.lastShown) / 2),
                window.lastShown,
              ];
          return (
            <>
              <text x="0" y="16">
                {target} · configuration
              </text>
              {[range.min, (range.min + range.max) / 2, range.max].map(
                (v, i) => (
                  <g key={i}>
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
                ),
              )}
              {window.visible.map(({ segment, records }) => {
                const color = segmentColor(segment.id);
                return (
                  <g key={segment.id} aria-label={`Segment ${segment.id}`}>
                    {records.map(
                      ({ trace, before, result, xBefore, xResult }) => (
                        <g key={trace.update} opacity={trace.warmup ? 0.35 : 1}>
                          {trace.kind !== 'direct' && before !== null && (
                            <path
                              d={`M${x(xBefore)},${y(before)} H${x(xResult)} V${y(result)}`}
                              stroke={color}
                              strokeWidth="1.1"
                              fill="none"
                              data-testid="scalar-step"
                            />
                          )}
                          {trace.outcome === 'rejected' ? (
                            <path
                              d={`M${x(xResult) - 2.5},${y(result) - 2.5} l5,5 m-5,0 l5,-5`}
                              stroke={color}
                              strokeWidth="1.5"
                              fill="none"
                              data-testid="scalar-rejection"
                            >
                              <title>
                                Update {trace.update}: rejected; {target} ={' '}
                                {result}
                              </title>
                            </path>
                          ) : (
                            <circle
                              cx={x(xResult)}
                              cy={y(result)}
                              r="2.2"
                              fill={color}
                              data-testid="scalar-point"
                            >
                              <title>
                                Update {trace.update}: {trace.outcome}; {target}{' '}
                                = {result}
                              </title>
                            </circle>
                          )}
                        </g>
                      ),
                    )}
                  </g>
                );
              })}
              {ticks.map((n, i) => (
                <text
                  key={i}
                  x={x(
                    (n - window.firstShown) /
                      Math.max(1, window.lastShown - window.firstShown),
                  )}
                  y={bottom + 20}
                  textAnchor={
                    i === 0
                      ? 'start'
                      : n === window.lastShown
                        ? 'end'
                        : 'middle'
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
        Direct independent draws: separate points. Local heat bath and
        Metropolis: steps, including unchanged observed values; × marks
        rejection. Faint marks are warm-up. Colors identify parameter segments.
        Update count is not physical time.
      </p>
      <p className="plot-note" data-testid="scalar-trajectory-retention">
        {window.retained} exact transitions shown · latest 1000 per segment
        retained. Earliest retained update:{' '}
        {window.earliestRetained.toLocaleString('en')}. Removed history and gaps
        are never reconstructed.
      </p>
    </>
  );
}
