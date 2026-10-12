import { useRef, useState } from 'react';
import type { Snapshot } from '../engine/protocol';
import type { ScalarTrace } from '../engine/scalarRun';
import { scalarTargets } from '../models/scalarField';
import type { ScalarModel } from '../models/scalarField';
import { ScalarPlot, scalarPlotNames } from './ScalarInspector';
import type { ScalarView, ScalarViewportMemory } from './ScalarInspector';
import { ScalarGraphVisualization } from './ScalarWorkspace';
import { ToolDeck } from './ToolDeck';
import type { ToolDefinition } from './ToolDeck';

type ScalarTool = 'configuration' | ScalarView;
type CardOptions = {
  target: string;
  histogram: boolean;
  windowLength: 100 | 500 | 1000;
  end: number | null;
};

const plotOrder: ScalarView[] = [
  'histogram',
  'trajectory',
  'mean',
  'error',
  'bare',
  'conditional-potential',
  'conditional-density',
  'scatter',
  'covariance',
  'acceptance',
];
const siteOnly: readonly ScalarView[] = [
  'bare',
  'conditional-potential',
  'conditional-density',
];

/** Assignment keys own every display choice; worker snapshots remain read-only.
 * ToolDeck may remount a card when it swaps with the featured display. */
export function ScalarToolDeck({
  snapshot,
  selectedSite,
  setSelectedSite,
  selectedEdge,
  setSelectedEdge,
  trace,
}: {
  snapshot: Snapshot;
  selectedSite: string;
  setSelectedSite: (site: string) => void;
  selectedEdge: string;
  setSelectedEdge: (edge: string) => void;
  trace?: ScalarTrace;
}) {
  const model = snapshot.configuration.model as ScalarModel;
  const sites = model.parameters.domain.vertices.map((v) => v.id);
  const targets = scalarTargets(model);
  const [options, setOptions] = useState<Record<number, CardOptions>>({});
  const [fitVersion, setFitVersion] = useState(0);
  const viewports = useRef<ScalarViewportMemory>(new Map());
  const defaultChoice = (): CardOptions => ({
    target: sites[0]!,
    histogram: true,
    windowLength: 100,
    end: null,
  });
  const choiceFor = (key: number): CardOptions =>
    options[key] ?? defaultChoice();
  const change = (key: number, update: Partial<CardOptions>) =>
    setOptions((old) => ({
      ...old,
      [key]: { ...(old[key] ?? defaultChoice()), ...update },
    }));
  const tools: ToolDefinition<ScalarTool>[] = [
    {
      id: 'configuration',
      title: 'Real scalar configuration',
      kind: 'Visualization',
      description:
        'Current field values and oriented gradient bonds; select a site or bond to inspect it.',
    },
    ...plotOrder.map((id) => ({
      id,
      title: scalarPlotNames[id],
      kind:
        id === 'covariance' || id === 'acceptance'
          ? ('Analysis' as const)
          : ('Plot' as const),
      description:
        'Read-only measurements and applicable mathematical references.',
    })),
  ];

  return (
    <ToolDeck
      title="Real scalar tools"
      tools={tools}
      featuredDefault="configuration"
      defaults={['histogram', sites.length > 1 ? 'scatter' : 'bare']}
      addPreference={[
        'trajectory',
        'mean',
        'conditional-density',
        'covariance',
        'acceptance',
      ]}
      onRemove={(key) => {
        setOptions((old) => {
          const next = { ...old };
          delete next[key];
          return next;
        });
        for (const name of viewports.current.keys())
          if (name.startsWith(`${key}:`)) viewports.current.delete(name);
      }}
      renderSharedControls={(layout, _, addTool) => (
        <div className="small-refit-controls plot-controls">
          <button
            className="button"
            onClick={() => {
              viewports.current.clear();
              setFitVersion((old) => old + 1);
            }}
          >
            Refit axes
          </button>
          <span className="plot-note">
            Refits display limits from retained segments; no sampling or model
            fitting.
          </span>
          <button
            className="button"
            disabled={layout.gallery.length >= 6}
            onClick={() => {
              const key = addTool('trajectory');
              if (key !== null) change(key, { target: selectedSite });
            }}
          >
            Plot selected field {selectedSite}
          </button>
        </div>
      )}
      renderTool={(tool, key) => {
        if (tool === 'configuration')
          return (
            <ScalarGraphVisualization
              model={model}
              state={snapshot.scalarState ?? null}
              trace={trace}
              selected={selectedSite}
              setSelected={setSelectedSite}
              selectedEdge={selectedEdge}
              setSelectedEdge={setSelectedEdge}
            />
          );
        const choice = choiceFor(key);
        const needsSite = siteOnly.includes(tool);
        const needsTarget = !['scatter', 'covariance', 'acceptance'].includes(
          tool,
        );
        const targetOptions = needsSite ? sites : targets;
        const validTarget =
          !needsTarget || targetOptions.includes(choice.target);
        return (
          <div className="small-plot-tool" data-assignment-key={key}>
            <div className="small-plot-options">
              {needsTarget && (
                <label>
                  {needsSite ? 'Site' : 'Observable'}
                  <select
                    aria-label={`Observable for tool ${key}`}
                    value={validTarget ? choice.target : ''}
                    onChange={(event) =>
                      change(key, { target: event.target.value })
                    }
                  >
                    {!validTarget && (
                      <option value="">Choose an individual site…</option>
                    )}
                    {targetOptions.map((target) => (
                      <option key={target} value={target}>
                        {target}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {tool === 'histogram' && (
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    aria-label={`Histogram for tool ${key}`}
                    checked={choice.histogram}
                    onChange={(event) =>
                      change(key, { histogram: event.target.checked })
                    }
                  />
                  Empirical histogram
                </label>
              )}
            </div>
            {!validTarget ? (
              <p className="plot-note">
                Choose an individual site for this view. Aggregate observables
                cannot be used as a local potential or conditional.
              </p>
            ) : (
              <ScalarPlot
                key={`${snapshot.runId}:${key}:${choice.target}:${tool}`}
                snapshot={snapshot}
                target={choice.target}
                view={tool}
                fitVersion={fitVersion}
                showHistogram={choice.histogram}
                viewportMemory={viewports.current}
                viewportKey={`${key}:${choice.target}:${tool}`}
                trajectoryWindow={choice.windowLength}
                trajectoryEnd={choice.end}
                setTrajectoryWindow={(windowLength) =>
                  change(key, { windowLength })
                }
                setTrajectoryEnd={(end) => change(key, { end })}
              />
            )}
          </div>
        );
      }}
    />
  );
}
