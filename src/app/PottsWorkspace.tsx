import { useEffect, useMemo, useRef, useState } from 'react';
import { PottsClient } from '../engine/pottsClient';
import type { PottsPort, PottsView } from '../engine/pottsClient';
import {
  defaultLatticePotts,
  samePottsSupport,
  validatePottsSettings,
} from '../engine/pottsRun';
import type { PottsConfiguration } from '../engine/pottsRun';
import type { PottsSampler } from '../algorithms/pottsSampler';
import { pottsGeometries, pottsGraph } from '../domain/pottsDomain';
import type { PottsGeometry } from '../domain/pottsDomain';
import { pottsModel } from '../models/potts';
import { SiteHeader } from './SiteHeader';
import { ToolDeck } from './ToolDeck';
import { pottsTools, PottsTool } from './PottsTools';
import { PottsCatalogOptions, pottsRecipe } from './pottsCatalog';
import type { PottsExampleId } from './pottsCatalog';
import { catalogGroups } from './smallCatalog';
import { GaugeCatalogOptions } from './gaugeCatalog';
import { DisplayMath } from '../ui/Math';

type Draft = {
  q: string;
  h: string;
  geometry: PottsGeometry;
  couplings: Record<string, string>;
  lx: string;
  ly: string;
  periodicX: boolean;
  periodicY: boolean;
  kx: string;
  ky: string;
  sampler: PottsSampler;
  warmup: string;
  stride: string;
  seed: string;
};
function draftFor(c: PottsConfiguration): Draft {
  const g = c.parameters.geometry;
  return {
    q: String(c.parameters.q),
    h: String(c.parameters.h),
    geometry: g.kind === 'graph' ? (g.domain.id as PottsGeometry) : 'dimer',
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
    warmup: String(c.warmup),
    stride: String(c.stride),
    seed: String(c.seed),
  };
}
function parsed(d: Draft, mode: 'small' | 'lattice'): PottsConfiguration {
  const graph = pottsGraph(d.geometry);
  if (graph.kind !== 'graph') throw new Error('Expected graph draft.');
  const configuration: PottsConfiguration = {
    parameters: {
      q: Number(d.q) as 2 | 3 | 4,
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
    warmup: Number(d.warmup),
    stride: Number(d.stride),
    seed: Number(d.seed),
  };
  validatePottsSettings(configuration);
  return configuration;
}
/** Draft, selection and keyed tool options belong to React. Scientific state
 * belongs to one PottsClient/worker. Both workspace placements use this page
 * but create separate clients; hiding either page does not reset or pause it. */
export function PottsWorkspace({
  mode,
  example = 'potts-dimer',
  launch = 0,
  active,
  choose,
  archiveCount,
  onLatticeChoice,
}: {
  mode: 'small' | 'lattice';
  example?: PottsExampleId;
  launch?: number;
  active: boolean;
  choose?: (id: string) => void;
  archiveCount: number;
  onLatticeChoice?: (id: '2d' | 'chain' | 'potts') => void;
}) {
  const initial = mode === 'small' ? pottsRecipe(example) : defaultLatticePotts;
  const [draft, setDraft] = useState(() => draftFor(initial)),
    [lastApplied, setLastApplied] = useState(initial);
  const [view, setView] = useState<PottsView>({
    snapshot: null,
    running: false,
    busy: true,
    pending: false,
    error: null,
  });
  const [error, setError] = useState<string | null>(null),
    [site, setSite] = useState(0),
    [bond, setBond] = useState('e0'),
    [color, setColor] = useState(0),
    [compare, setCompare] = useState(0);
  const [histories, setHistories] = useState<Record<number, string>>({});
  const client = useRef<PottsClient | null>(null),
    previousLaunch = useRef(launch);
  useEffect(() => {
    const instance = new PottsClient(
      () =>
        new Worker(new URL('../workers/potts.worker.ts', import.meta.url), {
          type: 'module',
        }) as unknown as PottsPort,
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
    setSite(0);
    setBond('e0');
    setColor(0);
    setCompare(0);
    setHistories({});
  }
  useEffect(() => {
    if (previousLaunch.current === launch) return;
    previousLaunch.current = launch;
    const next = pottsRecipe(example);
    client.current?.initialize(next);
    setDraft(draftFor(next));
    setLastApplied(next);
    clearSelection();
    setError(null);
  }, [example, launch]);
  const snapshot = view.snapshot,
    applied = snapshot?.configuration ?? lastApplied;
  const model = useMemo(
    () => pottsModel(applied.parameters),
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
      setError(e instanceof Error ? e.message : 'Invalid Potts settings.');
    }
  }
  function reset(c: PottsConfiguration) {
    client.current!.initialize(c);
    setLastApplied(c);
    clearSelection();
  }
  const numbers = (
    key: 'h' | 'kx' | 'ky' | 'warmup' | 'stride' | 'seed' | 'lx' | 'ly',
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
        className="gauge-workspace potts-workspace"
        data-testid={`${mode}-potts-workspace`}
      >
        <section className="intro">
          <div>
            <p className="eyebrow">
              {mode === 'small' ? 'Small Potts systems' : '2D Potts laboratory'}
            </p>
            <h1>
              Categorical colors. <span>Physical interactions.</span>
            </h1>
            <p>
              q=2,3,4 site-valued Potts models, signed dimensionless couplings
              and counting measure.
            </p>
          </div>
        </section>
        <div className="lab-layout">
          <aside className="sidebar" aria-label="Potts model and settings">
            <section className="model-card">
              {mode === 'small' ? (
                <label>
                  Named example
                  <select
                    aria-label={
                      active ? 'Named example' : 'Inactive Potts example'
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
                  </select>
                </label>
              ) : (
                <label>
                  Physical system
                  <select
                    aria-label={
                      active
                        ? 'Lattice physical system'
                        : 'Inactive Potts physical system'
                    }
                    value="potts"
                    onChange={(e) =>
                      onLatticeChoice?.(
                        e.target.value as '2d' | 'chain' | 'potts',
                      )
                    }
                  >
                    <option value="2d">2D square-lattice Ising</option>
                    <option value="chain">1D Ising chain</option>
                    <option value="potts">2D Potts</option>
                  </select>
                </label>
              )}
              <DisplayMath>{String.raw`\begin{aligned}S_P&=-\sum_b K_b\delta_{\sigma_t,\sigma_h}\\&\quad-h\sum_i\delta_{\sigma_i,0}\end{aligned}`}</DisplayMath>
              <p>
                Colors 0,…,q−1 are categorical labels, not angles. Weight
                exp(−S) has no extra temperature factor. Positive K favors equal
                neighbors; negative K disfavors them. Positive h favors color 0;
                negative h disfavors it.
              </p>
            </section>
            <details
              className="settings-panel"
              open={!window.matchMedia('(max-width:700px)').matches}
            >
              <summary>Potts settings</summary>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  attempt(() => {
                    const next = parsed(draft, mode);
                    if (!samePottsSupport(applied.parameters, next.parameters))
                      reset(next);
                    else client.current!.change(next);
                  });
                }}
              >
                <label>
                  Potts q
                  <select
                    aria-label="Potts q"
                    value={draft.q}
                    onChange={(e) => setDraft({ ...draft, q: e.target.value })}
                  >
                    {[2, 3, 4].map((q) => (
                      <option key={q}>{q}</option>
                    ))}
                  </select>
                </label>
                {mode === 'small' ? (
                  <>
                    <label>
                      Potts graph geometry
                      <select
                        value={draft.geometry}
                        onChange={(e) => {
                          const geometry = e.target.value as PottsGeometry,
                            g = pottsGraph(geometry);
                          if (g.kind === 'graph')
                            setDraft({
                              ...draft,
                              geometry,
                              couplings: Object.fromEntries(
                                Object.keys(g.couplings).map((id) => [
                                  id,
                                  '.7',
                                ]),
                              ),
                            });
                        }}
                      >
                        {Object.entries(pottsGeometries).map(([id, label]) => (
                          <option key={id} value={id}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {Object.entries(draft.couplings).map(([id, K]) => (
                      <label key={id}>
                        Potts K {id}
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
                    {numbers('lx', 'Potts Lx', 2, 32)}
                    {numbers('ly', 'Potts Ly', 2, 32)}
                    {(['periodicX', 'periodicY'] as const).map((key, i) => (
                      <label key={key}>
                        Potts {i === 0 ? 'x' : 'y'} boundary
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
                    {numbers('kx', 'Potts Kx', -4, 4, 'any')}
                    {numbers('ky', 'Potts Ky', -4, 4, 'any')}
                  </>
                )}
                {numbers('h', 'Potts source h', -4, 4, 'any')}
                <label>
                  Potts sampler
                  <select
                    aria-label="Potts sampler"
                    value={draft.sampler}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        sampler: e.target.value as PottsSampler,
                      })
                    }
                  >
                    <option value="metropolis">
                      Lazy random-site Metropolis
                    </option>
                    <option value="heat-bath">Random-site heat bath</option>
                    <option
                      value="direct"
                      disabled={
                        mode === 'lattice' &&
                        Number(draft.q) **
                          (Number(draft.lx) * Number(draft.ly)) >
                          256
                      }
                    >
                      Exact independent draw (q^V≤256)
                    </option>
                  </select>
                </label>
                {numbers('warmup', 'Potts warm-up sweeps', 0, 10000)}
                {numbers(
                  'stride',
                  'Potts measurement stride (sweeps)',
                  1,
                  1000,
                )}
                {numbers('seed', 'Potts seed on Reset', 0, 4294967295)}
                <button disabled={!snapshot || !!view.error || view.pending}>
                  Apply Potts settings
                </button>
              </form>
            </details>
            <p data-testid="potts-applied">
              Applied q={model.q},{' '}
              {model.shape
                ? `${model.shape.lx}×${model.shape.ly}`
                : pottsGeometries[model.graph!.id as PottsGeometry]}
              ; h={model.h}; {applied.sampler}; warm-up {applied.warmup}, stride{' '}
              {applied.stride}.{' '}
              {model.shape && applied.parameters.geometry.kind === 'lattice'
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
                  : 'Paused'}
              {view.pending ? ' · settings pending' : ''} ·{' '}
              <span data-testid="potts-updates">{snapshot?.updates ?? 0}</span>{' '}
              updates ·{' '}
              <span data-testid="potts-samples">{current?.samples ?? 0}</span>{' '}
              retained · segment{' '}
              <span data-testid="potts-segment">{current?.id ?? 1}</span>.
            </p>
            {(error || view.error) && <p role="alert">{error ?? view.error}</p>}
            <p className="plot-note">
              One local Step is one site attempt; {model.size} attempts with
              replacement form a nominal sweep, not physical time. Direct draws
              retain every whole configuration and ignore warm-up/stride.
              All-zero initialization is unmeasured. Apply on fixed support
              preserves colors/RNG in a new segment; q/topology/boundaries and
              Reset reseed. Seed edits take effect on Reset/support change.
              Apply waits for a posted batch; Pause finishes its acknowledgment.
            </p>
            <p className="plot-note">
              No Potts archive or sweep format is available. Top-level tab
              changes preserve independent mounted sessions. Explicit Small
              Systems example launches restore seeded recipe defaults.
            </p>
          </aside>
          <div className="gauge-content">
            <ToolDeck
              title="Potts tools"
              tools={pottsTools}
              featuredDefault="configuration"
              defaults={['occupation', 'reference']}
              renderTool={(id, key) => (
                <PottsTool
                  id={id}
                  model={model}
                  snapshot={snapshot}
                  site={site}
                  bond={bond}
                  color={color}
                  compare={compare}
                  history={histories[key] ?? 'm0'}
                  selectSite={setSite}
                  selectBond={setBond}
                  selectColor={setColor}
                  selectCompare={setCompare}
                  selectHistory={(value) =>
                    setHistories((s) => ({ ...s, [key]: value }))
                  }
                />
              )}
            />
            <details className="model-notes">
              <summary>Segments, warm-up and measurement coverage</summary>
              {snapshot?.segments.map((s) => (
                <p key={s.id}>
                  Segment {s.id}, q={s.settings.parameters.q}, h=
                  {s.settings.parameters.h}, {s.settings.sampler}; warm-up{' '}
                  {s.settings.warmup}, stride {s.settings.stride} sweeps;{' '}
                  {s.updates} attempts/draws, {s.warmupUpdates} discarded
                  warm-up attempts, {s.samples} complete measurements,{' '}
                  {s.history.length} recent records.{' '}
                  {s.settings.parameters.geometry.kind === 'graph'
                    ? Object.entries(s.settings.parameters.geometry.couplings)
                        .map(([id, k]) => `${id}=${k}`)
                        .join(', ')
                    : `Kx=${s.settings.parameters.geometry.kx}, Ky=${s.settings.parameters.geometry.ky}`}
                  .
                </p>
              ))}
              <p>
                Eight retained segments; {snapshot?.droppedSegments ?? 0} older
                segments evicted. Full moments, site occupancies, bond counts
                and axial correlations survive recent-history eviction. At most
                256 scalar records; tiny systems retain color vectors, larger
                boxes keep only the current image. Every scheduled
                rejection/stay/unchanged resample is measured. No incompatible
                segments are pooled.
              </p>
            </details>
            <details className="model-notes">
              <summary>Mathematics and suggested experiments</summary>
              <p>
                Derive the categorical heat-bath softmax. Count dimer agreements
                and q=3 triangle colorings. Compare q=2 frustration with q=3
                proper coloring. Count eight periodic 2×2 bonds, then derive the
                q=2 Ising action and partition shift. At K=h=0, verify uniform
                site probabilities but positive finite-size mean majority order.
              </p>
              <p>
                Fixed warm-up is a budget, not evidence of mixing. Local chains
                can mix slowly at large signed coupling. Tiny boxes do not
                establish critical behavior. FK and Edwards–Sokal are future
                work: the usual p=1−exp(−K) bond probability is not valid for
                negative K. No cluster update, clock/XY interaction or automatic
                criticality inference is implemented.
              </p>
            </details>
          </div>
        </div>
      </main>
    </>
  );
}
