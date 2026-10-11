import { useEffect, useRef, useState } from 'react';
import { LatticeClient } from '../engine/latticeClient';
import type { LatticeView, LatticeWorkerPort } from '../engine/latticeClient';
import { defaultLatticeConfiguration } from '../engine/latticeRun';
import type {
  LatticeConfiguration,
  LatticeSnapshot,
} from '../engine/latticeRun';
import { criticalTemperature } from '../models/latticeIsing';
import { graphPreset } from '../domain/graph';
import { exactIsing, spinAt } from '../models/ising';
import type { IsingModel } from '../models/ising';
import { LatticePlots } from '../plotting/LatticePlots';
import { segmentColor } from '../plotting/viewport';
import { formatNumber } from '../plotting/PlotFrame';
import { InlineMath, DisplayMath } from '../ui/Math';

function useLattice() {
  const [view, setView] = useState<LatticeView>({
    snapshot: null,
    running: false,
    busy: false,
    error: null,
  });
  const client = useRef<LatticeClient | null>(null);
  useEffect(() => {
    const instance = new LatticeClient(
      () =>
        new Worker(new URL('../workers/lattice.worker.ts', import.meta.url), {
          type: 'module',
        }) as unknown as LatticeWorkerPort,
      setView,
    );
    client.current = instance;
    instance.initialize(defaultLatticeConfiguration);
    return () => {
      instance.dispose();
      client.current = null;
    };
  }, []);
  return { view, client };
}
function CanvasLattice({
  snapshot,
  selected,
  select,
}: {
  snapshot: LatticeSnapshot;
  selected: number;
  select: (site: number) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { lx, ly, periodicX, periodicY } = snapshot.configuration.parameters;
  useEffect(() => {
    const element = canvas.current!,
      context = element.getContext('2d')!;
    const cell = Math.max(6, Math.floor(640 / Math.max(lx, ly)));
    element.width = lx * cell;
    element.height = ly * cell;
    context.fillStyle = '#14625a';
    context.fillRect(0, 0, element.width, element.height);
    for (let i = 0; i < snapshot.spins.length; i++) {
      context.fillStyle = snapshot.spins[i] === 1 ? '#14625a' : '#c87d44';
      context.fillRect((i % lx) * cell, Math.floor(i / lx) * cell, cell, cell);
    }
    if (cell >= 12) {
      context.strokeStyle = 'rgba(255,255,255,.17)';
      context.lineWidth = 1;
      for (let x = 1; x < lx; x++) {
        context.beginPath();
        context.moveTo(x * cell, 0);
        context.lineTo(x * cell, element.height);
        context.stroke();
      }
      for (let y = 1; y < ly; y++) {
        context.beginPath();
        context.moveTo(0, y * cell);
        context.lineTo(element.width, y * cell);
        context.stroke();
      }
    }
    const mark = (site: number, color: string, width: number) => {
      if (site < 0) return;
      context.strokeStyle = color;
      context.lineWidth = width;
      context.strokeRect(
        (site % lx) * cell + width / 2,
        Math.floor(site / lx) * cell + width / 2,
        cell - width,
        cell - width,
      );
    };
    mark(selected, '#152e2a', Math.max(2, cell / 7));
    if (snapshot.lastTrace)
      mark(snapshot.lastTrace.site, '#f5ce66', Math.max(2, cell / 9));
  }, [snapshot, selected, lx, ly]);
  const site = Math.min(snapshot.spins.length - 1, Math.max(0, selected));
  return (
    <section className="lattice-canvas-card" aria-label="Spin configuration">
      <div className="section-heading">
        <h2>Spin configuration</h2>
        <span className="parameter-chip">
          {lx}×{ly} · {snapshot.spins.length} sites
        </span>
      </div>
      <canvas
        ref={canvas}
        data-testid="lattice-canvas"
        aria-label={`${lx} by ${ly} Ising spin grid; select a site by pointer or use the site controls`}
        onPointerDown={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const x = Math.min(
            lx - 1,
            Math.max(
              0,
              Math.floor(((event.clientX - rect.left) / rect.width) * lx),
            ),
          );
          const y = Math.min(
            ly - 1,
            Math.max(
              0,
              Math.floor(((event.clientY - rect.top) / rect.height) * ly),
            ),
          );
          select(x + lx * y);
        }}
      />
      <div className="lattice-legend">
        <span>
          <i className="spin-plus" />
          +1 spin
        </span>
        <span>
          <i className="spin-minus" />
          −1 spin
        </span>
        <span>
          <i className="spin-latest" />
          latest updated site
        </span>
      </div>
      <p className="plot-note">
        The flat image identifies opposite{' '}
        {periodicX && periodicY
          ? 'x and y'
          : periodicX
            ? 'x'
            : periodicY
              ? 'y'
              : 'no'}{' '}
        edges{periodicX || periodicY ? ' periodically' : ''}. Pixel position
        selects lattice coordinates; selection does not change spins.
      </p>
      <div className="lattice-site-controls">
        <label>
          Inspect x{' '}
          <input
            aria-label="Inspect x"
            type="number"
            min="0"
            max={lx - 1}
            value={site % lx}
            onChange={(e) =>
              select(
                Math.min(lx - 1, Math.max(0, Number(e.target.value))) +
                  lx * Math.floor(site / lx),
              )
            }
          />
        </label>
        <label>
          y{' '}
          <input
            aria-label="Inspect y"
            type="number"
            min="0"
            max={ly - 1}
            value={Math.floor(site / lx)}
            onChange={(e) =>
              select(
                (site % lx) +
                  lx * Math.min(ly - 1, Math.max(0, Number(e.target.value))),
              )
            }
          />
        </label>
        <span>
          Spin <strong>{snapshot.spins[site] === 1 ? '+1' : '−1'}</strong>
        </span>
      </div>
      <div className="lattice-detail" aria-label="Selected site neighborhood">
        {Array.from({ length: 25 }, (_, i) => {
          const dx = (i % 5) - 2,
            dy = Math.floor(i / 5) - 2,
            x = (site % lx) + dx,
            y = Math.floor(site / lx) + dy;
          const inBounds =
            (periodicX || (x >= 0 && x < lx)) &&
            (periodicY || (y >= 0 && y < ly));
          const at = ((x + lx) % lx) + lx * ((y + ly) % ly);
          return (
            <span
              key={i}
              className={`${inBounds ? (snapshot.spins[at] === 1 ? 'plus' : 'minus') : 'outside'} ${i === 12 ? 'center' : ''}`}
              title={
                inBounds
                  ? `(${(x + lx) % lx},${(y + ly) % ly}) ${snapshot.spins[at]}`
                  : 'Outside open boundary'
              }
            >
              {inBounds ? (snapshot.spins[at] === 1 ? '+' : '−') : ''}
            </span>
          );
        })}
      </div>
      <small>
        5×5 detail centered on ({site % lx}, {Math.floor(site / lx)}); periodic
        directions wrap.
      </small>
    </section>
  );
}

function exactTwoByTwo(snapshot: LatticeSnapshot) {
  const p = snapshot.configuration.parameters;
  if (p.lx !== 2 || p.ly !== 2 || p.periodicX !== p.periodicY) return null;
  const domain = graphPreset(p.periodicX ? 'torus' : 'square');
  const beta = 1 / p.temperature;
  const model: IsingModel = {
    kind: 'ising',
    parameters: {
      domain,
      couplings: Object.fromEntries(
        domain.edges.map((e) => [e.id, beta * (e.axis === 0 ? p.jx : p.jy)]),
      ),
      fields: Object.fromEntries(
        domain.vertices.map((v) => [v.id, beta * p.field]),
      ),
    },
  };
  const reference = exactIsing(model),
    n = 4;
  const m = reference.probabilities.reduce(
    (sum, probability, code) =>
      sum +
      (probability *
        Array.from({ length: n }, (_, i) => spinAt(code, i)).reduce(
          (a, b) => a + b,
          0,
        )) /
        n,
    0,
  );
  const absM = reference.probabilities.reduce(
    (sum, probability, code) =>
      sum +
      probability *
        Math.abs(
          Array.from({ length: n }, (_, i) => spinAt(code, i)).reduce(
            (a, b) => a + b,
            0,
          ) / n,
        ),
    0,
  );
  const e = reference.probabilities.reduce(
    (sum, probability, code) =>
      sum + (probability * reference.actions[code]! * p.temperature) / n,
    0,
  );
  const e2 = reference.probabilities.reduce(
    (sum, probability, code) =>
      sum + probability * ((reference.actions[code]! * p.temperature) / n) ** 2,
    0,
  );
  const distribution = new Map<number, number>();
  reference.probabilities.forEach((probability, code) => {
    const value =
      Array.from({ length: n }, (_, i) => spinAt(code, i)).reduce(
        (a, b) => a + b,
        0,
      ) / n;
    distribution.set(value, (distribution.get(value) ?? 0) + probability);
  });
  return {
    logZ: reference.logPartition,
    m,
    absM,
    e,
    e2,
    distribution: [...distribution].sort((a, b) => a[0] - b[0]),
    bonds: domain.edges.length,
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

export function LatticeSystems() {
  const { view, client } = useLattice();
  const snapshot = view.snapshot;
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
  const [plotKey, setPlotKey] = useState(0);
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
          setPlotKey((k) => k + 1);
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
      setPlotKey((k) => k + 1);
    }, 'Reset cleared history and restarted the selected seed and initialization.');
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
      <header className="site-header">
        <a className="brand" href="#small-systems">
          <span className="brand-mark" aria-hidden="true">
            ▦
          </span>
          <span>
            Lattice <strong>Lab</strong>
          </span>
        </a>
        <nav aria-label="Workspaces">
          <a href="#small-systems">Small Systems</a>
          <a className="nav-active" aria-current="page" href="#lattice-systems">
            Lattice Systems
          </a>
          <span className="nav-planned">
            Experiments <small>Planned</small>
          </span>
        </nav>
        <a className="source-link" href="https://github.com/gantemur/lattice">
          Source ↗
        </a>
      </header>
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
                    High T · 4
                  </button>
                  <button
                    type="button"
                    onClick={() => updateP({ temperature: 2.269185 })}
                  >
                    Near Tc
                  </button>
                  <button
                    type="button"
                    onClick={() => updateP({ temperature: 1.5 })}
                  >
                    Low T · 1.5
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
                <div className="sample-count">
                  <strong data-testid="lattice-samples">
                    {current?.samples ?? 0}
                  </strong>
                  <span>retained measurements</span>
                </div>
              </div>
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
                        <dt>ΔH / ΔS</dt>
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
              <CanvasLattice
                snapshot={snapshot}
                selected={selected}
                select={setSelected}
              />
            )}
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
                distributions. Each retains full online moments and histograms,
                up to 1,000 recent measurements and logarithmic mean
                checkpoints. Older measurements and then older segments are
                evicted. Warm-up is a count, not evidence of mixing.
              </p>
            </section>
            {snapshot && <LatticePlots key={plotKey} snapshot={snapshot} />}
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
              {exact && (
                <p data-testid="lattice-exact">
                  2×2 exact enumeration (M1a, all 16 states; {exact.bonds}{' '}
                  distinct bonds): log Z={formatNumber(exact.logZ)}, 〈m〉=
                  {formatNumber(exact.m)}, 〈|m|〉={formatNumber(exact.absM)},
                  〈e〉={formatNumber(exact.e)}, 〈e²〉={formatNumber(exact.e2)}
                  . Exact P(m):{' '}
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
                  Infinite-volume theoretical critical temperature for positive
                  Jx,Jy and h=0: Tc={formatNumber(tc)}. Isotropic case:{' '}
                  <InlineMath>{String.raw`T_c/J=2/\log(1+\sqrt2)`}</InlineMath>.
                  A finite lattice has no true thermodynamic singularity.
                </p>
              ) : (
                <p>
                  No 2D ferromagnetic critical-temperature reference applies to
                  these signed couplings or nonzero field.
                </p>
              )}
              <p className="plot-note">
                At h=0 the finite-volume exact mean 〈m〉 is zero by spin-flip
                symmetry, but a finite local chain may remain in one sector.
                |m|, histograms and trajectories help reveal this. No MCMC error
                bars or claim of spontaneous symmetry breaking.
              </p>
            </section>
            <details className="model-notes">
              <summary>Suggested experiments</summary>
              {experiments.map(([title, note]) => (
                <p key={title}>
                  <strong>{title}.</strong> {note}
                </p>
              ))}
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
