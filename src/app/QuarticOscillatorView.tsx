import { useState } from 'react';
import { defaultQuarticConfiguration } from '../engine/fieldRun';
import type {
  QuarticConfiguration,
  QuarticFieldSettings,
  FieldSegmentSnapshot,
} from '../engine/fieldRun';
import {
  potentialMinimum,
  quarticPotential,
  quarticQuadraticPart,
  symmetricDoubleWell,
  validateQuarticOscillator,
} from '../models/quarticOscillator';
import {
  quarticCorrelationProjection,
  quarticEffectiveEnergy,
} from '../observables/quarticCorrelator';
import { formatNumber } from '../plotting/PlotFrame';
import { segmentColor } from '../plotting/viewport';
import { RunPauseControl } from './RunPauseControl';
import { SiteHeader } from './SiteHeader';
import { ToolDeck } from './ToolDeck';
import type { ToolDefinition } from './ToolDeck';
import { OscillatorHistory } from './OscillatorHistory';
import { useField } from './useField';
import { Chart, TransferTool } from './QuarticPlots';
import { QuarticOscillatorControls } from './QuarticOscillatorControls';

type QuarticTool =
  | 'path'
  | 'potential'
  | 'correlator'
  | 'transfer'
  | 'effective'
  | 'history'
  | 'transition';
const tools: ToolDefinition<QuarticTool>[] = [
  {
    id: 'path',
    title: 'Current periodic path',
    kind: 'Visualization',
    description: 'One configuration along Euclidean time.',
  },
  {
    id: 'potential',
    title: 'Applied physical potential',
    kind: 'Plot',
    description: 'Stationary points and classical barrier.',
  },
  {
    id: 'correlator',
    title: 'Euclidean path correlator',
    kind: 'Plot',
    description: 'Full-segment translation averages.',
  },
  {
    id: 'transfer',
    title: 'Transfer spectroscopy',
    kind: 'Analysis',
    description: 'Independent refined numerical quadrature.',
  },
  {
    id: 'effective',
    title: 'Sampled effective energies',
    kind: 'Analysis',
    description: 'Provisional local cosh indicators.',
    featureable: false,
  },
  {
    id: 'history',
    title: 'Path-average history',
    kind: 'Plot',
    description: 'Algorithmic update coordinates and sector changes.',
  },
  {
    id: 'transition',
    title: 'Local Metropolis inspection',
    kind: 'Analysis',
    description: 'Actual latest proposal and decision.',
    featureable: false,
  },
];
type QuarticSegment = FieldSegmentSnapshot & { settings: QuarticFieldSettings };
function quarticSettings(draft: QuarticConfiguration): QuarticFieldSettings {
  validateQuarticOscillator(draft.quartic);
  return {
    model: 'quartic-oscillator',
    quartic: { ...draft.quartic },
    parameters: quarticQuadraticPart(draft.quartic),
    sampler: { ...draft.sampler },
    warmupSweeps: draft.warmupSweeps,
    strideSweeps: draft.strideSweeps,
  };
}

export function QuarticOscillatorView({
  chooseHarmonic,
}: {
  chooseHarmonic: () => void;
}) {
  const { view, client } = useField(defaultQuarticConfiguration);
  const [draft, setDraft] = useState<QuarticConfiguration>(
    defaultQuarticConfiguration,
  );
  const [seed, setSeed] = useState(String(defaultQuarticConfiguration.seed));
  const [notice, setNotice] = useState(
    'The zero path is an initial configuration, not an equilibrium draw.',
  );
  const [error, setError] = useState<string | null>(null);
  const [pathRanges, setPathRanges] = useState<Record<number, number>>({});
  const [potentialRanges, setPotentialRanges] = useState<
    Record<number, number>
  >({});
  const [potentialYRanges, setPotentialYRanges] = useState<
    Record<number, number>
  >({});
  const snapshot = view.snapshot;
  const segments =
    snapshot?.segments.filter(
      (segment): segment is QuarticSegment =>
        segment.settings.model === 'quartic-oscillator',
    ) ?? [];
  const current = segments.at(-1);
  const p = current?.settings.quartic ?? defaultQuarticConfiguration.quartic;
  const a = p.beta / p.sites;
  const path = snapshot?.field ?? null;
  const busy = view.busy || !current;
  const projection = current?.measurements
    ? quarticCorrelationProjection(
        current.pairProducts,
        current.average.mean,
        p.h,
      )
    : null;

  function attempt(action: () => void, message: string) {
    try {
      action();
      setError(null);
      setNotice(message);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Invalid quartic settings.',
      );
    }
  }
  function apply() {
    attempt(
      () => {
        const settings = quarticSettings(draft);
        if (settings.quartic.sites !== p.sites)
          client.current?.initialize({ ...settings, seed: Number(seed) });
        else client.current?.change(settings);
      },
      draft.quartic.sites !== p.sites
        ? 'N changed: a new seeded path session began.'
        : 'Applied parameters began an isolated segment; path and RNG continue. Warm-up restarts.',
    );
  }
  function reset() {
    attempt(
      () =>
        client.current?.initialize({
          ...current!.settings,
          seed: Number(seed),
        }),
      'Reset restarted the applied model and cleared measurements.',
    );
  }
  const last = snapshot?.lastTrace;
  const well = symmetricDoubleWell(p);
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
              Euclidean paths. <span>Quartic oscillator.</span>
            </h1>
            <p className="intro-copy">
              Explore a single or double well with local Metropolis paths,
              full-segment correlations and independent transfer spectroscopy.
            </p>
          </div>
          <span className="milestone">
            M4c1 · Interacting quantum mechanics
          </span>
        </section>
        <div className="qm-model-choice">
          <label>
            Quantum model{' '}
            <select
              aria-label="Quantum model"
              value="quartic"
              onChange={chooseHarmonic}
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
          <QuarticOscillatorControls
            p={p}
            draft={draft}
            setDraft={setDraft}
            seed={seed}
            setSeed={setSeed}
            apply={apply}
          />
          <div className="field-main">
            <section
              className="field-run-panel"
              aria-label="Quartic simulation controls"
            >
              <div className="section-heading">
                <h2>Periodic interacting path</h2>
                <span className="parameter-chip">
                  N={p.sites} · β={p.beta} · a={formatNumber(a)}
                </span>
              </div>
              <div className="field-run-buttons">
                <RunPauseControl
                  running={view.running}
                  busy={view.busy}
                  ready={!!current && !view.error}
                  run={() => client.current?.start()}
                  pause={() => client.current?.pause()}
                />
                <button
                  className="button"
                  type="button"
                  disabled={busy || view.running || !!view.error}
                  onClick={() => client.current?.step()}
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
                  <strong data-testid="quartic-updates">
                    {snapshot?.updates ?? 0}
                  </strong>
                </span>
                <span>
                  Retained paths{' '}
                  <strong data-testid="quartic-samples">
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
              <p
                className="run-notice"
                role={error || view.error ? 'alert' : undefined}
              >
                {error || view.error || notice}
              </p>
              <p className="plot-note">
                Horizontal path coordinate t is Euclidean time; updates count
                Monte Carlo attempts, not physical time. One nominal sweep is{' '}
                {p.sites} random-site attempts. Acceptance includes warm-up.
              </p>
            </section>
            <ToolDeck
              title="Quartic QM tools"
              tools={tools}
              featuredDefault="path"
              defaults={['correlator', 'potential']}
              onRemove={(key) => {
                setPathRanges((old) => {
                  const next = { ...old };
                  delete next[key];
                  return next;
                });
                setPotentialRanges((old) => {
                  const next = { ...old };
                  delete next[key];
                  return next;
                });
                setPotentialYRanges((old) => {
                  const next = { ...old };
                  delete next[key];
                  return next;
                });
              }}
              renderTool={(tool, key) => {
                if (tool === 'path') {
                  const limit = pathRanges[key] ?? 3;
                  const clipped =
                    path?.filter((value) => Math.abs(value) > limit).length ??
                    0;
                  return (
                    <>
                      <label className="tool-options">
                        Fixed path range ±{' '}
                        <input
                          aria-label="Quartic path range"
                          type="number"
                          min="0.1"
                          max="50"
                          step="any"
                          value={limit}
                          onChange={(event) => {
                            const value = Number(event.target.value);
                            if (value >= 0.1 && value <= 50)
                              setPathRanges((old) => ({
                                ...old,
                                [key]: value,
                              }));
                          }}
                        />
                      </label>
                      <Chart
                        title="Current periodic path x(t)"
                        curves={
                          path
                            ? [
                                {
                                  label: 'Current path; closing xₙ=x₀',
                                  color: '#14625a',
                                  points: [...path, path[0]!].map(
                                    (value, j) => [j * a, value],
                                  ),
                                },
                              ]
                            : []
                        }
                        xMin={0}
                        xMax={p.beta}
                        yLimit={limit}
                        xLabel="t="
                      />
                      <p className="plot-note">
                        Fixed ±{limit}; {clipped} sampled coordinates clipped.
                        Endpoint at β repeats x₀ and is not sampled twice.
                      </p>
                    </>
                  );
                }
                if (tool === 'potential') {
                  const range = potentialRanges[key] ?? 4;
                  const yRange = potentialYRanges[key] ?? 20;
                  const minimum = potentialMinimum(p);
                  const curve = Array.from({ length: 161 }, (_, i) => {
                    const x = -range + (2 * range * i) / 160;
                    return [x, quarticPotential(p, x)] as [number, number];
                  });
                  return (
                    <>
                      <label className="tool-options">
                        Potential x range ±{' '}
                        <input
                          aria-label="Quartic potential range"
                          type="number"
                          min="1"
                          max="20"
                          step="any"
                          value={range}
                          onChange={(event) => {
                            const value = Number(event.target.value);
                            if (value >= 1 && value <= 20)
                              setPotentialRanges((old) => ({
                                ...old,
                                [key]: value,
                              }));
                          }}
                        />
                      </label>
                      <label className="tool-options">
                        Fixed V range ±{' '}
                        <input
                          aria-label="Quartic potential vertical range"
                          type="number"
                          min="0.1"
                          max="1000"
                          step="any"
                          value={yRange}
                          onChange={(event) => {
                            const value = Number(event.target.value);
                            if (value >= 0.1 && value <= 1000)
                              setPotentialYRanges((old) => ({
                                ...old,
                                [key]: value,
                              }));
                          }}
                        />
                      </label>
                      <Chart
                        title="Applied potential V(x)"
                        curves={[
                          { label: 'V(x)', color: '#9d4363', points: curve },
                        ]}
                        xMin={-range}
                        xMax={range}
                        yLimit={yRange}
                        xLabel="x="
                      />
                      <p>
                        Global minimum at x={formatNumber(minimum.x)}, Vmin=
                        {formatNumber(minimum.value)}.{' '}
                        {well &&
                          `Symmetric classical minima ±${formatNumber(well.minima[1] ?? null)}; barrier height ${formatNumber(well.barrier)}.`}
                      </p>
                      <p className="plot-note">
                        Fixed V range ±{yRange};{' '}
                        {
                          curve.filter((point) => Math.abs(point[1]) > yRange)
                            .length
                        }{' '}
                        curve points clipped. A classical barrier is not the
                        quantum gap. Off-screen stationary points are clipped by
                        the chosen x range.
                      </p>
                    </>
                  );
                }
                if (tool === 'correlator') {
                  const curves = segments
                    .filter((segment) => segment.measurements > 0)
                    .flatMap((segment) => {
                      const old = segment.settings.quartic;
                      const projection = quarticCorrelationProjection(
                        segment.pairProducts,
                        segment.average.mean,
                        old.h,
                      );
                      const raw = {
                        label: `Segment ${segment.id}: β=${old.beta}, r=${old.r}, λ=${old.lambda}, h=${old.h}, n=${segment.measurements} raw`,
                        color: segmentColor(segment.id),
                        points: projection.raw.map(
                          (value, lag) =>
                            [(lag * old.beta) / old.sites, value] as [
                              number,
                              number,
                            ],
                        ),
                      };
                      if (old.h === 0 || !projection.connected) return [raw];
                      return [
                        raw,
                        {
                          label: `Segment ${segment.id}: connected sample-mean plug-in`,
                          color: segmentColor(segment.id),
                          dashed: true,
                          points: projection.connected.map(
                            (value, lag) =>
                              [(lag * old.beta) / old.sites, value] as [
                                number,
                                number,
                              ],
                          ),
                        },
                      ];
                    });
                  return (
                    <>
                      <Chart
                        title="Euclidean C(t): raw and connected"
                        curves={curves}
                        xMin={0}
                        xMax={
                          Math.max(
                            p.beta,
                            ...segments.map(
                              (segment) => segment.settings.quartic.beta,
                            ),
                          ) / 2
                        }
                        xLabel="t="
                      />
                      <p className="plot-note">
                        Craw(ℓ)=N⁻¹Σⱼ〈xⱼxⱼ₊ₗ〉 uses all retained paths in each
                        segment. No individual path is demeaned. At h=0 exact
                        reflection symmetry makes this the connected equilibrium
                        correlator, even if a finite chain remains in one well.
                      </p>
                      {segments.some(
                        (segment) => segment.settings.quartic.h !== 0,
                      ) && (
                        <p>
                          Nonzero-h segments also show dashed connected
                          sample-mean plug-in curves. Current connected C(0)=
                          {formatNumber(projection?.connected?.[0] ?? null)},
                          using the full-segment translational sample mean{' '}
                          {formatNumber(current?.average.mean ?? null)}. This
                          centering may be biased by autocorrelation or poor
                          mixing.
                        </p>
                      )}
                    </>
                  );
                }
                if (tool === 'transfer') return <TransferTool p={p} />;
                if (tool === 'history')
                  return snapshot ? (
                    <>
                      <OscillatorHistory snapshot={snapshot} />
                      {well && current && (
                        <p>
                          Retained path-average signs:{' '}
                          {current.positiveAveragePaths} positive,{' '}
                          {current.negativeAveragePaths} negative,{' '}
                          {current.zeroAveragePaths} zero;{' '}
                          {current.observedSignChanges} observed sign changes
                          between retained paths. Cadence: one path per{' '}
                          {current.settings.strideSweeps} nominal sweeps after
                          warm-up. Intermediate changes may be missed. This is
                          an algorithmic sector diagnostic, not a physical
                          tunneling rate.
                        </p>
                      )}
                      <p>
                        Accepted {current?.accepted ?? 0}; rejected{' '}
                        {current?.rejected ?? 0} proposals, including warm-up.
                      </p>
                    </>
                  ) : (
                    <p>Wait for the path session.</p>
                  );
                if (tool === 'effective') {
                  return (
                    <section className="field-results">
                      <h2>Provisional effective energies</h2>
                      <p>
                        64 retained paths is a presentation threshold, not an
                        equilibration certificate.{' '}
                        {p.h === 0
                          ? 'Raw correlator preserves exact reflection symmetry.'
                          : 'Connected plug-in subtraction uses the sample mean and can be unstable.'}
                      </p>
                      <table className="field-covariance">
                        <thead>
                          <tr>
                            <th>Euclidean lag</th>
                            <th>Local cosh indicator</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Array.from(
                            { length: Math.floor(p.sites / 2) },
                            (_, i) => i + 1,
                          ).map((lag) => {
                            const result = quarticEffectiveEnergy(
                              projection,
                              current?.measurements ?? 0,
                              lag,
                              a,
                              p.sites,
                            );
                            return (
                              <tr key={lag}>
                                <th>{formatNumber(lag * a)}</th>
                                <td>{formatNumber(result.value)}</td>
                                <td>{result.status}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      <p className="plot-note">
                        A finite positive ratio is necessary; no automatic
                        plateau fit or nonlinear error bar is claimed. Higher
                        states and finite β can change the indicator. Warm-up
                        does not prove mixing; a small splitting may need more β
                        and sampling effort.
                      </p>
                    </section>
                  );
                }
                return (
                  <section className="field-results">
                    <h2>Latest Metropolis update</h2>
                    {last ? (
                      <p>
                        Update {last.update}, segment {last.segmentId},{' '}
                        {last.warmup ? 'warm-up' : 'post-warm-up'}: site{' '}
                        {last.site}, old {formatNumber(last.before)}, proposal{' '}
                        {formatNumber(last.proposed)}, actual{' '}
                        {formatNumber(last.after)}, proposed ΔS{' '}
                        {formatNumber(last.deltaAction)}, α{' '}
                        {formatNumber(last.acceptanceProbability)}, decision u{' '}
                        {formatNumber(last.decisionUniform)};{' '}
                        <strong>{last.outcome}</strong>.
                      </p>
                    ) : (
                      <p>Step or Run to inspect an actual proposal.</p>
                    )}
                    <p className="plot-note">
                      A rejected proposal leaves the path unchanged. The three
                      seeded uniforms select site, proposal and decision in that
                      order.
                    </p>
                  </section>
                );
              }}
            />
            <details className="model-page-details">
              <summary>Technical details &amp; measurement coverage</summary>
              <p>
                Seed {snapshot?.seed ?? seed}; segment {current?.id ?? '—'}{' '}
                began at update {current?.startUpdate ?? 0}.{' '}
                {current?.warmupUpdates ?? 0} warm-up updates;{' '}
                {current?.measurements ?? 0} retained paths;{' '}
                {current?.discardedMeasurements ?? 0} recent vectors evicted. At
                most eight segments and 256 recent paths per segment are
                retained. Scalar and pair-product aggregates span each full
                segment.
              </p>
              <p>
                Local measurements are correlated. A fixed warm-up budget does
                not prove equilibrium. Transfer quadrature is independent of the
                MC worker and has separate resolution checks.
              </p>
            </details>
            <details className="model-page-details">
              <summary>
                Mathematics, exercises &amp; suggested experiments
              </summary>
              <p>
                Compare λ=0 with the analytic displaced oscillator, then
                introduce λ&gt;0 and negative r. At h=0 inspect raw C(t) even if
                a trajectory remains in one well. With h≠0 compare raw and
                connected plug-in values. Vary N at fixed β to distinguish
                finite-spacing from continuum effects.
              </p>
              <p>
                Quantum energy splitting comes from the physical transfer
                operator; Monte Carlo metastability concerns the chosen update
                algorithm. These are different spectral and dynamical questions.
              </p>
              <a href="https://github.com/gantemur/lattice/blob/main/docs/math/interacting-oscillator.md">
                Interacting-oscillator mathematics ↗
              </a>
            </details>
          </div>
        </div>
      </main>
    </>
  );
}
