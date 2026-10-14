import { XYWorkspace } from './XYWorkspace';
import { PottsWorkspace } from './PottsWorkspace';
import { SiteHeader } from './SiteHeader';
import { useState } from 'react';
import { defaultLatticeConfiguration } from '../engine/latticeRun';
import type {
  LatticeConfiguration,
  LatticeSnapshot,
} from '../engine/latticeRun';
import { criticalTemperature } from '../models/latticeIsing';
import { exactLatticeTwoByTwo } from '../models/latticeExact';
import { LatticeToolDeck } from './LatticeToolDeck';
import { segmentColor } from '../plotting/viewport';
import { formatNumber } from '../plotting/PlotFrame';
import { InlineMath, DisplayMath } from '../ui/Math';
import { LatticeStatisticalDiagnostics } from './StatisticalDiagnostics';
import type { Capture } from '../experiments/archive';
import { useLatticeSession } from './useLatticeSession';
import { ChainSystems } from './ChainSystems';

function exactTwoByTwo(snapshot: LatticeSnapshot) {
  const p = snapshot.configuration.parameters;
  if (p.lx !== 2 || p.ly !== 2) return null;
  const reference = exactLatticeTwoByTwo(p);
  return {
    logZ: reference.logPartition,
    m: reference.meanM,
    absM: reference.meanAbsM,
    e: reference.meanE,
    e2: reference.secondE,
    chi: reference.susceptibility,
    binder: reference.binder,
    specificHeat: reference.specificHeat,
    gx: reference.meanGx,
    gy: reference.meanGy,
    distribution: reference.magnetizationDistribution,
    bonds: reference.bondCount,
  };
}

const experiments = [
  [
    'A · Ordering from random',
    'Random spins, T=1.5, periodic 32×32. Where do aligned domains form? Finite size and slow mixing can obscure equilibrium.',
  ],
  [
    'B · Heating ordered spins',
    'Start all +1 at T=1.5; then Apply T=4. How do m and e change? New segment warm-up is needed after the quench.',
  ],
  [
    'C · Near-critical fluctuations',
    'Periodic 32×32, Jx=Jy=1, h=0, T≈2.269. Are large magnetization swings visible? Local MCMC can mix slowly.',
  ],
  [
    'D · External field',
    'Apply positive then negative h. Which sign biases m? Compare separate segments; finite runs may lag behind a quench.',
  ],
  [
    'E · Boundaries',
    'Reset equal-size open and periodic boxes with the same seed and settings. What changes at edges? Finite-size effects matter.',
  ],
] as const;

export function LatticeSystems({
  saveCaptures,
  archiveCount,
}: {
  saveCaptures: (captures: Capture[]) => void;
  archiveCount: number;
}) {
  const [dimension, setDimension] = useState<'2d' | 'chain'>('2d');
  const [pottsActive, setPottsActive] = useState(false);
  const [pottsOpened, setPottsOpened] = useState(false);
  const [xyActive, setXYActive] = useState(false);
  const [xyOpened, setXYOpened] = useState(false);
  function chooseSystem(id: '2d' | 'chain' | 'potts' | 'xy') {
    setXYActive(id === 'xy');
    if (id === 'xy') {
      setXYOpened(true);
      setPottsActive(false);
    } else if (id === 'potts') {
      setPottsOpened(true);
      setPottsActive(true);
    } else {
      setDimension(id);
      setPottsActive(false);
    }
  }
  // Adding Potts never unmounts the existing Ising owner. The legacy Ising
  // grid/chain switch retains its established semantics inside this container.
  return (
    <>
      <div hidden={pottsActive || xyActive}>
        {dimension === 'chain' ? (
          <ChainSystems
            saveCaptures={saveCaptures}
            archiveCount={archiveCount}
            switchToGrid={() => setDimension('2d')}
            chooseSystem={chooseSystem}
            active={!pottsActive && !xyActive}
          />
        ) : (
          <TwoDimensionalSystems
            saveCaptures={saveCaptures}
            archiveCount={archiveCount}
            switchToChain={() => setDimension('chain')}
            chooseSystem={chooseSystem}
            active={!pottsActive && !xyActive}
          />
        )}
      </div>
      {xyOpened && (
        <div hidden={!xyActive}>
          <XYWorkspace
            mode="lattice"
            active={xyActive}
            archiveCount={archiveCount}
            onLatticeChoice={chooseSystem}
          />
        </div>
      )}
      {pottsOpened && (
        <div hidden={!pottsActive}>
          <PottsWorkspace
            mode="lattice"
            active={pottsActive}
            archiveCount={archiveCount}
            onLatticeChoice={chooseSystem}
          />
        </div>
      )}
    </>
  );
}

function TwoDimensionalSystems({
  saveCaptures,
  archiveCount,
  switchToChain,
  chooseSystem,
  active,
}: {
  saveCaptures: (captures: Capture[]) => void;
  archiveCount: number;
  switchToChain: () => void;
  chooseSystem: (id: '2d' | 'chain' | 'potts' | 'xy') => void;
  active: boolean;
}) {
  const { view, client } = useLatticeSession(defaultLatticeConfiguration);
  const snapshot = view.snapshot;
  // Form edits are local until Apply/Reset; the worker snapshot is authoritative
  // for the active Gibbs measure and all sampled measurements.
  const [draft, setDraft] = useState<LatticeConfiguration>(
    defaultLatticeConfiguration,
  );
  const [seed, setSeed] = useState(String(defaultLatticeConfiguration.seed));
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState(
    'Random initialization is not a measurement. Run or Step to begin updates.',
  );
  const [inspectOpen, setInspectOpen] = useState(false);
  const p =
    snapshot?.configuration.parameters ??
    defaultLatticeConfiguration.parameters;
  const current = snapshot?.segments.at(-1);
  const tc = criticalTemperature(p),
    exact = snapshot ? exactTwoByTwo(snapshot) : null;
  function execute(action: () => void, message: string) {
    try {
      action();
      setError(null);
      setNotice(message);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : 'Invalid settings.',
      );
    }
  }
  function apply() {
    if (!snapshot) return;
    const old = snapshot.configuration.parameters,
      next = draft.parameters;
    const geometry =
      old.lx !== next.lx ||
      old.ly !== next.ly ||
      old.periodicX !== next.periodicX ||
      old.periodicY !== next.periodicY;
    execute(
      () => {
        if (geometry) {
          client.current?.initialize({ ...draft, seed: Number(seed) });
          setSelected(0);
        } else
          client.current?.change({
            parameters: draft.parameters,
            sampler: draft.sampler,
            warmupSweeps: draft.warmupSweeps,
            strideSweeps: draft.strideSweeps,
          });
      },
      geometry
        ? 'Geometry changed: new seeded session; measurements cleared.'
        : 'Applied parameters begin a separate segment after the current worker batch. Configuration and RNG are preserved; warm-up restarts.',
    );
  }
  function reset() {
    execute(() => {
      client.current?.initialize({
        ...snapshot!.configuration,
        seed: Number(seed),
        initialization: draft.initialization,
      });
      setSelected(0);
    }, 'Reset cleared history and restarted the selected seed and initialization.');
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
          'Lattice worker changed during multi-segment capture; pause and retry.',
        );
      saveCaptures(captures);
      setError(null);
      setNotice(
        `Saved ${captures.length} acknowledged lattice segment${captures.length === 1 ? '' : 's'} to Experiments.`,
      );
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Could not save lattice segment.',
      );
    }
  }
  const updateP = (patch: Partial<LatticeConfiguration['parameters']>) =>
    setDraft((d) => ({ ...d, parameters: { ...d.parameters, ...patch } }));
  const currentM = snapshot
    ? snapshot.magnetization / snapshot.spins.length
    : null;
  const currentE = snapshot ? snapshot.energy / snapshot.spins.length : null;
  return (
    <>
      <a className="skip-link" href="#lattice-laboratory">
        Skip to laboratory
      </a>
      <SiteHeader active="lattice" archiveCount={archiveCount} />
      <main id="lattice-laboratory">
        <section className="intro" id="lattice-systems">
          <div>
            <p className="eyebrow">A numerical playground / 02</p>
            <h1>
              Many spins. <span>Collective behavior.</span>
            </h1>
            <p className="intro-copy">
              Explore finite square-lattice Ising systems. Watch true local
              updates, measure magnetization and energy, and compare to
              carefully labeled references.
            </p>
          </div>
          <span className="milestone">M2 · 2D Ising</span>
        </section>
        <div className="lab-layout">
          <aside className="sidebar" aria-label="Lattice settings">
            <label className="model-choice">
              Physical system
              <select
                aria-label={
                  active
                    ? 'Lattice physical system'
                    : 'Inactive Ising physical system'
                }
                value="2d"
                onChange={(e) =>
                  e.target.value === 'chain'
                    ? switchToChain()
                    : chooseSystem(e.target.value as 'potts' | 'xy')
                }
              >
                <option value="2d">2D square-lattice Ising</option>
                <option value="chain">1D Ising chain</option>
                <option value="potts">2D Potts</option>
                <option value="xy">2D XY</option>
              </select>
            </label>
            <section className="model-card lattice-model-card">
              <p className="eyebrow">Nearest-neighbor Ising</p>
              <DisplayMath>{String.raw`\begin{aligned}H={}&-J_x\sum_{\langle i,j\rangle_x}s_is_j\\&-J_y\sum_{\langle i,j\rangle_y}s_is_j\\&-h\sum_i s_i\end{aligned}`}</DisplayMath>
              <p>
                Physical energy <InlineMath>H</InlineMath>; action{' '}
                <InlineMath>{String.raw`S=\beta H`}</InlineMath>,{' '}
                <InlineMath>{String.raw`\beta=1/T`}</InlineMath>,{' '}
                <InlineMath>{String.raw`k_B=1`}</InlineMath>. M1a weights are{' '}
                <InlineMath>{String.raw`K_x=\beta J_x,\ K_y=\beta J_y,\ b=\beta h`}</InlineMath>
                .
              </p>
            </section>
            <details className="settings" open>
              <summary>Geometry & physical settings</summary>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  apply();
                }}
              >
                <label>
                  Size preset
                  <select
                    aria-label="Size preset"
                    value={
                      draft.parameters.lx === draft.parameters.ly &&
                      [2, 4, 8, 16, 32, 64].includes(draft.parameters.lx)
                        ? draft.parameters.lx
                        : 'custom'
                    }
                    onChange={(e) => {
                      if (e.target.value !== 'custom')
                        updateP({
                          lx: Number(e.target.value),
                          ly: Number(e.target.value),
                        });
                    }}
                  >
                    <option value="custom">Custom rectangle</option>
                    {[2, 4, 8, 16, 32, 64].map((n) => (
                      <option key={n} value={n}>
                        {n}×{n}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="lattice-form-pair">
                  <label>
                    Lx
                    <input
                      type="number"
                      min="2"
                      max="64"
                      value={draft.parameters.lx}
                      onChange={(e) => updateP({ lx: Number(e.target.value) })}
                    />
                  </label>
                  <label>
                    Ly
                    <input
                      type="number"
                      min="2"
                      max="64"
                      value={draft.parameters.ly}
                      onChange={(e) => updateP({ ly: Number(e.target.value) })}
                    />
                  </label>
                </div>
                <label>
                  <input
                    type="checkbox"
                    checked={draft.parameters.periodicX}
                    onChange={(e) => updateP({ periodicX: e.target.checked })}
                  />{' '}
                  Periodic x
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={draft.parameters.periodicY}
                    onChange={(e) => updateP({ periodicY: e.target.checked })}
                  />{' '}
                  Periodic y
                </label>
                <label>
                  Temperature T
                  <input
                    type="number"
                    min="0.05"
                    max="100"
                    step="any"
                    value={draft.parameters.temperature}
                    onChange={(e) =>
                      updateP({ temperature: Number(e.target.value) })
                    }
                  />
                </label>
                <div className="lattice-temperature-presets">
                  <button
                    type="button"
                    onClick={() => updateP({ temperature: 4 })}
                  >
                    T = 4
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateP({
                        temperature: 2.269185314213022,
                        jx: 1,
                        jy: 1,
                        field: 0,
                      })
                    }
                  >
                    Tc example · J=1, h=0
                  </button>
                  <button
                    type="button"
                    onClick={() => updateP({ temperature: 1.5 })}
                  >
                    T = 1.5
                  </button>
                </div>
                <div className="lattice-form-pair">
                  <label>
                    Horizontal Jx
                    <input
                      type="number"
                      min="-10"
                      max="10"
                      step="any"
                      value={draft.parameters.jx}
                      onChange={(e) => updateP({ jx: Number(e.target.value) })}
                    />
                  </label>
                  <label>
                    Vertical Jy
                    <input
                      type="number"
                      min="-10"
                      max="10"
                      step="any"
                      value={draft.parameters.jy}
                      onChange={(e) => updateP({ jy: Number(e.target.value) })}
                    />
                  </label>
                </div>
                <label>
                  Field h
                  <input
                    type="number"
                    min="-10"
                    max="10"
                    step="any"
                    value={draft.parameters.field}
                    onChange={(e) => updateP({ field: Number(e.target.value) })}
                  />
                </label>
                <label>
                  Sampler
                  <select
                    value={draft.sampler}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        sampler: e.target
                          .value as LatticeConfiguration['sampler'],
                      }))
                    }
                  >
                    <option value="metropolis">
                      Random-site lazy Metropolis
                    </option>
                    <option value="heat-bath">Random-site heat bath</option>
                  </select>
                </label>
                <div className="lattice-form-pair">
                  <label>
                    Warm-up sweeps
                    <input
                      type="number"
                      min="0"
                      max="10000"
                      value={draft.warmupSweeps}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          warmupSweeps: Number(e.target.value),
                        }))
                      }
                    />
                  </label>
                  <label>
                    Measure every sweeps
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={draft.strideSweeps}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          strideSweeps: Number(e.target.value),
                        }))
                      }
                    />
                  </label>
                </div>
                <label>
                  Initialization on new session
                  <select
                    value={draft.initialization}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        initialization: e.target
                          .value as LatticeConfiguration['initialization'],
                      }))
                    }
                  >
                    <option value="random">Seeded random ±1</option>
                    <option value="plus">All +1</option>
                    <option value="minus">All −1</option>
                  </select>
                </label>
                <label>
                  Lattice RNG seed
                  <input
                    type="number"
                    min="0"
                    max="4294967295"
                    value={seed}
                    onChange={(e) => setSeed(e.target.value)}
                  />
                </label>
                <button
                  className="button primary"
                  type="submit"
                  disabled={!snapshot || !!view.error}
                >
                  Apply settings
                </button>
                <p className="settings-warning">
                  T, J, h, sampler or schedule changes preserve spins and RNG
                  but begin a new measurement segment with fresh warm-up. A
                  geometry change starts a new session.
                </p>
              </form>
            </details>
            <div className="local-note">
              ◌ Computation stays in your browser.
            </div>
          </aside>
          <div className="workspace">
            <section
              className="run-panel"
              aria-label="Lattice sampling controls"
            >
              <div className="run-heading">
                <div>
                  <span
                    className={`status-dot ${view.running ? 'is-running' : ''}`}
                  />
                  <strong role="status" data-testid="lattice-status">
                    {view.error
                      ? 'Worker unavailable'
                      : view.running
                        ? 'Sampling'
                        : view.busy
                          ? 'Finishing update'
                          : 'Paused'}
                  </strong>
                  <span className="segment" data-testid="lattice-segment">
                    Segment {snapshot?.activeSegmentId ?? '…'}
                  </span>
                </div>
                <span className="algorithm-label">
                  {snapshot?.configuration.sampler ?? 'Metropolis'}
                </span>
              </div>
              <div className="command-row">
                <button
                  className="button primary"
                  onClick={() => {
                    if (view.running) {
                      client.current?.pause();
                      setNotice(
                        'Pause waits for the current bounded worker batch; Step then advances exactly one update.',
                      );
                    } else {
                      client.current?.start();
                      setNotice(
                        'Run is sampling in bounded worker batches. Measurements occur only on scheduled sweep boundaries.',
                      );
                    }
                  }}
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
                    setNotice(
                      'Step applied one actual local transition using the current seeded stream.',
                    );
                  }}
                  disabled={
                    view.running || view.busy || !snapshot || !!view.error
                  }
                >
                  Step
                </button>
                <button className="button" onClick={reset} disabled={!snapshot}>
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
                  <strong data-testid="lattice-samples">
                    {current?.samples ?? 0}
                  </strong>
                  <span>retained measurements</span>
                </div>
              </div>
              <p className="plot-note">
                Pause and wait for the current batch before saving. Captures
                preserve the numerical state and RNG. The in-memory library
                holds at most 16 records/12 MiB; export before reloading.
              </p>
              <div className="run-meta">
                <span>
                  Updates{' '}
                  <strong data-testid="lattice-updates">
                    {snapshot?.updates ?? 0}
                  </strong>
                </span>
                <span>
                  Completed sweeps <strong>{snapshot?.sweeps ?? 0}</strong>
                </span>
                <span>
                  Warm-up{' '}
                  <strong>
                    {current?.warmupUpdates ?? 0}/
                    {(snapshot?.spins.length ?? 0) *
                      (current?.settings.warmupSweeps ?? 0)}
                  </strong>{' '}
                  updates
                </span>
                <span>
                  Stride <strong>{current?.settings.strideSweeps ?? 1}</strong>{' '}
                  sweeps
                </span>
              </div>
              <div className="run-readings">
                <span>
                  <InlineMath>m=M/N</InlineMath>{' '}
                  <strong data-testid="lattice-m">
                    {formatNumber(currentM)}
                  </strong>
                </span>
                <span>
                  <InlineMath>{String.raw`e=H/N`}</InlineMath>{' '}
                  <strong data-testid="lattice-e">
                    {formatNumber(currentE)}
                  </strong>
                </span>
                <span>
                  M <strong>{snapshot?.magnetization ?? '—'}</strong>
                </span>
                <span>
                  H <strong>{formatNumber(snapshot?.energy ?? null)}</strong>
                </span>
              </div>
              <p className="run-notice">
                {notice} One sweep is N random-site updates with replacement,
                not physical time. A rendered frame may cover many updates.
              </p>
              {error && (
                <p role="alert" className="error-message">
                  {error}
                </p>
              )}
              {view.error && (
                <p role="alert" className="error-message">
                  {view.error}
                </p>
              )}
              <details
                className="step-inspector"
                open={inspectOpen}
                onToggle={(e) => setInspectOpen(e.currentTarget.open)}
              >
                <summary>Actual latest update · step mathematics</summary>
                {snapshot?.lastTrace ? (
                  <div>
                    <p data-testid="lattice-trace">
                      Update {snapshot.lastTrace.update} at (
                      {snapshot.lastTrace.x},{snapshot.lastTrace.y}):{' '}
                      {snapshot.lastTrace.oldSpin > 0 ? '+1' : '−1'} →{' '}
                      {snapshot.lastTrace.newSpin > 0 ? '+1' : '−1'} ·{' '}
                      {snapshot.lastTrace.outcome}
                    </p>
                    <div className="transition-grid">
                      <div>
                        <dt>Physical local field</dt>
                        <dd>{formatNumber(snapshot.lastTrace.field)}</dd>
                      </div>
                      <div>
                        <dt>If selected spin flipped ΔH / ΔS</dt>
                        <dd>
                          {formatNumber(snapshot.lastTrace.flipDeltaH)} /{' '}
                          {formatNumber(snapshot.lastTrace.flipDeltaS)}
                        </dd>
                      </div>
                      {snapshot.configuration.sampler === 'metropolis' && (
                        <div>
                          <dt>Proposed move ΔH / ΔS</dt>
                          <dd>
                            {formatNumber(
                              snapshot.lastTrace.proposedSpin !==
                                snapshot.lastTrace.oldSpin
                                ? snapshot.lastTrace.flipDeltaH
                                : 0,
                            )}{' '}
                            /{' '}
                            {formatNumber(
                              snapshot.lastTrace.proposedSpin !==
                                snapshot.lastTrace.oldSpin
                                ? snapshot.lastTrace.flipDeltaS
                                : 0,
                            )}
                          </dd>
                        </div>
                      )}
                      <div>
                        <dt>Actual transition ΔH / ΔS</dt>
                        <dd>
                          {formatNumber(snapshot.lastTrace.deltaH)} /{' '}
                          {formatNumber(snapshot.lastTrace.deltaS)}
                        </dd>
                      </div>
                      <div>
                        <dt>
                          {snapshot.configuration.sampler === 'metropolis'
                            ? 'Flip acceptance'
                            : 'P(+1 | neighbors)'}
                        </dt>
                        <dd>{formatNumber(snapshot.lastTrace.probability)}</dd>
                      </div>
                      <div>
                        <dt>Site / proposal / decision uniforms</dt>
                        <dd>
                          {formatNumber(snapshot.lastTrace.siteUniform)} /{' '}
                          {formatNumber(
                            snapshot.lastTrace.proposalUniform ?? null,
                          )}{' '}
                          / {formatNumber(snapshot.lastTrace.decisionUniform)}
                        </dd>
                      </div>
                    </div>
                    <p>
                      Distinct incident bonds:{' '}
                      {snapshot.lastTrace.terms
                        .map(
                          (t, i) =>
                            `${i + 1}: ${t.axis} neighbor (${t.neighbor % p.lx},${Math.floor(t.neighbor / p.lx)}) spin ${t.spin > 0 ? '+1' : '−1'} contributes ${formatNumber(t.contribution)}`,
                        )
                        .join('; ')}
                      . Parallel periodic bonds are counted separately.
                    </p>
                  </div>
                ) : (
                  <p>No update yet.</p>
                )}
              </details>
            </section>
            {snapshot && (
              <LatticeToolDeck
                key={snapshot.runId}
                snapshot={snapshot}
                selected={selected}
                select={setSelected}
              />
            )}
            <details className="model-page-details lattice-technical-details">
              <summary>
                Technical details, exact references &amp; diagnostics
              </summary>
              <div>
                <section className="segment-history">
                  <div className="section-heading">
                    <h2>Parameter segments</h2>
                    <span className="parameter-chip">
                      latest 8 · {snapshot?.droppedSegments ?? 0} removed
                    </span>
                  </div>
                  {snapshot?.segments.map((s) => (
                    <div
                      className="lattice-segment-row"
                      key={s.id}
                      style={{ borderLeftColor: segmentColor(s.id) }}
                    >
                      <strong>
                        S{s.id}
                        {s.id === snapshot.activeSegmentId ? ' · current' : ''}
                      </strong>
                      <span>
                        T={formatNumber(s.settings.parameters.temperature)}, Jx=
                        {formatNumber(s.settings.parameters.jx)}, Jy=
                        {formatNumber(s.settings.parameters.jy)}, h=
                        {formatNumber(s.settings.parameters.field)} ·{' '}
                        {s.settings.sampler} · N={s.samples}
                      </span>
                      <span>
                        mean m={formatNumber(s.m.mean)}, |m|=
                        {formatNumber(s.absM.mean)}, e={formatNumber(s.e.mean)}
                      </span>
                    </div>
                  ))}
                  <p className="plot-note">
                    Segments never pool measurements from different target
                    distributions. Each retains full online moments and
                    histograms, up to 1,000 recent measurements and logarithmic
                    mean checkpoints. Older measurements and then older segments
                    are evicted. Warm-up is a count, not evidence of mixing.
                  </p>
                </section>
                <section className="moments-panel">
                  <div className="section-heading">
                    <h2>Finite measurements & references</h2>
                  </div>
                  <table className="moments-table">
                    <thead>
                      <tr>
                        <th>Observable</th>
                        <th>Sample mean</th>
                        <th>Sample variance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {current &&
                        (
                          [
                            ['m', current.m],
                            ['|m|', current.absM],
                            ['e=H/N', current.e],
                            ['m²', current.m2],
                            ['e²', current.e2],
                          ] as const
                        ).map(([name, stats]) => (
                          <tr key={name}>
                            <th>{name}</th>
                            <td>{formatNumber(stats.mean)}</td>
                            <td>{formatNumber(stats.variance)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  <table
                    className="moments-table"
                    data-testid="lattice-equilibrium-observables"
                  >
                    <caption>
                      Equilibrium fluctuation and bond observables · current
                      segment
                    </caption>
                    <thead>
                      <tr>
                        <th>Observable</th>
                        <th>Sampled estimate</th>
                        <th>Exact 2×2</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <th>χ = N(〈m²〉−〈m〉²)/T</th>
                        <td>
                          {formatNumber(
                            current?.fluctuations?.susceptibility ?? null,
                          )}
                        </td>
                        <td>{formatNumber(exact?.chi ?? null)}</td>
                      </tr>
                      <tr>
                        <th>U₄ = 1−〈m⁴〉/(3〈m²〉²)</th>
                        <td>
                          {formatNumber(current?.fluctuations?.binder ?? null)}
                        </td>
                        <td>{formatNumber(exact?.binder ?? null)}</td>
                      </tr>
                      <tr>
                        <th>cᵥ = N(〈e²〉−〈e〉²)/T²</th>
                        <td>
                          {formatNumber(
                            current?.fluctuations?.specificHeat ?? null,
                          )}
                        </td>
                        <td>{formatNumber(exact?.specificHeat ?? null)}</td>
                      </tr>
                      <tr>
                        <th>Gₓ(1) · x bonds</th>
                        <td>{formatNumber(current?.gx.mean ?? null)}</td>
                        <td>{formatNumber(exact?.gx ?? null)}</td>
                      </tr>
                      <tr>
                        <th>Gᵧ(1) · y bonds</th>
                        <td>{formatNumber(current?.gy.mean ?? null)}</td>
                        <td>{formatNumber(exact?.gy ?? null)}</td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="plot-note">
                    χ uses the signed mean m. cᵥ is heat capacity per site at
                    fixed physical Jx, Jy and h. These use population
                    fluctuations of retained measurements, not the N−1 sample
                    variances above. U₄ is N/A when 〈m²〉 is numerically
                    unusable. Bond means divide by actual x/y bond counts,
                    including periodic length-two parallel records. Exact
                    columns apply only to 2×2.
                  </p>
                  {exact && (
                    <p data-testid="lattice-exact">
                      2×2 exact enumeration (all 16 states; {exact.bonds}{' '}
                      distinct bonds): log Z={formatNumber(exact.logZ)}, 〈m〉=
                      {formatNumber(exact.m)}, 〈|m|〉=
                      {formatNumber(exact.absM)}, 〈e〉={formatNumber(exact.e)},
                      〈e²〉={formatNumber(exact.e2)}. Exact P(m):{' '}
                      {exact.distribution
                        .map(
                          ([value, probability]) =>
                            `${value}: ${formatNumber(probability)}`,
                        )
                        .join(' · ')}
                      .
                    </p>
                  )}
                  {tc !== null ? (
                    <p>
                      Infinite-volume theoretical critical temperature for
                      positive Jx,Jy and h=0: Tc={formatNumber(tc)}. Isotropic
                      case:{' '}
                      <InlineMath>{String.raw`T_c/J=2/\log(1+\sqrt2)`}</InlineMath>
                      . A finite lattice has no true thermodynamic singularity.
                    </p>
                  ) : (
                    <p>
                      No 2D ferromagnetic critical-temperature reference applies
                      to these signed couplings or nonzero field.
                    </p>
                  )}
                  <p className="plot-note">
                    At h=0 the finite-volume exact mean 〈m〉 is zero by
                    spin-flip symmetry, but a finite local chain may remain in
                    one sector. |m|, histograms and trajectories help reveal
                    this. No MCMC error bars or claim of spontaneous symmetry
                    breaking.
                  </p>
                </section>
                {current && (
                  <LatticeStatisticalDiagnostics
                    key={current.id}
                    segment={current}
                  />
                )}
              </div>
            </details>
            <details className="model-page-details lattice-teaching-notes">
              <summary>
                Mathematics, exercises &amp; suggested experiments
              </summary>
              <div>
                <p>
                  The Gibbs probability of a spin configuration is proportional
                  to <InlineMath>{String.raw`e^{-H/T}`}</InlineMath>. Metropolis
                  proposes local changes and may reject them; heat bath
                  resamples from the local conditional law. A nominal sweep
                  counts N random-site attempts, never physical time.
                </p>
                <p>
                  Compare magnetization, susceptibility and the Binder cumulant
                  across finite sizes. Spatial correlations depend on
                  boundaries: only fully periodic boxes use the global-mean
                  connected form. Recent-window autocorrelation and blocking
                  reveal limitations of Monte Carlo precision, not proof of
                  equilibration. At zero field, spin-flip symmetry can coexist
                  with long-lived magnetized trajectories.
                </p>
                <p>
                  Enumerate all 16 states of a 2×2 box to compare exact finite
                  results with sampling. The theoretical critical temperature
                  applies only to the infinite-volume ferromagnetic zero-field
                  model; a finite box has no singularity.
                </p>
                {experiments.map(([title, note]) => (
                  <p key={title}>
                    <strong>{title}.</strong> {note}
                  </p>
                ))}
              </div>
            </details>
          </div>
        </div>
      </main>
      <footer>
        <span>Lattice Lab / Finite lattices, explicit mathematics.</span>
        <span>2D Ising · Worker Monte Carlo · Static deployment</span>
      </footer>
    </>
  );
}
