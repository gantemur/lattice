import type { SegmentSnapshot } from '../engine/protocol';
import {
  gaussianScalar,
  scalarReference,
  quarticReference,
} from '../models/scalarField';
import { formatNumber } from '../plotting/PlotFrame';
export function ScalarReferences({ segment }: { segment: SegmentSnapshot }) {
  if (segment.model.kind !== 'scalar' || !segment.scalar) return null;
  const model = segment.model,
    ids = model.parameters.domain.vertices.map((v) => v.id),
    gaussian = ids.every((id) => model.parameters.lambda[id] === 0),
    g = gaussian ? gaussianScalar(model) : null;
  return (
    <section className="moments-panel">
      <h2>Real-field references · current segment</h2>
      {g && (
        <p>
          Analytic exact multivariate Gaussian · log Z = {formatNumber(g.logZ)}.
          Precision Q and covariance Q⁻¹ use every non-self bond once.
        </p>
      )}
      {g && (
        <details>
          <summary>Exact Gaussian precision, covariance & pair moments</summary>
          {(
            [
              ['Precision Q', g.Q],
              ['Covariance C = Q⁻¹', g.covariance],
              ['Pair moments ⟨xᵢxⱼ⟩', g.correlations],
            ] as [string, number[][]][]
          ).map(([label, matrix]) => (
            <div className="matrix-scroll" key={label}>
              <table className="moments-table">
                <caption>{label}</caption>
                <thead>
                  <tr>
                    <th></th>
                    {ids.map((id) => (
                      <th key={id}>{id}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrix.map((row, i) => (
                    <tr key={ids[i]}>
                      <th>{ids[i]}</th>
                      {row.map((value, j) => (
                        <td key={ids[j]}>{formatNumber(value)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </details>
      )}
      <table className="moments-table">
        <thead>
          <tr>
            <th>Site</th>
            <th>Reference mean / variance</th>
            <th>Sampled mean / variance</th>
            <th>Method</th>
          </tr>
        </thead>
        <tbody>
          {ids.map((id) => {
            const r = scalarReference(model, id),
              m = segment.scalar!.targets[id]!.moments;
            return (
              <tr key={id}>
                <th>{id}</th>
                <td>
                  {r
                    ? `${formatNumber(r.mean)} / ${formatNumber(r.variance)}`
                    : 'Unavailable'}
                </td>
                <td>
                  {formatNumber(m.mean)} / {formatNumber(m.variance)}
                </td>
                <td>{r?.kind ?? 'Sampled only'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!g &&
        model.parameters.domain.edges.every(
          (e) => model.parameters.kappa[e.id] === 0,
        ) && (
          <p className="plot-note">
            Independent sites: full log Z ={' '}
            {formatNumber(
              ids.reduce(
                (s, id) =>
                  s +
                  quarticReference(
                    model.parameters.a[id]!,
                    model.parameters.lambda[id]!,
                    model.parameters.h[id]!,
                  ).logPartition,
                0,
              ),
            )}
            . Each site reference uses one-dimensional quadrature or its
            Gaussian limit.
          </p>
        )}
      {ids
        .filter(
          (id) =>
            model.parameters.lambda[id]! > 0 &&
            model.parameters.domain.edges.every(
              (e) => model.parameters.kappa[e.id] === 0,
            ),
        )
        .map((id) => {
          const q = quarticReference(
            model.parameters.a[id]!,
            model.parameters.lambda[id]!,
            model.parameters.h[id]!,
          );
          return (
            <p key={id} className="plot-note">
              {id}: quadrature on [{q.domain.map(formatNumber).join(', ')}],
              normalized tail bound ≤ {q.tailBound.toExponential(2)}. Adaptive
              integration targets about 1e−8 relative precision; unsupported
              cases report failure.
            </p>
          );
        })}
      <p className="plot-note">
        Connected covariance = sampled ⟨xᵢxⱼ⟩ − sampled means; exact Gaussian
        covariance appears in the covariance plot. No exact coupled-quartic
        marginal or MCMC uncertainty is claimed. Sample variance uses N−1; fixed
        warm-up does not establish mixing.
      </p>
    </section>
  );
}
