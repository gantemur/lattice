# Euclidean harmonic oscillator: from paths to a spectral gap

This is the mathematical reading companion to [M4b](../RELEASES.md#euclidean-qm). Follow the implementing functions in the order below; each calculation is a pure TypeScript function and has a nearby independent test. Units are `ℏ=k_B=m=1`.

## Time slicing and the Gaussian action

The continuum Hamiltonian is `H=p²/2+ω²x²/2`. On a periodic Euclidean circle of extent `β`, choose `N` time sites, `a=β/N`, and `x_N=x_0`. The symmetric-slice action is

`S_a(x)=Σ_(j=0)^(N−1)[(x_(j+1)−x_j)²/(2a)+aω²x_j²/2]`.

The path measure is proportional to `exp(−S_a)∏_(j=0)^(N−1)dx_j`. `x_N` is only a closing display point. [`oscillatorAction`](../../src/models/oscillator.ts) computes this directly; [`oscillatorField`](../../src/models/oscillator.ts) maps it to the existing periodic Gaussian bond action with `r=aω²`, `κ=1/a`, `j=0`. The map is independently checked in [`oscillator.test.ts`](../../src/models/oscillator.test.ts), including a tiny precision matrix. `N=4–64`, `β=2–16`, `ω=0.25–4` have their own validation: fine spacing can make `κ>10` or `r<0.05`, outside the standalone Gaussian UI teaching bounds.

The precision matrix is `Q=aω²I+(1/a)L_cycle`, with one bond per oriented positive-time step. In Fourier mode `k`, [`oscillatorEigenvalues`](../../src/models/oscillatorReference.ts) returns

`λ_k=aω²+(4/a)sin²(πk/N)`.

The constant mode has eigenvalue `aω²>0`; it is **not removed**. The variance of the path average `N⁻¹Σ_jx_j` is `1/(Nλ_0)=1/(βω²)`.

## Exact correlator and finite-spacing gap

[`fourierCorrelator`](../../src/models/oscillatorReference.ts) calculates the exact finite-lattice two-point function

`C_a(ℓ)=N⁻¹Σ_k cos(2πkℓ/N)/λ_k`.

The independent closed form in [`latticeCorrelator`](../../src/models/oscillatorReference.ts) is

`C_a(ℓ)=a cosh[Ω_a(β/2−ℓa)]/[2 sinh(aΩ_a) sinh(βΩ_a/2)]`, where `Ω_a=(2/a)asinh(aω/2)`.

`Ω_a` is the **exact finite-spacing transfer gap**, not a Monte Carlo estimate. At fixed `β,ω`, it approaches the continuum frequency `ω` with an `O(a²)` difference. The continuum thermal reference is `C_β(t)=cosh[ω(β/2−t)]/[2ω sinh(βω/2)]`. [`oscillator.test.ts`](../../src/models/oscillator.test.ts) compares Fourier, dense Cholesky, closed form and continuum refinement. The view labels finite lattice and continuum separately.

For each retained path, [`pathCorrelator`](../../src/observables/oscillatorCorrelator.ts) computes `c_x(ℓ)=N⁻¹Σ_jx_jx_(j+ℓ)`. [`segmentCorrelator`](../../src/observables/oscillatorCorrelator.ts) projects the worker's **full-segment** pair-product matrix into the same quantity, so evicting old display vectors does not truncate the estimate. Do not subtract the mean of an individual path: that would delete its physical constant mode. In exact symmetric equilibrium, `〈x〉=0`, so this unconnected two-point is connected. A finite run may have a nonzero empirical mean.

The cosh estimator in [`effectiveGap`](../../src/observables/oscillatorCorrelator.ts) is `a⁻¹acosh[(C(ℓ−1)+C(ℓ+1))/(2C(ℓ))]`; at an even-N midpoint, use reflection for `ℓ+1`. [`assessSampledGap`](../../src/observables/oscillatorCorrelator.ts) withholds a displayed value until 64 retained paths in that segment. Even then the result is provisional and uncorrected: local paths may be autocorrelated, fixed warm-up does not establish equilibrium, and 64 paths do not imply 64 independent draws. A noisy or nonpositive input may be outside the real domain, in which case the display says N/A. No uncertainty for this nonlinear estimator is inferred from one correlator value. The raw sampled correlator remains visible before the gap threshold. Tests compare direct path loops and pair projection and check the count boundary, exact gap and invalid ratios.

## Symmetric transfer operator and normalization

For `V(x)=ω²x²/2`, [`transferKernel`](../../src/models/oscillatorTransfer.ts) implements

`T_a(x,y)=(2πa)^(−1/2) exp[−(x−y)²/(2a)−a(V(x)+V(y))/2]`.

This is the symmetric Trotter step `e^(−aV/2)e^(−ap²/2)e^(−aV/2)`, **not** exact `e^(−aH)` at finite `a`. As an operator it is positive self-adjoint because of the positive kinetic semigroup between the two multiplication factors. Positive kernel entries alone would not establish operator positivity. Its oscillator eigenvalues are `t_n=exp[−aΩ_a(n+1/2)]`, so the first two finite-spacing levels are `Ω_a/2` and `3Ω_a/2`.

The raw product-Lebesgue Gaussian integral is `Z_raw=∫exp(−S_a)∏dx_j`. [`oscillatorPartition`](../../src/models/oscillatorReference.ts) computes its spectral determinant, then separately computes

`Z_QM=(2πa)^(−N/2) Z_raw=Tr(T_a^N)=1/[2sinh(βΩ_a/2)]`.

The kinetic prefactor is essential. The test compares the determinant and transfer formulas independently. [`transferQuadrature`](../../src/models/oscillatorTransfer.ts) forms a finite positive-weight trapezoidal Nyström matrix with `33`, `49` or `65` symmetric coordinate nodes and a disclosed cutoff. Its two leading eigenvalues and gap approximate the integral operator; the analytic `Ω_a` remains authoritative. [`assessTransferQuadrature`](../../src/models/oscillatorTransfer.ts) compares the grid gap against this known answer and checks the leading-eigenvalue bound `t₀<1`. It labels a discrepancy over 5% or a bound violation as under-resolved and unusable eigenvalue data as unavailable. For `N=64, β=2, ω=0.25`, 49 nodes have spacing 0.5 versus kinetic width `√a≈0.177`: the grid gap is about 0.131 versus exact 0.250. This is discretization error in a valid approximation method, not a defect of analytic transfer theory. [`symmetricEigenvalues`](../../src/models/oscillatorTransfer.ts) is a small cyclic-Jacobi solver, tested on a hand-checkable `[[2,1],[1,2]]` matrix.

## Reflection positivity, carefully stated

[`reflectionExample`](../../src/models/oscillatorTransfer.ts) selects positive-time indices on one half-circle and constructs `G_ij=C_a(i+j)`. Its eigenvalues are nonnegative up to roundoff in the tested finite examples; low-rank examples may have zero eigenvalues. This illustrates the transfer-operator positivity structure. A noisy Monte Carlo Gram can have a small negative eigenvalue without disproving the exact property. Finite matrix checks are **not** a proof of the full Osterwalder–Schrader axioms. [`oscillatorTransfer.test.ts`](../../src/models/oscillatorTransfer.test.ts) checks several lattice sizes.

## Two kinds of time

The horizontal path and correlator axes use **Euclidean coordinate time** `t=ja`. The Run and Step counters in [`FieldRun.advance`](../../src/engine/fieldRun.ts) use **algorithmic updates**. One spectral update replaces a whole independent path and consumes exactly `2N` seeded uniforms. A local heat-bath or Metropolis update chooses one time site; `N` such updates constitute a nominal Monte Carlo sweep, not real or Euclidean time evolution. Warm-up and stride are segment-local. Changed `β`, `ω` or sampler at fixed `N` preserve configuration and RNG but begin isolated statistics; changing `N`, switching models, or Reset starts a seeded session. The view and transfer calculations consume no RNG. [`oscillatorRun.test.ts`](../../src/engine/oscillatorRun.test.ts) checks these boundaries.

## Small exercises

1. Write down `Q` for four sites at `a=ω=1` and invert one row by hand; compare with `fourierCorrelator`.
2. Set `N=2` in the periodic bond construction used by the model test. Why are two distinct parallel bonds needed?
3. Compute `log Z_raw−log Z_QM` for one small `N` and verify the kinetic factor.
4. Hold `β,ω` fixed and halve `a` repeatedly. Compare `Ω_a−ω` at successive refinements.
5. Implement the direct path-loop correlator without reading the pair-product projection; check both on the same seeded paths after the plotting history has evicted old vectors.
