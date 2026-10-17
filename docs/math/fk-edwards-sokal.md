# FK random clusters, Edwards–Sokal coupling and Swendsen–Wang

## Physical convention and domain

M5d keeps the counting-measure Potts action

\[
S_P(\sigma)=-\sum_{e\in E}K_e\delta_{\sigma_{t(e)},\sigma_{h(e)}}
\]

with q=2,3,4, zero distinguished-color source and every physical K in [0,4]. Set `p_e=-expm1(-K_e)` so small positive K is accurate. These are representation restrictions, not restrictions on the existing signed/source-biased Potts algorithms. `fkIneligibility` in [fk.ts](../../src/models/fk.ts) explains unsupported requests; validation precedes RNG or state changes.

One occupation flag η_e belongs to every physical edge ID, including present K=0 edges, parallel bonds and self-links. These auxiliary random-cluster variables are not gauge links. The periodic 2×2 torus still has eight bond records and four oriented faces; its FK enumeration has 256 words. `fkComponents` uses union by size and path compression, followed by an ascending-site scan to label components by their smallest vertex. Isolates count. An occupied self-link counts as a bond but does not merge vertices. Components are independent of spin-color domains: disconnected clusters can receive the same color.

## Two partition functions and one joint measure

For occupied set A, with k(A) components including isolates,

\[
w_{FK}(A)=q^{k(A)}\prod_{e\in A}p_e\prod_{e\notin A}(1-p_e),
\quad Z_{FK}=\sum_A w_{FK}(A).
\]

For a spin/bond pair use the unnormalized weight

\[
w_{ES}(\sigma,A)=\prod_e\left[(1-p_e)\mathbf1_{e\notin A}
+p_e\mathbf1_{e\in A}\delta_{\sigma_t,\sigma_h}\right].
\]

Summing colors for fixed A gives q independent choices per component, hence w_FK. Summing bonds for fixed σ gives `Π_e[(1-p_e)+p_e δ_equal]`. Since `1-p_e=e^(−K_e)`, this equals `exp(−ΣK_e) exp(−S_P(σ))`. Therefore

\[
Z_P=e^{\sum_e K_e}Z_{FK},\qquad
\log Z_P=\log Z_{FK}+\sum_eK_e,
\]

and equivalently `Z_P=Σ_A q^k(A) Π_(e∈A)(exp(K_e)−1)`. Every physical record contributes to the constant, including self and parallel bonds. At all K=0 only the empty bond word has nonzero weight and both partition functions are q^V.

[exactFK](../../src/models/fkExact.ts) enumerates only V≤4 and E≤8, uses log-sum-exp, and retains impossible open-zero-coupling words with probability exactly zero. It reports absolute log partitions, all word weights/probabilities, per-bond occupancy, pair connectivity, cluster/bond/largest-size distributions and mean component-size counts. The cap is separate from the older q^V≤256 Potts reference.

## Conditional laws and identities

Given σ, agreeing physical bonds are independent Bernoulli(p_e); disagreeing bonds are closed. Given A, each component independently receives one uniform color in {0,…,q−1}. Each compatible complete coloring therefore has probability q^(−k(A)). These conditionals normalize the same ES joint law; neither requires a Metropolis correction.

Conditioning on whether i and j share a component gives

\[
\langle\delta_{\sigma_i,\sigma_j}\rangle
=\frac1q+\left(1-\frac1q\right)P(i\leftrightarrow j),
\qquad \langle\eta_e\rangle=p_e\langle\delta_{\sigma_t,\sigma_h}\rangle.
\]

Connected sites necessarily agree; disconnected components agree with probability 1/q. A spin domain may thus contain several FK clusters. For q=2, color 0→+1 and color 1→−1, J_e=K_e/2, and p_e=1−exp(−2J_e). Connectivity equals the zero-field Ising raw pair expectation. The absolute constants also obey `log Z_P=log Z_Ising+ΣK/2`, hence `log Z_FK=log Z_Ising−ΣK/2`.

A hand-checkable q=3 dimer at K=log 2 has p=1/2. Empty and open FK weights are 9/2 and 3/2: Z_FK=6, Z_P=12, P(open)=P(connected)=1/4 and Potts equality=1/2.

## Sampling algorithms and reversibility

[pottsClusterTransition](../../src/algorithms/pottsClusterSampler.ts) implements two distinct algorithms:

1. **Exact FK joint draw:** one uniform chooses a word from the exact FK CDF, then k(A) uniforms color its canonical components. Exactly **1+k(A)** uniforms, including the CDF uniform when only the empty word is possible. Each draw uses fresh independent random inputs and ignores the previous colors, which establishes independence; an empirical autocorrelation trace is not the proof.
2. **Swendsen–Wang:** visit physical bonds in stored order, drawing one uniform for each even when K=0 or endpoints disagree; compute components without randomness; draw one color per component in canonical order. Exactly **E+k(A)** uniforms. One update refreshes the full bond configuration and recolors all sites. It has no acceptance rate.

For the collapsed spin chain,

\[
P_{SW}(\sigma,\sigma')=\sum_A\pi_{ES}(A\mid\sigma)\pi_{ES}(\sigma'\mid A),
\]

\[
\pi_P(\sigma)P_{SW}(\sigma,\sigma')=
\sum_A\pi_{FK}(A)\pi_{ES}(\sigma\mid A)\pi_{ES}(\sigma'\mid A).
\]

The last expression is symmetric in σ,σ′, proving detailed balance and stationarity. At finite supported K every state has positive probability of the empty-bond route, from which all colorings have positive probability: the finite spin chain is irreducible and has positive diagonal. At K=0 this route occurs with probability one, so a single SW trajectory is exactly a product-uniform draw regardless of its starting state. These facts do not bound practical mixing time at strong coupling or near a transition.

## Worker units, storage and interpretation

[PottsRun](../../src/engine/pottsRun.ts) remains the common engine for two independent Small/Lattice sessions. The historical direct/Metropolis/heat-bath kernels and draw ordering are unchanged. Local cadence counts V random-site attempts per nominal sweep; direct Potts and FK retain every complete draw. SW uses explicit `warmupTrajectories` and `strideTrajectories`: one Step is one complete trajectory, not V independent samples and not physical time.

Fixed-support parameter/sampler/cadence changes preserve colors and RNG but begin a new segment and clear the current auxiliary image. q/geometry/boundary changes and Reset reseed. FK summaries exist only for genuine auxiliary measurements. Scheduled unchanged states are retained. Spin and FK aggregates use the same measurement boundary. Work counters include warm-up; equilibrium summaries exclude it. At most eight segments, 256 recent scalar measurements per segment and one latest full auxiliary image are kept. Small systems retain pair connectivity; large boxes have per-bond and bounded size histograms, not an NxN matrix. Full aggregates survive recent-history eviction. Cluster-size histograms count components, not size-biased sites.

[PottsClient](../../src/engine/pottsClient.ts) retains one in-flight command, queued Apply and acknowledged Pause. Cluster Run batches contain eight trajectories, with a per-command cap of 32; old 128/1024 local batching and 4096 cap remain. Component finding is near-linear O((V+E)α(V)); recoloring is O(V); existing bounded-lag spin measurements remain separate. Plot palettes and tool assignments never consume RNG. Equal algorithmic update counts are not equal computational work or sampling efficiency.

No independent-sample error bars are assigned to correlated SW data. Fixed warm-up is a budget, not a mixing certificate. No FK external-field/ghost-spin construction, antiferromagnetic representation, noninteger q, alternative cluster dynamics, XY, gauge clusters, new archives or sweeps are included. Nonzero fields would require a correctly weighted extension of the joint law; negative K cannot be repaired by clipping a negative bond probability.

## Independent checks and reading exercises

Read [fk.test.ts](../../src/models/fk.test.ts), [test-only BFS/joint oracle](../../src/test/fkOracle.ts), [complete SW matrices](../../src/algorithms/pottsClusterSampler.test.ts), [worker tests](../../src/engine/fkRun.test.ts), [client tests](../../src/engine/fkClient.test.ts), [released replay fixtures](../../src/engine/pottsReplay.test.ts), and [fixed multiseed comparisons](../../src/engine/fkBenchmark.test.ts). The [validation summary](../RELEASES.md#fk-clusters) links the reproducible benchmarks, budgets and limits.

1. Sum either variable out of w_ES and derive the partition constant, keeping a self-link.
2. Reproduce the rational q=3 dimer values without running code.
3. Derive the connectivity identity by conditioning on component membership.
4. Explain why the symmetric detailed-balance sum uses the **FK** marginal.
5. Enumerate the eight-bond torus; explain why four effective pair couplings cannot replace eight independent occupation flags.
6. Prove one-step K=0 independence, then count uniforms for each new algorithm.

## Primary references

- R. H. Swendsen and J.-S. Wang, “Nonuniversal critical dynamics in Monte Carlo simulations,” _Physical Review Letters_ **58**, 86–88 (1987), [original paper](https://journals.aps.org/prl/abstract/10.1103/PhysRevLett.58.86).
- R. G. Edwards and A. D. Sokal, “Generalization of the Fortuin–Kasteleyn–Swendsen–Wang representation and Monte Carlo algorithm,” _Physical Review D_ **38**, 2009–2012 (1988), [original paper](https://doi.org/10.1103/PhysRevD.38.2009).
