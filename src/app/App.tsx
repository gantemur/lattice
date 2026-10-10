import { useState } from 'react';
import type { FormEvent } from 'react';
import { singleSite } from '../domain/singleSite';
import { standardGaussianPreset } from '../engine/preset';
import { MAX_SEGMENTS } from '../engine/gaussianEngine';
import { gaussianReference } from '../models/gaussian';
import { formatNumber } from '../plotting/PlotFrame';
import { segmentColor } from '../plotting/viewport';
import { InlineMath, DisplayMath } from '../ui/Math';
import { useSimulation } from './useSimulation';
import { Inspector } from './Inspector';

export function App() {
  const { view, client } = useSimulation();
  const snapshot = view.snapshot;
  const configuration =
    snapshot?.configuration ?? standardGaussianPreset.configuration;
  const [a, setA] = useState('1'),
    [h, setH] = useState('0');
  const [seed, setSeed] = useState(
    String(standardGaussianPreset.configuration.seed),
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState('Draw one sample or start a run.');
  const reference = gaussianReference(configuration.parameters);
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
  function apply(event: FormEvent) {
    event.preventDefault();
    if (!a.trim() || !h.trim()) {
      setFormError('Complete both parameter fields before applying.');
      return;
    }
    attempt(
      () => client.current?.changeParameters({ a: Number(a), h: Number(h) }),
      'Parameter changes start a separate segment. Earlier measurements and the RNG stream are preserved; unchanged parameters keep the current segment.',
    );
  }
  function reset() {
    if (!seed.trim()) {
      setFormError('Enter the seed to use on Reset.');
      return;
    }
    attempt(
      () =>
        client.current?.initialize({
          parameters: configuration.parameters,
          seed: Number(seed),
        }),
      'Reset cleared history and refitted plots. Sampling restarts with the current parameters and the selected seed.',
    );
  }
  function preset() {
    setA('1');
    setH('0');
    attempt(
      () => client.current?.changeParameters({ a: 1, h: 0 }),
      'Standard Gaussian parameters applied. Earlier segments and the RNG stream are preserved.',
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
          Source ↗
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
              Explore one variable. Compare distributions, follow convergence,
              and keep the mathematics in view.
            </p>
          </div>
          <span className="milestone">M0 · Gaussian foundation</span>
        </section>
        <div className="lab-layout">
          <aside className="sidebar" aria-label="Model and settings">
            <section className="model-card">
              <p className="eyebrow">Current model</p>
              <h2>0D Gaussian</h2>
              <div className="formula">
                <DisplayMath>{String.raw`S(x)=\frac{a x^2}{2}-hx`}</DisplayMath>
              </div>
              <p className="model-convention">
                <InlineMath>{String.raw`x\in\mathbb R,\quad a>0`}</InlineMath>
                <br />
                Weight <InlineMath>{String.raw`e^{-S(x)}`}</InlineMath>.
                Dimensionless; no extra β factor.
              </p>
              <a href="#model-notes">Model notes & exercise ↓</a>
            </section>
            <details className="settings">
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
                    onChange={(e) => setA(e.target.value)}
                  />
                </label>
                <small>0.05–20 · larger a narrows the density</small>
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
                    onChange={(e) => setH(e.target.value)}
                  />
                </label>
                <small>
                  −10–10 · shifts the mean to <InlineMath>{'h/a'}</InlineMath>
                </small>
                <p className="settings-warning">
                  Apply keeps earlier segments and continues the random stream.
                  Statistics are never pooled across parameters.
                </p>
                <button
                  type="submit"
                  className="button primary"
                  disabled={!snapshot || !!view.error}
                >
                  Apply parameters
                </button>
                <button
                  type="button"
                  className="button full"
                  onClick={preset}
                  disabled={!snapshot || !!view.error}
                >
                  Standard Gaussian preset
                </button>
                <label htmlFor="seed">
                  Seed on Reset
                  <input
                    id="seed"
                    inputMode="numeric"
                    type="number"
                    min="0"
                    max="4294967295"
                    step="1"
                    value={seed}
                    onChange={(e) => setSeed(e.target.value)}
                  />
                </label>
                <small>
                  Integer 0–4294967295. Apply does not change the seed. Reset
                  uses the applied parameters and this seed.
                </small>
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
                <span>x</span>
              </div>
              <p>
                {singleSite.vertices.length} site · {singleSite.edges.length}{' '}
                links · 1 physical variable
              </p>
              <small>Geometry is separate from plot slots.</small>
            </section>
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
                <button className="button" onClick={reset}>
                  Reset
                </button>
                <div className="sample-count">
                  <strong data-testid="sample-count">
                    {snapshot?.moments.count ?? 0}
                  </strong>
                  <span>segment samples</span>
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
                <span>
                  All updates{' '}
                  <strong data-testid="total-updates">
                    {snapshot?.updates ?? 0}
                  </strong>
                </span>
              </div>
              <div className="current-value">
                <span>
                  Current x{' '}
                  <strong data-testid="current-value">
                    {formatNumber(snapshot?.currentValue ?? null)}
                  </strong>
                </span>
                <span>
                  Action <InlineMath>{'S(x)'}</InlineMath>{' '}
                  {formatNumber(snapshot?.currentAction ?? null)}
                </span>
              </div>
              {snapshot?.currentValue !== null &&
                snapshot?.moments.count === 0 && (
                  <p className="plot-note">
                    Carried configuration; no measurements yet in this segment.
                  </p>
                )}
              {view.error && (
                <p role="alert" className="error">
                  {view.error}{' '}
                  {snapshot &&
                    'Displayed measurements are the last confirmed state.'}
                </p>
              )}
              {formError && (
                <p className="error" role="alert">
                  {formError}
                </p>
              )}
              <p className="run-notice" aria-live="polite">
                {notice}
              </p>
            </section>
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
                    </strong>{' '}
                    a={segment.parameters.a}, h={segment.parameters.h} · N=
                    {segment.moments.count}
                  </span>
                ))}
              </div>
              <details>
                <summary>Segment statistics & retention</summary>
                <p>
                  Latest {MAX_SEGMENTS} segments retained.{' '}
                  {snapshot?.droppedSegments ?? 0} older segments removed. Each
                  segment has its own histogram, moments, and convergence
                  trajectory; no individual samples are stored.
                </p>
                <div className="segment-statistics">
                  {snapshot?.segments.map((segment) => (
                    <p key={segment.id}>
                      <strong>S{segment.id}</strong> · starts after update{' '}
                      {segment.startUpdate} · mean{' '}
                      {formatNumber(segment.moments.mean)} · variance{' '}
                      {formatNumber(segment.moments.variance)} · last
                      convergence N={segment.convergence.at(-1)?.count ?? 0}
                    </p>
                  ))}
                </div>
              </details>
              {!!snapshot?.droppedSegments && (
                <p role="status">
                  History limit: {snapshot.droppedSegments} oldest segments
                  removed; the current RNG stream continues.
                </p>
              )}
            </section>
            <Inspector snapshot={snapshot} />
            <section className="moments-panel" aria-labelledby="moments-title">
              <div className="section-heading">
                <h2 id="moments-title">Current segment · exact & sampled</h2>
                <span className="parameter-chip">
                  a = {configuration.parameters.a} · h ={' '}
                  {configuration.parameters.h}
                </span>
              </div>
              <table className="moments-table">
                <caption className="sr-only">
                  Current segment analytic moments and Monte Carlo estimates
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
                      <InlineMath>{String.raw`\langle x\rangle`}</InlineMath>
                    </th>
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
                    <th scope="row">
                      Second moment{' '}
                      <InlineMath>{String.raw`\langle x^2\rangle`}</InlineMath>
                    </th>
                    <td>{formatNumber(reference.secondMoment)}</td>
                    <td>
                      {formatNumber(snapshot?.moments.secondMoment ?? null)}
                    </td>
                  </tr>
                </tbody>
              </table>
              <p className="table-note">
                Sample variance uses <InlineMath>{'N-1'}</InlineMath> and needs
                two draws. The convergence bands use the known analytic
                variance, not an estimated uncertainty.
              </p>
            </section>
            <details className="model-notes" id="model-notes">
              <summary>The mathematics & a small experiment</summary>
              <div>
                <h3>A normalized Gaussian, on the full real line</h3>
                <DisplayMath>{String.raw`\mu=\frac ha,\qquad\sigma^2=\frac1a`}</DisplayMath>
                <DisplayMath>{String.raw`p(x)=\sqrt{\frac{a}{2\pi}}\exp\!\left[-\frac{a(x-\mu)^2}{2}\right]`}</DisplayMath>
                <DisplayMath>{String.raw`\log Z=\frac12\log\frac{2\pi}{a}+\frac{h^2}{2a}`}</DisplayMath>
                <p>
                  Each update uses Box–Muller with two seeded Mulberry32 v1
                  uniforms. Draws are independent of the current configuration,
                  so no warm-up is discarded, even after parameters change. One
                  update (also one sweep here) produces one retained sample.
                  Updates are not physical time; a rendered frame may summarize
                  many draws.
                </p>
                <h3>Convergence is statistical</h3>
                <DisplayMath>{String.raw`\overline x_N=\frac1N\sum_{i=1}^{N}x_i,\qquad\operatorname{SE}(\overline x_N)=\frac{\sigma}{\sqrt N}`}</DisplayMath>
                <p>
                  At each fixed sample count, the mean of independent Gaussian
                  draws is Gaussian with exact mean{' '}
                  <InlineMath>{'\u03bc'}</InlineMath> and variance{' '}
                  <InlineMath>{String.raw`\sigma^2/N`}</InlineMath>. The shaded
                  one-standard-error envelope around the exact mean has about
                  68% pointwise coverage. It is not a simultaneous confidence
                  band or a guarantee for the whole trajectory.
                </p>
                <p>
                  The log–log absolute-error view compares a single random
                  trajectory with the RMS reference{' '}
                  <InlineMath>{String.raw`\sigma N^{-1/2}`}</InlineMath>.
                  Individual errors can rise, fall, or cross zero; they need not
                  decrease monotonically. Exact zero-error checkpoints are
                  omitted on the log axis. Lines connect retained checkpoints
                  and do not display every intermediate fluctuation.
                </p>
                <p>
                  Checkpoints are collected inside the worker at counts{' '}
                  <InlineMath>{String.raw`n_{k+1}=\lceil 1.125 n_k\rceil,\quad n_0=1`}</InlineMath>
                  , plus the latest count. At most 320 scheduled checkpoints
                  plus one current endpoint per segment cover the safe-integer
                  counter range. Display changes do not affect this schedule.
                </p>
                <h3>Try it: shift, then narrow</h3>
                <p>
                  Run with <InlineMath>{'a=1,h=0'}</InlineMath>, then apply{' '}
                  <InlineMath>{'h=2'}</InlineMath>. Run again and compare both
                  distributions. Set <InlineMath>{'a=4'}</InlineMath>: the new
                  exact mean is 0.5 and variance 0.25. Each change begins a
                  separate trajectory with its own count. Fit All adjusts axes
                  only; Reset clears all segments, refits axes, and restarts the
                  selected seed with the currently applied parameters.
                </p>
                <p>
                  Each segment keeps 32 fixed bins over its own{' '}
                  <InlineMath>{String.raw`\mu\pm4\sigma`}</InlineMath>. Tail
                  samples still enter that segment’s moments and normalization.
                  Up to eight recent segments remain in memory; older ones are
                  removed with notice. No saved-run manager, export, or general
                  MCMC error analysis is implemented. Seed replay requires the
                  same parameter-change/update sequence and build; browser math
                  can differ in the last bits.
                </p>
              </div>
            </details>
          </div>
        </div>
      </main>
      <footer>
        <span>Lattice Lab / Small systems, explicit mathematics.</span>
        <span>0D Gaussian available · more models planned</span>
      </footer>
    </>
  );
}
