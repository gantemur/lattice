import { useEffect, useMemo, useRef, useState } from 'react';
import type { Snapshot } from '../engine/protocol';
import type { PlotAssignment } from '../plotting/slots';
import { defaultSlots, MAX_PLOTS } from '../plotting/slots';
import { DistributionPlot } from '../plotting/DistributionPlot';
import { TrajectoryPlot } from '../plotting/TrajectoryPlot';
import { AcceptancePlot } from '../plotting/AcceptancePlot';
import { ConvergencePlot } from '../plotting/ConvergencePlot';
import { ConditionalPlot, IsingMatrix } from '../plotting/IsingPlots';
import { variableName } from '../models/singleVariable';
import { isingTargets } from '../models/ising';
import { standardGaussianPreset } from '../engine/preset';
import { useViewport } from '../plotting/useViewport';
import type { ViewportMemory } from '../plotting/useViewport';
import { projectSegments } from '../plotting/isingProjection';
export const plotNames: Record<PlotAssignment['plot'], string> = {
  density: 'Distribution / histogram',
  trajectory: 'Sample trajectory',
  mean: 'Running mean',
  error: 'Absolute error (log–log)',
  acceptance: 'Acceptance diagnostics',
  correlation: 'Connected correlation matrix',
  conditional: 'Local conditional probability',
};
export const targetNames: Record<string, string> = {
  M: 'Total magnetization M',
  m: 'Mean magnetization m',
  absM: 'Absolute magnetization |M|',
  E: 'Total action E = S',
};
export function Plot({
  snapshot,
  assignment,
  fitVersion,
  showHistogram,
  viewportMemory,
  viewportKey,
}: {
  snapshot: Snapshot;
  assignment: PlotAssignment;
  fitVersion: number;
  showHistogram: boolean;
  viewportMemory?: ViewportMemory;
  viewportKey?: string;
}) {
  const segments = useMemo(
    () => projectSegments(snapshot.segments, assignment.target),
    [snapshot, assignment.target],
  );
  const projected = { ...snapshot, segments };
  const { range, fitAll } = useViewport(projected, viewportMemory, viewportKey);
  const previousFit = useRef(fitVersion);
  useEffect(() => {
    if (previousFit.current !== fitVersion) {
      previousFit.current = fitVersion;
      fitAll();
    }
  }, [fitVersion]);
  if (!range) return null;
  if (assignment.plot === 'correlation')
    return <IsingMatrix snapshot={snapshot} />;
  if (assignment.plot === 'conditional')
    return <ConditionalPlot snapshot={snapshot} target={assignment.target} />;
  if (assignment.plot === 'density')
    return (
      <DistributionPlot
        segments={segments}
        viewport={range}
        showHistogram={showHistogram}
      />
    );
  if (assignment.plot === 'trajectory')
    return <TrajectoryPlot segments={segments} bounds={range.trajectory} />;
  if (assignment.plot === 'acceptance')
    return <AcceptancePlot segments={segments} />;
  return (
    <ConvergencePlot
      segments={segments}
      viewport={range}
      absoluteError={assignment.plot === 'error'}
    />
  );
}
export function Inspector({
  snapshot,
  selectedSite,
}: {
  snapshot: Snapshot | null;
  selectedSite?: string;
}) {
  const settings =
      snapshot?.configuration ?? standardGaussianPreset.configuration,
    model = settings.model;
  const [plots, setPlots] = useState(() =>
    defaultSlots(settings).map((assignment, id) => ({
      id,
      assignment,
      collapsed: false,
    })),
  );
  const nextId = useRef(2),
    [active, setActive] = useState(0),
    [overview, setOverview] = useState(false),
    [expanded, setExpanded] = useState<number | null>(null),
    [fitVersion, setFitVersion] = useState(0),
    [showHistogram, setShowHistogram] = useState(true);
  const targets =
    model.kind === 'ising' ? isingTargets(model) : [variableName(model)];
  const available = (Object.keys(plotNames) as PlotAssignment['plot'][]).filter(
    (p) =>
      model.kind === 'ising' || (p !== 'correlation' && p !== 'conditional'),
  );
  function add(target = targets[0]!) {
    if (plots.length >= MAX_PLOTS) return;
    const id = nextId.current++;
    setPlots([
      ...plots,
      {
        id,
        assignment: {
          target,
          plot: target.startsWith('v') ? 'trajectory' : 'density',
        },
        collapsed: false,
      },
    ]);
    setActive(id);
  }
  return (
    <section
      className={`inspector ${overview ? 'show-overview' : ''}`}
      aria-labelledby="inspector-title"
    >
      <div className="section-heading">
        <div>
          <p className="eyebrow">Variable inspector</p>
          <h2 id="inspector-title">Your views. One system.</h2>
        </div>
        <div className="plot-controls">
          <button
            className="button"
            onClick={() => setFitVersion((v) => v + 1)}
            disabled={!snapshot}
          >
            Fit All
          </button>
          <button
            className="button primary"
            disabled={plots.length >= MAX_PLOTS}
            onClick={() => add()}
          >
            Add Plot
          </button>
        </div>
      </div>
      <div className="inspector-options">
        <p>{plots.length} / 6 plots · Display changes never alter sampling.</p>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={showHistogram}
            onChange={(e) => setShowHistogram(e.target.checked)}
          />
          Histogram
        </label>
      </div>
      {selectedSite && model.kind === 'ising' && (
        <button
          className="text-button"
          disabled={plots.length >= MAX_PLOTS}
          onClick={() => add(selectedSite)}
        >
          Plot selected spin {selectedSite}
        </button>
      )}
      {plots.length === 0 && (
        <p className="empty-plots">
          No plots open. Use Add Plot to inspect the running experiment.
        </p>
      )}
      {!!plots.length && (
        <div className="mobile-plot-controls">
          <div aria-label="Choose detail plot">
            {plots.map((p, i) => (
              <button
                key={p.id}
                className="slot-button"
                aria-pressed={active === p.id}
                onClick={() => {
                  setActive(p.id);
                  setOverview(false);
                }}
              >
                Plot {i + 1}
              </button>
            ))}
          </div>
          <button
            className="button"
            aria-pressed={overview}
            onClick={() => setOverview(!overview)}
          >
            {overview ? 'Single detail' : 'Compact overview'}
          </button>
        </div>
      )}
      <div
        className={`plot-grid ${plots.filter((p) => !p.collapsed).length === 1 ? 'one-expanded' : ''}`}
      >
        {plots.map((p, index) => (
          <article
            key={p.id}
            className={`plot-card ${active === p.id ? 'active-detail' : ''} ${p.collapsed ? 'compact-slot' : 'assigned-slot'} ${expanded === p.id ? 'expanded-plot' : ''}`}
            aria-label={`Plot ${index + 1}`}
          >
            <div className="plot-card-heading">
              <span className="slot-number">0{index + 1}</span>
              <label className="sr-only" htmlFor={`target-${p.id}`}>
                Variable for plot {index + 1}
              </label>
              <select
                id={`target-${p.id}`}
                value={p.assignment.target}
                onChange={(e) =>
                  setPlots(
                    plots.map((q) =>
                      q.id === p.id
                        ? {
                            ...q,
                            assignment: {
                              ...q.assignment,
                              target: e.target.value,
                            },
                          }
                        : q,
                    ),
                  )
                }
              >
                {targets.map((t) => (
                  <option key={t} value={t}>
                    {targetNames[t] ?? (t.startsWith('v') ? `Spin ${t}` : t)}
                  </option>
                ))}
              </select>
            </div>
            <label className="sr-only" htmlFor={`view-${p.id}`}>
              View for plot {index + 1}
            </label>
            <select
              id={`view-${p.id}`}
              value={p.assignment.plot}
              onChange={(e) =>
                setPlots(
                  plots.map((q) =>
                    q.id === p.id
                      ? {
                          ...q,
                          assignment: {
                            ...q.assignment,
                            plot: e.target.value as PlotAssignment['plot'],
                          },
                        }
                      : q,
                  ),
                )
              }
            >
              {available.map((t) => (
                <option key={t} value={t}>
                  {plotNames[t]}
                </option>
              ))}
            </select>
            <div className="slot-actions">
              <button
                className="text-button"
                aria-label={`${p.collapsed ? 'Open' : 'Collapse'} plot ${index + 1}`}
                onClick={() =>
                  setPlots(
                    plots.map((q) =>
                      q.id === p.id ? { ...q, collapsed: !q.collapsed } : q,
                    ),
                  )
                }
              >
                {p.collapsed ? 'Open' : 'Collapse'}
              </button>
              <button
                className="text-button"
                aria-label={`Remove plot ${index + 1}`}
                onClick={() => {
                  const next = plots.filter((q) => q.id !== p.id);
                  setPlots(next);
                  if (active === p.id) setActive(next[0]?.id ?? -1);
                }}
              >
                Remove
              </button>
              <button
                className="text-button"
                aria-label={`Expand plot ${index + 1}`}
                onClick={() => {
                  setExpanded(expanded === p.id ? null : p.id);
                  setActive(p.id);
                  setOverview(false);
                }}
              >
                {expanded === p.id ? 'Restore' : 'Expand'}
              </button>
              {[-1, 1].map((delta) => (
                <button
                  key={delta}
                  className="text-button"
                  aria-label={`Move plot ${index + 1} ${delta < 0 ? 'up' : 'down'}`}
                  disabled={index + delta < 0 || index + delta >= plots.length}
                  onClick={() => {
                    const next = [...plots];
                    [next[index], next[index + delta]] = [
                      next[index + delta]!,
                      next[index]!,
                    ];
                    setPlots(next);
                  }}
                >
                  {delta < 0 ? '↑' : '↓'}
                </button>
              ))}
            </div>
            {snapshot && (
              <div hidden={p.collapsed}>
                <Plot
                  key={`${snapshot.runId}:${p.assignment.target}`}
                  snapshot={snapshot}
                  assignment={p.assignment}
                  fitVersion={fitVersion}
                  showHistogram={showHistogram}
                />
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
