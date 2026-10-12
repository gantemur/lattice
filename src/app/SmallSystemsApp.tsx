import { SiteHeader } from './SiteHeader';
import { ScalarShare } from './ScalarShare';
import { decodeScalarConfiguration } from './shareConfiguration';
import {
  ScalarGraphInspection,
  ScalarParameterEditor,
} from './ScalarWorkspace';
import { ScalarToolDeck } from './ScalarToolDeck';
import { ScalarStepInspector } from './ScalarStepInspector';
import { ScalarReferences } from './ScalarReferences';
import type { ScalarModel } from '../models/scalarField';
import {
  GraphInspection,
  GraphParameterEditor,
  ExactIsingPanel,
} from './GraphWorkspace';
import { topologyKey } from '../domain/graph';
import { observableValue, spins } from '../models/ising';
import type { IsingModel } from '../models/ising';
import { useEffect, useRef, useState } from 'react';
import type { Capture } from '../experiments/archive';
import { standardGaussianPreset } from '../engine/preset';
import type { RunConfiguration } from '../engine/protocol';
import { MAX_SEGMENTS } from '../engine/protocol';
import {
  defaultModel,
  modelNames,
  modelReference,
  modelSummary,
  variableName,
} from '../models/singleVariable';
import type { ModelKind } from '../models/singleVariable';
import { samplerName } from '../algorithms/transitions';
import type { Settings } from '../algorithms/transitions';
import { formatNumber } from '../plotting/PlotFrame';
import { segmentColor } from '../plotting/viewport';
import { InlineMath } from '../ui/Math';
import { useSimulation } from './useSimulation';
import { SmallToolDeck } from './SmallToolDeck';
import { SmallIsingStatisticalDiagnostics } from './StatisticalDiagnostics';
import { SettingsPanel } from './SettingsPanel';
import { ModelFormula, ModelNotes } from './ModelNotes';
import { StepInspector } from './StepInspector';

export function SmallSystemsApp({
  saveCaptures,
  archiveCount,
}: {
  saveCaptures: (captures: Capture[]) => void;
  archiveCount: number;
}) {
  const { view, client } = useSimulation();
  const snapshot = view.snapshot;
  const lastConfiguration = useRef<RunConfiguration>(
    standardGaussianPreset.configuration,
  );
  if (snapshot) lastConfiguration.current = snapshot.configuration;
  const configuration = snapshot?.configuration ?? lastConfiguration.current;
  const { model, sampler } = configuration;
  const current = snapshot?.segments.at(-1);
  const [seed, setSeed] = useState(
    String(standardGaussianPreset.configuration.seed),
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState('Draw one sample or start a run.');
  const [selectedSite, setSelectedSite] = useState('v0');
  const [selectedEdge, setSelectedEdge] = useState('');
  // The featured graph can be remounted or swapped; the sidebar editor remains
  // the sole owner of draft parameters and exposes only its focus action.
  const editScalarCoupling = useRef<((edge: string) => void) | null>(null);
  const [inspectOpen, setInspectOpen] = useState(false);
  const reference = model.kind === 'scalar' ? null : modelReference(model),
    variable = variableName(model);
  useEffect(() => {
    if (!location.search.includes('config=')) return;
    try {
      const shared = decodeScalarConfiguration(location.href);
      client.current?.initialize(shared);
      setSeed(String(shared.seed));
      setNotice(
        'Loaded schema-v1 scalar configuration from URL as a new seeded session.',
      );
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : 'Invalid scalar share link.',
      );
    }
  }, []);
  const status = view.error
    ? 'Worker unavailable'
    : view.running
      ? 'Sampling'
      : view.busy
        ? 'Finishing update'
        : 'Paused';
  function attempt(action: () => void, message: string) {
    try {
      action();
      setFormError(null);
      setNotice(message);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : 'Invalid settings.',
      );
    }
  }
  function apply(settings: Settings) {
    attempt(
      () => client.current?.changeSettings(settings),
      'Apply preserves compatible history and the RNG stream. Changed settings begin separate measurements; unchanged settings keep the segment.',
    );
  }
  function applyGraph(next: IsingModel) {
    if (model.kind !== 'ising') return;
    if (
      topologyKey(next.parameters.domain) ===
      topologyKey(model.parameters.domain)
    )
      apply({ model: next, sampler });
    else {
      setSelectedSite('v0');
      setSelectedEdge('');
      attempt(
        () =>
          client.current?.initialize({
            model: next,
            sampler,
            seed: seed.trim() ? Number(seed) : NaN,
          }),
        'Topology changed: new session, history cleared and selected seed restarted.',
      );
    }
  }
  function applyScalar(next: ScalarModel) {
    if (model.kind !== 'scalar') return;
    const gaussian = next.parameters.domain.vertices.every(
      (v) => next.parameters.lambda[v.id] === 0,
    );
    const nextSampler =
      !gaussian && sampler.kind !== 'metropolis'
        ? { kind: 'metropolis' as const, width: 1, warmup: 200 }
        : sampler;
    if (
      topologyKey(next.parameters.domain) ===
      topologyKey(model.parameters.domain)
    )
      apply({ model: next, sampler: nextSampler });
    else {
      setSelectedSite('v0');
      setSelectedEdge('');
      attempt(
        () =>
          client.current?.initialize({
            model: next,
            sampler: nextSampler,
            seed: seed.trim() ? Number(seed) : NaN,
          }),
        'Topology changed: new real-vector session, history cleared and seed restarted.',
      );
    }
  }
  function reset() {
    attempt(
      () =>
        client.current?.initialize({
          ...configuration,
          seed: seed.trim() ? Number(seed) : NaN,
        }),
      'Reset cleared history and refitted plots. Applied settings restart with the selected seed.',
    );
  }
  async function save(all: boolean) {
    if (!snapshot || !client.current) return;
    try {
      const ids = all
        ? snapshot.segments.map((s) => s.id)
        : [snapshot.activeSegmentId];
      const captures: Capture[] = [];
      for (const id of ids) captures.push(await client.current.capture(id));
      if (
        captures.some(
          (c) =>
            c.runId !== captures[0]?.runId ||
            c.version !== captures[0]?.version,
        )
      )
        throw new Error(
          'Worker changed during multi-segment capture; pause and retry.',
        );
      saveCaptures(captures);
      setFormError(null);
      setNotice(
        `Saved ${captures.length} acknowledged segment${captures.length === 1 ? '' : 's'} to the in-memory Experiments library.`,
      );
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : 'Could not save this segment.',
      );
    }
  }
  function selectModel(kind: ModelKind) {
    if (kind === model.kind) return;
    setSelectedSite('v0');
    setSelectedEdge('');
    attempt(
      () =>
        client.current?.initialize({
          model: defaultModel(kind),
          sampler: { kind: 'direct' },
          seed: seed.trim() ? Number(seed) : NaN,
        }),
      'New model session: previous model history cleared, default parameters and direct sampler selected, RNG restarted with the selected seed.',
    );
  }
  return (
    <>
      <a className="skip-link" href="#laboratory">
        Skip to laboratory
      </a>
      <SiteHeader active="small" archiveCount={archiveCount} />
      <main id="laboratory">
        <section
          className="intro"
          id="small-systems"
          aria-labelledby="workspace-title"
        >
          <div>
            <p className="eyebrow">A numerical playground / 01a</p>
            <h1 id="workspace-title">
              Small systems. <span>Clear ideas.</span>
            </h1>
            <p className="intro-copy">
              Compare distributions and samplers. Follow each transition, and
              keep the mathematics in view.
            </p>
          </div>
          <span className="milestone">
            {model.kind === 'scalar'
              ? 'M1b · Continuous scalar systems'
              : 'Small Systems · models and measurements'}
          </span>
        </section>
        <div className="lab-layout">
          <aside className="sidebar" aria-label="Model and settings">
            <section className="model-card">
              <label className="eyebrow" htmlFor="model">
                Probability model
              </label>
              <select
                id="model"
                className="model-select"
                value={model.kind}
                onChange={(e) => selectModel(e.target.value as ModelKind)}
                disabled={!snapshot || !!view.error}
              >
                {Object.entries(modelNames).map(([kind, name]) => (
                  <option key={kind} value={kind}>
                    {name}
                  </option>
                ))}
              </select>
              <ModelFormula model={model} />
              <small>
                Changing model starts a new session. Applied:{' '}
                {samplerName(sampler)}.
              </small>
              <a href="#model-notes">Model notes & experiments ↓</a>
            </section>
            {model.kind === 'scalar' && (
              <ScalarParameterEditor
                key={topologyKey(model.parameters.domain)}
                model={model}
                apply={applyScalar}
                disabled={!snapshot || !!view.error}
                editCoupling={editScalarCoupling}
              />
            )}
            <SettingsPanel
              key={model.kind}
              settings={configuration}
              seed={seed}
              setSeed={setSeed}
              apply={apply}
              disabled={!snapshot || !!view.error}
            />
            {model.kind === 'ising' && (
              <GraphParameterEditor
                key={topologyKey(model.parameters.domain)}
                model={model}
                apply={applyGraph}
                disabled={!snapshot || !!view.error}
              />
            )}
            {model.kind === 'scalar' && (
              <ScalarShare
                configuration={configuration}
                load={(shared) => {
                  setSeed(String(shared.seed));
                  setSelectedSite('v0');
                  attempt(
                    () => client.current?.initialize(shared),
                    'Loaded scalar configuration as a new seeded session.',
                  );
                }}
              />
            )}
            <div className="local-note">
              ◌ Computation stays in your browser.
            </div>
          </aside>
          <div className="workspace">
            <section className="run-panel" aria-label="Sampling controls">
              <div className="run-heading">
                <div>
                  <span
                    className={`status-dot ${view.running ? 'is-running' : ''}`}
                  />
                  <strong role="status" data-testid="run-status">
                    {status}
                  </strong>
                  <span className="segment" data-testid="active-segment">
                    Segment {snapshot?.activeSegmentId ?? '…'}
                  </span>
                </div>
                <span className="algorithm-label">{samplerName(sampler)}</span>
              </div>
              <div className="command-row">
                <button
                  className="button primary"
                  onClick={() =>
                    view.running
                      ? client.current?.pause()
                      : client.current?.start()
                  }
                  disabled={
                    !view.running && (view.busy || !snapshot || !!view.error)
                  }
                >
                  {view.running ? 'Ⅱ Pause' : '▷ Run'}
                </button>
                <button
                  className="button"
                  onClick={() => {
                    setInspectOpen(true);
                    client.current?.step();
                  }}
                  disabled={
                    view.running || view.busy || !snapshot || !!view.error
                  }
                >
                  Step
                </button>
                <button className="button" onClick={reset}>
                  Reset
                </button>
                <button
                  className="button"
                  onClick={() => void save(false)}
                  disabled={
                    view.running || view.busy || !snapshot || !!view.error
                  }
                >
                  Save current segment
                </button>
                <button
                  className="button"
                  onClick={() => void save(true)}
                  disabled={
                    view.running || view.busy || !snapshot || !!view.error
                  }
                >
                  Save available segments
                </button>
                <div className="sample-count">
                  <strong data-testid="sample-count">
                    {snapshot?.moments.count ?? 0}
                  </strong>
                  <span>retained in segment</span>
                </div>
              </div>
              <p className="plot-note">
                Pause and wait for the current batch before saving. Captures do
                not update the model or consume random numbers. The in-memory
                library holds at most 16 records/12 MiB and is lost on reload
                unless exported.
              </p>
              <div className="run-meta">
                <span>
                  Segment updates{' '}
                  <strong data-testid="segment-updates">
                    {current?.updates ?? 0}
                  </strong>
                </span>
                <span>
                  Warm-up{' '}
                  <strong data-testid="warmup-count">
                    {current?.warmupUpdates ?? 0} / {current?.warmupTarget ?? 0}
                  </strong>
                  {sampler.kind === 'direct' && ' · not needed'}
                </span>
                <span>
                  All updates{' '}
                  <strong data-testid="total-updates">
                    {snapshot?.updates ?? 0}
                  </strong>
                </span>
                <span>
                  Seed <strong>{configuration.seed}</strong>
                </span>
              </div>
              {sampler.kind === 'metropolis' && (
                <div className="run-meta" data-testid="acceptance-counts">
                  <span>
                    Accepted moves <strong>{current?.accepted ?? 0}</strong>
                  </span>
                  <span>
                    Rejected <strong>{current?.rejected ?? 0}</strong>
                  </span>
                  <span>
                    Self <strong>{current?.self ?? 0}</strong>
                  </span>
                  <span>
                    Accept rate{' '}
                    <strong>
                      {current?.updates
                        ? `${((100 * (current.accepted + current.self)) / current.updates).toFixed(1)}%`
                        : '—'}
                    </strong>{' '}
                    · includes self & warm-up
                  </span>
                </div>
              )}
              <div className="run-readings">
                <span>
                  Current {variable}{' '}
                  <strong data-testid="current-value">
                    {formatNumber(
                      model.kind === 'ising' &&
                        snapshot?.currentValue !== null &&
                        snapshot?.currentValue !== undefined
                        ? observableValue(model, snapshot.currentValue)
                        : (snapshot?.currentValue ?? null),
                    )}
                  </strong>
                </span>
                <span>
                  Action <InlineMath>{'S'}</InlineMath>{' '}
                  {formatNumber(snapshot?.currentAction ?? null)}
                </span>
              </div>
              {current && current.moments.count === 0 && (
                <p className="plot-note">
                  {current.initialization}{' '}
                  {current.warmupUpdates < current.warmupTarget
                    ? 'Warm-up is excluded from equilibrium estimates.'
                    : 'No retained measurements yet.'}
                </p>
              )}
              {formError && (
                <p className="error-message" role="alert">
                  {formError}
                </p>
              )}
              {view.error && (
                <p className="error-message" role="alert">
                  {view.error} Displayed values are the last confirmed state.
                </p>
              )}
              <p className="run-notice">{notice}</p>
              {model.kind === 'scalar' ? (
                <ScalarStepInspector
                  record={current?.scalar?.trajectory.at(-1)}
                  open={inspectOpen}
                  setOpen={setInspectOpen}
                />
              ) : (
                <StepInspector
                  model={model}
                  record={current?.trajectory.at(-1)}
                  open={inspectOpen}
                  setOpen={setInspectOpen}
                />
              )}
            </section>
            {model.kind === 'scalar' && snapshot && (
              <ScalarToolDeck
                key={`scalar-tools:${topologyKey(model.parameters.domain)}`}
                snapshot={snapshot}
                selectedSite={selectedSite}
                setSelectedSite={setSelectedSite}
                selectedEdge={
                  selectedEdge || model.parameters.domain.edges[0]?.id || ''
                }
                setSelectedEdge={setSelectedEdge}
                trace={current?.scalar?.trajectory.at(-1)}
              />
            )}
            {model.kind !== 'scalar' && snapshot && (
              <SmallToolDeck
                key={
                  model.kind === 'ising'
                    ? `small-tools:${topologyKey(model.parameters.domain)}`
                    : `small-tools:${model.kind}`
                }
                snapshot={snapshot}
                selectedSite={selectedSite}
                setSelectedSite={setSelectedSite}
                selectedEdge={
                  selectedEdge ||
                  (model.kind === 'ising'
                    ? (model.parameters.domain.edges[0]?.id ?? '')
                    : '')
                }
                setSelectedEdge={setSelectedEdge}
              />
            )}
            {model.kind === 'ising' && snapshot?.currentValue != null && (
              <p className="plot-note">
                <span data-testid="spin-configuration">
                  Configuration:{' '}
                  {spins(model, snapshot.currentValue).join(', ')}
                </span>{' '}
                ·{' '}
                {sampler.kind === 'direct'
                  ? `${current?.updates ?? 0} whole-configuration draws in this segment`
                  : `${formatNumber((current?.updates ?? 0) / model.parameters.domain.vertices.length)} nominal sweeps in this segment (N local attempts per sweep)`}
              </p>
            )}
            <section
              className="segment-history"
              aria-label="Recent measurement segments"
            >
              <div className="segment-legend">
                {snapshot?.segments.map((segment) => (
                  <span
                    key={segment.id}
                    className="segment-chip"
                    style={{ borderLeftColor: segmentColor(segment.id) }}
                    data-testid={`segment-${segment.id}`}
                  >
                    <strong>
                      S{segment.id}
                      {segment.id === snapshot.activeSegmentId
                        ? ' · current'
                        : ''}
                    </strong>
                    {modelSummary(segment.model)} ·{' '}
                    {samplerName(segment.sampler)}
                    {segment.sampler.kind === 'metropolis' &&
                    segment.model.kind === 'gaussian'
                      ? ` δ=${segment.sampler.width}`
                      : ''}{' '}
                    · N={segment.moments.count}
                  </span>
                ))}
              </div>
              <details>
                <summary>Segment statistics & retention</summary>
                <p>
                  Latest {MAX_SEGMENTS} segments;{' '}
                  {snapshot?.droppedSegments ?? 0} older segments removed. Each
                  has separate statistics and up to 1000 exact recent
                  transitions. Histograms and mean checkpoints exclude warm-up.
                  No pooling across targets or algorithms.
                </p>
                {snapshot?.segments.map((segment) => (
                  <p key={segment.id}>
                    <strong>S{segment.id}</strong> · starts after update{' '}
                    {segment.startUpdate} · {segment.updates} updates · warm-up{' '}
                    {segment.warmupUpdates}/{segment.warmupTarget} · N=
                    {segment.moments.count} · mean{' '}
                    {formatNumber(segment.moments.mean)} · variance{' '}
                    {formatNumber(segment.moments.variance)} · last convergence
                    N={segment.convergence.at(-1)?.count ?? 0}
                    <br />
                    {segment.initialization}
                    {segment.updates > segment.trajectory.length &&
                      ` ${segment.updates - segment.trajectory.length} older transition records removed; all retained measurements remain in statistics.`}
                  </p>
                ))}
              </details>
              {!!snapshot?.droppedSegments && (
                <p role="status">
                  History limit: {snapshot.droppedSegments} oldest segments
                  removed; the current RNG stream continues.
                </p>
              )}
            </section>
            {model.kind === 'scalar' && (
              <details className="small-technical-details">
                <summary>Local scalar inspection</summary>
                <ScalarGraphInspection
                  model={model}
                  state={snapshot?.scalarState ?? null}
                  selected={selectedSite}
                  setSelected={setSelectedSite}
                  selectedEdge={
                    selectedEdge || model.parameters.domain.edges[0]?.id || ''
                  }
                  setSelectedEdge={setSelectedEdge}
                  editCoupling={editScalarCoupling}
                />
              </details>
            )}
            {model.kind === 'ising' && (
              <details className="small-technical-details">
                <summary>Local graph inspection</summary>
                <GraphInspection
                  model={model}
                  state={snapshot?.currentValue ?? null}
                  selected={selectedSite}
                  edge={
                    selectedEdge || model.parameters.domain.edges[0]?.id || ''
                  }
                />
              </details>
            )}
            {model.kind === 'scalar' ? (
              current ? (
                <details
                  className="small-technical-details"
                  data-testid="small-scalar-references"
                >
                  <summary>Exact references &amp; numerical methods</summary>
                  <ScalarReferences segment={current} />
                </details>
              ) : null
            ) : (
              <details
                className="small-technical-details"
                data-testid="small-exact-references"
              >
                <summary>Exact references &amp; diagnostics</summary>
                {model.kind === 'ising' && current ? (
                  <>
                    <ExactIsingPanel segment={current} />
                    <SmallIsingStatisticalDiagnostics
                      key={current.id}
                      segment={current}
                    />
                  </>
                ) : (
                  <section
                    className="moments-panel"
                    aria-labelledby="moments-title"
                  >
                    <div className="section-heading">
                      <h2 id="moments-title">
                        Current segment · exact & sampled
                      </h2>
                      <span className="parameter-chip">
                        {modelSummary(model)}
                      </span>
                    </div>
                    <table className="moments-table">
                      <caption className="sr-only">
                        Current segment analytic moments and Monte Carlo
                        estimates
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col">Moment</th>
                          <th scope="col">Analytic exact</th>
                          <th scope="col">Sampled estimate</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <th scope="row">
                            Mean{' '}
                            <InlineMath>{String.raw`\langle ${variable}\rangle`}</InlineMath>
                          </th>
                          <td data-testid="exact-mean">
                            {formatNumber(reference!.mean)}
                          </td>
                          <td data-testid="sample-mean">
                            {formatNumber(snapshot?.moments.mean ?? null)}
                          </td>
                        </tr>
                        <tr>
                          <th scope="row">Variance</th>
                          <td data-testid="exact-variance">
                            {formatNumber(reference!.variance)}
                          </td>
                          <td>
                            {formatNumber(snapshot?.moments.variance ?? null)}
                          </td>
                        </tr>
                        <tr>
                          <th scope="row">
                            Second moment{' '}
                            <InlineMath>{String.raw`\langle ${variable}^2\rangle`}</InlineMath>
                          </th>
                          <td>{formatNumber(reference!.secondMoment)}</td>
                          <td>
                            {formatNumber(
                              snapshot?.moments.secondMoment ?? null,
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <p className="plot-note">
                      Exact <InlineMath>{String.raw`\log Z`}</InlineMath> ={' '}
                      {formatNumber(reference!.logPartition)}. Sample variance
                      uses N − 1 and needs two retained measurements; this does
                      not remove finite-chain correlation bias. No
                      autocorrelation-adjusted uncertainty or ESS is estimated.
                    </p>
                  </section>
                )}
              </details>
            )}
            <ModelNotes model={model} />
          </div>
        </div>
      </main>
      <footer>
        <span>Lattice Lab / Small systems, explicit mathematics.</span>
        <span>
          Gaussian · Spin · Binomial · Graph Ising · Real scalar field
        </span>
      </footer>
    </>
  );
}
