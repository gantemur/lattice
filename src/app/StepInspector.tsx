import type { TransitionRecord } from '../observables/trajectory';
import { formatNumber } from '../plotting/PlotFrame';
import { InlineMath } from '../ui/Math';
export function StepInspector({
  record,
  open,
  setOpen,
}: {
  record: TransitionRecord | undefined;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
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
          {record.kind === 'metropolis' ? (
            <>
              <dl className="transition-grid">
                <div>
                  <dt>Before</dt>
                  <dd>{formatNumber(record.current)}</dd>
                </div>
                <div>
                  <dt>Proposed</dt>
                  <dd>{formatNumber(record.proposed)}</dd>
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
                    {formatNumber(record.result)}
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
                  : 'Exact single-spin heat-bath resample (independent of previous value)'}{' '}
                ·{' '}
                <strong data-testid="transition-result">
                  {formatNumber(record.result)}
                </strong>
              </p>
              {record.kind === 'heat-bath' && (
                <p>
                  Before: {formatNumber(record.current)} · P(+1) ={' '}
                  {record.probabilityPlus.toPrecision(6)} · uniform u ={' '}
                  {record.uniform.toPrecision(6)}. Choose +1 when u &lt; P(+1).
                </p>
              )}
              <p>No Metropolis acceptance test.</p>
            </>
          )}
        </div>
      )}
    </details>
  );
}
