import type { Model } from '../models/singleVariable';
import { spins, observableValue, isingAction } from '../models/ising';
import type { TransitionRecord } from '../observables/trajectory';
import { formatNumber } from '../plotting/PlotFrame';
import { InlineMath } from '../ui/Math';
export function StepInspector({
  record,
  model,
  open,
  setOpen,
}: {
  record: TransitionRecord | undefined;
  model?: Model;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const value = (v: number | null) =>
    model?.kind === 'ising' && v !== null
      ? spins(model, v)
          .map((s) => (s > 0 ? '+1' : '−1'))
          .join(', ')
      : formatNumber(v);
  return (
    <details
      className="step-inspector"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>
        Inspect latest update{record ? ` · ${record.update}` : ''}
      </summary>
      {!record ? (
        <p>No transition in this segment yet. Step to inspect one.</p>
      ) : (
        <div data-testid="transition-details">
          <p>
            S{record.segmentId} · update {record.update} ·{' '}
            {record.warmup
              ? 'warm-up — excluded from estimates'
              : 'retained measurement'}
          </p>
          {record.ising && (
            <div className="local-inspection">
              <strong>Selected vertex {record.ising.site}</strong>
              <p>
                Spin {record.ising.oldSpin} → proposed{' '}
                {record.ising.proposedSpin} → result {record.ising.newSpin}.
                Site draw: {record.ising.siteUniform.toPrecision(6)}
                {record.ising.proposalUniform !== undefined
                  ? ` · proposal draw: ${record.ising.proposalUniform.toPrecision(6)}`
                  : ''}
                .
              </p>
              <p>
                Field b = {record.ising.field}; effective local field ={' '}
                {formatNumber(record.ising.localField)}.
              </p>
              <ul>
                {record.ising.contributions.map((c) => (
                  <li key={c.edgeId}>
                    {c.edgeId} · neighbor {c.neighbor}: spin {c.spin}, K=
                    {c.coupling}, contribution K·s=
                    {formatNumber(c.contribution)}
                  </li>
                ))}
              </ul>
              <p>
                Self-links contribute no local field. Actual flip ΔS ={' '}
                {formatNumber(
                  2 * record.ising.oldSpin * record.ising.localField,
                )}
                ; a lazy proposal has ΔS = 0.
              </p>
            </div>
          )}
          {model?.kind === 'ising' && (
            <p>
              Result M = {observableValue(model, record.result)} · total S ={' '}
              {formatNumber(isingAction(model, record.result))}.
            </p>
          )}
          {record.kind === 'metropolis' ? (
            <>
              <dl className="transition-grid">
                <div>
                  <dt>Before</dt>
                  <dd>{value(record.current)}</dd>
                </div>
                <div>
                  <dt>Proposed</dt>
                  <dd>{value(record.proposed)}</dd>
                </div>
                <div>
                  <dt>
                    <InlineMath>{String.raw`\Delta S`}</InlineMath>
                  </dt>
                  <dd>{formatNumber(record.delta)}</dd>
                </div>
                <div>
                  <dt>Accept probability α</dt>
                  <dd>{record.alpha.toPrecision(6)}</dd>
                </div>
                <div>
                  <dt>Uniform draw u</dt>
                  <dd>{record.uniform.toPrecision(6)}</dd>
                </div>
                <div>
                  <dt>Result</dt>
                  <dd data-testid="transition-result">
                    {value(record.result)}
                  </dd>
                </div>
              </dl>
              <p
                className={`transition-outcome outcome-${record.outcome}`}
                data-testid="transition-outcome"
              >
                {record.outcome === 'self'
                  ? `Accepted self-proposal · ${record.selfReason === 'boundary' ? `attempted ${record.attempted} outside support` : 'deliberate lazy stay'}`
                  : record.accepted
                    ? 'Accepted move'
                    : 'Rejected · state repeated'}
                . Decision uses full precision.
              </p>
            </>
          ) : (
            <>
              <p>
                {record.kind === 'direct'
                  ? 'Independent draw'
                  : record.ising
                    ? 'Local heat-bath resample conditional on neighbors'
                    : 'Exact single-spin heat-bath resample (independent of previous value)'}{' '}
                ·{' '}
                <strong data-testid="transition-result">
                  {value(record.result)}
                </strong>
              </p>
              {record.kind === 'heat-bath' && (
                <p>
                  Before: {value(record.current)} · P(+1) ={' '}
                  {record.probabilityPlus.toPrecision(6)} · uniform u ={' '}
                  {record.uniform.toPrecision(6)}. Choose +1 when u &lt; P(+1).
                </p>
              )}
              <p>
                No Metropolis acceptance test.
                {record.ising && record.kind === 'heat-bath'
                  ? record.outcome === 'self'
                    ? ' Spin unchanged after resampling.'
                    : ' Spin changed after resampling.'
                  : ''}
              </p>
            </>
          )}
        </div>
      )}
    </details>
  );
}
