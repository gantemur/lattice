import { useEffect, useState } from 'react';
import type { Snapshot } from '../engine/protocol';
import type { Slots, PlotAssignment } from '../plotting/slots';
import { assignSlot, defaultSlots, swapSlots } from '../plotting/slots';
import { DistributionPlot } from '../plotting/DistributionPlot';
import { TrajectoryPlot } from '../plotting/TrajectoryPlot';
import { AcceptancePlot } from '../plotting/AcceptancePlot';
import { variableName } from '../models/singleVariable';
import { standardGaussianPreset } from '../engine/preset';
import { ConvergencePlot } from '../plotting/ConvergencePlot';
import { useViewport } from '../plotting/useViewport';

export function Inspector({ snapshot }: { snapshot: Snapshot | null }) {
  const [slots, setSlots] = useState<Slots>(() =>
    defaultSlots(
      snapshot?.configuration ?? standardGaussianPreset.configuration,
    ),
  );
  const target = variableName(
    snapshot?.configuration.model ?? standardGaussianPreset.configuration.model,
  );
  const [customized, setCustomized] = useState(false);
  const hasMetropolis =
    snapshot?.segments.some((s) => s.sampler.kind === 'metropolis') ?? false;
  useEffect(() => {
    if (!customized)
      setSlots((slots) =>
        assignSlot(
          slots,
          3,
          hasMetropolis ? { target, plot: 'acceptance' } : null,
        ),
      );
  }, [hasMetropolis, customized, target]);
  const [closed, setClosed] = useState<boolean[]>([false, false, false, false]);
  const [activeSlot, setActiveSlot] = useState(0);
  const [overview, setOverview] = useState(false);
  const [showHistogram, setShowHistogram] = useState(true);
  const { range, fitAll } = useViewport(snapshot);
  const expanded = slots.filter((slot, index) => slot && !closed[index]).length;
  function moveSlot(from: number, to: number) {
    setCustomized(true);
    setSlots(swapSlots(slots, from, to));
    const reordered = [...closed];
    [reordered[from], reordered[to]] = [closed[to]!, closed[from]!];
    setClosed(reordered);
    setActiveSlot(to);
  }
  return (
    <section
      className={`inspector ${overview ? 'show-overview' : ''}`}
      aria-labelledby="inspector-title"
    >
      <div className="section-heading">
        <div>
          <p className="eyebrow">Variable inspector</p>
          <h2 id="inspector-title">Four slots. One system.</h2>
        </div>
        <button className="button" onClick={fitAll} disabled={!snapshot}>
          Fit All
        </button>
      </div>
      <div className="inspector-options">
        <p>
          Apply preserves history and axes. Fit All fits retained segments;
          Reset starts afresh.
        </p>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={showHistogram}
            onChange={(e) => setShowHistogram(e.target.checked)}
          />
          Histogram
        </label>
      </div>
      <div className="mobile-plot-controls">
        <div aria-label="Choose detail slot">
          {slots.map((_, index) => (
            <button
              key={index}
              className="slot-button"
              aria-pressed={activeSlot === index}
              onClick={() => {
                setActiveSlot(index);
                setOverview(false);
              }}
            >
              Slot {index + 1}
            </button>
          ))}
        </div>
        <button
          className="button"
          aria-pressed={overview}
          onClick={() => setOverview(!overview)}
        >
          {overview ? 'Single detail' : '2 × 2 overview'}
        </button>
      </div>
      <div className={`plot-grid ${expanded === 1 ? 'one-expanded' : ''}`}>
        {slots.map((assignment, index) => {
          const open = assignment && !closed[index];
          return (
            <article
              key={index}
              className={`plot-card ${activeSlot === index ? 'active-detail' : ''} ${open ? 'assigned-slot' : 'compact-slot'}`}
              aria-label={`Plot slot ${index + 1}`}
            >
              <div className="plot-card-heading">
                <span className="slot-number">0{index + 1}</span>
                <label className="sr-only" htmlFor={`slot-${index}`}>
                  Plot for slot {index + 1}
                </label>
                <select
                  id={`slot-${index}`}
                  value={
                    assignment ? `${assignment.target}:${assignment.plot}` : ''
                  }
                  onChange={(e) => {
                    const value = e.target.value;
                    setCustomized(true);
                    setSlots(
                      assignSlot(
                        slots,
                        index,
                        value
                          ? {
                              target,
                              plot: value.split(
                                ':',
                              )[1] as PlotAssignment['plot'],
                            }
                          : null,
                      ),
                    );
                    setClosed(closed.map((v, i) => (i === index ? false : v)));
                    setActiveSlot(index);
                  }}
                >
                  <option value="">Unassigned</option>
                  <option value={`${target}:density`}>
                    {target} · Distribution / histogram
                  </option>
                  <option value={`${target}:trajectory`}>
                    {target} · Sample trajectory
                  </option>
                  <option value={`${target}:mean`}>
                    {target} · Running mean
                  </option>
                  <option value={`${target}:error`}>
                    {target} · Absolute error (log–log)
                  </option>
                  <option value={`${target}:acceptance`}>
                    Acceptance diagnostics
                  </option>
                </select>
              </div>
              {assignment && (
                <div className="slot-actions">
                  <button
                    className="text-button"
                    aria-label={`${closed[index] ? 'Open' : 'Close'} plot ${index + 1}`}
                    onClick={() =>
                      setClosed(closed.map((v, i) => (i === index ? !v : v)))
                    }
                  >
                    {closed[index] ? 'Open' : 'Close'}
                  </button>
                  <button
                    className="text-button"
                    aria-label={`Move slot ${index + 1} up`}
                    disabled={index === 0}
                    onClick={() => moveSlot(index, index - 1)}
                  >
                    ↑
                  </button>
                  <button
                    className="text-button"
                    aria-label={`Move slot ${index + 1} down`}
                    disabled={index === 3}
                    onClick={() => moveSlot(index, index + 1)}
                  >
                    ↓
                  </button>
                </div>
              )}
              {open &&
                range &&
                snapshot &&
                (assignment.plot === 'density' ? (
                  <DistributionPlot
                    segments={snapshot.segments}
                    viewport={range}
                    showHistogram={showHistogram}
                  />
                ) : assignment.plot === 'trajectory' ? (
                  <TrajectoryPlot
                    segments={snapshot.segments}
                    bounds={range.trajectory}
                  />
                ) : assignment.plot === 'acceptance' ? (
                  <AcceptancePlot segments={snapshot.segments} />
                ) : (
                  <ConvergencePlot
                    segments={snapshot.segments}
                    viewport={range}
                    absoluteError={assignment.plot === 'error'}
                  />
                ))}
            </article>
          );
        })}
      </div>
    </section>
  );
}
