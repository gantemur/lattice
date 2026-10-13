import type { ReactNode } from 'react';
import type { FieldLattice } from '../domain/fieldLattice';
import type {
  FieldSegmentSnapshot,
  Phi4FieldSettings,
} from '../engine/fieldRun';
import type { Phi4FieldParameters } from '../models/phi4Field';
import { phi4LocalTerms } from '../models/phi4Field';
import { phi4Correlations } from '../observables/phi4Correlator';
import { Chart } from './QuarticPlots';
import { DisplayMath } from '../ui/Math';
import { formatNumber as f } from '../plotting/PlotFrame';
import { segmentColor } from '../plotting/viewport';
export type Phi4Segment = FieldSegmentSnapshot & {
  settings: Phi4FieldSettings;
};
type Segment = Phi4Segment;
/** These tools project acknowledged records only. None owns a simulation client. */
export function Phi4LocalInspection({
  lattice,
  p,
  field,
  site,
  siteControl,
}: {
  lattice: FieldLattice;
  p: Phi4FieldParameters;
  field: number[] | null;
  site: number;
  siteControl: ReactNode;
}) {
  const terms = field ? phi4LocalTerms(lattice, p, field, site) : null;
  return (
    <section
      className="field-results"
      aria-label="Spatial selected-site inspection"
    >
      {siteControl}
      <h2>Selected spatial site {site}</h2>
      <p>
        Current φ={f(field?.[site] ?? null)}; bare on-site action{' '}
        {f(terms?.onsite ?? null)}; on-site gradient{' '}
        {f(terms?.onsiteGradient ?? null)}.
      </p>
      <div className="field-terms">
        {terms?.incident.map((b) => (
          <span key={b.bondId}>
            Bond {b.bondId} ({b.axis}) to site {b.neighbor}, κ=
            {b.stiffness}: action {f(b.action)}, gradient {f(b.gradient)}.
          </span>
        ))}
      </div>
      <DisplayMath>{String.raw`U_{\mathrm{cond}}(z)=\tfrac q2z^2+\tfrac\lambda4z^4-bz+\mathrm{constant}`}</DisplayMath>
      <p>
        Fixed-neighbor q=
        {f(terms?.conditionalQuadratic ?? null)}, b=
        {f(terms?.conditionalSource ?? null)}, λ={p.lambda}.{' '}
        {p.lambda > 0
          ? 'This conditional is quartic, not Gaussian, even when q is positive.'
          : 'The λ=0 conditional is Gaussian.'}{' '}
        It differs from the bare on-site potential and from the equilibrium
        marginal, which integrates over neighbors.
      </p>
    </section>
  );
}
export function Phi4SpatialCorrelations({
  segments,
  current,
}: {
  segments: Segment[];
  current: Segment;
}) {
  const p = current.settings.parameters;
  const fullyPeriodic =
    p.shape.kind === 'chain'
      ? p.shape.periodic
      : p.shape.periodicX && p.shape.periodicY;
  return (
    <>
      <Chart
        title="Sampled spatial correlations"
        xMin={0}
        xMax={Math.max(
          ...(['x', 'y'] as const).flatMap((axis) =>
            phi4Correlations(
              p.shape,
              current.pairProducts,
              current.sites.map((v) => v.mean ?? 0),
              p.source,
              axis,
            ).map((point) => point.lag),
          ),
        )}
        xLabel="spatial displacement"
        curves={segments
          .filter((s) => s.measurements > 0)
          .flatMap((s) =>
            (p.shape.kind === 'chain'
              ? (['x'] as const)
              : (['x', 'y'] as const)
            ).flatMap((axis) => {
              const projection = phi4Correlations(
                p.shape,
                s.pairProducts,
                s.sites.map((v) => v.mean!),
                s.settings.parameters.source,
                axis,
              );
              const base = {
                label: `Segment ${s.id} ${axis}: raw (n=${s.measurements}, j=${s.settings.parameters.source})`,
                color: segmentColor(s.id),
                points: projection.map(
                  (v) => [v.lag, v.raw] as [number, number],
                ),
                dashed: axis === 'y',
              };
              return s.settings.parameters.source === 0
                ? [base]
                : [
                    base,
                    {
                      label: `Segment ${s.id} ${axis}: connected site-mean plug-in`,
                      color: axis === 'x' ? '#9d4363' : '#5979a2',
                      points: projection.map(
                        (v) => [v.lag, v.connected] as [number, number],
                      ),
                      dashed: true,
                    },
                  ];
            }),
          )}
      />
      <p className="plot-note">
        {fullyPeriodic
          ? 'Periodic translation-averaged finite-volume correlations.'
          : 'Origin-averaged finite-volume correlations over admissible pairs; open boundaries do not imply translation invariance.'}{' '}
        At j=0 raw correlations equal connected equilibrium correlations by
        reflection symmetry, even if this chain stays in one well. At j≠0 the
        plug-in estimate subtracts site-specific segment means, never each
        configuration’s mean. No independent-sample error bars or 2D
        correlation-length fit.
      </p>
      <details>
        <summary>Contributing origin pairs</summary>
        {(['x', 'y'] as const).map((axis) => (
          <p key={axis}>
            {axis}:{' '}
            {phi4Correlations(
              p.shape,
              current.pairProducts,
              current.sites.map((v) => v.mean ?? 0),
              p.source,
              axis,
            )
              .map((v) => `lag ${v.lag}: ${v.pairs}`)
              .join('; ') || 'no transverse direction'}
          </p>
        ))}
      </details>
    </>
  );
}
export function Phi4Moments({ segments }: { segments: Segment[] }) {
  return (
    <section className="field-results">
      <h2>Full-segment scalar moments</h2>
      {segments.map((s) => {
        const m2 = s.average.secondMoment,
          m4 = s.averageFourthMoment;
        const binder =
          s.measurements >= 64 && m2 !== null && m2 > 1e-15 && m4 !== null
            ? 1 - m4 / (3 * m2 * m2)
            : null;
        return (
          <article
            className="hmc-segment"
            key={s.id}
            style={{ borderColor: segmentColor(s.id) }}
          >
            <h3>
              Segment {s.id}: r={s.settings.parameters.r}, λ=
              {s.settings.parameters.lambda}, j={s.settings.parameters.source}
            </h3>
            <p>
              Retained {s.measurements}; 〈m〉={f(s.average.mean)}, 〈m²〉=
              {f(m2)}, 〈m⁴〉={f(m4)}, sampled S/V={f(s.actionDensity.mean)}.
              Binder U₄={f(binder)}.
            </p>
            <p>
              Accepted {s.accepted}; rejected {s.rejected}; acceptance{' '}
              {f(s.updates ? (100 * s.accepted) / s.updates : null)}% including
              warm-up. {s.discardedMeasurements} older display vectors evicted.
            </p>
          </article>
        );
      })}
      <p className="plot-note">
        U₄=1−〈m⁴〉/(3〈m²〉²), shown after 64 fields and a usable denominator.
        This finite-volume moment ratio is not a mixing certificate or evidence
        of a phase transition. Sample variance (when used) has n−1
        normalization, unlike these equilibrium raw moments.
      </p>
    </section>
  );
}
