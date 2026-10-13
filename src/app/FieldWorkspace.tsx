import { Phi4FieldView } from './Phi4FieldView';
import { SiteHeader } from './SiteHeader';
import { useState } from 'react';
import { defaultFieldConfiguration } from '../engine/fieldRun';
import type {
  GaussianFieldConfiguration,
  FieldSettings,
} from '../engine/fieldRun';
import { createFieldLattice } from '../domain/fieldLattice';
import { formatNumber } from '../plotting/PlotFrame';
import { DisplayMath, InlineMath } from '../ui/Math';
import { FieldControls } from './FieldControls';
import { FieldHistory } from './FieldHistory';
import { FieldInspection, FieldStepInspection } from './FieldResults';
import { FieldVisual } from './FieldVisual';
import { FieldSpectrum } from './FieldSpectrum';
import { fieldMeasure } from '../models/gaussianField';
import { useField } from './useField';
import { RunPauseControl } from './RunPauseControl';
import { ToolDeck } from './ToolDeck';
import type { ToolDefinition } from './ToolDeck';

type FieldTool = 'profile' | 'inspection' | 'spectrum' | 'history' | 'update';
const fieldTools: ToolDefinition<FieldTool>[] = [
  {
    id: 'profile',
    title: 'Current field configuration',
    kind: 'Visualization',
    description: 'Spatial profile or heatmap at the current update.',
  },
  {
    id: 'inspection',
    title: 'Selected site and covariance',
    kind: 'Analysis',
    description: 'Local terms, conditional law and segment pair comparison.',
  },
  {
    id: 'spectrum',
    title: 'Fourier spectrum',
    kind: 'Plot',
    description: 'Momentum-index power for fully periodic fields.',
  },
  {
    id: 'history',
    title: 'Measurement history',
    kind: 'Plot',
    description: 'Recent bounded measurements in algorithmic update order.',
  },
  {
    id: 'update',
    title: 'Latest update',
    kind: 'Analysis',
    description: 'The actual latest draw or local transition.',
    featureable: false,
  },
];

export function FieldWorkspace() {
  const [model, setModel] = useState<'gaussian' | 'phi4'>('gaussian');
  return model === 'gaussian' ? (
    <GaussianFieldSession choosePhi4={() => setModel('phi4')} />
  ) : (
    <Phi4FieldView chooseGaussian={() => setModel('gaussian')} />
  );
}

function GaussianFieldSession({ choosePhi4 }: { choosePhi4: () => void }) {
  const { view, client } = useField(defaultFieldConfiguration);
  const snapshot = view.snapshot;
  const current = snapshot?.segments.at(-1);
  const [draft, setDraft] = useState<GaussianFieldConfiguration>(
    defaultFieldConfiguration,
  );
  const [seed, setSeed] = useState(String(defaultFieldConfiguration.seed));
  const [selected, setSelected] = useState(0);
  const [partners, setPartners] = useState<Record<number, number>>({});
  const [displayLimits, setDisplayLimits] = useState<Record<number, number>>(
    {},
  );
  // React remounts a tool when it moves between gallery and feature containers.
  // Momentum is presentation state tied to the assignment key, not the worker.
  const [spectrumModes, setSpectrumModes] = useState<Record<number, number>>(
    {},
  );
  const [notice, setNotice] = useState(
    'Draw a field or Step an elementary update.',
  );
  const [formError, setFormError] = useState<string | null>(null);
  const applied = current?.settings ?? defaultFieldConfiguration;
  const lattice = createFieldLattice(applied.parameters.shape);
  const site = Math.min(selected, lattice.size - 1);
  const busy = view.busy || !snapshot;
  const periodic =
    applied.parameters.shape.kind === 'chain'
      ? applied.parameters.shape.periodic
      : applied.parameters.shape.periodicX &&
        applied.parameters.shape.periodicY;

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
  const knownSiteVariance =
    current?.reference?.covariance[site]?.[site] ?? null;
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
      <SiteHeader active="fields" />
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
        <div className="qm-model-choice">
          <label>
            Field model{' '}
            <select
              aria-label="Field model"
              value="gaussian"
              onChange={choosePhi4}
            >
              <option value="gaussian">Gaussian field / mean-zero GFF</option>
              <option value="phi4">Interacting φ⁴ field</option>
            </select>
          </label>
          <span className="plot-note">
            Changing model starts a new seeded session.
          </span>
        </div>
        <div className="lab-layout field-layout">
          <aside className="sidebar" aria-label="Field settings">
            <section className="model-card">
              <p className="eyebrow">Dimensionless Gaussian action</p>
              <DisplayMath>{String.raw`\begin{aligned}S(\phi)={}&\tfrac r2\sum_i\phi_i^2\\&+\tfrac12\sum_b\kappa_b(\phi_t-\phi_h)^2\\&-j\sum_i\phi_i\end{aligned}`}</DisplayMath>
              <p>
                Weight <InlineMath>{String.raw`e^{-S}`}</InlineMath>. Ordinary
                massive fields use product Lebesgue measure; the periodic
                massless variant removes the constant mode with Σφ=0. Open edges
                omit wrap bonds rather than fixing field values.
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
                <RunPauseControl
                  running={view.running}
                  busy={view.busy}
                  ready={!!snapshot && !view.error}
                  run={() => client.current?.start()}
                  pause={() => client.current?.pause()}
                />
                <button
                  type="button"
                  className="button"
                  onClick={() => client.current?.step()}
                  disabled={busy || view.running || !!view.error}
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
            </section>
            <ToolDeck
              title="Lattice Fields tools"
              tools={fieldTools}
              featuredDefault="profile"
              defaults={['inspection']}
              addPreference={fieldTools
                .filter((tool) => periodic || tool.id !== 'spectrum')
                .map((tool) => tool.id)}
              onRemove={(key) => {
                setSpectrumModes((current) => {
                  const next = { ...current };
                  delete next[key];
                  return next;
                });
                setDisplayLimits((current) => {
                  const next = { ...current };
                  delete next[key];
                  return next;
                });
                setPartners((current) => {
                  const next = { ...current };
                  delete next[key];
                  return next;
                });
              }}
              renderTool={(tool, assignmentKey) => {
                const limit = displayLimits[assignmentKey] ?? 3;
                const pairSite = Math.min(
                  partners[assignmentKey] ?? 1,
                  lattice.size - 1,
                );
                switch (tool) {
                  case 'profile':
                    return (
                      <>
                        <div className="tool-options">
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
                            Fixed display range ±
                            <input
                              type="number"
                              aria-label="Field display limit"
                              min="0.1"
                              max="50"
                              step="any"
                              value={limit}
                              onChange={(event) => {
                                const value = Number(event.target.value);
                                if (value >= 0.1 && value <= 50)
                                  setDisplayLimits((current) => ({
                                    ...current,
                                    [assignmentKey]: value,
                                  }));
                              }}
                            />
                          </label>
                        </div>
                        <FieldVisual
                          shape={applied.parameters.shape}
                          field={snapshot?.field ?? null}
                          selected={site}
                          onSelect={setSelected}
                          limit={limit}
                        />
                      </>
                    );
                  case 'inspection':
                    return snapshot ? (
                      <>
                        <div className="tool-options">
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
                                setPartners((current) => ({
                                  ...current,
                                  [assignmentKey]: boundedSite(
                                    event.target.value,
                                  ),
                                }))
                              }
                            />
                          </label>
                        </div>
                        <FieldInspection
                          snapshot={snapshot}
                          site={site}
                          partner={pairSite}
                        />
                      </>
                    ) : (
                      <p>Wait for the field worker to initialize.</p>
                    );
                  case 'spectrum':
                    return current ? (
                      <FieldSpectrum
                        segment={current}
                        selected={spectrumModes[assignmentKey] ?? 0}
                        onSelect={(mode) =>
                          setSpectrumModes((previous) => ({
                            ...previous,
                            [assignmentKey]: mode,
                          }))
                        }
                      />
                    ) : (
                      <p>Wait for a field segment.</p>
                    );
                  case 'history':
                    return snapshot ? (
                      <>
                        <div className="tool-options">
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
                            History display range ±
                            <input
                              type="number"
                              aria-label="Field history display limit"
                              min="0.1"
                              max="50"
                              step="any"
                              value={limit}
                              onChange={(event) => {
                                const value = Number(event.target.value);
                                if (value >= 0.1 && value <= 50)
                                  setDisplayLimits((current) => ({
                                    ...current,
                                    [assignmentKey]: value,
                                  }));
                              }}
                            />
                          </label>
                        </div>
                        <FieldHistory
                          snapshot={snapshot}
                          site={site}
                          limit={limit}
                        />
                      </>
                    ) : (
                      <p>Wait for a field segment.</p>
                    );
                  case 'update':
                    return snapshot ? (
                      <FieldStepInspection snapshot={snapshot} />
                    ) : (
                      <p>No update yet.</p>
                    );
                }
              }}
            />
            <details className="model-page-details">
              <summary>Technical details &amp; measurement coverage</summary>
              <div>
                <p>
                  Seed {snapshot?.seed ?? seed}; segment {current?.id ?? '—'}{' '}
                  began at update {current?.startUpdate ?? 0}.{' '}
                  {current?.warmupUpdates ?? 0} warm-up updates and{' '}
                  {current?.measurements ?? 0} retained measurements;{' '}
                  {current?.discardedMeasurements ?? 0} older display vectors
                  evicted. Site and pair aggregates span the full retained
                  segment; plotted vectors are bounded. Parameter changes never
                  pool distinct target measures.
                </p>
                {current && (
                  <p>
                    {current.accepted} accepted and {current.rejected} rejected
                    Metropolis proposals, including warm-up.{' '}
                    {independentSE === null
                      ? 'No independent-sample SE is claimed for a local chain.'
                      : `Exact-variance pointwise SE for the independent site mean: ${formatNumber(independentSE)}; it is not a simultaneous band.`}
                  </p>
                )}
                <p>
                  The dashed site-mean reference and covariance are exact for
                  this finite Gaussian system. A fixed warm-up period does not
                  prove local-chain equilibration. Fields/QM archive integration
                  remains future work.
                </p>
              </div>
            </details>
            <details className="model-page-details">
              <summary>
                Mathematics, exercises &amp; suggested experiments
              </summary>
              <div>
                <p>
                  The quadratic action has precision matrix Q. For an ordinary
                  massive field, the exact finite-volume covariance is Q⁻¹; open
                  boundaries omit wrap bonds and periodic boundaries retain each
                  indexed bond. The constrained massless field removes the
                  constant Fourier mode and uses a mean-zero measure, so its
                  covariance is a constrained inverse rather than Q⁻¹ on the
                  full space.
                </p>
                <p>
                  Independent Gaussian or Fourier draws replace the whole field.
                  Coordinate heat bath and Metropolis change one site per
                  algorithmic update and produce correlated measurements. The
                  spectrum compares sampled mode powers with exact finite-volume
                  values; its zero mode is absent for the mean-zero field.
                </p>
                <ul>
                  <li>
                    Vary mass and stiffness; compare the field scale and
                    covariance.
                  </li>
                  <li>
                    Compare open and periodic boundaries, then inspect the
                    removed zero mode.
                  </li>
                  <li>
                    Compare local and independent sampling and sampled versus
                    exact Fourier power.
                  </li>
                </ul>
                <a href="https://github.com/gantemur/lattice/blob/main/docs/math/gaussian-fields.md">
                  Gaussian-field mathematics ↗
                </a>{' '}
                ·{' '}
                <a href="https://github.com/gantemur/lattice/blob/main/docs/math/gaussian-fourier.md">
                  Fourier and mean-zero mathematics ↗
                </a>
              </div>
            </details>
            {trace && (
              <span className="sr-only">Latest update {trace.update}</span>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
