import type { Model } from '../models/singleVariable';
import { DisplayMath, InlineMath } from '../ui/Math';
export function ModelFormula({ model }: { model: Model }) {
  return (
    <>
      <div className="formula">
        <DisplayMath>
          {model.kind === 'gaussian'
            ? String.raw`S(x)=\frac{a x^2}{2}-hx`
            : model.kind === 'spin'
              ? String.raw`S(s)=-hs`
              : String.raw`S(k)=-hk-\log\binom nk`}
        </DisplayMath>
      </div>
      <p className="model-convention">
        <InlineMath>
          {model.kind === 'gaussian'
            ? String.raw`x\in\mathbb R,\quad a>0`
            : model.kind === 'spin'
              ? String.raw`s\in\{-1,+1\}`
              : String.raw`k\in\{0,\ldots,n\}`}
        </InlineMath>
        <br />
        Weight <InlineMath>{String.raw`e^{-S}`}</InlineMath>. Dimensionless; no
        extra β factor.
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
