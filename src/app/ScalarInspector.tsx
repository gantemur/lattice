import { useEffect, useMemo, useState } from 'react';
import type { Snapshot } from '../engine/protocol';
import {
  scalarReference,
  localPotential,
  conditionalPotential,
  quarticReference,
  gaussianScalar,
} from '../models/scalarField';
import type { ScalarModel } from '../models/scalarField';
import { PlotFrame, formatNumber, tick } from '../plotting/PlotFrame';
import { segmentColor } from '../plotting/viewport';
import { ScalarTrajectoryPlot } from '../plotting/ScalarTrajectoryPlot';
import { ScalarAcceptancePlot } from '../plotting/ScalarAcceptancePlot';
export type ScalarView =
  | 'histogram'
  | 'trajectory'
  | 'mean'
  | 'error'
  | 'bare'
  | 'conditional-potential'
  | 'conditional-density'
  | 'scatter'
  | 'covariance'
  | 'acceptance';
export type ScalarViewportMemory = Map<
  string,
  {
    runId: number;
    bounds: { min: number; max: number; ymax?: number; nmax?: number };
  }
>;
export const scalarPlotNames: Record<ScalarView, string> = {
  histogram: 'Marginal histogram',
  trajectory: 'Sample trajectory',
  mean: 'Running mean',
  error: 'Absolute error (log–log)',
  bare: 'Bare local potential',
  'conditional-potential': 'Conditional potential',
  'conditional-density': 'Conditional probability density',
  scatter: 'Two-variable scatter',
  covariance: 'Covariance matrix',
  acceptance: 'Acceptance diagnostics',
};
function referenceDensity(
  model: ScalarModel,
  target: string,
  x: number,
): number | null {
  const r = scalarReference(model, target);
  if (!r) return null;
  const gaussian = model.parameters.domain.vertices.every(
    (v) => model.parameters.lambda[v.id] === 0,
  );
  if (gaussian) {
    if (target === 'S' || target.endsWith('²') || target.includes('·'))
      return null;
    if (!(r.variance > 0)) return null;
    return (
      Math.exp(-((x - r.mean) ** 2) / (2 * r.variance)) /
      Math.sqrt(2 * Math.PI * r.variance)
    );
  }
  const id = target.replace('²', '');
  if (target.endsWith('²')) return null;
  if (
    model.parameters.domain.vertices.some((v) => v.id === id) &&
    model.parameters.domain.edges.every(
      (e) => model.parameters.kappa[e.id] === 0,
    )
  ) {
    return quarticReference(
      model.parameters.a[id]!,
      model.parameters.lambda[id]!,
      model.parameters.h[id]!,
    ).density(x);
  }
  return null;
}
export function ScalarPlot({
  snapshot,
  target,
  view,
  fitVersion,
  showHistogram = true,
  viewportMemory,
  viewportKey,
  trajectoryWindow,
  trajectoryEnd,
  setTrajectoryWindow,
  setTrajectoryEnd,
}: {
  snapshot: Snapshot;
  target: string;
  view: ScalarView;
  fitVersion: number;
  showHistogram?: boolean;
  viewportMemory?: ScalarViewportMemory;
  viewportKey?: string;
  trajectoryWindow?: 100 | 500 | 1000;
  trajectoryEnd?: number | null;
  setTrajectoryWindow?: (length: 100 | 500 | 1000) => void;
  setTrajectoryEnd?: (end: number | null) => void;
}) {
  const segments = snapshot.segments.filter(
      (s) => s.model.kind === 'scalar' && s.scalar?.targets[target],
    ),
    current = segments.at(-1),
    model = current?.model as ScalarModel | undefined;
  const allowed = segments.filter((s) => s.scalar?.targets[target]);
  const needed = useMemo(() => {
    let min = Infinity,
      max = -Infinity,
      ymax = 0,
      nmax = 2;
    for (const s of allowed) {
      const d = s.scalar!.targets[target]!,
        h = d.histogram,
        ref = scalarReference(s.model as ScalarModel, target);
      min = Math.min(min, h.min);
      max = Math.max(max, h.max);
      nmax = Math.max(nmax, d.moments.count);
      for (const v of h.bins)
        ymax = Math.max(
          ymax,
          d.moments.count
            ? v / ((d.moments.count * (h.max - h.min)) / h.bins.length)
            : 0,
        );
      if (ref && target.startsWith('v') && !target.endsWith('²'))
        for (let k = 0; k < 33; k++)
          ymax = Math.max(
            ymax,
            referenceDensity(
              s.model as ScalarModel,
              target,
              h.min + ((h.max - h.min) * k) / 32,
            ) ?? 0,
          );
    }
    if (!Number.isFinite(min)) {
      min = -4;
      max = 4;
    }
    return { min, max, ymax: Math.max(ymax * 1.2, 0.1), nmax };
  }, [segments, target]);
  const [saved, setSaved] = useState<{
    runId: number;
    bounds: typeof needed;
  } | null>(() => {
    const old = viewportKey ? viewportMemory?.get(viewportKey) : null;
    return old?.bounds.ymax !== undefined && old.bounds.nmax !== undefined
      ? {
          runId: old.runId,
          bounds: {
            ...old.bounds,
            ymax: old.bounds.ymax,
            nmax: old.bounds.nmax,
          },
        }
      : null;
  });
  const bounds =
    saved?.runId === snapshot.runId
      ? {
          min: Math.min(saved.bounds.min, needed.min),
          max: Math.max(saved.bounds.max, needed.max),
          ymax: Math.max(saved.bounds.ymax, needed.ymax),
          nmax: Math.max(saved.bounds.nmax, needed.nmax),
        }
      : needed;
  const key = JSON.stringify(bounds);
  useEffect(() => {
    const next = { runId: snapshot.runId, bounds };
    setSaved(next);
    if (viewportKey) viewportMemory?.set(viewportKey, next);
  }, [key, snapshot.runId]);
  useEffect(() => {
    if (fitVersion > 0) {
      const next = { runId: snapshot.runId, bounds: needed };
      setSaved(next);
      if (viewportKey) viewportMemory?.set(viewportKey, next);
    }
  }, [fitVersion]);
  if (!model || !current) return null;
  if (view === 'covariance') {
    const ids = model.parameters.domain.vertices.map((v) => v.id),
      n = current.scalar!.targets[ids[0]!]!.moments.count;
    const exact = model.parameters.domain.vertices.every(
      (v) => model.parameters.lambda[v.id] === 0,
    )
      ? gaussianScalar(model).covariance
      : null;
    return (
      <div className="matrix-scroll">
        <table className="moments-table">
          <caption>
            Covariance · current segment, sampled /{' '}
            {exact ? 'analytic exact' : 'no exact coupled-quartic reference'}
          </caption>
          <thead>
            <tr>
              <th></th>
              {ids.map((id) => (
                <th key={id}>{id}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ids.map((id, i) => (
              <tr key={id}>
                <th>{id}</th>
                {ids.map((other, j) => {
                  const mi = current.scalar!.targets[id]!.moments.mean,
                    mj = current.scalar!.targets[other]!.moments.mean,
                    v =
                      n > 1
                        ? (current.scalar!.cross[i]![j]! - n * mi! * mj!) /
                          (n - 1)
                        : null;
                  return (
                    <td key={other}>
                      {formatNumber(v)} /{' '}
                      {exact ? formatNumber(exact[i]![j]!) : '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (view === 'acceptance') return <ScalarAcceptancePlot segments={allowed} />;
  if (view === 'trajectory')
    return (
      <ScalarTrajectoryPlot
        segments={allowed}
        target={target}
        bounds={{ min: bounds.min, max: bounds.max }}
        runId={snapshot.runId}
        fitVersion={fitVersion}
        windowLength={trajectoryWindow}
        end={trajectoryEnd}
        setWindowLength={setTrajectoryWindow}
        setEnd={setTrajectoryEnd}
        viewportMemory={viewportMemory}
        viewportKey={viewportKey ? `${viewportKey}:trajectory` : undefined}
      />
    );
  if (view === 'scatter') {
    if (model.parameters.domain.vertices.length < 2)
      return (
        <p className="plot-note">
          Select a graph with at least two real variables.
        </p>
      );
    const points = current.scalar!.scatter,
      a = model.parameters.domain.vertices[0]!.id,
      b = model.parameters.domain.vertices[1]!.id;
    if (!points.length)
      return (
        <p className="plot-note">
          No retained configuration pairs yet. Warm-up transitions are excluded;
          this view uses only the latest bounded sampled pairs.
        </p>
      );
    const hA = current.scalar!.targets[a]!.histogram,
      hB = current.scalar!.targets[b]!.histogram;
    return (
      <>
        <PlotFrame
          label="Sampled two-variable scatter"
          viewport={JSON.stringify([hA.min, hA.max, hB.min, hB.max])}
        >
          {({ left, right, top, bottom, width, height }) => (
            <>
              <text x="0" y="16">
                Sampled {a} versus {b}
              </text>
              {points.map((p, i) => (
                <circle
                  key={i}
                  cx={
                    left +
                    ((p[0] - hA.min) / (hA.max - hA.min)) * (right - left)
                  }
                  cy={
                    bottom -
                    ((p[1] - hB.min) / (hB.max - hB.min)) * (bottom - top)
                  }
                  r="1.5"
                  fill="#14625a"
                  opacity="0.4"
                />
              ))}
              <text x={width / 2} y={height - 3} textAnchor="middle">
                {a}
              </text>
              <text x="2" y={top + 12}>
                {b}
              </text>
            </>
          )}
        </PlotFrame>
        <p className="plot-note">
          Latest {points.length} retained configuration pairs in the current
          segment. This is a sampled joint view, not an exact density.
        </p>
      </>
    );
  }
  if (
    view === 'bare' ||
    view === 'conditional-potential' ||
    view === 'conditional-density'
  ) {
    const id = target,
      i = model.parameters.domain.vertices.findIndex((v) => v.id === id),
      state = snapshot.scalarState;
    if (i < 0)
      return (
        <p className="plot-note">Choose an individual site for this view.</p>
      );
    if (view !== 'bare' && !state)
      return (
        <p className="plot-note">
          Step or Run to inspect a current-neighbor conditional.
        </p>
      );
    let ref: ReturnType<typeof quarticReference> | null = null;
    if (view === 'conditional-density') {
      let A = model.parameters.a[id]!,
        H = model.parameters.h[id]!;
      for (const e of model.parameters.domain.edges)
        if (e.tail !== e.head && (e.tail === id || e.head === id)) {
          const other = e.tail === id ? e.head : e.tail,
            j = model.parameters.domain.vertices.findIndex(
              (v) => v.id === other,
            ),
            k = model.parameters.kappa[e.id]!;
          A += k;
          H += k * state![j]!;
        }
      ref = quarticReference(A, model.parameters.lambda[id]!, H);
    }
    const lo = Math.min(bounds.min, -4),
      hi = Math.max(bounds.max, 4),
      values = Array.from({ length: 161 }, (_, k) => {
        const x = lo + ((hi - lo) * k) / 160;
        return {
          x,
          y:
            view === 'bare'
              ? localPotential(model, i, x)
              : view === 'conditional-potential'
                ? conditionalPotential(model, state!, i, x)
                : ref!.density(x),
        };
      });
    const ymin =
        view === 'conditional-density'
          ? 0
          : Math.min(...values.map((v) => v.y)),
      ymax = Math.max(...values.map((v) => v.y)),
      scale = Math.max(1e-8, ymax - ymin);
    return (
      <>
        <PlotFrame
          label={scalarPlotNames[view]}
          viewport={JSON.stringify({ lo, hi, ymin, ymax })}
        >
          {({ left, right, top, bottom, width, height }) => (
            <>
              <text x="0" y="16">
                {scalarPlotNames[view]}
              </text>
              <path
                d={values
                  .map(
                    (p, k) =>
                      `${k ? 'L' : 'M'}${left + ((p.x - lo) / (hi - lo)) * (right - left)},${bottom - ((p.y - ymin) / scale) * (bottom - top)}`,
                  )
                  .join(' ')}
                fill="none"
                stroke="#14625a"
                strokeWidth="2"
              />
              <text x={width / 2} y={height - 3} textAnchor="middle">
                Trial {id} value z
              </text>
              <text x={left - 5} y={top + 4} textAnchor="end">
                {tick(ymax)}
              </text>
              <text x={left - 5} y={bottom} textAnchor="end">
                {tick(ymin)}
              </text>
            </>
          )}
        </PlotFrame>
        <p className="plot-note">
          {view === 'bare'
            ? 'Bare on-site energy Vᵢ(z); vertical axis is action, not density.'
            : view === 'conditional-potential'
              ? 'Conditional action with current neighbors fixed; vertical axis is action, not density.'
              : 'Normalized conditional density given current neighbors. This is not the equilibrium marginal.'}
        </p>
      </>
    );
  }
  if (
    view === 'histogram' &&
    !showHistogram &&
    !allowed.some(
      (s) => referenceDensity(s.model as ScalarModel, target, 0) !== null,
    )
  )
    return (
      <p className="plot-note">
        Empirical histogram hidden. No analytic Gaussian or independent-site
        quadrature density is available for this observable.
      </p>
    );
  if (
    view === 'histogram' &&
    !allowed.some((s) => s.scalar!.targets[target]!.moments.count > 0) &&
    !allowed.some(
      (s) => referenceDensity(s.model as ScalarModel, target, 0) !== null,
    )
  )
    return (
      <p className="plot-note">
        No retained samples or applicable reference density yet. Warm-up
        transitions do not enter the marginal histogram.
      </p>
    );
  if (view === 'histogram')
    return (
      <>
        <PlotFrame
          label="Sampled marginal and available reference density"
          viewport={JSON.stringify(bounds)}
        >
          {({ left, right, top, bottom, width, height }) => {
            const x = (v: number) =>
                left +
                ((v - bounds.min) / (bounds.max - bounds.min)) * (right - left),
              y = (v: number) => bottom - (v / bounds.ymax) * (bottom - top);
            return (
              <>
                <text x="0" y="16">
                  Density / sampled histogram
                </text>
                {allowed.map((s) => {
                  const d = s.scalar!.targets[target]!,
                    h = d.histogram,
                    bw = (h.max - h.min) / h.bins.length,
                    color = segmentColor(s.id),
                    path = h.bins
                      .map((v, i) => {
                        const level = d.moments.count
                          ? v / (d.moments.count * bw)
                          : 0;
                        return `${i ? 'L' : 'M'}${x(h.min + i * bw)},${y(level)} L${x(h.min + (i + 1) * bw)},${y(level)}`;
                      })
                      .join(' ');
                  const ref = scalarReference(s.model as ScalarModel, target),
                    density =
                      ref && !target.endsWith('²')
                        ? Array.from({ length: 101 }, (_, i) => {
                            const p = h.min + ((h.max - h.min) * i) / 100;
                            return `${i ? 'L' : 'M'}${x(p)},${y(referenceDensity(s.model as ScalarModel, target, p) ?? 0)}`;
                          }).join(' ')
                        : null;
                  return (
                    <g key={s.id}>
                      {showHistogram && d.moments.count > 0 && (
                        <path
                          d={path}
                          fill="none"
                          stroke={color}
                          strokeWidth="1.5"
                        />
                      )}
                      {density && (
                        <path
                          d={density}
                          fill="none"
                          stroke={color}
                          strokeWidth="2"
                          strokeDasharray="5 3"
                        />
                      )}
                    </g>
                  );
                })}
                <text x={width / 2} y={height - 3} textAnchor="middle">
                  {target} · real
                </text>
                <text x={left} y={bottom + 18}>
                  {tick(bounds.min)}
                </text>
                <text x={right} y={bottom + 18} textAnchor="end">
                  {tick(bounds.max)}
                </text>
              </>
            );
          }}
        </PlotFrame>
        <p className="plot-note">
          Solid: sampled marginal histogram (warm-up excluded). Dashed: analytic
          Gaussian or independent-site quadrature density when available.
          Coupled quartic marginals have no exact overlay. Values outside fixed
          bins remain in moments.
        </p>
      </>
    );
  return (
    <ScalarSeries
      snapshot={snapshot}
      segments={allowed}
      target={target}
      view={view as 'mean' | 'error'}
      fitVersion={fitVersion}
      viewportMemory={viewportMemory}
      viewportKey={viewportKey ? `${viewportKey}:series` : undefined}
    />
  );
}
function ScalarSeries({
  snapshot,
  segments,
  target,
  view,
  fitVersion,
  viewportMemory,
  viewportKey,
}: {
  snapshot: Snapshot;
  segments: Snapshot['segments'];
  target: string;
  view: 'mean' | 'error';
  fitVersion: number;
  viewportMemory?: ScalarViewportMemory;
  viewportKey?: string;
}) {
  const series = segments
    .filter((s) => s.scalar)
    .map((s) => {
      const model = s.model as ScalarModel,
        data = s.scalar!.targets[target]!,
        ref = scalarReference(model, target);
      const points = data.convergence;
      return {
        segment: s,
        data,
        ref,
        points,
        values: points.map((p) =>
          view === 'error' && ref ? Math.abs(p.mean - ref.mean) : p.mean,
        ),
      };
    })
    .filter((s) => view !== 'error' || s.ref);
  const all = series.flatMap((s) => s.values),
    nMax = Math.max(2, ...series.flatMap((s) => s.points.map((p) => p.count)));
  const floor = Math.min(
    ...series.map((s) =>
      Math.max(
        1e-7,
        Math.max(0.1, Math.sqrt(s.ref?.variance ?? 0)) /
          (100 * Math.sqrt(Math.max(2, s.data.moments.count))),
      ),
    ),
  );
  const refs = series.flatMap((s) => (s.ref ? [s.ref.mean] : []));
  const needed =
    view === 'error'
      ? {
          min: Number.isFinite(floor) ? floor : 1e-4,
          max: Math.max(
            1,
            ...all.filter((v) => v > 0),
            ...series.map((s) => Math.sqrt(s.ref?.variance ?? 0)),
          ),
        }
      : {
          min: Math.min(-1, ...all, ...refs) - 0.1,
          max: Math.max(1, ...all, ...refs) + 0.1,
        };
  const [saved, setSaved] = useState<{
    runId: number;
    view: string;
    range: typeof needed;
  } | null>(() => {
    const old = viewportKey ? viewportMemory?.get(viewportKey) : null;
    return old ? { runId: old.runId, view, range: old.bounds } : null;
  });
  const range =
    saved?.runId === snapshot.runId && saved.view === view
      ? {
          min: Math.min(saved.range.min, needed.min),
          max: Math.max(saved.range.max, needed.max),
        }
      : needed;
  const key = JSON.stringify(range);
  useEffect(() => {
    setSaved({ runId: snapshot.runId, view, range });
    if (viewportKey)
      viewportMemory?.set(viewportKey, {
        runId: snapshot.runId,
        bounds: { ...range, ymax: 0, nmax: 0 },
      });
  }, [key, snapshot.runId, view]);
  useEffect(() => {
    if (fitVersion > 0) {
      setSaved({ runId: snapshot.runId, view, range: needed });
      if (viewportKey)
        viewportMemory?.set(viewportKey, {
          runId: snapshot.runId,
          bounds: { ...needed, ymax: 0, nmax: 0 },
        });
    }
  }, [fitVersion]);
  if (!series.length)
    return (
      <p className="plot-note">
        No exact/reference mean is available for a coupled quartic error plot.
        Choose a running mean instead.
      </p>
    );
  const hi =
    range.max <= range.min
      ? view === 'error'
        ? range.min * 10
        : range.min + 1
      : range.max;
  const omitted = series.reduce(
    (n, s) =>
      n + s.values.filter((v) => view === 'error' && v < range.min).length,
    0,
  );
  return (
    <>
      <PlotFrame
        label={scalarPlotNames[view]}
        viewport={JSON.stringify({ min: range.min, max: hi, nMax })}
      >
        {({ left, right, top, bottom, width, height }) => {
          const x = (n: number) =>
            left +
            (Math.log10(Math.max(1, n)) / Math.log10(nMax)) * (right - left);
          const y = (v: number) =>
            bottom -
            (view === 'error'
              ? Math.log(v / range.min) / Math.log(hi / range.min)
              : (v - range.min) / (hi - range.min)) *
              (bottom - top);
          return (
            <>
              <text x="0" y="16">
                {scalarPlotNames[view]}
              </text>
              {series.map((s) => {
                let pen = false;
                const color = segmentColor(s.segment.id),
                  path = s.points
                    .map((p, i) => {
                      const v = s.values[i]!;
                      if (view === 'error' && v < range.min) {
                        pen = false;
                        return '';
                      }
                      const q = `${pen ? 'L' : 'M'}${x(p.count)},${y(v)}`;
                      pen = true;
                      return q;
                    })
                    .join(' ');
                return (
                  <g key={s.segment.id} aria-label={`Segment ${s.segment.id}`}>
                    {view === 'mean' && s.ref && (
                      <line
                        x1={left}
                        x2={x(Math.max(1, s.data.moments.count))}
                        y1={y(s.ref.mean)}
                        y2={y(s.ref.mean)}
                        stroke={color}
                        strokeDasharray="5 3"
                      />
                    )}
                    <path d={path} stroke={color} strokeWidth="2" fill="none" />
                  </g>
                );
              })}
              <text x={width / 2} y={height - 3} textAnchor="middle">
                Retained N per segment (log)
              </text>
              <text x={left - 5} y={top + 4} textAnchor="end">
                {tick(hi)}
              </text>
              <text x={left - 5} y={bottom} textAnchor="end">
                {tick(range.min)}
              </text>
            </>
          );
        }}
      </PlotFrame>
      <p className="plot-note">
        {view === 'mean'
          ? 'Solid running means, dashed available analytic/quadrature references; each color is one parameter segment. MCMC samples can be correlated.'
          : `Absolute error against each segment’s own reference; ${omitted} zero or below-range checkpoints omitted. A small observed error is not estimator uncertainty or proof of mixing.`}
      </p>
      {view === 'error' &&
        series.map((s) => (
          <p key={s.segment.id} className="plot-note">
            Segment {s.segment.id}: current absolute error{' '}
            {formatNumber(
              s.data.moments.count
                ? Math.abs(s.data.moments.mean! - s.ref!.mean)
                : null,
            )}{' '}
            at retained N={s.data.moments.count}.
          </p>
        ))}
    </>
  );
}
