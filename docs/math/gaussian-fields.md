# Massive Gaussian lattice fields: equations and source map

This M4a1 model assigns one real number `φᵢ` to each site of an explicit 1D chain or row-major 2D rectangle. Begin with [`fieldLattice.ts`](../../src/domain/fieldLattice.ts): a positive-axis bond is recorded once, even when a periodic length-two axis has a second, parallel wrap bond. An open side simply omits that wrap; it does not prescribe `φ=0` at the edge. The geometry tests in [`fieldLattice.test.ts`](../../src/domain/fieldLattice.test.ts) enumerate two-site and 2×2 cases by hand.

## Action and precision

The dimensionless action, relative to ordinary product Lebesgue measure `∏ᵢdφᵢ`, is

`S(φ) = (r/2) Σᵢ φᵢ² + (1/2) Σ_b κ_b(φ_tail(b)−φ_head(b))² − j Σᵢφᵢ`.

Here `r>0` is the quadratic precision coefficient, `κ_b=κx` or `κy` by bond direction, and `j` is a uniform source. There is no separate inverse temperature. `r` must not be confused with the particle mass in a later Euclidean oscillator. [`fieldAction`, `fieldGradient`, `fieldPrecision`](../../src/models/gaussianField.ts) implement `S`, `∇S=Qφ−j1`, and `Q=rI+` the weighted graph Laplacian. Each bond adds `κ[[1,−1],[−1,1]]` on its endpoints. Nonnegative stiffness and `r>0` make `Q` positive definite.

For a two-site _open_ chain with `r=2, κx=3, j=2`, `Q=[[5,−3],[−3,5]]`, `det Q=16`, `μ=(1,1)` and `C=Q⁻¹=[[5,3],[3,5]]/16`. Periodic length two contributes a second bond and gives `Q=[[8,−6],[−6,8]]`. These arithmetic checks appear in [`gaussianField.test.ts`](../../src/models/gaussianField.test.ts), independently of the matrix-builder implementation. Setting `κ=0` recovers two copies of the existing 0D and small-graph Gaussian references.

## Local update mathematics

With neighbors held fixed, the selected-site conditional is Gaussian with `qᵢ=Qᵢᵢ=r+Σ_(incident b)κ_b`, variance `1/qᵢ`, and mean `(j+Σ_(incident b)κ_b φ_neighbor)/qᵢ`. This fixed-neighbor conditional is not the equilibrium site marginal, whose variance is `Cᵢᵢ`. [`fieldConditional` and `fieldLocalDifference`](../../src/models/gaussianField.ts) use incident bond records directly. The local difference equals `S(φ with φᵢ replaced)−S(φ)`; tests compare it to two independent full-action evaluations, including signed configurations and periodic parallels. Finite differences independently check the gradient.

[`fieldTransition`](../../src/algorithms/gaussianFieldSampler.ts) implements three algorithmic updates. A direct draw replaces all sites and consumes two Box–Muller uniforms per component. Coordinate heat bath draws one site uniform, then two normal uniforms for its conditional. Symmetric-uniform Metropolis draws site, proposal, and decision uniforms in that order; a rejection preserves the old field. `N` random-site local updates are one nominal sweep, not physical time. [`gaussianFieldSampler.test.ts`](../../src/algorithms/gaussianFieldSampler.test.ts) fixes these draw counts, and [`fieldRun.test.ts`](../../src/engine/fieldRun.test.ts) checks Step/batch seed replay, warm-up and parameter segments.

## Dense finite-volume reference

[`exactGaussianField`](../../src/models/gaussianFieldReference.ts) uses readable dense Cholesky `Q=LLᵀ`, triangular solves `Qμ=j1` and `QC=I`, and

`log Z = (N/2)log(2π) − Σᵢlog Lᵢᵢ + (1/2)j1ᵀμ`.

The ordinary measure fixes this normalization; no grid-spacing or Fourier-mode factors are implicit. To draw a full field, independent standard normals `z` solve `Lᵀ(φ−μ)=z`, giving covariance `L⁻ᵀL⁻¹=Q⁻¹`. The code checks the `QC≈I` residual and rejects unsupported singular or unstable calculations. Every supported M4a1 geometry has at most 64 sites, and full covariance is calculated only when the model or a parameter segment is created, not on every render. The reference is analytic for this finite Gaussian measure up to floating-point rounding. It is neither a sampled estimate nor an infinite-volume limit.

## Reading and modification exercises

1. Draw the two bonds of a periodic two-site chain. Predict each entry of `Q`, then run `npx vitest run src/models/gaussianField.test.ts`.
2. Increase `κx` in the open two-site example. Predict whether the difference-field variance rises or falls; check the computed covariance while keeping `r` fixed.
3. Choose a signed four-site field and propose one changed site. Recompute every on-site and incident bond contribution by hand, then compare with `fieldLocalDifference` and its test.

Massless `r=0` fields require an explicit zero-mode convention and are deferred to M4a2. Fourier sampling, interacting `φ⁴`, oscillator paths and HMC are also outside this milestone. The [source guide](../SOURCE_GUIDE.md) maps this calculation onward to the worker and browser displays.
