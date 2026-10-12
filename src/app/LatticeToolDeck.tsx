import { useState } from 'react';
import type { LatticeSnapshot } from '../engine/latticeRun';
import { LatticePlotView, latticePlotChoices } from '../plotting/LatticePlots';
import type { LatticePlot } from '../plotting/LatticePlots';
import { CanvasLattice } from './CanvasLattice';
import { ToolDeck } from './ToolDeck';
import type { ToolDefinition } from './ToolDeck';

type LatticeTool = 'spin-configuration' | LatticePlot;

/** The 16 plot IDs remain the old scientific views; only their placement changes. */
const latticeTools: ToolDefinition<LatticeTool>[] = [
  {
    id: 'spin-configuration',
    title: 'Spin configuration',
    kind: 'Visualization',
    description: 'Select sites on the current square-lattice spin image.',
  },
  ...latticePlotChoices.map(([id, title]) => ({
    id,
    title,
    kind: id === 'acceptance' ? ('Analysis' as const) : ('Plot' as const),
    description: id.endsWith('history')
      ? 'Retained measurements on a shared nominal-sweep window.'
      : 'Inspect this measurement or recent-window diagnostic.',
    featureable: id !== 'acceptance',
  })),
];

const historyTool = (tool: LatticeTool) => tool.endsWith('history');
const spatialTool = (tool: LatticeTool) => tool.startsWith('spatial-');

export function LatticeToolDeck({
  snapshot,
  selected,
  select,
}: {
  snapshot: LatticeSnapshot;
  selected: number;
  select: (site: number) => void;
}) {
  // These are display coordinates, not measurements. All history assignments
  // read one shared window so m and e remain aligned as the worker advances.
  const [windowSize, setWindowSize] = useState(100);
  const [follow, setFollow] = useState(true);
  const [end, setEnd] = useState(0);
  const [spatialMaximum, setSpatialMaximum] = useState<Record<number, number>>(
    {},
  );
  const earliest = Math.min(
    snapshot.sweeps,
    ...snapshot.segments.flatMap((segment) =>
      segment.measurements.map((measurement) => measurement.sweep),
    ),
  );
  const displayedEnd = follow
    ? snapshot.sweeps
    : Math.min(snapshot.sweeps, Math.max(earliest, end));

  return (
    <ToolDeck
      title="Lattice Systems tools"
      tools={latticeTools}
      featuredDefault="spin-configuration"
      defaults={['m-history', 'e-history']}
      onRemove={(key) =>
        setSpatialMaximum((old) => {
          const next = { ...old };
          delete next[key];
          return next;
        })
      }
      renderSharedControls={(_, activeTools) =>
        activeTools.some(historyTool) && (
          <div
            className="lattice-history-controls plot-controls"
            aria-label="Shared history window"
          >
            <span>Shared history window · nominal sweeps</span>
            <label>
              Window{' '}
              <select
                aria-label="Measurement window"
                value={windowSize}
                onChange={(event) => setWindowSize(Number(event.target.value))}
              >
                <option value="100">100 sweeps</option>
                <option value="500">500 sweeps</option>
                <option value="1000">1000 sweeps</option>
              </select>
            </label>
            <button
              className="button"
              disabled={displayedEnd <= earliest}
              onClick={() => {
                setFollow(false);
                setEnd(Math.max(earliest, displayedEnd - windowSize));
              }}
            >
              Older
            </button>
            <button
              className="button"
              disabled={displayedEnd >= snapshot.sweeps}
              onClick={() => {
                const newer = Math.min(
                  snapshot.sweeps,
                  displayedEnd + windowSize,
                );
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
                onChange={(event) => {
                  setFollow(event.target.checked);
                  if (!event.target.checked) setEnd(snapshot.sweeps);
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
                onChange={(event) => {
                  setFollow(false);
                  setEnd(Number(event.target.value));
                }}
              />
            </label>
          </div>
        )
      }
      renderTool={(tool, assignmentKey) => {
        if (tool === 'spin-configuration')
          return (
            <CanvasLattice
              snapshot={snapshot}
              selected={selected}
              select={select}
            />
          );
        return (
          <>
            {spatialTool(tool) && (
              <div className="tool-options">
                <label>
                  Spatial maximum displacement r
                  <select
                    aria-label="Spatial maximum displacement"
                    value={spatialMaximum[assignmentKey] ?? 4}
                    onChange={(event) =>
                      setSpatialMaximum((old) => ({
                        ...old,
                        [assignmentKey]: Number(event.target.value),
                      }))
                    }
                  >
                    {[1, 2, 3, 4].map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            <LatticePlotView
              snapshot={snapshot}
              plot={tool}
              windowSize={windowSize}
              end={displayedEnd}
              spatialMaximum={spatialMaximum[assignmentKey] ?? 4}
            />
          </>
        );
      }}
    />
  );
}
