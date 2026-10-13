# Hamiltonian Monte Carlo for spatial φ⁴

Start with [the spatial measure](spatial-phi4.md) and its bond conventions. HMC is a second sampler for exactly that finite-dimensional distribution; it does not add physical dynamics. The separate [QM HMC guide](hmc-euclidean-qm.md) retains the Euclidean path interpretation.

## Target and full force

For V real site variables and positive-axis bond records B,

```text
S(φ) = Σ_i (rφ_i²/2 + λφ_i⁴/4 − jφ_i)
       + ½ Σ_b κ_b (φ_tail(b) − φ_head(b))²,
π(φ) ∝ exp(−S(φ)) ∏_i dφ_i.
```

There is no extra beta or lattice-time factor and no zero-mode projection. The constant mode fluctuates. The M4d1 ranges remain r∈[−4,20], λ=0 or [0.01,4], κx,κy∈[0,10], |j|≤10; λ=0 requires r≥0.05. Chains have 2–64 sites and κy=0; rectangles have 2–8 sites per axis. Open boundaries omit wraps without fixing boundary fields. Periodic length-two axes retain both parallel bonds, and x/y stiffnesses can differ.

[`phi4Gradient`](../../src/models/phi4Field.ts) differentiates the complete action:

```text
g_i(φ) = rφ_i + λφ_i³ − j + Σ_(incident b) κ_b(φ_i − φ_other(b)).
```

Every bond record contributes separately. The force is never inferred from a Gaussian reference. [`phi4Hmc.test.ts`](../../src/algorithms/phi4Hmc.test.ts) compares it with centered differences of the full action on open, periodic, anisotropic and mixed geometries, and with Qφ−j1 in the Gaussian limit.

## Auxiliary phase space and leapfrog

Each trajectory refreshes independent `p_i~N(0,1)` and uses identity auxiliary mass:

```text
H_HMC(φ,p) = S(φ) + K(p),       K(p) = ½Σ_i p_i².
```

[`phi4HmcHamiltonian`](../../src/algorithms/phi4Hmc.ts) keeps action, kinetic and total distinct. These momenta are fictitious integration variables, not physical field momenta. The shared pure [`leapfrog`](../../src/algorithms/leapfrog.ts) copies both inputs, takes a half kick `p−=εg/2`, drifts `φ+=εp`, and finishes the half kick at the new position. Interior adjacent half kicks share a force evaluation. L successful steps use L+1 full gradients. The final momentum is negated to make the deterministic proposal involutive in exact arithmetic.

Each kick has block Jacobian `[[I,0],[-c Hess(S),I]]`; each drift has `[[I,cI],[0,I]]`. These triangular shears have determinant one and are symplectic. Their composition preserves phase-space volume and is reversible. Momentum reversal preserves **absolute** volume but is not itself a symplectic shear. Applying the complete flipped map twice recovers the input in exact arithmetic. Tests also use independently written backwards velocity-Verlet steps and a finite-difference dimer phase-space Jacobian.

Finite-step leapfrog does **not** exactly preserve H. At fixed auxiliary duration τ=Lε, smooth finite trajectories have second-order global integration error. A nonstationary tilted fixture at τ=0.4 tests L=8,16,32 and approximately fourfold reduction in |ΔH|. This is an asymptotic numerical example, not a claim of monotone errors for every stochastic trajectory.

The shared integrator deliberately retains the released QM arithmetic ordering. [`hmcReplay.test.ts`](../../src/algorithms/hmcReplay.test.ts) compares exact decimal golden outputs captured at main `14ae50c`, including accepted/rejected/divergent QM proposals, uniform counts and hashes of complete worker snapshots. Existing QM exports and all their tests remain valid. Spatial wrappers use typed `Phi4ArithmeticError` recovery, rather than treating arbitrary model/programming errors as rejections.

## Corrected whole-field transition

[`hmcPhi4Transition`](../../src/algorithms/phi4Hmc.ts) evaluates the starting Hamiltonian, integrates, and accepts the reversed proposal with

```text
ΔH = H_proposed − H_start,
α = exp(min(0,−ΔH)),          accept iff u < α.
```

The correction uses the complete action-plus-kinetic difference, not ΔS alone. Volume preservation and reversibility give the joint-density Metropolis ratio; momentum refresh leaves the same joint target invariant. Discarding momenta after the decision gives the desired field marginal. The next trajectory refreshes all momenta again.

The existing uncached Box–Muller draw uses two midpoint uniforms per normal. Every attempted trajectory consumes **exactly 2V+1 uniforms**, including automatic acceptance, finite rejection and arithmetic-divergence rejection. A rejected proposal preserves the entire old field. Invalid parameters, cadence or starting state throw rather than masquerading as Metropolis rejection. Valid spatial starts are checked before RNG consumption.

Nonfinite proposal positions, momenta, forces, actions or Hamiltonians cause a reported numerical divergence. The final acceptance uniform is still consumed and the old state remains authoritative. A large finite positive ΔH uses its actual probability, which may underflow to zero; there is no arbitrary finite-error cutoff. These safeguards make practical finite-precision failure explicit, not rigorously reversible under every overflow mode. Smaller ε may be needed for stiff or large fields; the application never retunes it automatically.

## Worker measurements, diagnostics and units

[`FieldRun`](../../src/engine/fieldRun.ts) owns fields, RNG and measurements. One HMC Step is a **whole-field trajectory**. HMC warm-up and stride count complete trajectories; intermediate MD fields never enter measurements, while rejected trajectories remain measurement-eligible. Local Metropolis retains one random-site attempt per Step and V attempts per nominal sweep. Applied settings contain exactly one cadence system.

Fixed-geometry changes to physical parameters, sampler, ε/L, width or cadence preserve field/RNG and start an isolated segment with fresh warm-up. Geometry/family changes and Reset seed new sessions. The monotone global update index spans both algorithms, so equal increments are not equal work. Eight retained segments each keep at most 256 recent field vectors; full site moments, m²/m⁴, S/V, pair products and sign diagnostics survive vector eviction. No archive format changes.

Spatial Run batches contain eight trajectories; direct HMC requests allow at most 32 and reject excessive counts before mutation. The existing client allows one batch in flight. Pause waits for that boundary before Step; pending settings apply after the batch. QM HMC keeps 16-trajectory Run batches, and local samplers keep 128 updates. No renderer or lazy reference draws from the simulation RNG.

HMC diagnostics include attempted/accepted/rejected counts **including warm-up**, divergences as a rejection subset, finite signed ΔH mean/RMS/max, gradient work and completed leapfrog steps. Stable scaled sums avoid squaring huge finite defects directly. Each segment retains at most 256 individual ΔH records. Spatial work counts include an attempted force call that overflows; successful trajectories have L+1. The shared integrator preserves QM's historical successful-force count on failure. The latest trace has start/proposed S,K,H, signed ΔH, α,u, outcome, ε,L,Lε, work and at most L completed-step defects, without full momentum/intermediate-field histories.

The controls and tools distinguish spatial coordinates, fictitious MD duration, and algorithmic trajectory index. Euclidean time belongs to the separate QM model. Auxiliary ΔH is not physical energy or cumulative chain drift. High acceptance and small defects do not establish mixing. Sign changes of field averages depend on algorithm and retained cadence, not a physical tunneling rate. One trajectory requires many gradients; it cannot be compared with one local attempt as equal work.

## Independent distribution checks

[`phi4HmcBenchmark.test.ts`](../../src/engine/phi4HmcBenchmark.test.ts) uses four declared seeds and fixed budgets/tolerances. It checks a 2×2 anisotropic Gaussian with independent precision eigenvalues 2,6,4,8, an open Gaussian, and one HMC step applied to independently drawn exact equilibrium fields using separate RNG streams. Decoupled symmetric/tilted quartics use one-site quadrature and independent-coordinate moment identities, including m⁴. Coupled open/periodic dimers use refined test-only tensor quadrature with an explicit independent action. A 4×4 interacting example checks symmetry and finite moments; local-Metropolis agreement is only secondary evidence.

For a periodic chain with κ>0, set `a=1/κ`, `β=N/κ` and `(rQM,λQM,hQM)=κ(r,λ,j)`. The spatial and QM actions, gradients and identity-mass HMC proposals then agree up to summation roundoff. The required N=16, κ=2, r=−1, λ=0.5, j=0 maps to QM β=8, rQM=−2, λQM=1, hQM=0. Its separately resolved finite-ring transfer C(0),C(1) benchmark the HMC ensemble. The transfer gap ≈0.329211319864 gives spatial ξ≈6.07512 sites; it predicts neither HMC acceptance nor mixing time. Existing transfer resolution gates remain unchanged.

Spatial observables retain M4d1 meanings: zero-source raw correlations are connected in equilibrium by reflection symmetry; nonzero-source plug-in centering uses full-segment **site-specific** means. No per-configuration demeaning or unsupported independent-sample error bars are added. Fixed budgets and a few seeded comparisons do not prove stationarity, interwell mixing, continuum limits or critical behavior. See [the review](../M4D2_REVIEW.md) for actual figures and browser measurements.

## Exercises

1. List all eight positive-axis bonds of a periodic 2×2 rectangle. Differentiate their anisotropic action and verify the four Gaussian eigenvalues above.
2. For the periodic dimer r=−1, λ=0.5, κ=2, j=0, take φ=(1,−1), p=(0.5,−0.5), ε=0.1. Check S=7.25, g=(7.5,−7.5), and the first drift φ′=(1.0125,−1.0125). Finish the kick, flip momentum, and compute ΔH.
3. Multiply the block Jacobians of one kick and drift. Explain why momentum reversal preserves absolute volume but must be distinguished from the symplectic leapfrog map.
4. Substitute the spatial/QM coefficient mapping into both actions, then compare one deterministic HMC trajectory. Why is exact cross-model bitwise equality unnecessary, while seeded same-model replay must remain exact?
5. Compare a double-well run at two ε values. Separate integration-quality evidence from exploration of both wells, and account for gradient work before comparing efficiency.
