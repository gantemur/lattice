import { useMemo } from 'react';
import type { FieldSegmentSnapshot } from '../engine/fieldRun';
import type { Phi4FieldParameters } from '../models/phi4Field';
import {
  decoupledPhi4Reference,
  spatialQmMapping,
} from '../models/phi4Reference';
import type { QuarticOscillatorParameters } from '../models/quarticOscillator';
import { useQuarticTransfer } from './useQuarticTransfer';
import { Chart } from './QuarticPlots';
import { formatNumber as f } from '../plotting/PlotFrame';

/** Mounted only for an open reference assignment. The independent transfer
 * worker/cache has no access to FieldClient or its random-number stream. */
export function Phi4Reference({
  p,
  segment,
}: {
  p: Phi4FieldParameters;
  segment: FieldSegmentSnapshot;
}) {
  const independent = useMemo(() => {
    if (p.kappaX !== 0 || p.kappaY !== 0) return null;
    try {
      return { value: decoupledPhi4Reference(p), error: null };
    } catch (cause) {
      return {
        value: null,
        error: cause instanceof Error ? cause.message : String(cause),
      };
    }
  }, [JSON.stringify(p)]);
  if (p.lambda === 0 && segment.reference) {
    const ref = segment.reference;
    return (
      <section className="field-results">
        <h2>Analytic finite-volume Gaussian limit</h2>
        <p>
          λ=0 exactly: μ₀={f(ref.mean[0]!)}, C₀₀={f(ref.covariance[0]![0]!)},
          raw 〈φ₀φ₁〉={f(ref.covariance[0]![1]! + ref.mean[0]! * ref.mean[1]!)}
          ; log Z={f(ref.logPartition)}. Product Lebesgue normalization; no
          interacting approximation.
        </p>
      </section>
    );
  }
  if (independent)
    return (
      <section className="field-results">
        <h2>Independent-site numerical quadrature</h2>
        {independent.value ? (
          <>
            <p>
              Single-site mean {f(independent.value.site.mean)}, second moment{' '}
              {f(independent.value.site.secondMoment)}, fourth moment{' '}
              {f(independent.value.site.fourthMoment)}, variance{' '}
              {f(independent.value.site.variance)}.
            </p>
            <p>
              log Z per site {f(independent.value.site.logPartition)}; lattice
              log Z {f(independent.value.logPartition)}; distinct-site raw
              product {f(independent.value.distinctPair)}.
            </p>
            <p>
              Integration interval [{independent.value.site.domain.join(', ')}];
              relative tail bound through fourth moments{' '}
              {independent.value.site.tailBound.toExponential(2)}. Adaptive
              quadrature, not an analytic interacting result.
            </p>
          </>
        ) : (
          <p>Reference unavailable: {independent.error}</p>
        )}
      </section>
    );
  const mapping = spatialQmMapping(p);
  return mapping.parameters ? (
    <SpatialTransfer parameters={mapping.parameters} />
  ) : (
    <section className="field-results">
      <h2>Independent reference unavailable</h2>
      <p>
        {mapping.reason} No Gaussian covariance is assigned to this interacting
        field.
      </p>
    </section>
  );
}
function SpatialTransfer({
  parameters,
}: {
  parameters: QuarticOscillatorParameters;
}) {
  const { result, error } = useQuarticTransfer(parameters);
  const grid = result?.grids[2];
  const a = parameters.beta / parameters.sites;
  const xi =
    result?.gap && result.status === 'resolved' ? 1 / (a * result.gap) : null;
  const ratio =
    grid && grid.leading.length > 1
      ? grid.leading[1]! / grid.leading[0]!
      : null;
  return (
    <section className="field-results" aria-label="Spatial transfer reference">
      <h2>Numerical finite-ring transfer reference</h2>
      {!result && !error && (
        <p role="status">
          Computing three coordinate grids in an independent worker…
        </p>
      )}
      {error && <p>Reference unavailable: {error}</p>}
      {result && (
        <>
          <p data-testid="phi4-transfer-status">
            Leading ratio status: <strong>{result.status}</strong>.{' '}
            {result.reasons.join(' ') ||
              'Coordinate and cutoff refinements agree within 3%; eigenpair residuals checked.'}
          </p>
          <p>
            Converted a={f(a)}, β={parameters.beta}, rQM={parameters.r}, λQM=
            {parameters.lambda}, hQM={parameters.h}. Identical actions, with
            unchanged spatial coordinates.
          </p>
          <p>
            Numerical leading ratio q={f(ratio)}.{' '}
            {xi !== null
              ? `Bulk 1D correlation length ξ=${f(xi)} lattice spacings.`
              : 'Trusted bulk length unavailable.'}{' '}
            {xi !== null &&
              xi > parameters.sites / 2 &&
              'This length is large relative to the ring; finite-volume effects matter.'}
          </p>
          <p>
            Finite-ring correlator status:{' '}
            <strong>{result.correlatorStatus}</strong>.{' '}
            {result.correlatorReasons.join(' ')}{' '}
            {result.correlatorStatus === 'resolved' &&
              `Numerical ring mean ${f(grid?.mean ?? null)}.`}
          </p>
          {result.correlatorStatus === 'resolved' && grid?.rawCorrelator && (
            <Chart
              title="Numerical finite-ring spatial correlations"
              curves={[
                {
                  label: 'Raw finite ring',
                  color: '#14625a',
                  points: grid.rawCorrelator.map((v, i) => [i, v]),
                },
                ...(parameters.h !== 0 && grid.connectedCorrelator
                  ? [
                      {
                        label: 'Connected finite ring',
                        color: '#9d4363',
                        points: grid.connectedCorrelator.map(
                          (v, i) => [i, v] as [number, number],
                        ),
                        dashed: true,
                      },
                    ]
                  : []),
              ]}
              xMin={0}
              xMax={Math.floor(parameters.sites / 2)}
              xLabel="spatial displacement"
            />
          )}
          <details>
            <summary>Quadrature resolution evidence</summary>
            {result.grids.map((g) => (
              <p key={g.nodes}>
                {g.nodes} nodes, cutoff ±{f(g.cutoff)}, spacing {f(g.spacing)};
                maximum eigenpair residual{' '}
                {Math.max(...g.residuals).toExponential(2)}, orthogonality error{' '}
                {g.orthogonalityError.toExponential(2)}.
              </p>
            ))}
          </details>
          <p className="plot-note">
            The N-site ring correlator is finite-volume. ξ=−1/log(q) is a bulk
            1D transfer length, not a 2D mass gap, quantum energy or Monte Carlo
            mixing time. Refinement gates are practical checks, not certified
            error bounds.
          </p>
        </>
      )}
    </section>
  );
}
