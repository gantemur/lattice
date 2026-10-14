import { XYCatalogOptions } from './xyCatalog';
import { PottsCatalogOptions } from './pottsCatalog';
import { useEffect, useMemo, useRef, useState } from 'react';
import { U1GaugeClient } from '../engine/u1GaugeClient';
import type { U1Port, U1View } from '../engine/u1GaugeClient';
import { defaultU1 } from '../engine/u1GaugeRun';
import type { U1Configuration } from '../engine/u1GaugeRun';
import { u1GaugeModel } from '../models/u1Gauge';
import { DisplayMath } from '../ui/Math';
import { SiteHeader } from './SiteHeader';
import { ToolDeck } from './ToolDeck';
import { GaugeCatalogOptions } from './gaugeCatalog';
import type { U1ExampleId } from './gaugeCatalog';
import { catalogGroups } from './smallCatalog';
import { initialU1Selection, U1GaugeTool, u1Tools } from './U1GaugeTools';

// Strings keep partially edited/empty numeric fields out of applied science and
// avoid React NaN values. Parsing and worker validation occur only on Apply.
type Draft = {
  geometry: U1Configuration['geometry'];
  K: string;
  width: string;
  warmup: string;
  stride: string;
  seed: string;
};
function draftFor(c: U1Configuration): Draft {
  return {
    geometry: c.geometry,
    K: String(c.K),
    width: String(c.width),
    warmup: String(c.warmup),
    stride: String(c.stride),
    seed: String(c.seed),
  };
}
function recipe(example: U1ExampleId): U1Configuration {
  return {
    ...defaultU1,
    geometry: example === 'u1-torus' ? 'torus' : 'square',
  };
}

/** Independent lazy-mounted worker. An explicit named-example launch resets
 * this family to its declared seed/defaults; ordinary tab changes only hide it.
 * Draft controls, selected carriers and tool placement never own numerical state. */
export function U1GaugeWorkspace({
  example,
  launch,
  active,
  choose,
  archiveCount,
}: {
  example: U1ExampleId;
  launch: number;
  active: boolean;
  choose: (id: string) => void;
  archiveCount: number;
}) {
  const initial = recipe(example);
  const [draft, setDraft] = useState(() => draftFor(initial));
  const [lastApplied, setLastApplied] = useState(initial);
  const [view, setView] = useState<U1View>({
    snapshot: null,
    running: false,
    busy: true,
    error: null,
  });
  const [selection, setSelection] = useState(initialU1Selection);
  const [error, setError] = useState<string | null>(null);
  const client = useRef<U1GaugeClient | null>(null),
    previousLaunch = useRef(launch);
  useEffect(() => {
    const instance = new U1GaugeClient(
      () =>
        new Worker(new URL('../workers/u1Gauge.worker.ts', import.meta.url), {
          type: 'module',
        }) as unknown as U1Port,
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
    const next = recipe(example);
    setDraft(draftFor(next));
    setLastApplied(next);
    setSelection(initialU1Selection);
    setError(null);
    client.current?.initialize(next);
  }, [example, launch]);
  const snapshot = view.snapshot,
    applied = snapshot?.configuration ?? lastApplied;
  const model = useMemo(
    () => u1GaugeModel(applied.geometry, applied.K),
    [applied.geometry, applied.K],
  );
  const ready = !!snapshot && !view.busy && !view.running && !view.error;
  const current = snapshot?.segments.at(-1);
  function attempt(action: () => void) {
    try {
      action();
      setError(null);
      setSelection((s) => ({ ...s, preview: false }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid U(1) command.');
    }
  }
  function reset(next: U1Configuration) {
    client.current!.initialize(next);
    setLastApplied(next);
    setSelection(initialU1Selection);
  }
  const numbers = [
    ['K', 'Dimensionless U(1) coupling K', -4, 4, 'any'],
    ['width', 'Angular proposal half-width (radians)', 0.02, Math.PI, 'any'],
    ['warmup', 'U(1) warm-up sweeps', 0, 10000, '1'],
    ['stride', 'U(1) measurement stride (sweeps)', 1, 1000, '1'],
    ['seed', 'U(1) seed on Reset', 0, 4294967295, '1'],
  ] as const;
  return (
    <>
      <SiteHeader active="small" archiveCount={archiveCount} />
      <main className="gauge-workspace u1-workspace">
        <section className="intro">
          <div>
            <p className="eyebrow">Small gauge systems / Compact U(1)</p>
            <h1>
              Circle-valued links. <span>Invariant loops.</span>
            </h1>
            <p>
              Classical finite Euclidean gauge theory, with normalized Haar
              measure.
            </p>
          </div>
        </section>
        <div className="lab-layout">
          <aside className="sidebar" aria-label="U(1) model and settings">
            <section className="model-card">
              <label>
                Named example
                <select
                  aria-label={
                    active ? 'Named example' : 'Inactive U(1) example'
                  }
                  value={
                    applied.geometry === 'torus' ? 'u1-torus' : 'u1-square'
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
                  <PottsCatalogOptions />
                  <XYCatalogOptions />
                </select>
              </label>
              <DisplayMath>{String.raw`U_e=e^{i\theta_e},\quad S=-K\sum_f\cos\theta_f`}</DisplayMath>
              <DisplayMath>{String.raw`dP=Z^{-1}e^{-S}\prod_e\frac{d\theta_e}{2\pi}`}</DisplayMath>
              <p>
                U(1) link phases, θ∈[−π,π). No extra β, no gauge fixing. Angular
                random-link Metropolis.
              </p>
            </section>
            <details
              className="settings-panel"
              open={!window.matchMedia('(max-width: 700px)').matches}
            >
              <summary>U(1) settings</summary>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  attempt(() => {
                    const next: U1Configuration = {
                      geometry: draft.geometry,
                      sampler: 'metropolis',
                      K: Number(draft.K),
                      width: Number(draft.width),
                      warmup: Number(draft.warmup),
                      stride: Number(draft.stride),
                      seed: Number(draft.seed),
                    };
                    if (next.geometry !== applied.geometry) reset(next);
                    else client.current!.change(next);
                  });
                }}
              >
                <label>
                  U(1) geometry
                  <select
                    value={draft.geometry}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        geometry: e.target.value as Draft['geometry'],
                      })
                    }
                  >
                    <option value="square">Open square</option>
                    <option value="torus">Periodic 2×2 torus</option>
                  </select>
                </label>
                {numbers.map(([key, label, min, max, step]) => (
                  <label key={key}>
                    {label}
                    <input
                      type="number"
                      required
                      min={min}
                      max={max}
                      step={step}
                      value={draft[key]}
                      onChange={(e) =>
                        setDraft({ ...draft, [key]: e.target.value })
                      }
                    />
                  </label>
                ))}
                <button disabled={!ready}>Apply U(1) settings</button>
              </form>
            </details>
            <p data-testid="u1-applied">
              Applied {applied.geometry}, K={applied.K}, width={applied.width}{' '}
              rad; warm-up {applied.warmup}, stride {applied.stride} sweeps.
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
                  attempt(() => {
                    if (!draft.seed.trim())
                      throw new Error('Enter a seed for Reset.');
                    reset({ ...applied, seed: Number(draft.seed) });
                  })
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
              · <span data-testid="u1-updates">{snapshot?.updates ?? 0}</span>{' '}
              updates ·{' '}
              <span data-testid="u1-samples">{current?.samples ?? 0}</span>{' '}
              retained · segment{' '}
              <span data-testid="u1-segment">{current?.id ?? 1}</span>
            </p>
            {(error || view.error) && <p role="alert">{error ?? view.error}</p>}
            <p className="plot-note">
              One Step is one attempt; {model.domain.edges.length} random-link
              attempts with replacement form a nominal sweep, not physical time.
              Initial all-zero angles are unmeasured. Fixed-geometry Apply
              preserves angles/RNG in an isolated segment; geometry changes and
              Reset clear/reseed. Seed edits take effect only on Reset or
              geometry change.
            </p>
            <p className="plot-note">
              Eight segments, 256 recent measured configurations each; full
              moments and histograms survive history eviction. Gauge
              archives/sweeps are not available. Explicit catalog choices launch
              seeded defaults; top-level tabs preserve mounted sessions.
            </p>
          </aside>
          <div className="gauge-content">
            <ToolDeck
              title="U(1) tools"
              tools={u1Tools}
              featuredDefault="graph"
              defaults={['inspection', 'reference', 'transform']}
              renderTool={(id) => (
                <U1GaugeTool
                  id={id}
                  model={model}
                  snapshot={snapshot}
                  selection={selection}
                  select={(patch) => setSelection((s) => ({ ...s, ...patch }))}
                  ready={ready}
                  transform={(vertex, alpha) =>
                    attempt(() => client.current!.transform(vertex, alpha))
                  }
                />
              )}
            />
            <details className="model-notes">
              <summary>Parameter segments & measurement coverage</summary>
              {snapshot?.segments.map((s) => (
                <p key={s.id}>
                  Segment {s.id}: K={s.settings.K}, width {s.settings.width}{' '}
                  rad; warm-up {s.settings.warmup}, stride {s.settings.stride}{' '}
                  sweeps.
                  {s.updates} attempts ({s.accepted} accepted, {s.rejected}{' '}
                  rejected, including warm-up), {s.samples} measurements,
                  {s.history.length} recent vectors. All {s.samples} states
                  contribute to each invariant histogram and complex moment.
                </p>
              ))}
              <p>
                No segments with different parameters are pooled. Old segments
                are evicted after eight; raw vectors after 256 measurements.
                Display controls do not change collection.
              </p>
            </details>
            <details className="model-notes">
              <summary>Mathematics &amp; suggested experiments</summary>
              <p>
                Reverse an oriented loop and check complex conjugation.
                Transform a vertex by α then −α. Compare open-plaquette
                measurements with I₁/I₀ at K=0 and ±0.7. Derive the torus
                character sum by integrating every independent link against
                normalized Haar measure.
              </p>
              <p>
                The torus has eight links and four constrained plaquettes.
                Principal angles may sum to 2π rather than zero. Local gauge
                symmetry preserves winding holonomies; Metropolis need not. Flat
                directions may mix slowly even when plaquette averages agree
                with theory.
              </p>
              <p>
                This tiny finite 2D Euclidean measure is not real-time quantum
                dynamics, a continuum extrapolation or evidence of a confinement
                transition. No gauge fixing, matter, HMC, automatic tuning or
                topological-sector estimator is included.
              </p>
            </details>
          </div>
        </div>
      </main>
    </>
  );
}
