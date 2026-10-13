import { SiteHeader } from './SiteHeader';
import { RunPauseControl } from './RunPauseControl';
import { ToolDeck } from './ToolDeck';
import type { ToolDefinition } from './ToolDeck';
import { OscillatorHistory } from './OscillatorHistory';
import { useState } from 'react';
import type { FieldClient, FieldView } from '../engine/fieldClient';
import { defaultOscillatorConfiguration } from '../engine/fieldRun';
import type {
  FieldSegmentSnapshot,
  OscillatorConfiguration,
  OscillatorFieldSettings,
} from '../engine/fieldRun';
import { oscillatorField, oscillatorSpacing } from '../models/oscillator';
import type { OscillatorParameters } from '../models/oscillator';
import {
  continuumCorrelator,
  latticeCorrelator,
} from '../models/oscillatorReference';
import { segmentCorrelator } from '../observables/oscillatorCorrelator';
import { formatNumber } from '../plotting/PlotFrame';
import { OscillatorControls } from './OscillatorControls';
import { OscillatorTheory } from './OscillatorTheory';

type Curve = {
  label: string;
  color: string;
  points: [number, number][];
  dashed?: boolean;
};
type QmTool =
  | 'path'
  | 'correlator'
  | 'gap'
  | 'effective'
  | 'transfer'
  | 'reflection'
  | 'history';
const qmTools: ToolDefinition<QmTool>[] = [
  {
    id: 'path',
    title: 'Current periodic path',
    kind: 'Visualization',
    description: 'One configuration along Euclidean time.',
  },
  {
    id: 'correlator',
    title: 'Euclidean two-point correlator',
    kind: 'Plot',
    description: 'Exact, continuum and full-segment sampled curves.',
  },
  {
    id: 'gap',
    title: 'Finite-spacing and continuum gaps',
    kind: 'Analysis',
    description: 'Analytic lattice and continuum energy gaps.',
    featureable: false,
  },
  {
    id: 'effective',
    title: 'Effective gap and correlator table',
    kind: 'Analysis',
    description: 'Provisional sampled estimator with exact references.',
    featureable: false,
  },
  {
    id: 'transfer',
    title: 'Transfer operator and quadrature',
    kind: 'Analysis',
    description: 'Lazy finite-grid spectrum and normalization.',
  },
  {
    id: 'reflection',
    title: 'Reflection positivity',
    kind: 'Analysis',
    description: 'Finite covariance Gram illustration.',
    featureable: false,
  },
  {
    id: 'history',
    title: 'Recent path-average history',
    kind: 'Plot',
    description: 'Retained path averages versus Monte Carlo updates.',
  },
];
const colors = ['#574f9b', '#9d4363', '#587024', '#9b6917'];
type OscillatorSegment = FieldSegmentSnapshot & {
  settings: OscillatorFieldSettings;
};

/** Drawing reads worker snapshots only. It never samples or changes the RNG. */
function ScientificChart({
  title,
  curves,
  xMax,
  fixedY,
}: {
  title: string;
  curves: Curve[];
  xMax: number;
  fixedY?: number;
}) {
  const values = curves.flatMap((curve) =>
    curve.points.map((point) => point[1]),
  );
  const ymin = fixedY ? -fixedY : Math.min(0, ...values);
  const ymax = fixedY ? fixedY : Math.max(0.1, ...values);
  const span = ymax - ymin || 1;
  const x = (value: number) => 42 + (520 * value) / xMax;
  const y = (value: number) =>
    191 - (160 * (Math.max(ymin, Math.min(ymax, value)) - ymin)) / span;
  return (
    <section className="field-visual oscillator-chart" aria-label={title}>
      <h2>{title}</h2>
      <svg
        viewBox="0 0 600 225"
        role="img"
        aria-label={`${title}; horizontal axis is Euclidean time`}
      >
        <line x1="42" y1="191" x2="562" y2="191" stroke="#839991" />
        <line x1="42" y1="31" x2="42" y2="191" stroke="#839991" />
        <text x="2" y="34" fontSize="12">
          {formatNumber(ymax)}
        </text>
        <text x="2" y="191" fontSize="12">
          {formatNumber(ymin)}
        </text>
        <text x="39" y="217" fontSize="12">
          0
        </text>
        <text x="485" y="217" fontSize="12">
          t={formatNumber(xMax)}
        </text>
        {curves.map((curve) => (
          <polyline
            key={curve.label}
            points={curve.points
              .map(([time, value]) => `${x(time)},${y(value)}`)
              .join(' ')}
            fill="none"
            stroke={curve.color}
            strokeWidth="2.5"
            strokeDasharray={curve.dashed ? '6 5' : undefined}
          />
        ))}
      </svg>
      <div className="field-segment-legend">
        {curves.map((curve) => (
          <span key={curve.label} style={{ color: curve.color }}>
            ● {curve.label}
          </span>
        ))}
      </div>
    </section>
  );
}

function oscillatorSettings(
  p: OscillatorParameters,
  sampler: OscillatorFieldSettings['sampler'],
  warmupSweeps: number,
  strideSweeps: number,
): OscillatorFieldSettings {
  return {
    model: 'oscillator',
    oscillator: p,
    parameters: oscillatorField(p),
    sampler,
    warmupSweeps,
    strideSweeps,
  };
}

export function OscillatorView({
  view,
  client,
  chooseQuartic,
}: {
  view: FieldView;
  client: FieldClient | null;
  chooseQuartic: () => void;
}) {
  const [draft, setDraft] = useState<OscillatorConfiguration>(
    defaultOscillatorConfiguration,
  );
  const [seed, setSeed] = useState(String(defaultOscillatorConfiguration.seed));
  // Presentation options follow assignment keys across feature/gallery swaps.
  const [pathLimits, setPathLimits] = useState<Record<number, number>>({});
  const [effectiveLags, setEffectiveLags] = useState<Record<number, number>>(
    {},
  );
  const [notice, setNotice] = useState(
    'Draw a periodic path or Step one Monte Carlo update.',
  );
  const [error, setError] = useState<string | null>(null);
  const snapshot = view.snapshot;
  const segments =
    snapshot?.segments.filter(
      (segment): segment is OscillatorSegment =>
        segment.settings.model === 'oscillator',
    ) ?? [];
  const current = segments.at(-1);
  const p =
    current?.settings.oscillator ?? defaultOscillatorConfiguration.oscillator;
  const a = oscillatorSpacing(p);
  const busy = view.busy || !current;
  const sampled = current?.measurements
    ? segmentCorrelator(current.pairProducts)
    : null;

  function attempt(action: () => void, message: string) {
    try {
      action();
      setError(null);
      setNotice(message);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Invalid oscillator settings.',
      );
    }
  }
  function apply() {
    attempt(
      () => {
        const settings = oscillatorSettings(
          draft.oscillator,
          draft.sampler,
          draft.warmupSweeps,
          draft.strideSweeps,
        );
        if (settings.oscillator.sites !== p.sites)
          client?.initialize({ ...settings, seed: Number(seed) });
        else client?.change(settings);
      },
      draft.oscillator.sites !== p.sites
        ? 'N changed: a new seeded path session began; previous measurements were cleared.'
        : 'Physical or sampler settings changed: an isolated measurement segment began. The path and RNG continue.',
    );
  }
  function reset() {
    attempt(
      () => client?.initialize({ ...current!.settings, seed: Number(seed) }),
      'Reset cleared measurement history and restarted the applied path with the selected seed.',
    );
  }
  const exactCurve: Curve = {
    label: 'Exact finite lattice',
    color: '#14625a',
    points: Array.from({ length: Math.floor(p.sites / 2) + 1 }, (_, ell) => [
      ell * a,
      latticeCorrelator(p, ell),
    ]),
  };
  const continuumCurve: Curve = {
    label: 'Continuum thermal reference',
    color: '#a25721',
    dashed: true,
    points: Array.from({ length: 65 }, (_, i) => {
      const t = (i * p.beta) / 128;
      return [t, continuumCorrelator(p, t)];
    }),
  };
  const sampledCurves: Curve[] = segments
    .filter((segment) => segment.measurements > 0)
    .map((segment, index) => {
      const old = segment.settings.oscillator;
      const spacing = old.beta / old.sites;
      return {
        label: `Segment ${segment.id}: β=${old.beta}, ω=${old.omega}, n=${segment.measurements}`,
        color: colors[index % colors.length]!,
        dashed: true,
        points: segmentCorrelator(segment.pairProducts).map((value, ell) => [
          ell * spacing,
          value,
        ]),
      };
    });
  const historicalExactCurves: Curve[] = segments
    .slice(0, -1)
    .map((segment, index) => {
      const old = segment.settings.oscillator;
      const spacing = old.beta / old.sites;
      return {
        label: `Exact segment ${segment.id}: β=${old.beta}, ω=${old.omega}`,
        color: colors[index % colors.length]!,
        points: Array.from(
          { length: Math.floor(old.sites / 2) + 1 },
          (_, ell) => [ell * spacing, latticeCorrelator(old, ell)],
        ),
      };
    });
  const path = snapshot?.field ?? null;
  const pathCurve: Curve[] = path
    ? [
        {
          label: 'Current path; closing xₙ=x₀',
          color: '#14625a',
          points: [...path, path[0]!].map((value, j) => [j * a, value]),
        },
      ]
    : [];
  return (
    <>
      <a className="skip-link" href="#qm-laboratory">
        Skip to Lattice QM laboratory
      </a>
      <SiteHeader active="qm" />
      <main id="qm-laboratory" className="oscillator-workspace">
        <section className="intro" id="lattice-qm">
          <div>
            <p className="eyebrow">A numerical playground / 03</p>
            <h1>
              Euclidean paths. <span>Harmonic oscillator.</span>
            </h1>
            <p className="intro-copy">
              A periodic path is a Gaussian field in Euclidean time. Compare
              independent and local sampling with exact finite-spacing physics.
            </p>
          </div>
          <span className="milestone">M4b · Euclidean quantum mechanics</span>
        </section>
        <div className="qm-model-choice">
          <label>
            Quantum model{' '}
            <select
              aria-label="Quantum model"
              value="harmonic"
              onChange={chooseQuartic}
            >
              <option value="harmonic">Harmonic oscillator</option>
              <option value="quartic">Quartic / double-well oscillator</option>
            </select>
          </label>
          <span className="plot-note">
            Changing model starts a new seeded session.
          </span>
        </div>
        <div className="lab-layout field-layout">
          <OscillatorControls
            draft={draft}
            setDraft={setDraft}
            seed={seed}
            setSeed={setSeed}
            apply={apply}
            p={p}
            a={a}
          />
          <div className="field-main">
            <section
              className="field-run-panel"
              aria-label="Oscillator simulation controls"
            >
              <div className="section-heading">
                <h2>Periodic oscillator path</h2>
                <span className="parameter-chip">
                  N={p.sites} · β={p.beta} · ω={p.omega}
                </span>
              </div>
              <div className="field-run-buttons">
                <RunPauseControl
                  running={view.running}
                  busy={view.busy}
                  ready={!!current && !view.error}
                  run={() => client?.start()}
                  pause={() => client?.pause()}
                />
                <button
                  className="button"
                  type="button"
                  disabled={busy || view.running || !!view.error}
                  onClick={() => client?.step()}
                >
                  Step
                </button>
                <button
                  className="button"
                  type="button"
                  disabled={!current}
                  onClick={reset}
                >
                  Reset
                </button>
              </div>
              <div className="field-run-readings">
                <span>
                  Updates{' '}
                  <strong data-testid="oscillator-updates">
                    {snapshot?.updates ?? 0}
                  </strong>
                </span>
                <span>
                  Retained paths{' '}
                  <strong data-testid="oscillator-samples">
                    {current?.measurements ?? 0}
                  </strong>
                </span>
                <span>
                  Segment <strong>{current?.id ?? '—'}</strong>
                </span>
                <span>
                  Action S{' '}
                  <strong>{formatNumber(snapshot?.action ?? null)}</strong>
                </span>
              </div>
              <p className="run-notice">{error || view.error || notice}</p>
              <p className="plot-note">
                The horizontal path coordinate t is Euclidean time. Run and Step
                count algorithmic updates, not physical evolution.{' '}
                {current?.settings.sampler.kind === 'spectral'
                  ? 'One update draws an independent full path; acceptance and local sweeps are N/A.'
                  : `One nominal Monte Carlo sweep is ${p.sites} random-site updates. Warm-up and stride belong to this segment; local-chain measurements can be correlated.`}
              </p>
            </section>
            <ToolDeck
              title="Lattice QM tools"
              tools={qmTools}
              featuredDefault="path"
              defaults={['correlator']}
              onRemove={(key) => {
                setPathLimits((current) => {
                  const next = { ...current };
                  delete next[key];
                  return next;
                });
                setEffectiveLags((current) => {
                  const next = { ...current };
                  delete next[key];
                  return next;
                });
              }}
              renderTool={(tool, assignmentKey) => {
                if (tool === 'path') {
                  const limit = pathLimits[assignmentKey] ?? 3;
                  const clipped =
                    path?.filter((value) => Math.abs(value) > limit).length ??
                    0;
                  return (
                    <>
                      <div className="tool-options">
                        <label>
                          Fixed path range ±
                          <input
                            aria-label="Oscillator path range"
                            type="number"
                            min="0.1"
                            max="50"
                            step="any"
                            value={limit}
                            onChange={(event) => {
                              const value = Number(event.target.value);
                              if (value >= 0.1 && value <= 50)
                                setPathLimits((current) => ({
                                  ...current,
                                  [assignmentKey]: value,
                                }));
                            }}
                          />
                        </label>
                      </div>
                      <ScientificChart
                        title="Current periodic path x(t)"
                        curves={pathCurve}
                        xMax={p.beta}
                        fixedY={limit}
                      />
                      <p className="plot-note">
                        Fixed vertical scale ±{limit}; {clipped} path value
                        {clipped === 1 ? '' : 's'} clipped. The closing point at
                        t=β repeats x₀ and is not sampled separately.
                      </p>
                    </>
                  );
                }
                if (tool === 'correlator')
                  return (
                    <>
                      <ScientificChart
                        title="Euclidean two-point correlator C(t)"
                        curves={[
                          exactCurve,
                          continuumCurve,
                          ...historicalExactCurves,
                          ...sampledCurves,
                        ]}
                        xMax={
                          Math.max(
                            p.beta,
                            ...segments.map(
                              (segment) => segment.settings.oscillator.beta,
                            ),
                          ) / 2
                        }
                      />
                      <p className="plot-note">
                        Sampled curves are full-segment translation averages of
                        xⱼxⱼ₊ₗ without subtracting each path mean. Exact finite
                        lattice, continuum theory and each measurement segment
                        are distinct.
                      </p>
                    </>
                  );
                if (tool === 'history')
                  return snapshot ? (
                    <OscillatorHistory snapshot={snapshot} />
                  ) : (
                    <p>Wait for a path session.</p>
                  );
                const lag = Math.max(
                  1,
                  Math.min(
                    effectiveLags[assignmentKey] ?? 1,
                    Math.floor(p.sites / 2),
                  ),
                );
                return (
                  <>
                    {tool === 'effective' && (
                      <div className="tool-options">
                        <label>
                          Effective-gap lag ℓ
                          <input
                            aria-label="Oscillator effective-gap lag"
                            type="number"
                            min="1"
                            max={Math.floor(p.sites / 2)}
                            step="1"
                            value={lag}
                            onChange={(event) =>
                              setEffectiveLags((previous) => ({
                                ...previous,
                                [assignmentKey]: Number(event.target.value),
                              }))
                            }
                          />
                        </label>
                      </div>
                    )}
                    <OscillatorTheory
                      p={p}
                      sampled={sampled}
                      shownLag={lag}
                      measurements={current?.measurements ?? 0}
                      samplerKind={current?.settings.sampler.kind ?? 'spectral'}
                      panel={tool}
                    />
                  </>
                );
              }}
            />
            <details className="model-page-details">
              <summary>Technical details &amp; measurement coverage</summary>
              <div>
                <p>
                  Seed {snapshot?.seed ?? seed}; segment {current?.id ?? '—'}{' '}
                  began at update {current?.startUpdate ?? 0}.{' '}
                  {current?.warmupUpdates ?? 0} warm-up updates,{' '}
                  {current?.measurements ?? 0} retained paths,{' '}
                  {current?.discardedMeasurements ?? 0} older display vectors
                  evicted. Pair-product aggregates span the full retained
                  segment, while plotted paths are bounded. Changed physical
                  parameters start a separate measurement segment.
                </p>
                <p>
                  A fixed warm-up period does not prove equilibration. Sampled
                  effective gaps are provisional and have no nonlinear
                  uncertainty estimate. The finite-grid transfer calculation is
                  optional, lazy and labeled by its numerical quality.
                </p>
              </div>
            </details>
            <details className="model-page-details">
              <summary>
                Mathematics, exercises &amp; suggested experiments
              </summary>
              <div>
                <p>
                  The harmonic Hamiltonian H=p²/2+ω²x²/2 gives a periodic
                  Euclidean path action. The inverse temperature β is divided
                  among N time sites, so a=β/N. Euclidean separation along the
                  path is neither algorithmic update count nor physical real
                  time.
                </p>
                <p>
                  The finite-spacing lattice gap approaches the continuum gap ω
                  as a shrinks. The exact and sampled two-point correlators give
                  an effective-gap estimate; finite sampling can make its acosh
                  ratio unusable. The transfer-operator quadrature is a
                  finite-grid illustration with explicit quality warnings.
                  Reflection-positive covariance here is an illustration, not a
                  proof of all reconstruction axioms.
                </p>
                <ul>
                  <li>
                    Increase N at fixed β and compare finite-spacing and
                    continuum gaps.
                  </li>
                  <li>
                    Compare independent Fourier draws with local Metropolis or
                    heat bath.
                  </li>
                  <li>
                    Inspect effective-gap instability and under-resolved
                    transfer quadrature.
                  </li>
                </ul>
                <a href="https://github.com/gantemur/lattice/blob/main/docs/math/euclidean-oscillator.md">
                  Euclidean-oscillator mathematics ↗
                </a>
              </div>
            </details>
          </div>
        </div>
      </main>
    </>
  );
}
