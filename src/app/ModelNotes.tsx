import { ScalarNotes } from './ScalarNotes';
import type { Model } from '../models/singleVariable';
import { DisplayMath, InlineMath } from '../ui/Math';
export function ModelFormula({ model }: { model: Model }) {
  return (
    <>
      <div
        className={`formula ${model.kind === 'scalar' ? 'scalar-formula' : ''}`}
      >
        <DisplayMath>
          {model.kind === 'scalar'
            ? String.raw`\begin{aligned}S&=\sum_i V_i+\sum_e B_e\\V_i&=\frac{a_i x_i^2}{2}+\frac{\lambda_i x_i^4}{4}-h_ix_i\\B_e&=\frac{\kappa_e}{2}(x_t-x_h)^2\end{aligned}`
            : model.kind === 'ising'
              ? String.raw`\begin{aligned}S(s)&=-\sum_e K_e s_t s_h\\&\quad-\sum_i b_i s_i\end{aligned}`
              : model.kind === 'gaussian'
                ? String.raw`S(x)=\frac{a x^2}{2}-hx`
                : model.kind === 'spin'
                  ? String.raw`S(s)=-hs`
                  : String.raw`S(k)=-hk-\log\binom nk`}
        </DisplayMath>
      </div>
      <p className="model-convention">
        <InlineMath>
          {model.kind === 'scalar'
            ? String.raw`x_i\in\mathbb R,\quad \kappa_e\ge0`
            : model.kind === 'ising'
              ? String.raw`s_i\in\{-1,+1\}`
              : model.kind === 'gaussian'
                ? String.raw`x\in\mathbb R,\quad a>0`
                : model.kind === 'spin'
                  ? String.raw`s\in\{-1,+1\}`
                  : String.raw`k\in\{0,\ldots,n\}`}
        </InlineMath>
        <br />
        Weight <InlineMath>{String.raw`e^{-S}`}</InlineMath>. Dimensionless; no
        extra β factor.
        {model.kind === 'ising' && (
          <> t and h denote each bond’s tail and head.</>
        )}
        {model.kind === 'binomial' && (
          <>
            <br />
            <InlineMath>{String.raw`h=\log\frac p{1-p}`}</InlineMath>
          </>
        )}
      </p>
    </>
  );
}
export function ModelNotes({ model }: { model: Model }) {
  if (model.kind === 'ising') return <IsingNotes />;
  if (model.kind === 'scalar') return <ScalarNotes />;
  return (
    <details className="model-notes" id="model-notes">
      <summary>The mathematics & suggested experiments</summary>
      <div>
        {model.kind === 'gaussian' ? (
          <>
            <DisplayMath>{String.raw`\mu=\frac ha,\quad \sigma^2=\frac1a,\quad \log Z=\frac12\log\frac{2\pi}{a}+\frac{h^2}{2a}`}</DisplayMath>
            <DisplayMath>{String.raw`p(x)=\sqrt{\frac a{2\pi}}\,e^{-\frac a2(x-\mu)^2}`}</DisplayMath>
            <p>
              Direct sampling uses Box–Muller. Metropolis proposes{' '}
              <InlineMath>{String.raw`x'=x+\delta(2u-1)`}</InlineMath>. Try δ =
              0.1, 2, and 20 with a = 1, h = 0. Compare acceptance and
              exploration: high acceptance alone does not mean fast mixing.
            </p>
          </>
        ) : model.kind === 'spin' ? (
          <>
            <DisplayMath>{String.raw`Z=2\cosh h,\quad P(s)=\frac{e^{hs}}{Z}`}</DisplayMath>
            <DisplayMath>{String.raw`\langle s\rangle=\tanh h,\quad \operatorname{Var}(s)=1-\tanh^2h`}</DisplayMath>
            <p>
              Direct and single-spin heat-bath sampling both draw from these two
              exact probabilities. Heat bath has identical transition-matrix
              rows, so consecutive draws here are independent. Metropolis
              proposes staying or flipping with equal probability. The
              deliberate laziness avoids the period-two flip chain at h = 0.
            </p>
            <p>
              Compare heat bath and Metropolis at h = 0, then h = 1.5. Look for
              repeated states and distinguish deliberate stays from rejected
              flips.
            </p>
          </>
        ) : (
          <>
            <DisplayMath>{String.raw`P(K=k)=\binom nk p^k(1-p)^{n-k}`}</DisplayMath>
            <DisplayMath>{String.raw`\log Z=n\log(1+e^h)=-n\log(1-p)`}</DisplayMath>
            <DisplayMath>{String.raw`\langle K\rangle=np,\quad \operatorname{Var}(K)=np(1-p)`}</DisplayMath>
            <p>
              K is the aggregate number of successes in n Bernoulli trials. The
              factor <InlineMath>{String.raw`\binom nk`}</InlineMath> counts
              distinct microstates with the same K; omitting it would give a
              different distribution. The partition function above uses the
              displayed unnormalized action (the normalized PMF sums to one).
            </p>
            <p>
              Direct sampling sums n independent Bernoulli draws. Metropolis
              attempts ±1 equally; an attempted −1 at K = 0 or n + 1 at K = n is
              mapped to a self-proposal. This symmetric boundary rule preserves
              detailed balance.
            </p>
            <p>
              Try n = 20, 40, and 80 at p = 0.5 and examine the bell shape.
              Compare with a Gaussian having mean np and variance np(1−p) in a
              separate model session. The continuous Gaussian is only an
              approximation to these discrete masses; it is poor near extreme p.
            </p>
          </>
        )}
        <h3>Read a transition</h3>
        <DisplayMath>{String.raw`\Delta S=S(x')-S(x),\quad \alpha=\min(1,e^{-\Delta S})`}</DisplayMath>
        <p>
          A Metropolis update draws a proposal and an acceptance uniform u;
          accept if u &lt; α. Every update consumes both draws, even for
          self-proposals and automatic acceptance. Rejection repeats the
          previous state. Direct draws and heat bath do not use a Metropolis
          acceptance test. Run and Step execute the same kernel and random
          stream.
        </p>
        <h3>Relaxation and convergence</h3>
        <p>
          Shift the target distribution while running. A chain keeps its
          compatible configuration and starts a new segment with the chosen
          warm-up budget (default 200). Warm-up transitions appear faintly in
          trajectories but never enter histograms, moments, or running means.
          Relaxation toward equilibrium and convergence of a retained mean are
          different questions; a fixed warm-up budget is not proof of mixing.
        </p>
        <p>
          Only <strong>direct Gaussian</strong> segments show{' '}
          <InlineMath>{String.raw`\mu\pm\sigma/\sqrt N`}</InlineMath> (about 68%
          coverage at a fixed N). These are not simultaneous confidence bands.
          The optional <InlineMath>{String.raw`\sigma N^{-1/2}`}</InlineMath>{' '}
          line describes RMS error, not monotone decay of one trajectory.
          Correlated Metropolis segments have no such bands;
          autocorrelation-adjusted intervals and ESS are deferred.
        </p>
        <h3>History and reproducibility</h3>
        <p>
          Update number is algorithmic time, never physical time. Up to eight
          segments retain their latest 1000 exact transitions, including
          rejections and warm-up. Older transitions are removed, while full
          segment counters and moments remain; logarithmic mean checkpoints
          follow{' '}
          <InlineMath>{String.raw`n_{k+1}=\lceil1.125n_k\rceil,\ n_0=1`}</InlineMath>
          , plus the latest endpoint. Curves between checkpoints do not show
          every fluctuation.
        </p>
        <p>
          Gaussian histograms use 32 fixed bins over each segment’s μ ± 4σ;
          tails remain in its moments and normalization. Discrete histograms use
          one bin per state. Apply retains separate segment estimates and the
          RNG stream. Model-family changes start a new session. Reset clears
          history and restarts the selected seed with applied settings; initial
          chain states are 0 (Gaussian), +1 (spin), or round(np) (binomial),
          never fabricated measurements. Fit All changes axes only.
          Reproducibility requires the same seed, settings/update sequence and
          build.
        </p>
      </div>
    </details>
  );
}

function IsingNotes() {
  return (
    <details className="model-notes" id="model-notes">
      <summary>The mathematics & suggested experiments</summary>
      <div>
        <DisplayMath>{String.raw`S(s)=-\sum_e K_e s_{t(e)}s_{h(e)}-\sum_i b_i s_i,\qquad P(s)=e^{-S(s)}/Z`}</DisplayMath>
        <p>
          K and b are dimensionless: inverse temperature is already absorbed. E
          denotes the total action S, not a separately normalized Hamiltonian.
          Every edge record contributes once. Self-links add a constant −K and
          cancel in spin-flip differences. Parallel edges remain distinct. The
          single-spin model is the one-site, zero-bond special case.
        </p>
        <DisplayMath>{String.raw`Z=\sum_{s\in\{-1,+1\}^N}e^{-S(s)},\quad \langle O\rangle=\sum_s O(s)P(s)`}</DisplayMath>
        <p>
          All at most 16 configurations are enumerated with log-sum-exp
          normalization. Exact values need no sampling. M = Σsᵢ, m = M/N; a zero
          finite-volume mean at zero field is compatible with large |M|. It is
          not an infinite-volume spontaneous magnetization.
        </p>
        <DisplayMath>{String.raw`H_i=b_i+\sum_{e=(i,j),\ j\ne i}K_e s_j,\quad \Delta S_i=2s_iH_i,\quad P(s_i=+1\mid s_{j\ne i})=\frac{1}{1+e^{-2H_i}}`}</DisplayMath>
        <p>
          Choose a site uniformly with replacement. Local Metropolis draws a
          ½-stay/½-flip proposal, then an acceptance uniform even for a stay.
          Local heat bath draws the selected spin from its conditional law; in
          an interacting graph these updates are correlated. N elementary
          updates are one nominal sweep; some sites may be selected repeatedly.
          Direct enumeration draws a whole independent configuration with one
          uniform. No cluster algorithms.
        </p>
        <p>
          Reset starts local chains with all spins +1. Warm-up (default 200
          local updates) is discarded per new segment, not proof of mixing.
          Coupling, field and algorithm changes keep compatible configurations
          and the random stream. Topology changes start a new session; Add Plot,
          graph selection and Fit All do not change numerical state. Eight
          segments retain at most 1000 transitions each, bounded running-mean
          checkpoints and full configuration counts. No MCMC confidence bands or
          ESS.
        </p>
        <DisplayMath>{String.raw`T_{st}=\exp(Kst+b(s+t)/2),\qquad Z_{\mathrm{ring},N=4}=\operatorname{Tr}(T^4)`}</DisplayMath>
        <p>
          The periodic 1×4 chain is a one-dimensional four-bond ring. The
          periodic 2×2 square is a two-dimensional torus: one positive-x and one
          positive-y oriented bond from each site, eight bonds and four signed
          plaquettes. Dashed wrap bonds must not be removed or merged with their
          parallel partners. A generic graph has no inferred faces. A
          two-dimensional (1,4) thin torus is not the 1D ring preset.
        </p>
        <h3>Small experiments</h3>
        <ul>
          <li>
            Compare the open and periodic chains at K = 0.5, b = 0. Compare log
            Z, magnetization probabilities and connected correlations.
          </li>
          <li>
            Change every K from +0.5 to −0.5: compare ferromagnetic and
            antiferromagnetic preferences. Try the star and K4 with the same
            four spins.
          </li>
          <li>
            Make one bond stronger or negative, then vary one external field.
            Compare heterogeneous and uniform coupling patterns.
          </li>
          <li>
            Compare local Metropolis and heat bath with direct exact sampling.
            Pause, inspect individual transitions and resume the same seeded
            sequence.
          </li>
          <li>
            Watch sampled correlations approach exact values. Increase coupling
            and observe slow switching; high acceptance is not proof of good
            mixing.
          </li>
        </ul>
      </div>
    </details>
  );
}
