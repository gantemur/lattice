import { useEffect, useRef, useState } from 'react';
import { FieldClient } from '../engine/fieldClient';
import type { FieldView, FieldWorkerPort } from '../engine/fieldClient';
import { defaultFieldConfiguration } from '../engine/fieldRun';
import type { FieldConfiguration, FieldSettings } from '../engine/fieldRun';
import { createFieldLattice } from '../domain/fieldLattice';
import { formatNumber } from '../plotting/PlotFrame';
import { DisplayMath, InlineMath } from '../ui/Math';
import { FieldControls } from './FieldControls';
import { FieldHistory } from './FieldHistory';
import { FieldInspection, FieldStepInspection } from './FieldResults';
import { FieldVisual } from './FieldVisual';
import { FieldSpectrum } from './FieldSpectrum';
import { fieldMeasure } from '../models/gaussianField';

function useField() {
  const [view, setView] = useState<FieldView>({
    snapshot: null,
    running: false,
    busy: false,
    error: null,
  });
  const client = useRef<FieldClient | null>(null);
  useEffect(() => {
    const instance = new FieldClient(
      () =>
        new Worker(new URL('../workers/field.worker.ts', import.meta.url), {
          type: 'module',
        }) as unknown as FieldWorkerPort,
      setView,
    );
    client.current = instance;
    instance.initialize(defaultFieldConfiguration);
    return () => {
      instance.dispose();
      client.current = null;
    };
  }, []);
  return { view, client };
}

export function FieldWorkspace() {
  const { view, client } = useField();
  const snapshot = view.snapshot;
  const current = snapshot?.segments.at(-1);
  const [draft, setDraft] = useState<FieldConfiguration>(
    defaultFieldConfiguration,
  );
  const [seed, setSeed] = useState(String(defaultFieldConfiguration.seed));
  const [selected, setSelected] = useState(0);
  const [partner, setPartner] = useState(1);
  const [displayLimit, setDisplayLimit] = useState(3);
  const [notice, setNotice] = useState(
    'Draw a field or Step an elementary update.',
  );
  const [formError, setFormError] = useState<string | null>(null);
  const applied = current?.settings ?? defaultFieldConfiguration;
  const lattice = createFieldLattice(applied.parameters.shape);
  const site = Math.min(selected, lattice.size - 1);
  const pairSite = Math.min(partner, lattice.size - 1);
  const busy = view.busy || !snapshot;

  function boundedSite(value: string) {
    const parsed = Number(value);
    return Number.isFinite(parsed)
      ? Math.min(lattice.size - 1, Math.max(0, Math.trunc(parsed)))
      : 0;
  }

  function attempt(action: () => void, message: string) {
    try {
      action();
      setFormError(null);
      setNotice(message);
    } catch (cause) {
      setFormError(
        cause instanceof Error ? cause.message : 'Invalid field settings.',
      );
    }
  }
  function apply() {
    const settings: FieldSettings = {
      parameters: draft.parameters,
      sampler: draft.sampler,
      warmupSweeps: draft.warmupSweeps,
      strideSweeps: draft.strideSweeps,
    };
    const newGeometry =
      JSON.stringify(settings.parameters.shape) !==
      JSON.stringify(applied.parameters.shape);
    const newSupport =
      fieldMeasure(settings.parameters) !== fieldMeasure(applied.parameters);
    if (newGeometry || newSupport)
      attempt(
        () => client.current?.initialize({ ...settings, seed: Number(seed) }),
        'Geometry or measure support changed: a new seeded session began; the initial field is not a measurement.',
      );
    else
      attempt(
        () => client.current?.change(settings),
        'Applied settings begin a new isolated measurement segment when changed; the field and RNG stream continue.',
      );
  }
  function reset() {
    attempt(
      () => client.current?.initialize({ ...applied, seed: Number(seed) }),
      'Reset restarted the applied model with the selected seed and cleared measurements.',
    );
  }
  const trace = snapshot?.lastTrace;
  const samples = current?.measurements ?? 0;
  const knownSiteVariance = current?.reference.covariance[site]?.[site] ?? null;
  const independentSE =
    (current?.settings.sampler.kind === 'direct' ||
      current?.settings.sampler.kind === 'spectral') &&
    samples &&
    knownSiteVariance !== null
      ? Math.sqrt(knownSiteVariance / samples)
      : null;
  return (
    <>
      <a className="skip-link" href="#field-laboratory">
        Skip to field laboratory
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
          <a href="#lattice-systems">Lattice Systems</a>
          <a className="nav-active" aria-current="page" href="#fields-paths">
            Fields &amp; Paths
          </a>
          <a href="#experiments">Experiments</a>
        </nav>
        <a className="source-link" href="https://github.com/gantemur/lattice">
          Source ↗
        </a>
      </header>
      <main id="field-laboratory">
        <section className="intro" id="fields-paths">
          <div>
            <p className="eyebrow">A numerical playground / 03</p>
            <h1>
              Fields on finite lattices. <span>Exact Gaussian structure.</span>
            </h1>
            <p className="intro-copy">
              Explore massive real fields and the periodic mean-zero massless
              field. Compare exact finite-volume covariance and Fourier modes
              with independent draws or local updates.
            </p>
          </div>
          <span className="milestone">M4a2 · Fourier Gaussian fields</span>
        </section>
        <div className="lab-layout field-layout">
          <aside className="sidebar" aria-label="Field settings">
            <section className="model-card">
              <p className="eyebrow">Dimensionless Gaussian action</p>
              <DisplayMath>{String.raw`\begin{aligned}S(\phi)={}&\tfrac r2\sum_i\phi_i^2\\&+\tfrac12\sum_b\kappa_b(\phi_t-\phi_h)^2\\&-j\sum_i\phi_i\end{aligned}`}</DisplayMath>
              <p>
                Ordinary fields use r&gt;0 and product Lebesgue measure. The
                massless periodic field sets r=j=0 and removes the constant mode
                by Σφ=0 with induced Euclidean measure. Open boundaries omit
                wrap bonds; they do not fix the edge field to zero. Each
                periodic length-two axis has two distinct bonds. The Gibbs
                weight is <InlineMath>{String.raw`e^{-S}`}</InlineMath>.
              </p>
            </section>
            <FieldControls
              draft={draft}
              setDraft={setDraft}
              seed={seed}
              setSeed={setSeed}
              onApply={apply}
            />
          </aside>
          <div className="field-main">
            <section
              className="field-run-panel"
              aria-label="Field simulation controls"
            >
              <div className="section-heading">
                <h2>Gaussian field run</h2>
                <span className="parameter-chip">
                  {applied.parameters.shape.kind === 'chain'
                    ? '1D chain'
                    : '2D rectangle'}{' '}
                  · {lattice.size} sites
                </span>
              </div>
              <div className="field-run-buttons">
                <button
                  type="button"
                  className="button"
                  onClick={() => client.current?.start()}
                  disabled={busy || view.running}
                >
                  Run
                </button>
                <button
                  type="button"
                  className="button"
                  onClick={() => client.current?.pause()}
                  disabled={!view.running}
                >
                  Pause
                </button>
                <button
                  type="button"
                  className="button"
                  onClick={() => client.current?.step()}
                  disabled={busy || view.running}
                >
                  Step
                </button>
                <button type="button" className="button" onClick={reset}>
                  Reset
                </button>
              </div>
              <div className="field-run-readings">
                <span>
                  Updates{' '}
                  <strong data-testid="field-updates">
                    {snapshot?.updates ?? 0}
                  </strong>
                </span>
                <span>
                  Measurements{' '}
                  <strong data-testid="field-samples">{samples}</strong>
                </span>
                <span>
                  Action S{' '}
                  <strong>{formatNumber(snapshot?.action ?? null)}</strong>
                </span>
                <span>
                  〈φ〉 current{' '}
                  <strong>
                    {formatNumber(
                      snapshot?.field
                        ? snapshot.field.reduce(
                            (sum, value) => sum + value,
                            0,
                          ) / lattice.size
                        : null,
                    )}
                  </strong>
                </span>
              </div>
              <p className="run-notice">{formError || view.error || notice}</p>
              <p className="plot-note">
                {applied.sampler.kind === 'direct' ||
                applied.sampler.kind === 'spectral'
                  ? 'One update draws a whole independent field; acceptance and nominal local sweeps are N/A.'
                  : `One nominal sweep is ${lattice.size} random-site updates with replacement. Warm-up and stride are segment-local; acceptance is ${applied.sampler.kind === 'metropolis' ? 'defined for Metropolis proposals' : 'N/A for heat bath'}.`}{' '}
                Updates are not physical time. Run and Step share one worker
                kernel.
              </p>
              {current && (
                <p className="plot-note">
                  Segment {current.id}: {current.warmupUpdates} warm-up updates;{' '}
                  {current.measurements} retained measurements;{' '}
                  {current.accepted} accepted, {current.rejected} rejected
                  Metropolis proposals.{' '}
                  {independentSE === null
                    ? 'No independent-sample SE is claimed for a local chain.'
                    : `Exact-variance pointwise SE for the independent site mean: ${formatNumber(independentSE)}; it is not a simultaneous band.`}
                </p>
              )}
            </section>
            <div className="field-display-controls">
              <label>
                Inspect site
                <input
                  type="number"
                  aria-label="Inspect field site"
                  min="0"
                  max={lattice.size - 1}
                  step="1"
                  value={site}
                  onChange={(event) =>
                    setSelected(boundedSite(event.target.value))
                  }
                />
              </label>
              <label>
                Pair with site
                <input
                  type="number"
                  aria-label="Pair field site"
                  min="0"
                  max={lattice.size - 1}
                  step="1"
                  value={pairSite}
                  onChange={(event) =>
                    setPartner(boundedSite(event.target.value))
                  }
                />
              </label>
              <label>
                Fixed display range ±
                <input
                  type="number"
                  aria-label="Field display limit"
                  min="0.1"
                  max="50"
                  step="any"
                  value={displayLimit}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    if (value >= 0.1 && value <= 50) setDisplayLimit(value);
                  }}
                />
              </label>
            </div>
            <FieldVisual
              shape={applied.parameters.shape}
              field={snapshot?.field ?? null}
              selected={site}
              onSelect={setSelected}
              limit={displayLimit}
            />
            {current && <FieldSpectrum segment={current} />}
            {snapshot && (
              <>
                <FieldStepInspection snapshot={snapshot} />
                <FieldInspection
                  snapshot={snapshot}
                  site={site}
                  partner={pairSite}
                />
                <FieldHistory
                  snapshot={snapshot}
                  site={site}
                  limit={displayLimit}
                />
              </>
            )}
            <p className="plot-note">
              The dashed site-mean reference and covariance are exact for this
              finite Gaussian model. Sample estimates and recent plotted vectors
              belong to separate parameter segments. A fixed warm-up count does
              not prove local-chain equilibrium. Experiments archive integration
              arrives in M4e.
            </p>
            {trace && (
              <span className="sr-only">Latest update {trace.update}</span>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
