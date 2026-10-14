import { useEffect, useMemo, useRef, useState } from 'react';
import { XYClient } from '../engine/xyClient';
import type { XYPort, XYView } from '../engine/xyClient';
import {
  defaultLatticeXY,
  sameXYSupport,
  validateXYSettings,
} from '../engine/xyRun';
import type { XYConfiguration, XYInitialization } from '../engine/xyRun';
import type { XYSampler } from '../algorithms/xySampler';
import { xyGeometries, xyGraph } from '../domain/xyDomain';
import type { XYGeometry } from '../domain/xyDomain';
import { xyModel } from '../models/xy';
import { SiteHeader } from './SiteHeader';
import { ToolDeck } from './ToolDeck';
import { xyTools, XYTool, defaultXYOptions } from './XYTools';
import type { XYOptions } from './XYTools';
import type { XYSelection } from './XYConfiguration';
import { XYCatalogOptions, xyRecipe } from './xyCatalog';
import type { XYExampleId } from './xyCatalog';
import { catalogGroups } from './smallCatalog';
import { GaugeCatalogOptions } from './gaugeCatalog';
import { PottsCatalogOptions } from './pottsCatalog';
import { DisplayMath } from '../ui/Math';
type Draft = {
  h: string;
  geometry: XYGeometry;
  couplings: Record<string, string>;
  lx: string;
  ly: string;
  periodicX: boolean;
  periodicY: boolean;
  kx: string;
  ky: string;
  sampler: XYSampler;
  width: string;
  warmup: string;
  stride: string;
  seed: string;
  initialization: XYInitialization;
};
function draftFor(c: XYConfiguration): Draft {
  const g = c.parameters.geometry;
  return {
    h: String(c.parameters.h),
    geometry: g.kind === 'graph' ? (g.domain.id as XYGeometry) : 'site',
    couplings:
      g.kind === 'graph'
        ? Object.fromEntries(
            Object.entries(g.couplings).map(([id, K]) => [id, String(K)]),
          )
        : {},
    lx: g.kind === 'lattice' ? String(g.shape.lx) : '16',
    ly: g.kind === 'lattice' ? String(g.shape.ly) : '16',
    periodicX: g.kind === 'lattice' ? g.shape.periodicX : true,
    periodicY: g.kind === 'lattice' ? g.shape.periodicY : true,
    kx: g.kind === 'lattice' ? String(g.kx) : '.7',
    ky: g.kind === 'lattice' ? String(g.ky) : '.7',
    sampler: c.sampler,
    width: String(c.width),
    warmup: String(c.warmup),
    stride: String(c.stride),
    seed: String(c.seed),
    initialization: c.initialization,
  };
}
function parsed(d: Draft, mode: 'small' | 'lattice'): XYConfiguration {
  const graph = xyGraph(d.geometry);
  if (graph.kind !== 'graph') throw Error('Expected graph');
  const c: XYConfiguration = {
    parameters: {
      h: Number(d.h),
      geometry:
        mode === 'small'
          ? {
              ...graph,
              couplings: Object.fromEntries(
                Object.entries(d.couplings).map(([id, K]) => [id, Number(K)]),
              ),
            }
          : {
              kind: 'lattice',
              shape: {
                lx: Number(d.lx),
                ly: Number(d.ly),
                periodicX: d.periodicX,
                periodicY: d.periodicY,
              },
              kx: Number(d.kx),
              ky: Number(d.ky),
            },
    },
    sampler: d.sampler,
    width: Number(d.width),
    warmup: Number(d.warmup),
    stride: Number(d.stride),
    seed: Number(d.seed),
    initialization: d.initialization,
  };
  validateXYSettings(c);
  return c;
}
/** Each placement owns one independent mounted worker. Drafts and keyed tool
 * options belong here; numerical angles, RNG and measurement cadence do not.
 * A named launch resets its recipe; navigation alone merely hides this page. */
export function XYWorkspace({
  mode,
  example = 'xy-rotor',
  launch = 0,
  active,
  choose,
  archiveCount,
  onLatticeChoice,
}: {
  mode: 'small' | 'lattice';
  example?: XYExampleId;
  launch?: number;
  active: boolean;
  choose?: (id: string) => void;
  archiveCount: number;
  onLatticeChoice?: (id: '2d' | 'chain' | 'potts' | 'xy') => void;
}) {
  const initial = mode === 'small' ? xyRecipe(example) : defaultLatticeXY;
  const [draft, setDraft] = useState(() => draftFor(initial)),
    [lastApplied, setLastApplied] = useState(initial);
  const [view, setView] = useState<XYView>({
    snapshot: null,
    running: false,
    busy: true,
    pending: false,
    error: null,
  });
  const [error, setError] = useState<string | null>(null),
    [selection, select] = useState<XYSelection>({
      site: 0,
      bond: 'e0',
      face: 0,
    });
  const [options, setOptions] = useState<Record<number, XYOptions>>({});
  const client = useRef<XYClient | null>(null),
    previousLaunch = useRef(launch);
  useEffect(() => {
    const instance = new XYClient(
      () =>
        new Worker(new URL('../workers/xy.worker.ts', import.meta.url), {
          type: 'module',
        }) as unknown as XYPort,
      setView,
    );
    client.current = instance;
    instance.initialize(initial);
    return () => {
      instance.dispose();
      client.current = null;
    };
  }, []);
  function clearSelection() {
    select({ site: 0, bond: 'e0', face: 0 });
    setOptions({});
  }
  useEffect(() => {
    if (previousLaunch.current === launch) return;
    previousLaunch.current = launch;
    const next = xyRecipe(example);
    client.current?.initialize(next);
    setDraft(draftFor(next));
    setLastApplied(next);
    clearSelection();
    setError(null);
  }, [example, launch]);
  const snapshot = view.snapshot,
    applied = snapshot?.configuration ?? lastApplied;
  const model = useMemo(
    () => xyModel(applied.parameters),
    [applied.parameters],
  );
  const current = snapshot?.segments.at(-1),
    ready =
      !!snapshot && !view.busy && !view.running && !view.error && !view.pending;
  function attempt(action: () => void) {
    try {
      action();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid XY settings.');
    }
  }
  function reset(c: XYConfiguration) {
    client.current!.initialize(c);
    setLastApplied(c);
    clearSelection();
  }
  const number = (
    key:
      'h' | 'kx' | 'ky' | 'warmup' | 'stride' | 'seed' | 'lx' | 'ly' | 'width',
    label: string,
    min: number,
    max: number,
    step = '1',
  ) => (
    <label>
      {label}
      <input
        type="number"
        required
        min={min}
        max={max}
        step={step}
        value={draft[key]}
        onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
      />
    </label>
  );
  return (
    <>
      <SiteHeader
        active={mode === 'small' ? 'small' : 'lattice'}
        archiveCount={archiveCount}
      />
      <main
        className="gauge-workspace xy-workspace"
        data-testid={`${mode}-xy-workspace`}
      >
        <section className="intro">
          <div>
            <p className="eyebrow">
              {mode === 'small' ? 'Small XY systems' : '2D XY laboratory'}
            </p>
            <h1>
              Planar spins. <span>Integer vortices.</span>
            </h1>
            <p>
              Continuous site angles, signed dimensionless interactions and
              normalized Haar measure.
            </p>
          </div>
        </section>
        <div className="lab-layout">
          <aside className="sidebar" aria-label="XY model and settings">
            <section className="model-card">
              {mode === 'small' ? (
                <label>
                  Named example
                  <select
                    aria-label={
                      active ? 'Named example' : 'Inactive XY example'
                    }
                    value={example}
                    onChange={(e) => choose?.(e.target.value)}
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
              ) : (
                <label>
                  Physical system
                  <select
                    aria-label={
                      active
                        ? 'Lattice physical system'
                        : 'Inactive XY physical system'
                    }
                    value="xy"
                    onChange={(e) =>
                      onLatticeChoice?.(
                        e.target.value as '2d' | 'chain' | 'potts' | 'xy',
                      )
                    }
                  >
                    <option value="2d">2D square-lattice Ising</option>
                    <option value="chain">1D Ising chain</option>
                    <option value="potts">2D Potts</option>
                    <option value="xy">2D XY</option>
                  </select>
                </label>
              )}
              <DisplayMath>{String.raw`\begin{aligned}S_{XY}&=-\sum_e K_e\cos\Delta\theta_e\\&\quad-h\sum_i\cos\theta_i\end{aligned}`}</DisplayMath>
              <p>
                One angle per site in [−π,π), with ∏dθ/(2π) and no extra β. Here
                Δθₑ is the head-minus-tail angle. Positive K favors parallel
                spins; negative K favors antiparallel spins. The source h points
                along the x spin direction.
              </p>
            </section>
            <details
              className="settings-panel"
              open={!window.matchMedia('(max-width:700px)').matches}
            >
              <summary>XY settings</summary>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  attempt(() => {
                    const next = parsed(draft, mode);
                    if (
                      !sameXYSupport(applied.parameters, next.parameters) ||
                      next.initialization !== applied.initialization
                    )
                      reset(next);
                    else client.current!.change(next);
                  });
                }}
              >
                {mode === 'small' ? (
                  <>
                    <label>
                      XY graph geometry
                      <select
                        value={draft.geometry}
                        onChange={(e) => {
                          const geometry = e.target.value as XYGeometry,
                            g = xyGraph(geometry);
                          if (g.kind === 'graph')
                            setDraft({
                              ...draft,
                              geometry,
                              initialization: 'random',
                              couplings: Object.fromEntries(
                                Object.keys(g.couplings).map((id) => [
                                  id,
                                  '.7',
                                ]),
                              ),
                            });
                        }}
                      >
                        {Object.entries(xyGeometries).map(([id, label]) => (
                          <option key={id} value={id}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {Object.entries(draft.couplings).map(([id, K]) => (
                      <label key={id}>
                        XY K {id}
                        <input
                          type="number"
                          required
                          min="-4"
                          max="4"
                          step="any"
                          value={K}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              couplings: {
                                ...draft.couplings,
                                [id]: e.target.value,
                              },
                            })
                          }
                        />
                      </label>
                    ))}
                  </>
                ) : (
                  <>
                    {number('lx', 'XY Lx', 2, 32)}
                    {number('ly', 'XY Ly', 2, 32)}
                    {(['periodicX', 'periodicY'] as const).map((key, i) => (
                      <label key={key}>
                        XY {i === 0 ? 'x' : 'y'} boundary
                        <select
                          value={draft[key] ? 'periodic' : 'open'}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              [key]: e.target.value === 'periodic',
                            })
                          }
                        >
                          <option value="open">Open</option>
                          <option value="periodic">Periodic</option>
                        </select>
                      </label>
                    ))}
                    {number('kx', 'XY Kx', -4, 4, 'any')}
                    {number('ky', 'XY Ky', -4, 4, 'any')}
                  </>
                )}
                {number('h', 'XY source h', -4, 4, 'any')}
                <label>
                  XY sampler
                  <select
                    aria-label="XY sampler"
                    value={draft.sampler}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        sampler: e.target.value as XYSampler,
                      })
                    }
                  >
                    <option value="metropolis">
                      Random-site angular Metropolis
                    </option>
                    <option value="heat-bath">
                      Conditional von Mises heat bath
                    </option>
                  </select>
                </label>
                {draft.sampler === 'metropolis' &&
                  number(
                    'width',
                    'XY proposal half-width',
                    0.02,
                    Math.PI,
                    'any',
                  )}
                {number('warmup', 'XY warm-up sweeps', 0, 10000)}
                {number('stride', 'XY measurement stride (sweeps)', 1, 1000)}
                <label>
                  XY initialization
                  <select
                    value={draft.initialization}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        initialization: e.target.value as XYInitialization,
                      })
                    }
                  >
                    <option value="aligned">All aligned (no draws)</option>
                    <option value="random">
                      Independent uniform angles (V draws)
                    </option>
                    {((mode === 'small' &&
                      ['square', 'torus'].includes(draft.geometry)) ||
                      (mode === 'lattice' &&
                        draft.lx === '2' &&
                        draft.ly === '2')) && (
                      <>
                        <option value="vortex">
                          Positive vortex fixture (no draws)
                        </option>
                        <option value="antivortex">
                          Negative vortex fixture (no draws)
                        </option>
                      </>
                    )}
                  </select>
                </label>
                {number('seed', 'XY seed on Reset', 0, 4294967295)}
                <button disabled={!snapshot || !!view.error || view.pending}>
                  Apply XY settings
                </button>
              </form>
            </details>
            <p data-testid="xy-applied">
              Applied{' '}
              {model.shape
                ? `${model.shape.lx}×${model.shape.ly}`
                : xyGeometries[model.graph!.id as XYGeometry]}
              ; h={model.h}; {applied.sampler}; warm-up {applied.warmup}, stride{' '}
              {applied.stride} nominal sweeps; initialization{' '}
              {applied.initialization}.{' '}
              {applied.parameters.geometry.kind === 'lattice'
                ? `Kx=${applied.parameters.geometry.kx}, Ky=${applied.parameters.geometry.ky}`
                : model.bonds.map((b) => `${b.id}=${b.K}`).join(', ')}
              .
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
                    if (!draft.seed.trim()) throw Error('Enter a seed.');
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
                  : 'Paused'}
              {view.pending ? ' · settings pending' : ''} ·{' '}
              <span data-testid="xy-updates">{snapshot?.updates ?? 0}</span>{' '}
              site updates ·{' '}
              <span data-testid="xy-samples">{current?.samples ?? 0}</span>{' '}
              retained · segment{' '}
              <span data-testid="xy-segment">{current?.id ?? 1}</span> ·{' '}
              <span data-testid="xy-draws">{snapshot?.draws ?? 0}</span>{' '}
              uniforms.
            </p>
            {(error || view.error) && <p role="alert">{error ?? view.error}</p>}
            <p className="plot-note">
              One Step is one random-site attempt; {model.size} attempts with
              replacement make a nominal sweep, not physical time. Rejected
              states remain eligible measurements. Heat-bath candidate rejection
              is internal work, not chain rejection. Initialization is
              unmeasured.
            </p>
            <p className="plot-note">
              Apply preserves angles/RNG in an isolated segment. Geometry,
              boundaries, initialization changes and Reset reseed. Seed edits
              apply on Reset. Global rotation at h=0 preserves existing
              measurements. Tools and hidden-page navigation do not sample. No
              XY archive or sweep format is introduced.
            </p>
          </aside>
          <div className="gauge-content">
            <ToolDeck
              title="XY tools"
              tools={xyTools}
              key={example}
              featuredDefault="configuration"
              defaults={
                mode === 'small'
                  ? ['reference', 'conditional']
                  : ['history', 'correlation', 'vortices']
              }
              renderTool={(id, key) => (
                <XYTool
                  {...{ id, model, snapshot, selection, select, ready }}
                  options={options[key] ?? defaultXYOptions}
                  changeOptions={(value) =>
                    setOptions((o) => ({ ...o, [key]: value }))
                  }
                  rotate={(alpha) =>
                    attempt(() => client.current!.rotate(alpha))
                  }
                />
              )}
            />
            <details className="model-notes">
              <summary>XY measurement coverage and segments</summary>
              <p>
                At most eight segments, 256 recent retained scalar records per
                segment. Only tiny systems keep recent full angle vectors.
                Full-segment means use every scheduled post-warm-up state;
                vortex summaries omit incomplete/ambiguous images with explicit
                coverage. {snapshot?.droppedSegments ?? 0} old segments removed.
              </p>
              {snapshot?.segments.map((s) => (
                <p key={s.id}>
                  Segment {s.id}: h={s.settings.parameters.h};{' '}
                  {s.settings.sampler}; {s.updates} attempts, {s.warmupUpdates}{' '}
                  discarded warm-up attempts, {s.samples} retained; {s.draws}{' '}
                  sampling uniforms, {s.trials} conditional trials.{' '}
                  {s.vortex
                    ? `Vortex coverage ${s.vortex.coverage}/${s.samples}, ${s.vortex.omitted} omitted configurations.`
                    : 'No plaquettes.'}
                </p>
              ))}
            </details>
            <details className="model-notes">
              <summary>XY mathematics and suggested experiments</summary>
              <p>
                XY variables live on sites; U(1) gauge variables live on
                independent links. Global XY rotation at h=0 is one common
                angle. The derived XY bond phases multiply to one around every
                face even when their principal real increments wind by 2π.
              </p>
              <ol>
                <li>
                  Compare the single rotor and dimer with I₀ and I₁/I₀
                  references.
                </li>
                <li>
                  Set the triangle bonds to −1 and examine the two 120° chiral
                  arrangements; this graph has no square plaquette.
                </li>
                <li>
                  Load a 2×2 vortex fixture; compare open charge +1 with
                  periodic balanced charges.
                </li>
                <li>
                  Rotate all spins at h=0 and compare magnitude, components and
                  vortex charge.
                </li>
                <li>
                  Compare random and aligned 2D starts, local algorithms and
                  couplings. Slow decorrelation and finite size limit any BKT
                  interpretation.
                </li>
              </ol>
              <p>
                Finite runs do not determine a transition temperature, mixing
                time or helicity modulus. No physical-time dynamics, gauge
                fixing or independent-sample uncertainty is implied.
              </p>
            </details>
          </div>
        </div>
      </main>
    </>
  );
}
