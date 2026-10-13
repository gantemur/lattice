import type { FieldSnapshot } from '../engine/fieldRun';
import { formatNumber as f } from '../plotting/PlotFrame';

/** Only the acknowledged whole-field trace is inspected; no local site or
 * intermediate MD configuration is invented for this global proposal. */
export function SpatialHmcInspection({
  trace,
}: {
  trace: Extract<NonNullable<FieldSnapshot['lastTrace']>, { kind: 'hmc' }>;
}) {
  return (
    <section
      className="field-results"
      aria-label="Latest spatial HMC trajectory"
    >
      <h2>Latest whole-field HMC trajectory</h2>
      <p>
        Update {trace.update}, segment {trace.segmentId},{' '}
        {trace.warmup ? 'warm-up' : 'post-warm-up'}: {trace.outcome}.
      </p>
      <p>
        ε={f(trace.stepSize)}, L={trace.leapfrogSteps}, auxiliary duration Lε=
        {f(trace.trajectoryDuration)}.
      </p>
      <p>
        Start S={f(trace.startAction)}, K={f(trace.startKinetic)}, H=
        {f(trace.startHamiltonian)}. Proposed S={f(trace.proposedAction)}, K=
        {f(trace.proposedKinetic)}, H={f(trace.proposedHamiltonian)}.
      </p>
      <p>
        Complete ΔH={f(trace.deltaH)}; acceptance probability α=
        {f(trace.acceptanceProbability)}; decision uniform u=
        {f(trace.decisionUniform)}.
      </p>
      <p>
        {trace.gradientEvaluations} force evaluations;{' '}
        {trace.completedLeapfrogSteps} completed leapfrog steps.{' '}
        {trace.divergenceReason}
      </p>
      <details>
        <summary>Completed-step Hamiltonian defects</summary>
        <p>
          {trace.energyErrors.length
            ? trace.energyErrors.map(f).join(', ')
            : 'None before divergence.'}
        </p>
      </details>
      <p className="plot-note">
        H=S+Σp²/2 is an auxiliary Hamiltonian, not physical field energy. A
        rejection retains the entire old field. Intermediate leapfrog fields are
        not measurements.
      </p>
    </section>
  );
}
