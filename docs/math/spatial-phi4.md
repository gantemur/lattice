# Interacting spatial lattice φ⁴

Start with [`phi4Field.ts`](../../src/models/phi4Field.ts), its [hand-checkable tests](../../src/models/phi4Field.test.ts), and the model-independent [`FieldLattice`](../../src/domain/fieldLattice.ts). One real coordinate lives on each spatial site. The finite measure is

`dP(φ)=Z⁻¹ exp(−S(φ)) ∏ᵢdφᵢ`,

`S=Σᵢ[rφᵢ²/2+λφᵢ⁴/4−jφᵢ]+½Σ_b κ_b(φ_tail−φ_head)²`.

There is no extra inverse temperature. The quartic convention is λ/4, not λ/4!. The constant mode fluctuates. Positive λ confines every coordinate even for negative r; nonnegative bond squares cannot destroy this integrability. At λ=0 the supported ordinary measure requires r≥0.05. A singular constant mode is never repaired by secretly changing to the mean-zero GFF measure.

Teaching bounds are −4≤r≤20, λ=0 or 0.01≤λ≤4, 0≤κx,κy≤10 and |j|≤10. A chain has κy=0. These bounds restrict the interface and reference numerics, not the full mathematical family. Chains have 2–64 sites; rectangles have 2–8 sites per side. Open boundaries omit wrap bonds without fixing boundary values. In 2D, i=x+Lx y. Every positive-axis bond record contributes once; length-two periodic directions have two distinct parallel bonds. A periodic 2×2 rectangle has eight bonds, not four.

For a two-site periodic chain with r=−1, λ=1/2, κ=2, j=0 and φ=(1,−1), the on-site sum is −3/4 and each of two bond squares contributes 4: S=29/4. The open chain instead has S=13/4. `phi4Action` sums the explicit bond records; `phi4LocalDifference` changes only one potential and its incident bonds. Their test oracle independently loops over coordinates rather than using the production incidence list.

## Gaussian and on-site limits

At λ=0, `Q=rI+weighted bond Laplacian`, `μ=Q⁻¹j1`, `C=Q⁻¹` and `log Z=V log(2π)/2−log(det Q)/2+j1ᵀμ/2`. [`phi4GaussianParameters`](../../src/models/phi4Field.ts) permits the existing dense reference only after this exact reduction. An anisotropic periodic 2×2 example with r=2, κx=1, κy=1/2 has eigenvalues 2,6,4,8 and C₀₀=(1/2+1/6+1/4+1/8)/4. This is finite Gaussian analysis up to rounding, not an interacting quadratic approximation.

When all stiffnesses vanish, `Z=Z_site^V` and distinct-site raw products equal μ_site². [`decoupledPhi4Reference`](../../src/models/phi4Reference.ts) reuses the independently validated single-site adaptive quadrature, including its stationary-point partitions, exponent shift, convex tail bound through fourth moments and convergence failures. It runs only when its optional tool is open and uses the existing bounded cache. Difficult unsupported accuracy is reported, not replaced with an invented answer. Coupled two-site test references instead use a separate midpoint tensor quadrature with explicit spacing and cutoff refinements; there is no general multidimensional integration feature.

For j=0 and r<0, the bare on-site minima are ±√(−r/λ), with barrier r²/(4λ). They do not determine an equilibrium marginal or guarantee that a finite local chain explores both wells.

## Local conditionals, Metropolis and gradient

With neighbors fixed, the selected-site conditional has potential

`U_cond(z)=qᵢz²/2+λz⁴/4−bᵢz+constant`,

`qᵢ=r+Σ_(incident b)κ_b`, `bᵢ=j+Σ_(incident b)κ_b φ_neighbor`.

It is quartic whenever λ>0, even for positive qᵢ. The **bare** potential omits neighbor terms; the **conditional** holds neighbors fixed; the equilibrium **marginal** integrates all neighbors out. `phi4LocalTerms` exposes each actual bond contribution and the conditional coefficients without attempting a Gaussian conditional.

[`phi4Transition`](../../src/algorithms/phi4FieldSampler.ts) chooses a site uniformly with replacement, proposes φ′ᵢ=φᵢ+w(2u−1), and accepts with α=exp(min(0,−ΔS)). Exactly three uniforms are consumed in site/proposal/decision order, including downhill moves and rejections. Proposal symmetry gives `π(x)q(x,y)α(x,y)=π(y)q(y,x)α(y,x)`. Numerically overflowed proposals have α=0 and preserve the complete field; large finite ΔS uses the ordinary probability. No artificial unfavorable-action cutoff is imposed.

V attempted single-site updates are one nominal sweep; some sites may be visited repeatedly. Warm-up and stride count complete segment-local sweeps. A rejected configuration can be retained at its scheduled measurement. The initial zero field is not an equilibrium draw. Physical changes on fixed geometry preserve configuration and RNG, but begin isolated measurements and fresh warm-up. Geometry/model changes and Reset restart the selected seed. Display and independent-analysis operations never sample.

The pure full gradient is

`∂ᵢS=rφᵢ+λφᵢ³−j+Σ_(incident b)κ_b(φᵢ−φ_neighbor)`.

[`phi4Gradient`](../../src/models/phi4Field.ts) is tested against centered full-action differences, boundary cases, anisotropic parallel bonds and the Gaussian precision. It is the force primitive for later M4d2 spatial HMC; **no spatial HMC transition is implemented here**. The QM HMC integrator remains unchanged.

## Measurements and spatial correlations

[`FieldRun`](../../src/engine/fieldRun.ts) accumulates full-segment site moments, m=Σφ/V, m², m⁴, S/V and pair products. Only recent complete field vectors are bounded at 256 per segment; there are at most eight segments. An optional `U₄=1−〈m⁴〉/(3〈m²〉²)` is shown after 64 fields and a usable denominator. This is a finite-volume raw-moment ratio, distinct from n−1 sample variance and not a phase-transition or mixing certificate.

[`phi4Correlations`](../../src/observables/phi4Correlator.ts) averages ordered origin/displacement pairs separately in x and y. Periodic directions wrap; open directions use only admissible origins. A mixed/open box is labeled **origin-averaged finite volume**, not translation invariant. At j=0, global reflection symmetry makes every exact equilibrium site mean zero, so raw pair products are also connected equilibrium correlations—even if the observed chain stays mostly in one well. At j≠0, the displayed connected plug-in estimate subtracts each pair's full-segment sampled site means. It does not subtract each individual configuration's spatial average. These correlated estimates have no independent-sample error bars.

The horizontal coordinate is spatial lattice displacement, never Euclidean time or a Monte Carlo update. Tiny 2D boxes do not establish an infinite-volume phase transition, renormalized mass or continuum limit. No automatic 2D correlation-length fit is provided.

## Exact periodic-chain correspondence with Euclidean QM

For a periodic chain with κ>0, set

`a=1/κ`, `β=N a`, `rQM=r/a`, `λQM=λ/a`, `hQM=j/a`.

Then the QM bond term `(x_(i+1)−x_i)²/(2a)` is exactly `κ(φ_(i+1)−φ_i)²/2`, and `a[rQM x²/2+λQM x⁴/4−hQM x]` is exactly the spatial on-site term. With x=φ, the full actions and product-Lebesgue probability measures coincide. No coordinate rescaling or Jacobian occurs. This is an action identity, not a statement that spatial position becomes physical time.

The mandatory example N=16, κ=2, r=−1, λ=1/2, j=0 maps to N=16, β=8, rQM=−2, λQM=1, hQM=0. Tests compare arbitrary common configurations, plus tilted and Gaussian cases. [`spatialQmMapping`](../../src/models/phi4Reference.ts) checks the actual existing QM bounds without changing either model. Open chains, two-site rings, zero κ and otherwise valid spatial parameters outside those bounds get an explicit unavailable transfer reference.

The existing independent [transfer calculation](interacting-oscillator.md) uses the positive symmetric kernel `T_a(x,y)=(2πa)⁻¹/²exp[−(x−y)²/(2a)−a(V(x)+V(y))/2]`. The finite-ring raw correlator is `Tr(T^(N−ℓ) X T^ℓ X)/Tr(T^N)`, with connected mean subtraction when appropriate. The scalar prefactor cancels in normalized observables; for absolute normalization `Z_raw=(2πa)^(N/2)Tr(T^N)`. Coordinate grids 49→97 and an enlarged-cutoff 121-node grid retain all established residual, refinement and near-degeneracy gates. Correlator resolution and leading-splitting resolution are checked separately. The optional computation is lazy in the existing independent analysis worker, never a simulation update or render-time eigensolve.

For a resolved positive ratio `q=t₁/t₀`, `ξ_sites=−1/log q=1/(a ΔQM)` is a **bulk infinite-chain transfer correlation length in lattice spacings**. It differs from the finite-ring correlator and from Monte Carlo mixing time. For the mandatory example, ΔQM≈0.329211319864 gives ξ≈6.07512 sites; that QM numerical splitting is not labeled a spatial energy. A length large relative to N is flagged. Unresolved small splitting yields no trusted length, never zero or infinity substituted as a result.

## Exercises

1. Recompute S for the open and periodic two-site example, then predict the local gradient (15/2,−15/2) in the periodic case.
2. Derive qᵢ and bᵢ at an open corner of a 2×2 rectangle; compare with the periodic double-bond corner.
3. Convert N=16, κ=2, r=−1, λ=1/2, j=0.2 to QM parameters. Explain why a nonzero source requires site-mean centering in an open spatial box.
4. Set κ=0 and use independence to derive `E[m⁴]=[V E[φ⁴]+3V(V−1)E[φ²]²]/V⁴` at zero source. Compare the full-segment accumulator after 256 fields have been evicted.
5. Explain why a long double-well trajectory of one sign does not contradict the finite-volume equilibrium identity E[m]=0.
