import { createFieldLattice } from '../domain/fieldLattice';
import {
  fieldConditional,
  fieldLocalTerms,
  fieldMeasure,
} from '../models/gaussianField';
import type { FieldSnapshot } from '../engine/fieldRun';
import { formatNumber } from '../plotting/PlotFrame';

export function FieldInspection({
  snapshot,
  site,
  partner,
}: {
  snapshot: FieldSnapshot;
  site: number;
  partner: number;
}) {
  const segment = snapshot.segments.at(-1)!;
  const p = segment.settings.parameters;
  const lattice = createFieldLattice(p.shape);
  const field = snapshot.field;
  const constrained = fieldMeasure(p) === 'mean-zero';
  const conditional =
    field && !constrained ? fieldConditional(lattice, p, field, site) : null;
  const terms = field ? fieldLocalTerms(lattice, p, field, site) : null;
  // This renderer is mounted only by the spatial Gaussian workspace.
  const reference = segment.reference!;
  const siteMean = segment.sites[site]?.mean ?? null;
  const partnerMean = segment.sites[partner]?.mean ?? null;
  const pair = segment.measurements
    ? segment.pairProducts[site]![partner]!
    : null;
  const sampledCovariance =
    segment.measurements < 2 ||
    pair === null ||
    siteMean === null ||
    partnerMean === null
      ? null
      : pair - siteMean * partnerMean;
  const exactCovariance = reference.covariance[site]![partner]!;
  const exactProduct =
    exactCovariance + reference.mean[site]! * reference.mean[partner]!;
  return (
    <section
      className="field-results"
      aria-label="Field local and covariance inspection"
    >
      <div className="section-heading">
        <h2>Selected-site mathematics</h2>
        <span className="parameter-chip">site {site}</span>
      </div>
      <p>
        Current φ<sub>{site}</sub>:{' '}
        <strong>{formatNumber(field?.[site] ?? null)}</strong>. On-site action{' '}
        <strong>{formatNumber(terms?.onsite ?? null)}</strong>,{' '}
        {constrained ? 'ambient on-site gradient' : 'on-site gradient'}{' '}
        <strong>{formatNumber(terms?.onsiteGradient ?? null)}</strong>.
      </p>
      {constrained ? (
        <p>
          The field lies on Σφ=0. Fixing all other sites determines this site
          exactly; the ordinary fixed-neighbor conditional is not a conditional
          of the constrained measure. The listed action terms and gradients are
          ambient quantities.
        </p>
      ) : (
        <p>
          Exact conditional at fixed neighboring values: mean{' '}
          <strong>{formatNumber(conditional?.mean ?? null)}</strong>, variance{' '}
          <strong>{formatNumber(conditional?.variance ?? null)}</strong>. This
          is not the equilibrium marginal variance{' '}
          <strong>{formatNumber(reference.covariance[site]![site]!)}</strong>.
        </p>
      )}
      <div className="field-terms">
        {terms?.incident.map((term) => (
          <span key={term.bondId}>
            bond {term.bondId} → site {term.neighbor} ({term.axis}, κ=
            {formatNumber(term.stiffness)}): action {formatNumber(term.action)},
            gradient {formatNumber(term.gradient)}
          </span>
        )) ?? <span>Draw a field to inspect its local terms.</span>}
      </div>
      <h3>
        Pair comparison: sites {site}, {partner}
      </h3>
      <table className="field-covariance">
        <thead>
          <tr>
            <th scope="col">Quantity</th>
            <th scope="col">Exact finite volume</th>
            <th scope="col">Sampled segment</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">
              〈φ<sub>{site}</sub>〉
            </th>
            <td>{formatNumber(reference.mean[site]!)}</td>
            <td>{formatNumber(siteMean)}</td>
          </tr>
          <tr>
            <th scope="row">
              〈φ<sub>{site}</sub>φ<sub>{partner}</sub>〉
            </th>
            <td>{formatNumber(exactProduct)}</td>
            <td>{formatNumber(pair)}</td>
          </tr>
          <tr>
            <th scope="row">Connected covariance</th>
            <td>{formatNumber(exactCovariance)}</td>
            <td>{formatNumber(sampledCovariance)}</td>
          </tr>
        </tbody>
      </table>
      <p className="plot-note">
        Sampled pair values use all retained post-warm-up measurements in this
        segment. The covariance is the centered 1/N plug-in estimate and is
        shown only after two measurements.{' '}
        {segment.settings.sampler.kind === 'direct' ||
        segment.settings.sampler.kind === 'spectral'
          ? 'Independent whole-field draws have a known finite-volume reference; this table does not attach a pair-covariance error bar.'
          : 'No independent-sample error bar is assigned to a correlated local chain.'}
      </p>
    </section>
  );
}

export function FieldStepInspection({ snapshot }: { snapshot: FieldSnapshot }) {
  const trace = snapshot.lastTrace;
  return (
    <section className="field-results" aria-label="Latest field update">
      <h2>Latest algorithmic update</h2>
      {!trace ? (
        <p>No update yet. The initial configuration is not a measurement.</p>
      ) : trace.kind === 'direct' || trace.kind === 'spectral' ? (
        <p>
          Update {trace.update}: independent whole-field{' '}
          {trace.kind === 'spectral' ? 'spectral' : 'Gaussian'} draw.
          Acceptance: N/A. This update is not physical time.
        </p>
      ) : (
        <>
          <p>
            Update {trace.update}, site {trace.site}: {trace.outcome}
            {trace.warmup ? ' (warm-up)' : ''}. Before{' '}
            {formatNumber(trace.before)} → proposed{' '}
            {formatNumber(trace.proposed)} → actual {formatNumber(trace.after)}.
          </p>
          <p>
            Proposed ΔS = {formatNumber(trace.deltaAction)}.{' '}
            {trace.kind === 'metropolis'
              ? `Acceptance probability ${formatNumber(trace.acceptanceProbability)}; decision uniform ${formatNumber(trace.decisionUniform)}. Rejected proposals leave the field unchanged.`
              : 'Coordinate heat bath resamples from the exact conditional; acceptance is N/A.'}
          </p>
        </>
      )}
    </section>
  );
}
