import { useEffect, useMemo, useRef, useState } from 'react';
import { GaugeClient } from '../engine/z2GaugeClient';
import type { GaugePort, GaugeView } from '../engine/z2GaugeClient';
import { defaultGauge } from '../engine/z2GaugeRun';
import type { GaugeConfiguration } from '../engine/z2GaugeRun';
import {
  gaugeModel,
  gaugeObservables,
  gaugeTransform,
  wilsonProduct,
} from '../models/z2Gauge';
import { analyticGauge, exactGauge } from '../models/z2GaugeExact';
import { InlineMath, DisplayMath } from '../ui/Math';
import { ToolDeck } from './ToolDeck';
import type { ToolDefinition } from './ToolDeck';
import { SiteHeader } from './SiteHeader';
import { GaugeGraph } from './GaugeGraph';
import { GaugeCatalogOptions } from './gaugeCatalog';
import type { GaugeExampleId } from './gaugeCatalog';
import { catalogGroups } from './smallCatalog';
import { formatNumber as fmt } from '../plotting/PlotFrame';

const tools = [
  {
    id: 'graph',
    title: 'Oriented links and plaquettes',
    kind: 'Visualization',
    description:
      'Inspect every physical link; dashed arcs are independent periodic bonds.',
  },
  {
    id: 'inspection',
    title: 'Plaquette and action',
    kind: 'Analysis',
    description: 'Current gauge invariants and full-segment estimates.',
  },
  {
    id: 'loops',
    title: 'Wilson loops',
    kind: 'Analysis',
    description: 'Contractible curvature and fixed winding representatives.',
  },
  {
    id: 'transform',
    title: 'Gauge transformation',
    kind: 'Analysis',
    description:
      'Preview and apply an exact symmetry, without a Monte Carlo update.',
  },
  {
    id: 'exact',
    title: 'Exact finite-volume reference',
    kind: 'Analysis',
    description: 'Enumeration over all unfixed link configurations.',
  },
  {
    id: 'history',
    title: 'Gauge-invariant history',
    kind: 'Plot',
    description:
      'Up to 256 recent transitions per segment; only scheduled measurements enter this plot.',
  },
  {
    id: 'winding',
    title: 'Winding joint counts',
    kind: 'Analysis',
    description:
      'Fixed Wₓ and Wᵧ representatives; values are not conserved by Monte Carlo.',
  },
  {
    id: 'transition',
    title: 'Latest gauge update',
    kind: 'Analysis',
    description:
      'Self, accepted flip and rejected proposal are distinct outcomes.',
  },
] as const satisfies readonly ToolDefinition<string>[];
type ToolId = (typeof tools)[number]['id'];

/** Mounted independently from the old Small Systems session. Visibility changes
 * neither engine; references and every tool are read-only snapshot consumers. */
export function GaugeWorkspace({
  example,
  launch,
  active,
  choose,
  archiveCount,
}: {
  example: GaugeExampleId;
  launch: number;
  active: boolean;
  choose: (id: string) => void;
  archiveCount: number;
}) {
  const initial = {
    ...defaultGauge,
    geometry:
      example === 'gauge-torus' ? ('torus' as const) : ('square' as const),
  };
  const [draft, setDraft] = useState<GaugeConfiguration>(initial);
  const [view, setView] = useState<GaugeView>({
    snapshot: null,
    running: false,
    busy: true,
    error: null,
  });
  const client = useRef<GaugeClient | null>(null);
  const previousLaunch = useRef(launch);
  useEffect(() => {
    const instance = new GaugeClient(
      () =>
        new Worker(new URL('../workers/z2Gauge.worker.ts', import.meta.url), {
          type: 'module',
        }) as unknown as GaugePort,
      setView,
    );
    client.current = instance;
    instance.initialize(initial);
    return () => {
      instance.dispose();
      client.current = null;
    };
  }, []);
  useEffect(() => {
    if (previousLaunch.current === launch) return;
    previousLaunch.current = launch;
    const next = {
      ...defaultGauge,
      geometry:
        example === 'gauge-torus' ? ('torus' as const) : ('square' as const),
    };
    setDraft(next);
    client.current?.initialize(next);
    setEdge('e0');
    setFace('f0');
    setLoop('f0');
    setPreview(false);
  }, [example, launch]);
  const [edge, setEdge] = useState('e0'),
    [vertex, setVertex] = useState('v0'),
    [face, setFace] = useState('f0'),
    [loop, setLoop] = useState('f0');
  const [preview, setPreview] = useState(false),
    [error, setError] = useState<string | null>(null);
  const snapshot = view.snapshot;
  const applied = snapshot?.configuration ?? initial;
  const model = useMemo(
    () => gaugeModel(applied.geometry, applied.K),
    [applied.geometry, applied.K],
  );
  const reference = useMemo(() => exactGauge(model), [model]);
  const formula = analyticGauge(model.geometry, model.K);
  const links = snapshot?.links ?? model.domain.edges.map(() => 1);
  const values = gaugeObservables(model, links);
  const current = snapshot?.segments.at(-1);
  const ready = !!snapshot && !view.running && !view.busy && !view.error;
  function attempt(action: () => void) {
    try {
      action();
      setError(null);
      setPreview(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid gauge command.');
    }
  }
  const changeVertex = (id: string) => {
    setVertex(id);
    setPreview(false);
  };
  function render(id: ToolId) {
    if (id === 'graph')
      return (
        <GaugeGraph
          model={model}
          links={links}
          edge={edge}
          vertex={vertex}
          face={face}
          loop={loop}
          selectEdge={setEdge}
          selectVertex={changeVertex}
          selectFace={(id) => {
            setFace(id);
            setLoop(id);
          }}
        />
      );
    if (id === 'inspection')
      return (
        <div>
          <p data-testid="gauge-invariants">
            Current S = {fmt(values.action!)}; mean plaquette ={' '}
            {fmt(values.meanPlaquette!)}.{' '}
            {model.domain.faces
              .map((f) => `${f.id}=${values[f.id]}`)
              .join(', ')}
            .
          </p>
          <p>
            Selected face {face}:{' '}
            {model.domain.faces
              .find((f) => f.id === face)
              ?.boundary.map((e) => `${e.sign === 1 ? '+' : '−'}${e.edgeId}`)
              .join(' ')}
            .
          </p>
          <table>
            <thead>
              <tr>
                <th>Segment / K</th>
                <th>Samples</th>
                <th>Mean P</th>
                <th>Mean S</th>
              </tr>
            </thead>
            <tbody>
              {snapshot?.segments.map((s) => (
                <tr key={s.id}>
                  <td>
                    {s.id} / {s.settings.K}
                  </td>
                  <td>{s.samples}</td>
                  <td>
                    {fmt(s.samples ? s.moments.meanPlaquette!.mean : null)}
                  </td>
                  <td>{fmt(s.samples ? s.moments.action!.mean : null)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <table aria-label="Current segment plaquette sign histogram">
            <thead>
              <tr>
                <th>Face</th>
                <th>−1 count</th>
                <th>+1 count</th>
              </tr>
            </thead>
            <tbody>
              {model.domain.faces.map((f) => (
                <tr key={f.id}>
                  <td>{f.id}</td>
                  <td>
                    {(current?.samples ?? 0) - (current?.plus[f.id] ?? 0)}
                  </td>
                  <td>{current?.plus[f.id] ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="plot-note">
            S is the dimensionless total action, not physical energy. Each
            segment has its own target. No independent-sample error bars are
            assigned to a local chain.
          </p>
        </div>
      );
    if (id === 'loops') {
      const selected =
        model.loops.find((l) => l.id === loop) ?? model.loops[0]!;
      return (
        <div>
          <label>
            Inspected Wilson loop
            <select
              value={selected.id}
              onChange={(e) => setLoop(e.target.value)}
            >
              {model.loops.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <p>
            {selected.boundary
              .map((e) => `${e.sign === 1 ? '+' : '−'}${e.edgeId}`)
              .join(' ')}
            ; W = {wilsonProduct(model, links, selected.boundary)}.
          </p>
          <p>
            Plaquettes measure curvature. A contractible boundary multiplies
            enclosed plaquettes. The two-face torus walk touches itself after
            periodic identification. Winding loops use fixed representatives;
            another representative can differ by flux. Local gauge
            transformations preserve every closed loop; Monte Carlo flips need
            not.
          </p>
        </div>
      );
    }
    if (id === 'transform') {
      const after = gaugeTransform(model, links, [vertex]);
      return (
        <div>
          <label>
            Gauge transformation vertex
            <select
              value={vertex}
              onChange={(e) => changeVertex(e.target.value)}
            >
              {model.domain.vertices.map((v) => (
                <option key={v.id}>{v.id}</option>
              ))}
            </select>
          </label>
          <button disabled={!ready} onClick={() => setPreview(true)}>
            Preview gauge transformation
          </button>
          {preview && (
            <div data-testid="gauge-preview">
              <p>
                Links before: {links.join(', ')}. After: {after.join(', ')}.
              </p>
              <p>
                S = {fmt(values.action!)} and every plaquette / Wilson loop are
                unchanged.
              </p>
              <button
                disabled={!ready}
                onClick={() => attempt(() => client.current!.transform(vertex))}
              >
                Apply vertex transformation
              </button>
            </div>
          )}
          <p>
            Pause and wait for acknowledgment. This worker-owned symmetry
            consumes no random numbers, updates or measurements, and starts no
            segment.
          </p>
        </div>
      );
    }
    if (id === 'exact')
      return (
        <div>
          <p>
            Exact enumeration: {reference.states.length} unfixed link states.
            Counting-measure log Z = {fmt(reference.logZ)}; independent
            analytical log Z = {fmt(formula.logZ)}.
          </p>
          <DisplayMath>
            {model.geometry === 'torus'
              ? String.raw`Z=256\cosh^4 K(1+\tanh^4 K)`
              : String.raw`Z=16\cosh K`}
          </DisplayMath>
          <table>
            <thead>
              <tr>
                <th>Observable</th>
                <th>Exact mean</th>
                <th>Sampled current segment</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(reference.means).map(([key, value]) => (
                <tr key={key}>
                  <td>{key}</td>
                  <td>{fmt(value)}</td>
                  <td>
                    {fmt(current?.samples ? current.moments[key]!.mean : null)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            P(Pf=+1) = {fmt(formula.plusProbability)}.{' '}
            {model.geometry === 'torus'
              ? 'Eight even-parity plaquette patterns, each with 32 link states. Gauge orbits have 8 states; 32 orbits total. Each fixed winding pair has probability 1/4.'
              : 'Each plaquette sign has 8 link states in one gauge orbit.'}
          </p>
          <p className="plot-note">
            Probabilities are normalized over every link word, without gauge
            fixing or quotient normalization.
          </p>
        </div>
      );
    if (id === 'winding')
      return model.geometry !== 'torus' ? (
        <p>
          The open square has no noncontractible winding loops. Select the torus
          to inspect Wₓ and Wᵧ.
        </p>
      ) : (
        <div>
          <p>
            Wₓ=e0·e2 = {values.wx}; Wᵧ=e1·e5 = {values.wy}. Exact means are
            zero.
          </p>
          <table>
            <thead>
              <tr>
                <th>Segment / K</th>
                <th>− −</th>
                <th>− +</th>
                <th>+ −</th>
                <th>+ +</th>
              </tr>
            </thead>
            <tbody>
              {snapshot?.segments.map((s) => (
                <tr key={s.id}>
                  <td>
                    {s.id} / {s.settings.K}
                  </td>
                  {s.winding.map((n, i) => (
                    <td key={i}>{n}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            Joint full-segment counts; exact probabilities 1/4 each. Winding
            values are gauge invariant but not conserved by local updates.
          </p>
        </div>
      );
    if (id === 'transition') {
      const event = snapshot?.event;
      return (
        <div data-testid="gauge-transition">
          <p>
            {event
              ? event.kind
              : 'Unmeasured all-positive initial configuration.'}
          </p>
          {event && event.kind !== 'gauge-transform' && (
            <>
              <p>
                {event.edgeId
                  ? `Selected link ${event.edgeId}. Hypothetical flip ΔS=${fmt(event.proposedDelta!)}; flip acceptance probability ${fmt(event.probability!)}.`
                  : 'Exact independent whole-configuration draw; acceptance N/A.'}{' '}
                Actual ΔS = {fmt(event.actualDelta)}.
              </p>
              <p>Uniforms: {event.uniforms.map((u) => fmt(u)).join(', ')}.</p>
            </>
          )}
          {event?.kind === 'gauge-transform' && (
            <p>
              Vertex {event.vertex}; deterministic symmetry, not an accepted
              proposal.
            </p>
          )}
          <p>
            Including warm-up: {current?.accepted ?? 0} accepted flips,{' '}
            {current?.rejected ?? 0} rejected flips, {current?.self ?? 0} lazy
            self-proposals. Acceptance excludes self-proposals:{' '}
            {applied.sampler === 'direct'
              ? 'N/A'
              : current && current.accepted + current.rejected
                ? `${fmt((100 * current.accepted) / (current.accepted + current.rejected))}%`
                : 'awaiting flip proposals'}
            .
          </p>
        </div>
      );
    }
    return (
      <div>
        {snapshot?.segments.map((s) => {
          const history = s.history.filter((record) => record.measured);
          const first = history[0]?.update ?? 0,
            last = history.at(-1)?.update ?? 1;
          return (
            <div key={s.id}>
              <p>
                Segment {s.id}, K={s.settings.K}: {history.length} recent /{' '}
                {s.samples} retained; global updates {first}–{last}.
              </p>
              <svg
                viewBox="0 0 480 150"
                role="img"
                aria-label={`Segment ${s.id} mean plaquette history`}
              >
                <line x1="20" x2="460" y1="70" y2="70" stroke="#bbb" />
                {history.map((h) => (
                  <circle
                    key={h.update}
                    cx={
                      20 +
                      (440 * (h.update - first)) / Math.max(1, last - first)
                    }
                    cy={70 - 55 * h.values.meanPlaquette!}
                    r="2"
                    fill="#166c67"
                  />
                ))}
                <text x="20" y="145" fontSize="12">
                  {first}
                </text>
                <text x="400" y="145" fontSize="12">
                  {last}
                </text>
              </svg>
            </div>
          );
        })}
        <p>
          Mean plaquette P ∈ [−1,1]; horizontal axis: algorithmic update number,
          never physical time. Segments are not joined.
        </p>
      </div>
    );
  }
  return (
    <>
      <SiteHeader active="small" archiveCount={archiveCount} />
      <main className="gauge-workspace">
        <section className="intro">
          <div>
            <p className="eyebrow">Small gauge systems / M5a</p>
            <h1>
              Links, loops. <span>Gauge symmetry.</span>
            </h1>
            <p>
              Classical finite Euclidean Z₂ gauge theory on one plaquette or a
              tiny torus.
            </p>
          </div>
        </section>
        <div className="lab-layout">
          <aside className="sidebar" aria-label="Gauge model and settings">
            <section className="model-card">
              <label>
                Named example
                <select
                  aria-label={
                    active ? 'Named example' : 'Inactive gauge example'
                  }
                  value={
                    applied.geometry === 'torus'
                      ? 'gauge-torus'
                      : 'gauge-square'
                  }
                  onChange={(e) => choose(e.target.value)}
                >
                  {catalogGroups.map((g) => (
                    <optgroup key={g.label} label={g.label}>
                      {g.examples.map(([id, label]) => (
                        <option key={id} value={id}>
                          {label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                  <GaugeCatalogOptions />
                </select>
              </label>
              <DisplayMath>{String.raw`S_K(U)=-K\sum_f P_f(U)`}</DisplayMath>
              <p>
                <InlineMath>{String.raw`U_e\in\{-1,+1\},\quad P_f=\prod_{e\in\partial f}U_e`}</InlineMath>
              </p>
              <p>Unfixed links; counting measure. No extra β.</p>
            </section>
            <details
              className="settings-panel"
              open={!window.matchMedia('(max-width: 700px)').matches}
            >
              <summary>Gauge settings</summary>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  attempt(() => {
                    if (draft.geometry !== applied.geometry) {
                      client.current!.initialize(draft);
                      setEdge('e0');
                      setFace('f0');
                      setLoop('f0');
                    } else client.current!.change(draft);
                  });
                }}
              >
                <label>
                  Gauge geometry
                  <select
                    value={draft.geometry}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        geometry: e.target
                          .value as GaugeConfiguration['geometry'],
                      })
                    }
                  >
                    <option value="square">Open square</option>
                    <option value="torus">Periodic 2×2 torus</option>
                  </select>
                </label>
                <label>
                  Dimensionless coupling K
                  <input
                    type="number"
                    min="-4"
                    max="4"
                    step="any"
                    required
                    value={draft.K}
                    onChange={(e) =>
                      setDraft({ ...draft, K: e.target.valueAsNumber })
                    }
                  />
                </label>
                <label>
                  Gauge sampler
                  <select
                    value={draft.sampler}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        sampler: e.target
                          .value as GaugeConfiguration['sampler'],
                      })
                    }
                  >
                    <option value="direct">Exact independent draw</option>
                    <option value="metropolis">Lazy link Metropolis</option>
                  </select>
                </label>
                {draft.sampler === 'metropolis' && (
                  <>
                    <label>
                      Warm-up sweeps
                      <input
                        type="number"
                        min="0"
                        max="10000"
                        required
                        value={draft.warmup}
                        onChange={(e) =>
                          setDraft({ ...draft, warmup: e.target.valueAsNumber })
                        }
                      />
                    </label>
                    <label>
                      Measurement stride (sweeps)
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        required
                        value={draft.stride}
                        onChange={(e) =>
                          setDraft({ ...draft, stride: e.target.valueAsNumber })
                        }
                      />
                    </label>
                  </>
                )}
                <label>
                  Gauge seed
                  <input
                    type="number"
                    min="0"
                    max="4294967295"
                    required
                    value={draft.seed}
                    onChange={(e) =>
                      setDraft({ ...draft, seed: e.target.valueAsNumber })
                    }
                  />
                </label>
                <button disabled={!ready}>Apply gauge settings</button>
              </form>
            </details>
            <p data-testid="gauge-applied">
              Applied {applied.geometry}, K={applied.K}, {applied.sampler}.
              Fixed-topology changes preserve links/RNG and start isolated
              segments. Topology changes and Reset restart the selected seed.
            </p>
            <div className="gauge-actions">
              <button
                disabled={
                  !snapshot || !!view.error || (!view.running && view.busy)
                }
                onClick={() =>
                  attempt(() =>
                    view.running
                      ? client.current!.pause()
                      : client.current!.start(),
                  )
                }
              >
                {view.running ? 'Pause' : 'Run'}
              </button>
              <button
                disabled={!ready}
                onClick={() => attempt(() => client.current!.step())}
              >
                Step
              </button>
              <button
                onClick={() =>
                  attempt(() =>
                    client.current!.initialize({
                      ...applied,
                      seed: draft.seed,
                    }),
                  )
                }
              >
                Reset
              </button>
            </div>
            <p role="status">
              {view.running
                ? 'Sampling'
                : view.busy
                  ? 'Waiting for acknowledgment'
                  : 'Paused'}{' '}
              ·{' '}
              <span data-testid="gauge-updates">{snapshot?.updates ?? 0}</span>{' '}
              updates ·{' '}
              <span data-testid="gauge-samples">{current?.samples ?? 0}</span>{' '}
              retained · segment{' '}
              <span data-testid="gauge-segment">{current?.id ?? 1}</span>
            </p>
            {(error || view.error) && <p role="alert">{error ?? view.error}</p>}
            <p className="plot-note">
              One Step:{' '}
              {applied.sampler === 'direct'
                ? 'one independent draw, immediately retained; no warm-up.'
                : `one attempted link update. ${links.length} attempts form a nominal sweep; applied warm-up ${applied.warmup}, stride ${applied.stride} sweeps.`}{' '}
              Seed edits take effect on Reset or topology change. Initial links
              are unmeasured.
            </p>
            <p className="plot-note">
              Gauge archives and sweeps are not available in M5a. Other mounted
              workspaces retain their own sessions.
            </p>
          </aside>
          <div className="gauge-content">
            <ToolDeck
              title="Gauge tools"
              tools={tools}
              featuredDefault="graph"
              defaults={['inspection', 'exact']}
              renderTool={render}
            />
            <details className="model-notes">
              <summary>Mathematics & suggested experiments</summary>
              <p>
                Flip a link and compare the affected plaquettes. Transform one
                vertex twice. Compare direct draws with the lazy local chain at
                K=0 and K=±0.7. On the torus, the product of all four plaquettes
                is +1. Compare winding joint counts with four equally probable
                pairs.
              </p>
              <p>
                Large |K| can slow local mixing. These tiny finite 2D systems do
                not establish a thermodynamic phase transition. This is
                classical Euclidean gauge theory, not quantum dynamics or a
                Gauss-law Hilbert space.
              </p>
            </details>
          </div>
        </div>
      </main>
    </>
  );
}
