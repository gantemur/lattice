# The categorical Potts model

## State, measure and geometry

A configuration has one categorical color σᵢ∈{0,…,q−1} at each site, with q=2,3,4. Colors are labels, not angles or ordered amplitudes. With counting measure over q^V configurations,

\[
S_P(\sigma)=-\sum_{b=(t,h)}K_b\delta_{\sigma_t,\sigma_h}
-h\sum_i\delta_{\sigma_i,0},\qquad
P(\sigma)=\exp[-S_P(\sigma)]/Z_P.
\]

K and h are dimensionless, independently in [−4,4]; there is no additional inverse-temperature factor. Positive K favors equality, negative K disfavors it. Positive h favors the distinguished color 0; negative h disfavors it. No random-bond distribution or spin-glass interpretation is added.

[`pottsDomain`](../../src/domain/pottsDomain.ts) adapts existing geometry without changing its numerical engines. Small presets are a single site, open dimer, three-site chain, triangle, open 2×2 square and periodic 2×2 torus. Individual bonds keep their IDs even at K=0. The torus has eight physical bonds and four oriented faces, although site-color interactions do not use face variables. Parallel bonds each enter the action. A self-link adds −K independent of its site's color and contributes nothing to a recoloring difference or conditional score.

Lattice Systems supports 2≤Lx,Ly≤32, with independent open/periodic axes and Kx,Ky. Row-major indexing and positive-axis bond records come from the existing indexed lattice. Open boundaries omit bonds; they do not fix boundary colors. There is no NxN pair matrix for a large lattice. [`pottsAction`, `pottsDifference`](../../src/models/potts.ts) implement the same action on both placements. Their [tests](../../src/models/potts.test.ts) compare every tiny configuration/recoloring with independent bond and coordinate sums, including signed, zero, parallel and self interactions.

## Local updates and algorithmic time

For a candidate color c at site i, define

\[
\ell_i(c)=h\delta_{c,0}+\sum_{b\ni i,\;b\text{ non-self}}
K_b\delta_{c,\sigma_{j(b)}},\qquad
p_i(c\mid\sigma_{-i})=\frac{e^{\ell_i(c)-\ell_{\max}}}
{\sum_a e^{\ell_i(a)-\ell_{\max}}}.
\]

Every incident physical bond contributes, including parallel records. `pottsConditional` uses this stable softmax. A fixed-neighbor conditional is distinct from an exact equilibrium one-site marginal.

[`pottsTransition`](../../src/algorithms/pottsSampler.ts) provides:

- **Lazy random-site Metropolis:** choose a site uniformly, propose its current color with probability 1/2, or each other color with probability 1/[2(q−1)], then accept with min(1,exp(−ΔS)). The symmetric proposal ensures detailed balance. The three uniforms are always site, proposal, decision, including self-proposals and certain acceptance/rejection.
- **Random-site heat bath:** choose a site uniformly and resample its categorical conditional with a second uniform. An unchanged resample is a real transition, not a rejection. There is no accept/reject rate.
- **Exact independent draw:** only when q^V≤256; use one uniform against the exact whole-state categorical law. Acceptance is not applicable. Every draw is retained; local warm-up/stride settings do not apply.

Initialization sets every color to zero without drawing or measuring. For local algorithms, one Step is one elementary site attempt; V attempts with replacement form a nominal sweep, **not physical time**. Complete warm-up sweeps are discarded; one state is retained after each configured number of further sweeps. Rejected and unchanged states remain eligible measurements. Complete tiny transition matrices in the [sampler tests](../../src/algorithms/pottsSampler.test.ts) check stochasticity, detailed balance, positive diagonal and irreducibility at finite valid parameters.

## Exact counting references

[`exactPotts`](../../src/models/pottsExact.ts) enumerates no more than 256 configurations. Subtracting the minimum action before exponentiation avoids numerical overflow. It returns absolute log Z, probabilities, site/color marginals, bond/pair equality and observable moments. All q^V configurations enter the reference, even when the UI shows only the first 16. No large-volume exact reference is invented.

For an isolated site,

\[
Z_1=e^h+q-1,\qquad p_0=e^h/Z_1.
\]

For a uniform dimer at h=0, the q equal and q(q−1) unequal configurations give

\[
Z_2=q(e^K+q-1),\qquad
\langle\delta_{\sigma_1,\sigma_2}\rangle=\frac{e^K}{e^K+q-1}.
\]

For a uniform triangle at h=0, all-equal, two-equal and all-distinct colorings give

\[
Z_\triangle=q e^{3K}+3q(q-1)e^K+q(q-1)(q-2),
\]

\[
\langle\delta_b\rangle=
\frac{3q e^{3K}+3q(q-1)e^K}{3Z_\triangle}.
\]

When K<0, q=2 cannot satisfy all three unequal-color preferences: the six ground configurations each retain one equal bond. For q=3 all six permutations have zero equal bonds. For q=4 there are 24 such ground configurations. These ground-state counts assume equal negative bonds and h=0; unequal couplings or a source can split degeneracies. The [exact tests](../../src/models/pottsExact.test.ts) compare these formulas across signed K and enumerate their multiplicities independently.

## Exact q=2 Ising correspondence, including normalization

Map color 0 to s=+1 and color 1 to s=−1. Then δequal=(1+sᵢsⱼ)/2 and δcolor0=(1+sᵢ)/2. With the same physical bond records,

\[
J_b=K_b/2,\quad b_i=h/2,\quad
C=\frac{\sum_b K_b+Vh}{2},\quad
S_P=S_I-C,
\]

\[
Z_P=e^C Z_I,\qquad \log Z_P=\log Z_I+C.
\]

Normalized probabilities agree, but absolute actions and partition functions differ by this constant. Self-links and parallel bonds enter C. At q=2, m₀ equals Ising signed magnetization and majority order equals its absolute value. [Exact tests](../../src/models/pottsExact.test.ts) compare every state's absolute action/probability, partition shift, site/pair/bond expectations and magnetization moments against the existing graph Ising and finite 2D Ising references. [Injected-uniform tests](../../src/algorithms/pottsSampler.test.ts) also compare both local algorithms' transitions to the existing Ising samplers. Other q do not admit this two-valued correspondence.

## Measurements and correlations

For color counts nₐ and fractions pₐ=nₐ/V,

\[
m_0=\frac{q p_0-1}{q-1},\qquad
m_{\mathrm{majority}}=\frac{q\max_a p_a-1}{q-1}.
\]

The first quantity can be negative. The second has a positive finite-volume equilibrium mean even for independent uniform colors; positive majority order alone is not evidence of symmetry breaking. Action S and S/V are dimensionless action and action density, never physical energy density. Full-segment Welford moments, site occupancies and physical-bond agreement counts are separate from the recent display history.

Spatial equality is

\[
C_\alpha(r)=\left\langle\frac1{n_\alpha(r)}
\sum_{i\text{ admissible}}\delta_{\sigma_i,\sigma_{i+r\hat\alpha}}\right\rangle,
\qquad G_q(r)=\frac{q C_\alpha(r)-1}{q-1}.
\]

`pottsSpatial` uses all admissible origins for each axis and wraps only periodic axes. x and y remain separate; lags are bounded by min(8,Lα−1), with Cα(0)=1. These are raw equality/normalized equality correlations, **not connected covariance**, including at nonzero h. In an independent source-biased product law, C(r>0)=Σₐpₐ², which need not equal 1/q. Tiny graph pair comparisons use exact enumeration where available.

## State ownership and limits

[`PottsRun`](../../src/engine/pottsRun.ts) owns configuration, RNG, update count and measurements; [`PottsClient`](../../src/engine/pottsClient.ts) owns one in-flight batch and acknowledged scheduling. Small and Lattice Systems create independent instances. Display selection, ToolDeck operations and exact reference queries consume no randomness. Compatible coupling/source/sampler/cadence changes preserve colors and RNG but start fresh measurement segments with their own local warm-up. q, geometry, boundaries, explicit named-example launches and Reset start seeded sessions. Edits to the seed apply on Reset/support change.

There are at most eight segments and 256 recent measured records per segment. Oldest segments are explicitly counted when discarded. Scalar history covers its displayed range; tiny systems additionally retain color vectors. Full aggregates do not become recent-window estimates. Large systems do not retain every configuration or a site-pair matrix. Local Run batches contain 1024 attempts for more than eight sites and 128 otherwise; direct commands cap at 4096.

Local samples are correlated. Strong coupling, large fields and antiferromagnetic frustration can make mixing very slow; no finite run proves equilibration, a critical point, universality or a thermodynamic limit. There are no unvalidated susceptibility/Binder formulas, independent-sample error bars or automatic criticality detection. Multiseed moderate-coupling regression benchmarks are defined in the tests linked by the [validation summary](../RELEASES.md#potts).

M5d now adds the related [FK/Edwards–Sokal representation](fk-edwards-sokal.md), exact joint draws and Swendsen–Wang on the zero-source ferromagnetic subset. The usual bond probability 1−exp(−K) remains invalid for negative K; the signed Potts model and historical local/direct samplers described here are unchanged. No XY/clock interaction, archive/sweep schema or universal runtime is introduced.

## Exercises

1. Derive the q=2 action map and partition constant, including a self-link.
2. Enumerate the 27 q=3 triangle colorings by number of agreeing bonds.
3. Compare the q=2 and q=3 antiferromagnetic ground states and explain frustration.
4. Derive the conditional softmax by canceling action terms independent of the selected site.
5. Count the periodic 2×2 lattice's eight bonds and verify the Potts/Ising identity with unequal x/y couplings. Explain why deleting parallel records changes both its action and C.
