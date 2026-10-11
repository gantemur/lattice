import { useMemo, useState } from 'react';
import type { LatticeSegmentSnapshot } from '../engine/latticeRun';
import type { SegmentSnapshot } from '../engine/protocol';
import type { IsingModel } from '../models/ising';
import {
  exactMarkovDiagnostics,
  graphIsingKernel,
  graphObservableValues,
  latticeTwoByTwoKernel,
  latticeTwoByTwoObservableValues,
} from '../models/isingMarkov';
import type {
  ExactMarkovDiagnostics,
  SmallSampler,
} from '../models/isingMarkov';
import type {
  DiagnosticSummary,
  DiagnosticTarget,
} from '../observables/statisticalDiagnostics';
import { DIAGNOSTIC_CAPACITY } from '../observables/statisticalDiagnostics';
import { AutocorrelationPlot, BlockingPlot } from '../plotting/DiagnosticPlots';
import { formatNumber } from '../plotting/PlotFrame';

function Readout({
  diagnostic,
  exact,
  label,
  fullSamples,
}: {
  diagnostic: DiagnosticSummary;
  exact: ExactMarkovDiagnostics | null;
  label: string;
  fullSamples: number;
}) {
  const cadence = diagnostic.cadence;
  const observationUnit =
    cadence.kind === 'direct'
      ? 'independent draws'
      : cadence.kind === 'local'
        ? 'elementary updates'
        : 'retained measurements';
  const tauLabel =
    cadence.kind === 'lattice'
      ? 'τ_int · retained measurements'
      : cadence.kind === 'local'
        ? 'τ_int · observations = elementary updates'
        : 'τ_int · observations = independent draws';
  return (
    <>
      <p data-testid="diagnostic-status">
        <strong>{diagnostic.status}</strong> · {diagnostic.message}
      </p>
      {diagnostic.warnings.length > 0 && (
        <p className="plot-note">{diagnostic.warnings.join(' ')}</p>
      )}
      <div className="transition-grid">
        <div>
          <dt>Observable</dt>
          <dd>{label}</dd>
        </div>
        <div>
          <dt>Recent observations / full segment</dt>
          <dd data-testid="diagnostic-coverage">
            {diagnostic.used} / {fullSamples}
          </dd>
        </div>
        <div>
          <dt>Measurement interval</dt>
          <dd>
            {cadence.kind === 'lattice'
              ? `${cadence.sweepsPerObservation} nominal sweep(s)`
              : cadence.kind === 'local'
                ? '1 elementary site update'
                : '1 whole-configuration draw'}
          </dd>
        </div>
        <div>
          <dt>{tauLabel}</dt>
          <dd data-testid="diagnostic-tau">
            {formatNumber(diagnostic.tauMeasurements)}
          </dd>
        </div>
        <div>
          <dt>τ_int · nominal sweeps</dt>
          <dd data-testid="diagnostic-tau-sweeps">
            {cadence.kind === 'direct'
              ? 'N/A for independent draws'
              : formatNumber(diagnostic.tauSweeps)}
          </dd>
        </div>
        <div>
          <dt>Recent-window ESS</dt>
          <dd>{formatNumber(diagnostic.ess)}</dd>
        </div>
        <div>
          <dt>SE of recent-window mean</dt>
          <dd>{formatNumber(diagnostic.standardError)}</dd>
        </div>
        <div>
          <dt>Summation window W / maximum lag</dt>
          <dd>
            {diagnostic.window} / {diagnostic.maximumLag}
          </dd>
        </div>
      </div>
      <p className="plot-note">
        Analysis uses consecutive retained measurements{' '}
        {diagnostic.firstMeasurement}–{diagnostic.lastMeasurement};{' '}
        {Math.max(0, fullSamples - diagnostic.used)} older diagnostic
        observations fall outside the analyzed window or arrived since the last
        refresh. {Math.max(0, fullSamples - DIAGNOSTIC_CAPACITY)} have been
        evicted from the {DIAGNOSTIC_CAPACITY}-observation record. Full-segment
        online moments remain separate. Results refresh on measurement-count
        milestones, so the latest segment count can exceed the analyzed count.
        No uncertainty is attached to the longer full-segment mean.
      </p>
      {(diagnostic.acf.length > 0 || exact?.status === 'ok') && (
        <>
          <AutocorrelationPlot
            diagnostic={diagnostic}
            exact={exact?.status === 'ok' ? exact.acf : undefined}
          />
          <p className="plot-note">
            Teal: empirical recent-window ρ(k). Purple: exact finite-state
            equilibrium ρ(k), where available. Orange: empirical summation
            window. Lag is in retained measurements.
          </p>
        </>
      )}
      {diagnostic.blocking.length > 0 && (
        <details>
          <summary>Blocking cross-check</summary>
          <BlockingPlot diagnostic={diagnostic} />
          <p className="plot-note">
            Nonoverlapping blocks of 1, 2, 4, … observations; incomplete
            remainder omitted. At least 16 blocks per point. A short record does
            not establish a blocking plateau.
          </p>
        </details>
      )}
      {exact && (
        <div data-testid="exact-markov">
          <h3>Exact finite-state chain</h3>
          {exact.status === 'ok' ? (
            <p>
              Exact τ_int at this measurement cadence:{' '}
              <strong>{formatNumber(exact.tauMeasurements)}</strong>{' '}
              {observationUnit} · exact asymptotic variance{' '}
              {formatNumber(exact.asymptoticVariance)} ·{' '}
              {cadence.kind === 'direct' ? 'per-draw' : 'elementary-update'}{' '}
              spectral gap {formatNumber(exact.gap)}. These stationary
              quantities are not evidence that this run has equilibrated.
            </p>
          ) : (
            <p>
              {exact.status}: {exact.message}
            </p>
          )}
          {exact.eigenvalues.length > 0 && (
            <details>
              <summary>Nontrivial eigenvalues of the one-update kernel</summary>
              <p className="plot-note">
                {exact.eigenvalues.slice(1).map(formatNumber).join(', ')}
              </p>
            </details>
          )}
        </div>
      )}
      <p className="plot-note">
        The empirical estimator uses γ(k) with the recent-window mean and
        denominator n−k. It checks paired autocovariances γ(0)+γ(1), γ(2)+γ(3),
        …, then seeks the first complete-pair window W≥5τ(W), capped at 128 lags
        and n/10. A nonpositive pair before that window leaves τ, ESS and SE
        unresolved unless at least five positive lags support a provisional W≥3τ
        estimate. ESS=min(n,n/(2τ)); SE=√(2τ·sample-variance/n), using n−1 for
        sample variance. Drift, an unresolved tail, zero variance or too few
        samples can make these unavailable. Warm-up bias, finite volume and
        observed error against exact theory are separate questions.
      </p>
    </>
  );
}

const labels: Record<DiagnosticTarget, string> = {
  m: 'm',
  absM: '|m|',
  e: 'e = H/N',
};

export function LatticeStatisticalDiagnostics({
  segment,
}: {
  segment: LatticeSegmentSnapshot;
}) {
  const [target, setTarget] = useState<DiagnosticTarget>('m');
  const p = segment.settings.parameters;
  const key = JSON.stringify([
    p,
    segment.settings.sampler,
    segment.settings.strideSweeps,
    target,
  ]);
  const exact = useMemo(() => {
    if (p.lx !== 2 || p.ly !== 2) return null;
    const kernel = latticeTwoByTwoKernel(p, segment.settings.sampler);
    return exactMarkovDiagnostics(
      kernel,
      latticeTwoByTwoObservableValues(p, target),
      4 * segment.settings.strideSweeps,
    );
  }, [key]);
  return (
    <details
      className="moments-panel"
      aria-label="Statistical Diagnostics"
      data-testid="lattice-diagnostics"
    >
      <summary>
        Statistical Diagnostics · recent-window MCMC reliability
      </summary>
      <label>
        Observable{' '}
        <select
          aria-label="Diagnostic observable"
          value={target}
          onChange={(e) => setTarget(e.target.value as DiagnosticTarget)}
        >
          <option value="m">m</option>
          <option value="absM">|m|</option>
          <option value="e">e = H/N</option>
        </select>
      </label>
      <Readout
        diagnostic={segment.diagnostics[target]}
        exact={exact}
        label={labels[target]}
        fullSamples={segment.samples}
      />
    </details>
  );
}

export function SmallIsingStatisticalDiagnostics({
  segment,
}: {
  segment: SegmentSnapshot;
}) {
  const [target, setTarget] = useState<DiagnosticTarget>('m');
  const model = segment.model as IsingModel;
  const sampler = segment.sampler.kind as SmallSampler;
  const key = JSON.stringify([model.parameters, sampler, target]);
  const exact = useMemo(() => {
    const kernel = graphIsingKernel(model, sampler);
    const values = graphObservableValues(
      model,
      target === 'e' ? 'E' : target,
    ).map((v) =>
      target === 'absM' ? v / model.parameters.domain.vertices.length : v,
    );
    return exactMarkovDiagnostics(kernel, values, 1);
  }, [key]);
  if (!segment.ising) return null;
  return (
    <details
      className="moments-panel"
      aria-label="Exact and empirical Markov diagnostics"
      data-testid="small-ising-diagnostics"
    >
      <summary>Exact and empirical Markov diagnostics</summary>
      <label>
        Observable{' '}
        <select
          aria-label="Small Ising diagnostic observable"
          value={target}
          onChange={(e) => setTarget(e.target.value as DiagnosticTarget)}
        >
          <option value="m">m</option>
          <option value="absM">|m|</option>
          <option value="e">E = S</option>
        </select>
      </label>
      <Readout
        diagnostic={segment.ising.diagnostics[target]}
        exact={exact}
        label={target === 'e' ? 'E = S' : labels[target]}
        fullSamples={segment.moments.count}
      />
    </details>
  );
}
