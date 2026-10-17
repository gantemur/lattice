# Classical XY site spins and lattice vortices

M5e uses one XY family on small physical graphs and bounded square lattices. These are **site** angles, not independent compact U(1) link connections. The mathematical functions below have no React dependencies. See [validation summary](../RELEASES.md#xy-spins) and [source guide](../SOURCE_GUIDE.md).

## Measure, action and geometry

At each site, θ∈[−π,π) represents a point on the circle, with spin s=(cos θ,sin θ). The probability law is

\[
dP=Z^{-1}e^{-S}\prod_i\frac{d\theta_i}{2\pi},\qquad
S=-\sum_{e\in E}K_e\cos(\theta_{h(e)}-\theta_{t(e)})-h\sum_i\cos\theta_i.
\]

All couplings and the uniform x-directed source are dimensionless; there is no additional β. Thus Z=1 for K=h=0. Teaching bounds are |Kₑ|,|Kx|,|Ky|,|h|≤4. Every physical bond has an ID. Parallel bonds each contribute; a self-link contributes the constant −Kₑ and nothing to a local conditional or gradient. A present zero-coupling bond is retained. `xyDomain` in [xyDomain.ts](../../src/domain/xyDomain.ts) adapts existing graph/indexed geometry without changing it. Two-site, three-site and four-site examples share `xyModel` and `xyAction` in [xy.ts](../../src/models/xy.ts).

Rectangles use row-major i=x+Lx y, 2≤Lx,Ly≤32, and independent open/periodic boundaries. The periodic 2×2 has four sites, eight physical bonds and four oriented faces. Its energy can use effective pair couplings in a reference calculation, but its domain is never replaced by a four-edge cycle. A test-only periodic 1×4 also checks self-links and repeated face incidences.

`wrapXY` uses the half-open branch [−π,π). The pure `xyDifference` recomputes only incident non-self interactions for a proposed angle. `xyGradient` sums Kₑ sin(θᵢ−θⱼ) and h sin θᵢ. [xy.test.ts](../../src/models/xy.test.ts) independently recomputes full actions and centered finite differences, including negative weights, branch crossings and parallel bonds.

## Local conditional and samplers

For fixed neighbors of site i,

\[
H_x=h+\sum_{e\ni i,\ e\text{ nonself}}K_e\cos\theta_j,\quad
H_y=\sum_{e\ni i,\ e\text{ nonself}}K_e\sin\theta_j,\quad
R=\sqrt{H_x^2+H_y^2},\quad \mu=\operatorname{atan2}(H_y,H_x).
\]

The density relative to ordinary dθ is

\[
\rho_i(\theta\mid\theta_{-i})=
\frac{e^{R\cos(\theta-\mu)}}{2\pi I_0(R)}.
\]

At R=0 the density is uniform and μ is undefined. Signed interactions enter the vector with their signs. This **fixed-neighbor conditional is not the equilibrium marginal** of a coupled site. `xyConditional` exposes each physical contribution; `xyConditionalDensity` supplies the displayed von Mises curve.

[xySampler.ts](../../src/algorithms/xySampler.ts) implements two random-site chains:

- Metropolis consumes exactly three uniforms in site/displacement/decision order, including downhill and rejected proposals. It proposes wrap(θᵢ+w(2u−1)), 0.02≤w≤π, and accepts with min(1,exp(−ΔS)). The circular proposal density is symmetric, so the Metropolis ratio establishes detailed balance. Rejection leaves the whole configuration unchanged.
- Heat bath chooses a site, proposes δ uniformly on [−π,π), and accepts an internal candidate with exp[R(cos δ−1)], returning wrap(μ+δ). The envelope factor cancels on conditioning on acceptance, giving the exact von Mises law. At R=0, one relative uniform angle is added to the old angle. This remains uniform and preserves pathwise global-rotation covariance. A completed heat-bath update is always a resampling; internal rejection trials are computational work, not rejected chain transitions or an acceptance-rate estimate.

For R>0 the heat-bath draw budget is 1+2t for t candidates; at R=0 it is two uniforms total (site plus angle), with one candidate recorded. Small validated domains have at most sixteen bonds, so R≤68; the 2D lattice bound is R≤20. The acceptance fraction of the uniform envelope is exp(−R)I₀(R), about 0.048 at R=68. A 10,000-candidate safety cap protects against malformed RNG/numerics and throws without committing a biased fallback angle. Typical work and full replay are tested at R=0,.001,.7,4,20,68 in [xySampler.test.ts](../../src/algorithms/xySampler.test.ts).

One Step is one attempted site update. V random-site updates with replacement define one **nominal sweep**, not physical time. Warm-up and measurement stride are complete sweeps. Scheduled states include rejections. Aligned and ±vortex fixtures consume no uniforms; independent random initialization consumes exactly V and is not a retained equilibrium sample.

## Finite-volume references

`xyBessel` in [xyReference.ts](../../src/models/xyReference.ts) evaluates

\[
I_n(x)=\sum_{k\ge0}\frac{(x/2)^{2k+n}}{k!(n+k)!},\quad n\ge0,
\qquad I_{-n}=I_n,\quad I_n(-x)=(-1)^n I_n(x).
\]

The positive series has a geometric omitted-tail bound once successive ratios decrease below one. An explicit floating-point operation allowance accompanies it; this is not directed interval arithmetic. The existing gauge evaluator and its RNG/replay remain untouched.

For a single rotor, Z=I₀(h), ⟨cos θ⟩=I₁(h)/I₀(h), ⟨sin θ⟩=0, and ⟨cos²θ⟩=(1+I₂/I₀)/2. At h=.7, Z=1.126303018306809 and ⟨cos θ⟩=0.330177289532671. For a zero-field dimer Z=I₀(K), ⟨cos(θ₂−θ₁)⟩=I₁(K)/I₀(K). Forests factor into ΠₑI₀(Kₑ).

For a simple effective cycle with possibly signed/nonuniform couplings,

\[
Z=\sum_{n\in\mathbb Z}\prod_e I_n(K_e),\qquad
\langle\cos\Delta\theta_e\rangle=\partial_{K_e}\log Z.
\]

This follows by expanding each exp(K cos Δθ) into characters and integrating each site angle: the integer current is conserved at every vertex. The derivative insertion uses (Iₙ₋₁+Iₙ₊₁)/2. Absolute next-order bounds and roundoff allowances control signed cancellation, including odd antiferromagnetic cycles. The implementation stops only when its error gate ≤10⁻¹⁰ is met, at most order64, otherwise withholding trusted values as **under-resolved**.

Uniform triangles have Z=ΣₙIₙ(K)³. At K=.7 and −.7 the references are respectively 1.532159015191 and 1.326441767065. For K=−J<0, Σpairs cos=(|Σs|²−3)/2≥−3/2. Thus equal 120° separations attain Smin=−3J/2, with two chiral choices. A graph triangle has no declared square plaquette; chirality is not square-lattice vorticity.

The periodic 2×2 has two physical bonds per neighbor pair. Its zero-field normalized partition function is

\[
Z_{2\times2}=\sum_{n\in\mathbb Z} I_n(2K_x)^2 I_n(2K_y)^2.
\]

At Kx=Ky=.7 this is **7.069401867411065**. Replacing the physical torus by a single-bond open square would give the wrong Gibbs law as well as the wrong topology.

Nonzero-source dimers use shifted periodic midpoint quadrature on 32→64→128 grids, requiring both successive refinements to meet the stated absolute gate on log Z, action, magnetization and bond means. That is numerical convergence evidence, not symbolic exactness. Nonzero-source coupled graphs with more than two sites and interacting larger lattices display **unavailable**. Large zero-coupling lattices have a product von Mises reference; log Z is authoritative if Z exceeds floating-point range. Independent test integrals use explicit weights, never production action/Bessel/reference functions: [xyOracle.ts](../../src/test/xyOracle.ts) and [xyReference.test.ts](../../src/models/xyReference.test.ts).

## Magnetization and spatial correlations

`xyObservables` records mₓ=Σcos θ/V, mᵧ=Σsin θ/V, |m|, S, S/V and physical-bond alignment. ⟨|m|⟩ differs from |⟨m⟩|. At zero source the finite-volume vector mean is zero by rotational symmetry even when instantaneous configurations align. Slow rotation of an ordered state is a mixing limitation, not spontaneous symmetry breaking demonstrated by a short finite run.

`xySpatial` records raw Gα(r)=averageᵢ cos(θᵢ₊ᵣα−θᵢ), over admissible origins, with Gα(0)=1. It does not claim connected covariance. Distinct independent sites at K=0 have Gα(r)=(I₁(h)/I₀(h))²; at h=0 this vanishes. Histories have no unsupported independent-sample error bars.

## Principal lifts, faces and vortices

[xyPlaquettes.ts](../../src/domain/xyPlaquettes.ts) keeps declared graph faces and constructs indexed square walks bottom +x, right +y, top −x, left −y. F=(periodicX?Lx:Lx−1)(periodicY?Ly:Ly−1). The mathematical counterclockwise convention is independent of screen rows, which increase downward.

For each stored physical edge, compute Dₑ=wrap(θhead−θtail) **once**, and use −Dₑ for reverse traversal. Independently wrapping the reverse at an antipodal tie would break antisymmetry. The winding in [xyVortices.ts](../../src/models/xyVortices.ts) is

\[
Q_f=\frac{1}{2\pi}\sum_{e\in\partial f}\epsilon_{fe}D_e.
\]

A face touching a bond within 10⁻¹⁰ radians of |Dₑ|=π is **ambiguous**. Otherwise the result must be within 10⁻¹⁰ winding units of an integer; a failed check is **noninteger**, never silently rounded into a trusted charge. The density Σ|Q|/F is recorded only for complete valid face images. Ordinary measurements continue on ambiguous images, while vortex coverage/omission counts are separate. Only the current large-lattice face image is retained.

The row-major open-square fixtures [0,π/2,−π/2,−π] and [0,−π/2,π/2,−π] give four increments +π/2 and −π/2, hence Q=+1 and −1. On the torus the first produces [1,−1,−1,1]. Every periodic physical bond appears once with each incidence sign, proving ΣfQf=0. Open/mixed boundaries leave boundary terms, so neutrality is not asserted there.

Crucially, Π∂f exp(i εD)=exp(2πiQ)=1 even for a nonzero vortex. The charge belongs to the principal **real lift**, not compact gauge plaquette curvature. XY variables live on sites, whereas U(1) connections are independent link variables with a local gauge symmetry.

## Global spin symmetry and state ownership

At h=0 a common rotation θᵢ→wrap(θᵢ+α) preserves action, bond/pair cosines, |m| and unambiguous charges, while rotating (mₓ,mᵧ). Arbitrary site-dependent rotations are not a symmetry. At h≠0 the source breaks the common rotation symmetry.

`XYRun.rotate` in [xyRun.ts](../../src/engine/xyRun.ts) requires valid α and h=0; the [client](../../src/engine/xyClient.ts) requires an acknowledged paused worker. Application consumes no RNG, update, measurement or new segment. It preserves existing statistics, increments snapshot version, clears the obsolete local trace and records a deterministic event. Preview/selection/overlay are read-only. Both samplers have coupled pathwise rotation tests within floating-point tolerance.

Compatible Apply preserves angles/RNG and starts an isolated measurement segment (including renewed warm-up); geometry, boundaries and initialization changes create fresh seeded sessions. Reset uses current applied settings and the edited seed, clearing history. At most eight segments and 256 recent scalar records per segment are retained. Full aggregates survive record eviction. Tiny systems additionally retain bounded four-angle records/histograms/pair matrices; larger histories contain no configuration image. Small/Lattice XY clients remain independent and mounted when hidden. Navigation neither pauses nor resets a running session; Pause is explicit, matching the existing workspaces. No XY persistence format is introduced.

## Experiments, limitations and exercises

Local algorithms may mix slowly near the expected BKT regime and in ordered finite lattices. Acceptance and vortex suppression do not certify equilibration or determine a critical temperature. This laboratory implements neither cluster XY updates, HMC, helicity modulus, critical exponent fitting nor physical-time dynamics. The [validation summary](../RELEASES.md#xy-spins) links multiseed budgets and empirical regression gates without treating correlated records as independent draws.

Suggested exercises:

1. Differentiate the single-rotor partition integral to derive I₁/I₀ and the cosine second moment.
2. Change variables in the dimer integral to derive its bond correlation.
3. Integrate the triangle character expansion and explain the sign of odd orders at negative K.
4. Use |Σs|²≥0 to derive the antiferromagnetic 120° minimum.
5. Calculate all four principal increments of the open-square positive fixture.
6. Cancel opposite face incidences to prove periodic neutrality; identify the terms left on a cylinder.
7. Explain why the product of derived bond phases is one when Q=1.
8. Compare a common XY spin rotation with independent vertex gauge transformations of U(1) links.

For context, see Berezinskii, [Destruction of Long-range Order in One-dimensional and Two-dimensional Systems Having a Continuous Symmetry Group. I. Classical Systems](https://www.jetp.ras.ru/cgi-bin/dn/e_032_03_0493.pdf), JETP 32 (1971), 493–500; and Kosterlitz–Thouless, [Ordering, metastability and phase transitions in two-dimensional systems](https://doi.org/10.1088/0022-3719/6/7/010), J. Phys. C 6 (1973), 1181–1203. Their thermodynamic mechanisms motivate the exercises; finite pictures and short Monte Carlo runs do not establish those results.
