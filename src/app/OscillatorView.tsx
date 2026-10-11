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
  onBack,
}: {
  view: FieldView;
  client: FieldClient | null;
  onBack: () => void;
}) {
  const [draft, setDraft] = useState<OscillatorConfiguration>(
    defaultOscillatorConfiguration,
  );
  const [seed, setSeed] = useState(String(defaultOscillatorConfiguration.seed));
  const [limit, setLimit] = useState(3);
  const [lag, setLag] = useState(1);
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
  const shownLag = Math.max(1, Math.min(lag, Math.floor(p.sites / 2)));

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
  const clipped = path?.filter((value) => Math.abs(value) > limit).length ?? 0;

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
      <main id="field-laboratory" className="oscillator-workspace">
        <section className="intro" id="fields-paths">
          <div>
            <p className="eyebrow">A numerical playground / 03</p>
            <h1>
              Euclidean paths. <span>Harmonic oscillator.</span>
            </h1>
            <p className="intro-copy">
              A periodic path is a Gaussian field in Euclidean time. Compare
              independent and local sampling with exact finite-spacing physics.
            </p>
            <button className="button" type="button" onClick={onBack}>
              Gaussian fields mode
            </button>
          </div>
          <span className="milestone">M4b · Euclidean quantum mechanics</span>
        </section>
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
                <button
                  className="button"
                  type="button"
                  disabled={busy || view.running}
                  onClick={() => client?.start()}
                >
                  Run
                </button>
                <button
                  className="button"
                  type="button"
                  disabled={!view.running}
                  onClick={() => client?.pause()}
                >
                  Pause
                </button>
                <button
                  className="button"
                  type="button"
                  disabled={busy || view.running}
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
            <div className="field-display-controls">
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
                    const number = Number(event.target.value);
                    if (number >= 0.1 && number <= 50) setLimit(number);
                  }}
                />
              </label>
              <label>
                Effective-gap lag ℓ
                <input
                  aria-label="Oscillator effective-gap lag"
                  type="number"
                  min="1"
                  max={Math.floor(p.sites / 2)}
                  step="1"
                  value={shownLag}
                  onChange={(event) => setLag(Number(event.target.value))}
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
              {clipped === 1 ? '' : 's'} clipped. The closing point at t=β
              repeats x₀ and is not sampled separately.
            </p>
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
              Sampled curves are full-segment translation averages of xⱼxⱼ₊ₗ
              without subtracting each path mean. Exact finite lattice,
              continuum theory and each measurement segment are distinct.
            </p>
            <OscillatorTheory p={p} sampled={sampled} shownLag={shownLag} />
            <p className="plot-note">
              Seed {snapshot?.seed ?? seed}; segment {current?.id ?? '—'} began
              at update {current?.startUpdate ?? 0}.{' '}
              {current?.warmupUpdates ?? 0} warm-up updates,{' '}
              {current?.measurements ?? 0} retained paths,{' '}
              {current?.discardedMeasurements ?? 0} recent display vectors
              evicted. Pair-product aggregates still span the whole retained
              segment. A fixed warm-up period does not prove equilibration.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
