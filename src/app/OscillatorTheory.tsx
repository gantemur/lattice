import { useMemo } from 'react';
import type { OscillatorParameters } from '../models/oscillator';
import { oscillatorSpacing } from '../models/oscillator';
import {
  continuumCorrelator,
  latticeCorrelator,
  latticeGap,
  oscillatorPartition,
} from '../models/oscillatorReference';
import {
  reflectionExample,
  transferLevels,
  transferQuadrature,
} from '../models/oscillatorTransfer';
import { effectiveGap } from '../observables/oscillatorCorrelator';
import { formatNumber } from '../plotting/PlotFrame';
import { DisplayMath } from '../ui/Math';

/** Analytical references remain separate from the finite-run correlator. */
export function OscillatorTheory({
  p,
  sampled,
  shownLag,
}: {
  p: OscillatorParameters;
  sampled: number[] | null;
  shownLag: number;
}) {
  const a = oscillatorSpacing(p);
  const gap = latticeGap(p);
  const partition = oscillatorPartition(p);
  const levels = transferLevels(p);
  const quadrature = useMemo(
    () => transferQuadrature(p),
    [p.sites, p.beta, p.omega],
  );
  const reflection = useMemo(
    () => reflectionExample(p),
    [p.sites, p.beta, p.omega],
  );
  const empiricalGap = sampled
    ? effectiveGap(sampled, shownLag, a, p.sites)
    : null;
  return (
    <>
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
            Sampled Ωeff({shownLag}){' '}
            <strong data-testid="oscillator-effective-gap">
              {formatNumber(empiricalGap)}
            </strong>
          </span>
        </div>
        <p className="plot-note">
          Ωeff(ℓ)=acosh[(C(ℓ−1)+C(ℓ+1))/(2C(ℓ))]/a. N/A means too few
          measurements or a noisy ratio outside the real domain. No uncertainty
          is inferred from one correlator standard error.
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
              {Array.from({ length: Math.floor(p.sites / 2) + 1 }, (_, ell) => (
                <tr key={ell}>
                  <td>{ell}</td>
                  <td>{formatNumber(ell * a)}</td>
                  <td>{formatNumber(sampled?.[ell] ?? null)}</td>
                  <td>{formatNumber(latticeCorrelator(p, ell))}</td>
                  <td>{formatNumber(continuumCorrelator(p, ell * a))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <details className="field-results">
        <summary>
          Transfer operator, normalization &amp; reflection positivity
        </summary>
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
            Finite-grid gap <strong>{formatNumber(quadrature.gap)}</strong>
          </span>
        </div>
        <p className="plot-note">
          Finite coordinate-grid trapezoid quadrature: {quadrature.nodes} nodes
          on [−{formatNumber(quadrature.cutoff)}, +
          {formatNumber(quadrature.cutoff)}]. Its gap is approximate; Ωₐ is the
          analytic finite-spacing reference.
        </p>
        <p>
          Raw Gaussian log Z: {formatNumber(partition.logRaw)}. Physical trace
          log Z<sub>QM</sub>: {formatNumber(partition.logQuantum)}; independent
          transfer formula: {formatNumber(partition.logQuantumTransfer)}. The
          kinetic factor is (2πa)<sup>−N/2</sup>.
        </p>
        <p>At fixed β and ω, Ωₐ approaches ω as N grows:</p>
        <div className="field-segment-legend">
          {[4, 8, 16, 32, 64].map((sites) => (
            <span key={sites}>
              N={sites}: {formatNumber(latticeGap({ ...p, sites }))}
            </span>
          ))}
        </div>
        <p>
          Reflection covariance Gᵢⱼ=C(i+j) for positive half-circle indices{' '}
          {reflection.indices.join(', ')} has eigenvalues{' '}
          {reflection.eigenvalues.map(formatNumber).join(', ')}. Values at zero
          within {reflection.tolerance} are allowed. This numerical illustration
          is not a proof of the full Osterwalder–Schrader axioms; a sampled
          matrix can have small negative eigenvalues from noise.
        </p>
      </details>
    </>
  );
}
