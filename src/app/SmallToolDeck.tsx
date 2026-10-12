import { useRef, useState } from 'react';
import type { Snapshot } from '../engine/protocol';
import type { Model } from '../models/singleVariable';
import { variableName } from '../models/singleVariable';
import { isingTargets } from '../models/ising';
import { formatNumber } from '../plotting/PlotFrame';
import type { PlotAssignment } from '../plotting/slots';
import type { ViewportMemory } from '../plotting/useViewport';
import { GraphVisualization } from './GraphWorkspace';
import { Plot, plotNames, targetNames } from './Inspector';
import { ToolDeck } from './ToolDeck';
import type { ToolDefinition } from './ToolDeck';

type PlotKind = PlotAssignment['plot'];
type SmallTool = PlotKind | 'variable-state' | 'graph-configuration';
type CardOptions = { target: string; histogram: boolean };

const plotOrder: PlotKind[] = [
  'density',
  'trajectory',
  'mean',
  'error',
  'acceptance',
  'correlation',
  'conditional',
];

/** A small, typed bridge from existing scientific plots to keyed teaching cards. */
export function SmallToolDeck({
  snapshot,
  selectedSite,
  setSelectedSite,
  selectedEdge,
  setSelectedEdge,
}: {
  snapshot: Snapshot;
  selectedSite: string;
  setSelectedSite: (site: string) => void;
  selectedEdge: string;
  setSelectedEdge: (edge: string) => void;
}) {
  const model = snapshot.configuration.model;
  if (model.kind === 'scalar')
    throw new Error('Real scalar fields retain their own inspector in D1.');
  const graph = model.kind === 'ising';
  const [options, setOptions] = useState<Record<number, CardOptions>>({});
  const [fitVersion, setFitVersion] = useState(0);
  const viewports = useRef<ViewportMemory>(new Map());
  const targets = graph ? isingTargets(model) : [variableName(model)];
  const tools: ToolDefinition<SmallTool>[] = [
    {
      id: graph ? 'graph-configuration' : 'variable-state',
      title: graph ? 'Spin configuration' : 'Current variable',
      kind: 'Visualization',
      description: graph
        ? 'Select spins and bonds on the current graph; this view does not edit parameters.'
        : 'The current draw or state, separate from its probability distribution.',
    },
    ...plotOrder
      .filter(
        (plot) => graph || (plot !== 'correlation' && plot !== 'conditional'),
      )
      .map((plot) => ({
        id: plot,
        title: plotNames[plot],
        kind:
          plot === 'acceptance' || plot === 'conditional'
            ? ('Analysis' as const)
            : ('Plot' as const),
        description:
          'Read-only view of retained measurements and applicable exact references.',
      })),
  ];

  const defaultTarget = variableName(model);
  return (
    <ToolDeck
      title="Small Systems tools"
      tools={tools}
      featuredDefault={graph ? 'graph-configuration' : 'density'}
      defaults={graph ? ['density', 'trajectory'] : ['trajectory']}
      addPreference={
        graph
          ? ['mean', 'conditional', 'correlation']
          : ['mean', 'error', 'acceptance']
      }
      onRemove={(key) => {
        setOptions((old) => {
          const next = { ...old };
          delete next[key];
          return next;
        });
        for (const keyName of viewports.current.keys())
          if (keyName.startsWith(`${key}:`)) viewports.current.delete(keyName);
      }}
      renderSharedControls={(layout, _, addTool) => (
        <div className="small-refit-controls plot-controls">
          <button
            className="button"
            onClick={() => {
              // Refit is presentation-only; inactive assignments fit on next mount.
              viewports.current.clear();
              setFitVersion((old) => old + 1);
            }}
          >
            Refit axes
          </button>
          <span className="plot-note">
            Recomputes visual axis limits from retained segments; no model
            fitting or sampling.
          </span>
          {graph && (
            <button
              className="button"
              disabled={layout.gallery.length >= 6}
              onClick={() => {
                const key = addTool('trajectory');
                if (key !== null)
                  setOptions((old) => ({
                    ...old,
                    [key]: { target: selectedSite, histogram: true },
                  }));
              }}
            >
              Plot selected spin {selectedSite}
            </button>
          )}
        </div>
      )}
      renderTool={(tool, key) => {
        if (tool === 'graph-configuration' && model.kind === 'ising')
          return (
            <GraphVisualization
              model={model}
              state={snapshot.currentValue}
              record={snapshot.segments.at(-1)?.trajectory.at(-1)}
              selected={selectedSite}
              setSelected={setSelectedSite}
              edge={selectedEdge}
              setEdge={setSelectedEdge}
            />
          );
        if (tool === 'variable-state')
          return <VariableState model={model} value={snapshot.currentValue} />;

        const plot = tool as PlotKind;
        const choice = options[key] ?? {
          target: defaultTarget,
          histogram: true,
        };
        const target =
          plot === 'conditional' && !choice.target.startsWith('v')
            ? selectedSite
            : choice.target;
        const change = (update: Partial<CardOptions>) =>
          setOptions((old) => ({
            ...old,
            [key]: { ...choice, ...update },
          }));
        return (
          <div className="small-plot-tool" data-assignment-key={key}>
            <div className="small-plot-options">
              {graph && (
                <label>
                  Observable
                  <select
                    aria-label={`Observable for tool ${key}`}
                    value={target}
                    onChange={(event) => change({ target: event.target.value })}
                  >
                    {targets.map((name) => (
                      <option key={name} value={name}>
                        {targetNames[name] ??
                          (name.startsWith('v') ? `Spin ${name}` : name)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {plot === 'density' && (
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    aria-label={`Histogram for tool ${key}`}
                    checked={choice.histogram}
                    onChange={(event) =>
                      change({ histogram: event.target.checked })
                    }
                  />
                  Empirical histogram
                </label>
              )}
            </div>
            <Plot
              key={`${snapshot.runId}:${key}:${target}:${plot}`}
              snapshot={snapshot}
              assignment={{ target, plot }}
              fitVersion={fitVersion}
              showHistogram={choice.histogram}
              viewportMemory={viewports.current}
              viewportKey={`${key}:${target}`}
            />
          </div>
        );
      }}
    />
  );
}

function VariableState({
  model,
  value,
}: {
  model: Model;
  value: number | null;
}) {
  const name = variableName(model);
  return (
    <section
      className="variable-visual"
      aria-label="Current variable visualization"
    >
      <div
        className="site-diagram"
        role="img"
        aria-label={`Current variable ${name}: ${formatNumber(value)}`}
      >
        <span>{name}</span>
      </div>
      <p data-testid="variable-state">
        {name} = {formatNumber(value)}
      </p>
      <small>
        {model.kind === 'binomial'
          ? `${model.parameters.n} Bernoulli trials → one aggregate count K. No lattice is implied.`
          : 'One physical variable; its current state is distinct from the plotted distribution.'}
      </small>
    </section>
  );
}
