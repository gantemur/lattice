import type { ScalarTrace } from '../engine/scalarRun';
import { formatNumber } from '../plotting/PlotFrame';
export function ScalarStepInspector({
  record,
  open,
  setOpen,
}: {
  record?: ScalarTrace;
  open: boolean;
  setOpen: (v: boolean) => void;
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
      {record ? (
        <div data-testid="scalar-transition-details">
          <p>
            Update {record.update} ·{' '}
            {record.warmup
              ? 'warm-up excluded from estimates'
              : 'retained measurement'}{' '}
            ·{' '}
            {record.kind === 'direct'
              ? 'whole-vector independent Gaussian draw'
              : record.kind === 'heat-bath'
                ? 'coordinate Gaussian heat bath'
                : 'random-site Metropolis'}
            .
          </p>
          <p>
            Selected {record.site ?? 'whole vector'}; before [
            {record.before?.map(formatNumber).join(', ') ?? '—'}]; proposal [
            {record.proposed.map(formatNumber).join(', ')}]; result [
            {record.result.map(formatNumber).join(', ')}].
          </p>
          {record.site && (
            <>
              <p>
                Site draw {formatNumber(record.siteUniform)}; proposal draw{' '}
                {formatNumber(record.proposalUniform)}. On-site ΔS ={' '}
                {formatNumber(record.onsite)}.
              </p>
              <ul>
                {record.edges.map((e) => (
                  <li key={e.edgeId}>
                    {e.edgeId}: neighbor {e.neighbor}={formatNumber(e.value)},
                    κ={formatNumber(e.coupling)}, gradient ΔS=
                    {formatNumber(e.delta)}
                  </li>
                ))}
              </ul>
            </>
          )}
          {record.kind === 'metropolis' && (
            <p>
              Total ΔS={formatNumber(record.delta)}, α=
              {formatNumber(record.alpha)}, acceptance uniform=
              {formatNumber(record.uniform)}.{' '}
              {record.accepted
                ? 'Accepted.'
                : 'Rejected: complete vector repeated.'}
            </p>
          )}
        </div>
      ) : (
        <p>Step to inspect a transition.</p>
      )}
    </details>
  );
}
