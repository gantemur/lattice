import type { FieldSegmentSnapshot, FieldSnapshot } from '../engine/fieldRun';
import { formatNumber } from '../plotting/PlotFrame';
import { segmentColor } from '../plotting/viewport';

/** Read-only projection of worker-owned HMC effort and energy defects. */
export function QuarticHmcDiagnostics({
  segments,
  lastTrace,
  target = 'qm',
}: {
  segments: FieldSegmentSnapshot[];
  lastTrace: FieldSnapshot['lastTrace'];
  target?: 'qm' | 'spatial';
}) {
  const hmcSegments = segments.filter((segment) => segment.hmc !== null);
  if (!hmcSegments.length)
    return (
      <section className="field-results" aria-label="HMC diagnostics">
        <h2>HMC trajectory diagnostics</h2>
        <p>
          Apply Hamiltonian Monte Carlo to inspect{' '}
          {target === 'spatial' ? 'whole-field' : 'whole-path'} trajectory
          outcomes and auxiliary Hamiltonian error.
        </p>
      </section>
    );
  const points = hmcSegments.flatMap((segment) =>
    segment
      .hmc!.recent.filter((record) => record.deltaH !== null)
      .map((record) => ({
        segmentId: segment.id,
        update: record.update,
        deltaH: record.deltaH!,
      })),
  );
  const first = points.length
    ? Math.min(...points.map((point) => point.update))
    : 0;
  const last = points.length
    ? Math.max(...points.map((point) => point.update))
    : 1;
  const limit = Math.max(
    0.01,
    ...points.map((point) => Math.abs(point.deltaH)),
  );
  const x = (update: number) =>
    48 + (505 * (update - first)) / Math.max(1, last - first);
  const y = (delta: number) =>
    105 - 72 * Math.max(-1, Math.min(1, delta / limit));
  const latest = lastTrace?.kind === 'hmc' ? lastTrace : null;
  return (
    <section className="field-results" aria-label="HMC diagnostics">
      <h2>HMC trajectory diagnostics</h2>
      <p>
        One attempt is a full auxiliary MD trajectory. Its ΔH is the signed
        change in <em>S+Σp²/2</em>, not a physical{' '}
        {target === 'spatial' ? 'field' : 'quantum'} energy change or cumulative
        Monte Carlo drift. Acceptance and work counts include warm-up.
      </p>
      <div className="hmc-segment-list">
        {hmcSegments.map((segment) => {
          const diagnostic = segment.hmc!;
          const attempts = segment.accepted + segment.rejected;
          const sampler = segment.settings.sampler;
          return (
            <article className="hmc-segment" key={segment.id}>
              <h3 style={{ color: segmentColor(segment.id) }}>
                Segment {segment.id};{' '}
                {sampler.kind === 'hmc'
                  ? `ε=${sampler.stepSize}, L=${sampler.leapfrogSteps}`
                  : ''}
              </h3>
              <dl>
                <div>
                  <dt>Outcomes</dt>
                  <dd>
                    {attempts} attempted; {segment.accepted} accepted,{' '}
                    {segment.rejected} rejected ({diagnostic.divergences}{' '}
                    numerical divergences). Acceptance{' '}
                    {attempts
                      ? `${formatNumber((100 * segment.accepted) / attempts)}%`
                      : 'N/A'}
                  </dd>
                </div>
                <div>
                  <dt>Finite ΔH</dt>
                  <dd>
                    {diagnostic.finiteDeltaCount} finite; mean{' '}
                    {formatNumber(diagnostic.meanDeltaH)}, RMS{' '}
                    {formatNumber(diagnostic.rmsDeltaH)}, max |ΔH|{' '}
                    {formatNumber(diagnostic.maxAbsDeltaH)}
                  </dd>
                </div>
                <div>
                  <dt>Gradient work</dt>
                  <dd>
                    {diagnostic.gradientEvaluations} force evaluations;{' '}
                    {diagnostic.leapfrogSteps} completed leapfrog steps
                  </dd>
                </div>
              </dl>
            </article>
          );
        })}
      </div>
      <svg
        className="field-history"
        viewBox="0 0 600 220"
        role="img"
        aria-label="Recent signed auxiliary Hamiltonian errors against global transition index"
      >
        <line x1="48" y1="105" x2="553" y2="105" stroke="#87958d" />
        <line x1="48" y1="33" x2="48" y2="177" stroke="#87958d" />
        <text x="3" y="36" fontSize="11">
          +{formatNumber(limit)}
        </text>
        <text x="3" y="177" fontSize="11">
          −{formatNumber(limit)}
        </text>
        <text x="48" y="209" fontSize="11">
          transition {first}
        </text>
        <text x="553" y="209" fontSize="11" textAnchor="end">
          transition {last}
        </text>
        {points.map((point) => (
          <circle
            key={`${point.segmentId}-${point.update}`}
            cx={x(point.update)}
            cy={y(point.deltaH)}
            r="2.5"
            fill={segmentColor(point.segmentId)}
          />
        ))}
      </svg>
      <p className="plot-note">
        Only the latest 256 ΔH records per HMC segment have individual points;
        full-segment finite mean, RMS and maximum remain above. Numerical
        divergences have no finite ΔH point.
      </p>
      {latest && (
        <>
          <h3>Latest trajectory</h3>
          <p>
            Transition {latest.update}: {latest.outcome}; ΔH=
            {formatNumber(latest.deltaH)}, |ΔH|=
            {formatNumber(
              latest.deltaH === null ? null : Math.abs(latest.deltaH),
            )}
            ; α={formatNumber(latest.acceptanceProbability)}; u=
            {formatNumber(latest.decisionUniform)}.
            {latest.divergenceReason && ` ${latest.divergenceReason}`}
          </p>
          <p>
            Actual step defects H_MD(k)−H_MD(0):{' '}
            {latest.energyErrors.length
              ? latest.energyErrors
                  .map((value) => formatNumber(value))
                  .join(', ')
              : 'none before divergence'}
            .
          </p>
        </>
      )}
      <p className="plot-note">
        Small |ΔH| checks integration quality, not equilibrium. HMC trajectories
        and local site attempts have different computational costs;{' '}
        {target === 'spatial' ? 'field-average' : 'path-average'} sign changes
        depend on sampler and measurement cadence and are not a physical
        tunneling rate.
      </p>
    </section>
  );
}
