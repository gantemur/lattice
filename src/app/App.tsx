import { useState } from 'react';
import type { FormEvent } from 'react';
import { singleSite } from '../domain/singleSite';
import { standardGaussianPreset } from '../engine/preset';
import type { RunConfiguration } from '../engine/protocol';
import { gaussianReference, gaussianVariable } from '../models/gaussian';
import { formatNumber, GaussianPlot } from '../plotting/GaussianPlot';
import { useSimulation } from './useSimulation';

const slotNumbers = [0, 1, 2, 3] as const;

export function App() {
  const { view, client } = useSimulation();
  const [configuration, setConfiguration] = useState<RunConfiguration>(
    standardGaussianPreset.configuration,
  );
  const [a, setA] = useState('1');
  const [h, setH] = useState('0');
  const [seed, setSeed] = useState(String(configuration.seed));
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState(
    'Ready to explore. Draw one sample or start a run.',
  );
  const [slots, setSlots] = useState<(string | null)[]>([
    gaussianVariable.id,
    null,
    null,
    null,
  ]);
  const [activeSlot, setActiveSlot] = useState(0);
  const [overview, setOverview] = useState(false);
  const [showHistogram, setShowHistogram] = useState(true);
  const snapshot = view.snapshot;
  const reference = gaussianReference(configuration.parameters);
  const status = view.error
    ? 'Worker unavailable'
    : view.running
      ? 'Sampling'
      : view.busy
        ? 'Finishing update'
        : 'Paused';

  function initialize(next: RunConfiguration, message: string) {
    try {
      client.current?.initialize(next);
      setConfiguration(next);
      setFormError(null);
      setNotice(message);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : 'Invalid settings.',
      );
    }
  }

  function apply(event: FormEvent) {
    event.preventDefault();
    if (!a.trim() || !h.trim() || !seed.trim()) {
      setFormError('Complete all three fields before applying.');
      return;
    }
    initialize(
      { parameters: { a: Number(a), h: Number(h) }, seed: Number(seed) },
      'New segment started. Previous measurements were cleared.',
    );
  }

  function preset() {
    const next = standardGaussianPreset.configuration;
    setA(String(next.parameters.a));
    setH(String(next.parameters.h));
    setSeed(String(next.seed));
    initialize(
      next,
      'Standard Gaussian restored. The seed and measurements were reset.',
    );
  }

  return (
    <>
      <a className="skip-link" href="#laboratory">
        Skip to laboratory
      </a>
      <header className="site-header">
        <a
          className="brand"
          href="#small-systems"
          aria-label="Lattice Lab home"
        >
          <span className="brand-mark" aria-hidden="true">
            ▦
          </span>
          <span>
            Lattice <strong>Lab</strong>
          </span>
        </a>
        <nav aria-label="Workspaces">
          <a className="nav-active" href="#small-systems" aria-current="page">
            Small Systems
          </a>
          <span className="nav-planned">
            Lattice Systems <small>Planned</small>
          </span>
          <span className="nav-planned">
            Experiments <small>Planned</small>
          </span>
        </nav>
        <a className="source-link" href="https://github.com/gantemur/lattice">
          Source <span aria-hidden="true">↗</span>
        </a>
      </header>

      <main id="laboratory">
        <section
          className="intro"
          id="small-systems"
          aria-labelledby="workspace-title"
        >
          <div>
            <p className="eyebrow">A numerical playground / 00</p>
            <h1 id="workspace-title">
              Small systems. <span>Clear ideas.</span>
            </h1>
            <p className="intro-copy">
              Start with one variable. See its distribution, draw samples, and
              compare what you measure with what you know.
            </p>
          </div>
          <span className="milestone">M0 · Gaussian foundation</span>
        </section>

        <div className="lab-layout">
          <aside className="sidebar" aria-label="Model and settings">
            <section className="model-card">
              <p className="eyebrow">Current model</p>
              <h2>0D Gaussian</h2>
              <p>
                One real variable, an exact reference, and a seeded sampler.
              </p>
              <div className="formula">S(x) = ½ax² − hx</div>
              <p className="model-convention">
                x ∈ ℝ · a &gt; 0 · weight exp(−S)
                <br />
                Dimensionless; no extra β factor.
              </p>
              <a href="#model-notes">
                Model notes & exercise <span aria-hidden="true">↓</span>
              </a>
            </section>

            <details
              className="settings"
              onToggle={(event) => {
                if (!event.currentTarget.open) setFormError(null);
              }}
            >
              <summary>Model & sampler settings</summary>
              <form onSubmit={apply} noValidate>
                <label htmlFor="coefficient">
                  Quadratic coefficient <strong>a</strong>
                  <input
                    id="coefficient"
                    inputMode="decimal"
                    type="number"
                    min="0.05"
                    max="20"
                    step="any"
                    value={a}
                    onChange={(event) => setA(event.target.value)}
                    aria-describedby="coefficient-help"
                  />
                </label>
                <small id="coefficient-help">
                  0.05–20 · larger a narrows the density
                </small>
                <label htmlFor="source">
                  Source <strong>h</strong>
                  <input
                    id="source"
                    inputMode="decimal"
                    type="number"
                    min="-10"
                    max="10"
                    step="any"
                    value={h}
                    onChange={(event) => setH(event.target.value)}
                    aria-describedby="source-help"
                  />
                </label>
                <small id="source-help">−10–10 · shifts the mean to h/a</small>
                <label htmlFor="seed">
                  Random seed
                  <input
                    id="seed"
                    inputMode="numeric"
                    type="number"
                    min="0"
                    max="4294967295"
                    step="1"
                    value={seed}
                    onChange={(event) => setSeed(event.target.value)}
                  />
                </label>
                <small>Integer 0–4294967295 · same seed replays the run</small>
                <p className="settings-warning">
                  Apply starts a new segment and clears previous measurements.
                </p>
                {formError && (
                  <p className="error" role="alert">
                    {formError}
                  </p>
                )}
                <button type="submit" className="button primary">
                  Apply & start new segment
                </button>
                <button type="button" className="button full" onClick={preset}>
                  Standard Gaussian preset
                </button>
              </form>
            </details>

            <section className="geometry-card" aria-labelledby="geometry-title">
              <p className="eyebrow" id="geometry-title">
                Geometry · single site
              </p>
              <div
                className="site-diagram"
                role="img"
                aria-label="One site v0 carrying one real variable x, with no links"
              >
                <span>{gaussianVariable.id}</span>
              </div>
              <p>
                {singleSite.vertices.length} site · {singleSite.edges.length}{' '}
                links · 1 physical variable
              </p>
              <small>Geometry is separate from plot slots.</small>
            </section>
            <div className="local-note">
              <span aria-hidden="true">◌</span> Computation stays in your
              browser.
            </div>
          </aside>

          <div className="workspace">
            <section className="run-panel" aria-label="Sampling controls">
              <div className="run-heading">
                <div>
                  <span
                    className={`status-dot ${view.running ? 'is-running' : ''}`}
                  />{' '}
                  <strong role="status" data-testid="run-status">
                    {status}
                  </strong>
                  <span className="segment">
                    Segment {snapshot?.runId ?? '…'}
                  </span>
                </div>
                <span className="algorithm-label">
                  Independent Gaussian draws
                </span>
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
                  onClick={() => client.current?.step()}
                  disabled={
                    view.running || view.busy || !snapshot || !!view.error
                  }
                >
                  Step
                </button>
                <button
                  className="button"
                  onClick={() =>
                    initialize(
                      configuration,
                      'Run reset. Replaying the same seed clears previous measurements.',
                    )
                  }
                >
                  Reset
                </button>
                <div className="sample-count">
                  <strong data-testid="sample-count">
                    {snapshot?.moments.count ?? 0}
                  </strong>
                  <span>retained samples</span>
                </div>
              </div>
              <div className="run-meta">
                <span>
                  Warm-up: <strong>0 · not needed</strong>
                </span>
                <span>1 update = 1 retained draw</span>
                <span>
                  Seed <strong>{configuration.seed}</strong>
                </span>
              </div>
              {view.error && (
                <p role="alert" className="error">
                  {view.error}{' '}
                  {snapshot &&
                    'Displayed measurements are the last confirmed state.'}
                </p>
              )}
              <p className="run-notice" aria-live="polite">
                {notice}
              </p>
            </section>

            <section className="moments-panel" aria-labelledby="moments-title">
              <div className="section-heading">
                <h2 id="moments-title">A reference you can measure</h2>
                <span className="parameter-chip">
                  a = {configuration.parameters.a} · h ={' '}
                  {configuration.parameters.h}
                </span>
              </div>
              <table className="moments-table">
                <caption className="sr-only">
                  Analytic exact moments compared with Monte Carlo estimates
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
                    <th scope="row">Mean ⟨x⟩</th>
                    <td data-testid="exact-mean">
                      {formatNumber(reference.mean)}
                    </td>
                    <td data-testid="sample-mean">
                      {formatNumber(snapshot?.moments.mean ?? null)}
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Variance</th>
                    <td data-testid="exact-variance">
                      {formatNumber(reference.variance)}
                    </td>
                    <td>{formatNumber(snapshot?.moments.variance ?? null)}</td>
                  </tr>
                  <tr>
                    <th scope="row">Second moment ⟨x²⟩</th>
                    <td>{formatNumber(reference.secondMoment)}</td>
                    <td>
                      {formatNumber(snapshot?.moments.secondMoment ?? null)}
                    </td>
                  </tr>
                </tbody>
              </table>
              <p className="table-note">
                Sample variance uses n − 1 (needs two draws). Uncertainty
                estimates are not provided in M0.
              </p>
            </section>

            <section
              className={`inspector ${overview ? 'show-overview' : ''}`}
              aria-labelledby="inspector-title"
            >
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Variable inspector</p>
                  <h2 id="inspector-title">Four slots. One system.</h2>
                </div>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={showHistogram}
                    onChange={(event) => setShowHistogram(event.target.checked)}
                  />
                  Histogram
                </label>
              </div>
              <p className="inspector-description">
                Assign the same variable to another slot to compare views. Slots
                never add physical variables.
              </p>
              <div className="mobile-plot-controls">
                <div aria-label="Choose detail slot">
                  {slotNumbers.map((slot) => (
                    <button
                      key={slot}
                      className="slot-button"
                      aria-pressed={activeSlot === slot}
                      onClick={() => {
                        setActiveSlot(slot);
                        setOverview(false);
                      }}
                    >
                      Slot {slot + 1}
                    </button>
                  ))}
                </div>
                <button
                  className="button"
                  aria-pressed={overview}
                  onClick={() => setOverview(!overview)}
                >
                  {overview ? 'Single detail' : '2 × 2 overview'}
                </button>
              </div>
              <div className="plot-grid">
                {slotNumbers.map((slot) => (
                  <article
                    key={slot}
                    className={`plot-card ${activeSlot === slot ? 'active-detail' : ''} ${slots[slot] ? '' : 'empty-slot'}`}
                    aria-label={`Plot slot ${slot + 1}`}
                  >
                    <div className="plot-card-heading">
                      <span className="slot-number">0{slot + 1}</span>
                      <label className="sr-only" htmlFor={`slot-${slot}`}>
                        Variable for slot {slot + 1}
                      </label>
                      <select
                        id={`slot-${slot}`}
                        value={slots[slot] ?? ''}
                        onChange={(event) =>
                          setSlots(
                            slots.map((value, i) =>
                              i === slot ? event.target.value || null : value,
                            ),
                          )
                        }
                      >
                        <option value="">Unassigned</option>
                        <option value="x">x · real scalar</option>
                      </select>
                    </div>
                    {slots[slot] ? (
                      <>
                        <div className="current-value">
                          <span>
                            Current x{' '}
                            <strong data-testid={`current-${slot}`}>
                              {formatNumber(snapshot?.currentValue ?? null)}
                            </strong>
                          </span>
                          <span>
                            S(x) {formatNumber(snapshot?.currentAction ?? null)}
                          </span>
                        </div>
                        <GaussianPlot
                          parameters={configuration.parameters}
                          snapshot={snapshot}
                          showHistogram={showHistogram}
                        />
                      </>
                    ) : (
                      <div className="empty-slot-body">
                        <span aria-hidden="true">＋</span>
                        <h3>An open window</h3>
                        <p>
                          Select x above to inspect this model’s single variable
                          here.
                        </p>
                        <small>Slot {slot + 1} of 4 · unassigned</small>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </section>

            <details className="model-notes" id="model-notes">
              <summary>The mathematics & a small experiment</summary>
              <div>
                <h3>A normalized Gaussian, on the full real line</h3>
                <p>
                  Completing the square gives μ = h/a and σ² = 1/a. The analytic
                  density is p(x) = √(a/2π) exp[−a(x − μ)²/2]. The partition
                  function obeys log Z = ½ log(2π/a) + h²/(2a).
                </p>
                <p>
                  Each update uses the Box–Muller transform with two seeded
                  uniform draws (Mulberry32 v1). Every draw is independent of
                  the previous configuration, so no equilibration transitions
                  are discarded. An update is an algorithmic operation, not
                  physical time; for this one-variable sampler, a sweep would be
                  one update. A displayed frame may summarize many draws.
                </p>
                <h3>Try it: shift, then narrow</h3>
                <p>
                  Run the standard Gaussian and compare the sample moments with
                  0 and 1. Pause, set h = 2, and apply: the exact mean moves to
                  2. Now set a = 4: the mean becomes 0.5 and the variance 0.25.
                  Each apply starts a fresh segment.
                </p>
                <p>
                  Plots show μ ± 4σ, with 32 fixed bins normalized by all
                  retained samples. Tail draws remain in moments and overflow
                  counts. Sampled moments cover the entire current segment;
                  there is no saved-run history or export yet. Seed replay is
                  intended for the same algorithm and build; last-bit math may
                  vary between browsers.
                </p>
              </div>
            </details>
          </div>
        </div>
      </main>
      <footer>
        <span>
          Lattice Lab <span className="footer-divider">/</span> Small systems,
          explicit mathematics.
        </span>
        <span>0D Gaussian available · more models planned</span>
      </footer>
    </>
  );
}
