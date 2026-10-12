import { DisplayMath } from '../ui/Math';
export function ScalarNotes() {
  return (
    <details className="model-notes" id="model-notes">
      <summary>The mathematics & suggested experiments</summary>
      <div>
        <DisplayMath>{String.raw`S(x)=\sum_i\left(\tfrac12 a_i x_i^2+\tfrac14\lambda_i x_i^4-h_ix_i\right)+\tfrac12\sum_e\kappa_e(x_t-x_h)^2`}</DisplayMath>
        <p>
          All actions are dimensionless; the weight is exp(−S). Each bond is
          counted once. Parallel bonds contribute separately and self-links
          contribute zero gradient energy. The displayed bounds are sufficient
          for normalizability, not necessary.
        </p>
        <DisplayMath>{String.raw`S_{\lambda=0}(x)=\tfrac12 x^TQx-h^Tx,\quad \mu=Q^{-1}h,\quad C=Q^{-1}`}</DisplayMath>
        <p>
          For Gaussian fields the exact precision matrix includes every bond.
          Direct sampling draws a whole independent vector; coordinate heat bath
          and Metropolis draw correlated trajectories. Positive definite
          Cholesky checks guard the Gaussian reference.
        </p>
        <DisplayMath>{String.raw`V_i(z)=\tfrac12a_iz^2+\tfrac14\lambda_iz^4-h_iz,\quad V_i^{\rm cond}(z)=V_i(z)+\tfrac12\sum_{e\ni i}\kappa_e(z-x_j)^2`}</DisplayMath>
        <p>
          The conditional holds current neighbors fixed. Its normalized density
          differs from the equilibrium marginal of a coupled field. Independent
          quartic marginals use controlled one-dimensional quadrature; coupled
          quartic marginal curves are sampled only. A trajectory trapped in one
          well can indicate slow mixing.
        </p>
        <p>
          Try the Gaussian baseline, coupled pair, symmetric and tilted wells,
          then four-site Gaussian and quartic systems. Compare marginal widths
          and correlations as κ changes. Parameter Apply starts a new segment
          and warm-up with the current vector and RNG. Reset clears history and
          replays the seed; Refit axes changes only the view.
        </p>
      </div>
    </details>
  );
}
