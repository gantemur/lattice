import { useMemo } from 'react';
import type { FieldSampler } from '../algorithms/gaussianFieldSampler';
import type { OscillatorParameters } from '../models/oscillator';
import { oscillatorSpacing } from '../models/oscillator';
import {
  continuumCorrelator,
  latticeCorrelator,
  latticeGap,
  oscillatorPartition,
} from '../models/oscillatorReference';
import {
  assessTransferQuadrature,
  reflectionExample,
  transferLevels,
  transferQuadrature,
} from '../models/oscillatorTransfer';
import {
  assessSampledGap,
  minimumEffectiveGapPaths,
} from '../observables/oscillatorCorrelator';
import { formatNumber } from '../plotting/PlotFrame';
import { DisplayMath } from '../ui/Math';

export type OscillatorPanel = 'gap' | 'effective' | 'transfer' | 'reflection';
const quadratureCache = new Map<
  string,
  ReturnType<typeof transferQuadrature> | null
>();

/** This optional eigensolve is performed only after a transfer tool opens.
 * A bounded cache also survives a card collapse or rearrangement. */
function cachedQuadrature(p: OscillatorParameters) {
  const key = `${p.sites}:${p.beta}:${p.omega}`;
  if (quadratureCache.has(key)) return quadratureCache.get(key)!;
  let result: ReturnType<typeof transferQuadrature> | null;
  try {
    result = transferQuadrature(p);
  } catch {
    result = null;
  }
  if (quadratureCache.size >= 16)
    quadratureCache.delete(quadratureCache.keys().next().value!);
  quadratureCache.set(key, result);
  return result;
}

/** Analytical references remain separate from the finite-run correlator. */
export function OscillatorTheory({
  p,
  sampled,
  shownLag,
  measurements,
  samplerKind,
  panel,
}: {
  p: OscillatorParameters;
  sampled: number[] | null;
  shownLag: number;
  measurements: number;
  samplerKind: FieldSampler['kind'];
  panel: OscillatorPanel;
}) {
  const a = oscillatorSpacing(p);
  const gap = latticeGap(p);
  const partition = oscillatorPartition(p);
  const levels = transferLevels(p);
  const quadrature = useMemo(() => {
    return panel === 'transfer' ? cachedQuadrature(p) : null;
  }, [panel, p.sites, p.beta, p.omega]);
  const quality = assessTransferQuadrature(p, quadrature);
  const reflection = useMemo(
    () => (panel === 'reflection' ? reflectionExample(p) : null),
    [panel, p.sites, p.beta, p.omega],
  );
  const empiricalGap = assessSampledGap(
    sampled,
    measurements,
    shownLag,
    a,
    p.sites,
  );
  return (
    <>
      {panel === 'gap' && (
        <section className="field-results">
          <h2>Exact lattice and continuum gaps</h2>
          <div className="field-run-readings">
            <span>
              Exact lattice Ωₐ <strong>{formatNumber(gap)}</strong>
            </span>
            <span>
              Continuum ω <strong>{formatNumber(p.omega)}</strong>
            </span>
          </div>
          <p className="plot-note">
            Ωₐ=2 asinh(aω/2)/a is exact at this finite time spacing; ω is its
            continuum limit. Neither is a Monte Carlo estimate.
          </p>
          <p>At fixed β and ω, Ωₐ approaches ω as N grows:</p>
          <div className="field-segment-legend">
            {[4, 8, 16, 32, 64].map((sites) => (
              <span key={sites}>
                N={sites}: {formatNumber(latticeGap({ ...p, sites }))}
              </span>
            ))}
          </div>
        </section>
      )}
      {panel === 'effective' && (
        <section className="field-results">
          <h2>Energy gap from Euclidean correlations</h2>
          <div className="field-run-readings">
            <span>
              Continuum ω <strong>{formatNumber(p.omega)}</strong>
            </span>
            <span>
              Exact lattice Ωₐ <strong>{formatNumber(gap)}</strong>
            </span>
            <span>
              Provisional sampled Ωeff({shownLag}){' '}
              <strong data-testid="oscillator-effective-gap">
                {empiricalGap.value === null
                  ? 'N/A'
                  : formatNumber(empiricalGap.value)}
              </strong>
            </span>
          </div>
          <p
            className="plot-note"
            data-testid="oscillator-gap-status"
            role="status"
          >
            {empiricalGap.status === 'insufficient-samples'
              ? `N/A: insufficient samples (${measurements}/${minimumEffectiveGapPaths} retained paths).`
              : empiricalGap.status === 'invalid-ratio'
                ? `N/A: the sampled arcosh ratio is outside the real domain after ${measurements} retained paths.`
                : `Uncorrected plug-in estimate from ${measurements} retained paths; no nonlinear uncertainty is available.`}{' '}
            {samplerKind === 'spectral'
              ? 'Independent full-path draws still require enough measurements.'
              : 'Local paths may be autocorrelated; fixed warm-up does not certify equilibrium.'}
          </p>
          <p className="plot-note">
            Ωeff(ℓ)=acosh[(C(ℓ−1)+C(ℓ+1))/(2C(ℓ))]/a. The sampled correlator
            below is shown before the gap threshold; the exact finite-spacing
            lattice gap remains the reference. No gap uncertainty is inferred
            from one correlator standard error.
          </p>
          <div className="field-table-scroll">
            <table className="field-covariance">
              <thead>
                <tr>
                  <th>Lag ℓ</th>
                  <th>t=ℓa</th>
                  <th>Sampled</th>
                  <th>Exact lattice</th>
                  <th>Continuum</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(
                  { length: Math.floor(p.sites / 2) + 1 },
                  (_, ell) => (
                    <tr key={ell}>
                      <td>{ell}</td>
                      <td>{formatNumber(ell * a)}</td>
                      <td>{formatNumber(sampled?.[ell] ?? null)}</td>
                      <td>{formatNumber(latticeCorrelator(p, ell))}</td>
                      <td>{formatNumber(continuumCorrelator(p, ell * a))}</td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {panel === 'transfer' && (
        <section className="field-results">
          <h2>Transfer operator, normalization &amp; reflection positivity</h2>
          <p>
            The symmetric kernel represents e<sup>−aV/2</sup>e<sup>−ap²/2</sup>e
            <sup>−aV/2</sup>, not exact e<sup>−aH</sup>. Positivity follows from
            the operator factorization, not positive entries alone.
          </p>
          <DisplayMath>{String.raw`T_a(x,y)=\frac{e^{-(x-y)^2/(2a)-a[V(x)+V(y)]/2}}{\sqrt{2\pi a}}`}</DisplayMath>
          <div className="field-run-readings">
            <span>
              E₀,a <strong>{formatNumber(levels.ground)}</strong>
            </span>
            <span>
              E₁,a <strong>{formatNumber(levels.first)}</strong>
            </span>
            <span>
              Gap <strong>{formatNumber(gap)}</strong>
            </span>
            <span>
              Finite-grid gap (approximate){' '}
              <strong data-testid="oscillator-quadrature-gap">
                {quadrature?.gap === null || !quadrature
                  ? 'N/A'
                  : formatNumber(quadrature.gap)}
              </strong>
            </span>
          </div>
          <p
            className={`plot-note ${quality.status === 'usable' ? '' : 'oscillator-quality-warning'}`}
            data-testid="oscillator-quadrature-quality"
            role="status"
          >
            <strong>
              {quality.status === 'usable'
                ? 'Usable approximation.'
                : quality.status === 'under-resolved'
                  ? 'Under-resolved approximation.'
                  : 'Unavailable numerical result.'}
            </strong>{' '}
            {quadrature
              ? `${quadrature.nodes} coordinate nodes on [−${formatNumber(quadrature.cutoff)}, +${formatNumber(quadrature.cutoff)}]; `
              : ''}
            grid spacing {formatNumber(quality.gridSpacing)} versus kinetic
            width √a={formatNumber(quality.kineticWidth)}. Numerical leading
            eigenvalue {formatNumber(quadrature?.first ?? null)} versus exact{' '}
            {formatNumber(quality.exactLeadingEigenvalue)}. Gap discrepancy{' '}
            {quality.relativeGapDiscrepancy === null
              ? 'N/A'
              : `${formatNumber(quality.relativeGapDiscrepancy * 100)}%`}{' '}
            from exact Ωₐ={formatNumber(quality.exactGap)}.{' '}
            {quality.reasons.join(' ')} The analytic finite-spacing reference is
            authoritative; a poorly resolved grid does not invalidate the
            transfer theory.
          </p>
          <p>
            Raw Gaussian log Z: {formatNumber(partition.logRaw)}. Physical trace
            log Z<sub>QM</sub>: {formatNumber(partition.logQuantum)};
            independent transfer formula:{' '}
            {formatNumber(partition.logQuantumTransfer)}. The kinetic factor is
            (2πa)<sup>−N/2</sup>.
          </p>
          <p>At fixed β and ω, Ωₐ approaches ω as N grows:</p>
          <div className="field-segment-legend">
            {[4, 8, 16, 32, 64].map((sites) => (
              <span key={sites}>
                N={sites}: {formatNumber(latticeGap({ ...p, sites }))}
              </span>
            ))}
          </div>
        </section>
      )}
      {panel === 'reflection' && reflection && (
        <section className="field-results">
          <h2>Reflection-positivity illustration</h2>
          <p>
            Reflection covariance Gᵢⱼ=C(i+j) for positive half-circle indices{' '}
            {reflection.indices.join(', ')} has eigenvalues{' '}
            {reflection.eigenvalues.map(formatNumber).join(', ')}. Values at
            zero within {reflection.tolerance} are allowed. This numerical
            illustration is not a proof of the full Osterwalder–Schrader axioms;
            a sampled matrix can have small negative eigenvalues from noise.
          </p>
        </section>
      )}
    </>
  );
}
