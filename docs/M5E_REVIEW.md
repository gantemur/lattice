# M5e — Classical XY and lattice vortices review

## Baseline, scope and architecture

Remote main was verified at **0449e2a993a5f4a363fa28081c8de74abc234333**, the completed M5d release. Work uses `codex/m5e-xy-vortices` in the existing clean managed checkout. The original checkout and unrelated screenshots/recovery stashes remain untouched. Baseline: **843 unit tests, 385 browser passes and two existing skips**. No old numerical model, sampler, RNG helper, worker protocol, archive format or dependency is changed.

The preimplementation plan was: one narrow physical-bond XY adapter; pure action/conditional/gradient mathematics; independent Bessel/character/quadrature references; signed square-face/principal-lift vorticity; local samplers with explicit uniform work; dedicated acknowledged worker and independent Small/Lattice clients; read-only responsive ToolDeck integration. The implementation follows that plan without extracting a universal compact-spin/gauge framework.

Small geometry includes single site, open dimer, three-chain, triangle, open square, periodic 2×2 and four-ring. Four grouped named examples expose rotor, pair, frustrated triangle and torus. Rectangles allow 2–32 sites per axis and all boundary combinations. Domain/face adapters retain physical parallel edges, present zero weights and self-link constants. The torus has four sites/eight bonds/four faces. Test-only periodic 1×4 also validates degenerate incidences.

Angles use [−π,π), normalized site Haar measure, signed dimensionless K,h∈[−4,4], S=−ΣKcosΔθ−hΣcosθ, with no additional β. Metropolis uses exactly three uniforms; heat bath samples the exact fixed-neighbor von Mises conditional with variable rejection work. The R=0 case uses a relative uniform angle. The 10,000-candidate guard reports failure rather than inserting a biased fallback.

One Step is a site attempt; V random-site attempts define a nominal sweep. Complete-sweep warm-up/stride include rejected scheduled states. Random initialization uses V uniforms; aligned/±vortex fixtures use none and are unmeasured. Compatible Apply preserves angles/RNG and creates isolated segments; geometry/boundary/initialization changes and Reset start fresh seeded sessions. Eight segments/256 records per segment bound history; full ordinary moments and separately covered vortex moments survive eviction. No large historical configuration images are stored.

## Deterministic mathematics and protocol evidence

- Full explicit physical-bond actions, every local difference, gradients by centered finite difference, signed/zero/source cases, self-links, cancellation and parallel records agree. Equal antiferromagnetic triangles attain the independent −3|K|/2 lower bound at ±120°.
- Oriented walks close on every tested geometry/boundary. Open fixtures have charges ±1, orientation reversal changes sign, and torus fixture charges are [1,−1,−1,1]. Many arbitrary periodic configurations have net zero by signed incidence; cylinder/open cases correctly retain boundary charge.
- One stored principal lift per physical edge is negated in reverse. Proximity to antipodal within 10⁻¹⁰ radians marks ambiguity; a separate 10⁻¹⁰ winding residual gates integer assignment. Invalid face images omit only vortex statistics, with explicit coverage; an adversarial scheduled-image test verifies ordinary moments still accumulate. Derived complex phase products equal one on a nonzero XY vortex: these are not U(1) gauge plaquette curvatures.
- Injected RNG tests verify Metropolis site/displacement/decision order, rejection holds and detailed-balance flux. Conditional heat-bath moments/histograms use independent high-resolution integration at R=0,.001,.7,4,20,68 with four seeds. Seeded 500-update pathwise rotation comparisons cover both samplers and signed/zero interactions.
- Actual `XYEngine.handle` and client transport tests cover unequal batches, queued Apply, repeated Run/Pause, pending acknowledgments, stale version/run replies, reset/disposal, invalid atomic requests, bounded history and full-segment aggregates. Global rotation requires h=0 and an acknowledged pause; it preserves uniforms, updates, measurements and segments, increments version and records a deterministic event. Inverse/composition and subsequent coupled trajectories are tested.
- Small/Lattice XY sessions remain independent. As with released workspaces, hiding preserves a running session; navigation does not silently pause it. Explicit acknowledged Pause stops scheduling. Tools, preview, selections and gallery exchange do not consume randomness.

## Independent finite-volume references

The test oracle explicitly integrates site angles without calling production action, Bessel, conditional or vortex functions. Zero source permits removing one common angle; no such reduction is used with a source. Normalized anchors are rotor I₀(.7)=1.126303018306809, mean cosine .330177289532671; triangle Z(±.7)=1.532159015191/1.326441767065; periodic 2×2 Z(.7,.7)=**7.069401867411065**. The latter uses ΣₙIₙ(2Kx)²Iₙ(2Ky)², preserving the factors of two from physical parallel bonds.

All seven small geometries at K=0,±.7 are compared with independent 24→48 quadrature. Mixed-boundary anisotropic/signed 2×2 cases use 32→64. Source dimers are compared against independent 192-point-per-angle integration and factorization at K=0. Production source-dimer quadrature uses 32→64→128 and requires two converged refinements. No Monte Carlo RNG enters a reference. Unsupported nonzero-source coupled graphs above two sites and interacting large lattices report unavailable; forced inadequate cutoffs/grids report under-resolved with no trusted values.

Boundary-coupling reference checks, with independent 48→96 quadrature:

| Geometry / K | Resolved character order | Absolute/relative allowance | Relative Z refinement |
|---|---:|---:|---:|
| Triangle −4 | 9 | 2.72e−11 | 4.00e−15 |
| Triangle +4 | 8 | 1.61e−11 | 6.11e−15 |
| Torus −4 | 9 | 7.83e−11 | 1.75e−12 |
| Torus +4 | 9 | 7.83e−11 | 1.39e−12 |

These allowances combine truncation and ordinary floating-point error estimates, not rigorous interval arithmetic. Severe signed cancellation can withhold results. Large independent product references expose log Z when Z overflows.

## Declared multiseed equilibrium benchmarks

Seeds were fixed before outcomes: **17, 271, 12345, 89231**. Tiny cases use 500 warm-up sweeps, stride4, 6,000 retained states per seed, width .8 and random initialization. Each table row pools 24,000 measurements. Updates below include warm-up but exclude initialization; draw totals are per-segment and exclude V initialization draws per seed. Regression gates are .06 for vector components, .04 for bond means and normalized action discrepancy, .03 for eligible angular histogram bins. These are conservative empirical regression gates, not independent-sample confidence intervals.

| Tiny case / sampler | Updates | Mean S | Reference S | Uniforms | Conditional trials |
|---|---:|---:|---:|---:|---:|
| rotor h0 / metropolis | 98,000 | 0.000000 | 0.000000 | 294,000 | 0 |
| rotor h0 / heat-bath | 98,000 | 0.000000 | 0.000000 | 196,000 | 98,000 |
| rotor h-0.7 / metropolis | 98,000 | -0.238170 | -0.231124 | 294,000 | 0 |
| rotor h-0.7 / heat-bath | 98,000 | -0.232305 | -0.231124 | 448,788 | 175,394 |
| rotor h0.7 / metropolis | 98,000 | -0.237271 | -0.231124 | 294,000 | 0 |
| rotor h0.7 / heat-bath | 98,000 | -0.232305 | -0.231124 | 448,788 | 175,394 |
| rotor h-2 / metropolis | 98,000 | -1.423275 | -1.395549 | 294,000 | 0 |
| rotor h-2 / heat-bath | 98,000 | -1.391428 | -1.395549 | 734,354 | 318,177 |
| rotor h2 / metropolis | 98,000 | -1.418285 | -1.395549 | 294,000 | 0 |
| rotor h2 / heat-bath | 98,000 | -1.391428 | -1.395549 | 734,354 | 318,177 |
| dimer K0 / metropolis | 196,000 | 0.000000 | 0.000000 | 588,000 | 0 |
| dimer K0 / heat-bath | 196,000 | 0.000000 | 0.000000 | 392,000 | 196,000 |
| dimer K-0.7 / metropolis | 196,000 | -0.237797 | -0.231124 | 588,000 | 0 |
| dimer K-0.7 / heat-bath | 196,000 | -0.228507 | -0.231124 | 898,268 | 351,134 |
| dimer K0.7 / metropolis | 196,000 | -0.234920 | -0.231124 | 588,000 | 0 |
| dimer K0.7 / heat-bath | 196,000 | -0.228507 | -0.231124 | 898,268 | 351,134 |
| dimer source / metropolis | 196,000 | -0.867703 | -0.874289 | 588,000 | 0 |
| dimer source / heat-bath | 196,000 | -0.877129 | -0.874289 | 1,094,972 | 449,486 |
| triangle K-0.7 / metropolis | 294,000 | -0.486079 | -0.488741 | 882,000 | 0 |
| triangle K-0.7 / heat-bath | 294,000 | -0.487376 | -0.488741 | 1,383,408 | 544,704 |
| triangle K0.7 / metropolis | 294,000 | -0.868752 | -0.874289 | 882,000 | 0 |
| triangle K0.7 / heat-bath | 294,000 | -0.863348 | -0.874289 | 1,643,428 | 674,714 |
| open square / metropolis | 392,000 | -1.028308 | -1.007200 | 1,176,000 | 0 |
| open square / heat-bath | 392,000 | -1.007660 | -1.007200 | 2,088,876 | 848,438 |
| periodic torus / metropolis | 392,000 | -3.686985 | -3.663594 | 1,176,000 | 0 |
| periodic torus / heat-bath | 392,000 | -3.672918 | -3.663594 | 3,212,164 | 1,410,082 |

Large checks use independent random starts on periodic 8×8, width1.5, warm-up300 sweeps, stride2, 1,500 retained states per seed: **844,800 updates and 6,000 retained states per algorithm/case**. Product-reference pooled gates are .02; individual-run directional correlations through lag7 use .04. Paired algorithms use .08 action-density, .04 bond and .03 vortex-density gates, as secondary consistency evidence. Haar vortex density must exceed .25 and the ordered case remain below .04. No mixing or critical-point inference follows from these thresholds.

| Kx, Ky, h / sampler | Mean S/V | Bond cosine | Vortex density | Uniforms | Conditional trials |
|---|---:|---:|---:|---:|---:|
| 0, 0, 0 / metropolis | 0.000000 | -0.000946 | 0.334036 | 2,534,400 | 0 |
| 0, 0, 0 / heat-bath | 0.000000 | 0.000968 | 0.333349 | 1,689,600 | 844,800 |
| 0, 0, 0.7 / metropolis | -0.231205 | 0.108656 | 0.250651 | 2,534,400 | 0 |
| 0, 0, 0.7 / heat-bath | -0.231389 | 0.109261 | 0.251594 | 3,867,126 | 1,511,163 |
| 0.5, 0.5, 0 / metropolis | -0.274151 | 0.274151 | 0.197339 | 2,534,400 | 0 |
| 0.5, 0.5, 0 / heat-bath | -0.273689 | 0.273689 | 0.197005 | 4,583,958 | 1,869,579 |
| 0.3, 0.8, 0.2 / metropolis | -0.511322 | 0.360594 | 0.144729 | 2,534,400 | 0 |
| 0.3, 0.8, 0.2 / heat-bath | -0.514165 | 0.363586 | 0.143453 | 5,429,430 | 2,292,315 |
| -0.4, 0.6, 0 / metropolis | -0.278747 | 0.040548 | 0.329448 | 2,534,400 | 0 |
| -0.4, 0.6, 0 / heat-bath | -0.279711 | 0.040788 | 0.331510 | 4,612,438 | 1,883,819 |
| 1.4, 1.4, 0 / metropolis | -2.241484 | 0.800530 | 0.000906 | 2,534,400 | 0 |
| 1.4, 1.4, 0 / heat-bath | -2.240999 | 0.800357 | 0.000901 | 10,042,704 | 4,598,952 |

At zero coupling/source, exact distinct-site correlation is zero. With h=.7 and zero coupling it is (I₁/I₀)²; the tests also check every retained spatial lag against this independent product reference. The ordered K=1.4 case suppresses vortices but has visibly slow common-angle exploration: pooled (mₓ,mᵧ) is (.0531,−.0843) for Metropolis and (−.1529,.0218) for heat bath. This is explicitly **not** a claim that component means have equilibrated or finite-volume symmetry is broken.

## UI, responsiveness and readability

Four XY launchers extend the existing catalog to 32 choices. The default lattice page remains Ising; XY is an additive selector entry. All five hash routes, legacy scalar links, Experiments and old archive tests remain. Small SVG arrows show physical parallel/wrap bonds and selected angles; larger Canvas arrows/hue have numeric x/y/site/bond/face alternatives. A tiny torus displays four separately selectable face charges. Positive/negative/ambiguous marks use symbols, not color alone. The conditional is labeled fixed-neighbor, references label resolution, action density is dimensionless, and heat-bath acceptance is N/A.

Focused production-browser validation initially passed **30 tests** across desktop Chromium, 360px Chromium and mobile WebKit. It covers references, frustration, physical multiplicity, ±vortex fixtures, all boundaries, both samplers, rotation/preview, replay, segments, gallery capacity/exchange, old-family returns and overflow/console checks. The full suite additionally tests explicitly running hidden XY sessions. An accessible-label mismatch in the new sampler select was found and corrected; a historical catalog assertion was extended for the new group/count, without removing its old checks.

Measured local focused-run latency ranges (overlay both off/on, three concurrent browser workers):

| Profile / size | Metropolis Run→render→ack Pause | Heat bath Run→render→ack Pause |
|---|---:|---:|
| desktop / 8×8 | 115–226 ms | 114–228 ms |
| desktop / 16×16 | 168–169 ms | 166–171 ms |
| desktop / 32×32 | 389–396 ms | 405–408 ms |
| phone / 8×8 | 110–230 ms | 112–230 ms |
| phone / 16×16 | 111–229 ms | 228–230 ms |
| phone / 32×32 | 318–323 ms | 304–324 ms |
| mobile-webkit / 8×8 | 120–137 ms | 117–148 ms |
| mobile-webkit / 16×16 | 138–156 ms | 150–155 ms |
| mobile-webkit / 32×32 | 295–318 ms | 304–339 ms |

Couplings are .7 at 8², 1.1 at 16² and 2 at 32². Toggle-through-two-animation-frames measurements include automation and paint scheduling, about 70–144 ms in this run; they are not isolated GPU costs. Independently, pure vortex analysis of a fixed seeded random image over 500 repeats averaged **.020/.049/.190 ms** per 8²/16²/32² configuration in local JavaScript, outside rendering/sampling. Concurrent full-suite timings can be higher. Batches remain 128 tiny/512 larger site attempts. These measurements distinguish interactive acknowledgment, per-image mathematics and counted random work; emulation is not a physical-phone speed guarantee or an estimate of sampling efficiency.

Screenshots, visually inspected for readable mathematics, controls and overflow:

- [Small desktop](screenshots/m5e-small-desktop.png), [360px phone](screenshots/m5e-small-phone.png), [WebKit](screenshots/m5e-small-mobile-webkit.png).
- [Lattice desktop](screenshots/m5e-lattice-desktop.png), [360px phone](screenshots/m5e-lattice-phone.png), [WebKit](screenshots/m5e-lattice-mobile-webkit.png).

Readability assessment: model/domain/sampler/reference/measurement/client/UI responsibilities are explicit and separate. Comments explain self-link exclusion, reference-only parallel reduction, signed error gates, principal reverse increments, RNG work, ownership and coverage omissions. Tests contain hand-checkable fixtures and a separately written quadrature oracle. Numerical code does not import React. SVG/chart projection is local and small; Canvas avoids thousands of controls. The existing source guide was extended, not replaced. No older numerical modules were rewritten.

## Validation and publication record

`npm run check` passed on the final implementation: formatting, typecheck, **970 unit tests in 97 files**, production build and **418 browser passes with two pre-existing skips** (420 cases, 2.9 minutes locally). This adds 127 unit and 33 browser cases while retaining all 843 historical unit tests and 385 historical browser passes. The skips remain the phone/WebKit default sweep-budget browser scenario. `git diff --check` and local Markdown target checks pass. The intended diff adds only XY science/worker/UI/tests, additive existing-page selectors, three catalog assertions, scoped CSS, documentation and six M5e screenshots. Generated historical screenshots were preserved outside the diff and restored to their baseline versions. The existing nonfatal main-bundle size warning remains; there is no new runtime dependency or backend.

Implementation **`0ffa0345f0f79ab19d22fa644b2092d25d704516`** was pushed to the feature branch and released by an ordinary non-force fast-forward from `0449e2a`. The GitHub CLI was unavailable and the one PR attempt returned HTTP 403, “Resource not accessible by integration”; the user's explicitly authorized fallback was used after fresh ancestry, clean-tree and full-diff checks. No PR was created or force push used.

[Hosted validation and Pages run 38616201513](https://github.com/gantemur/lattice/actions/runs/38616201513) completed successfully: **970 unit passes, 418 browser passes, two existing skips**, with hosted browser execution taking 15.3 minutes. Both validation and deployment jobs succeeded. On 2026-10-14 the public `/lattice/` site served `assets/index-Cu5n4jPf.js`, containing the exact implementation SHA. Desktop Chromium, 360px Chromium and mobile WebKit exercised production Metropolis/heat bath, Step/Run/Pause/Reset, torus neutrality, no-draw global rotation, numeric selection, overlay invariance, separate Small/Lattice sessions and return to FK/Experiments. Each profile observed two distinct XY workers among eight total workers, with no console/request errors or horizontal overflow. All **71 discovered JS/CSS/font assets** returned successful responses. The standalone live harness was corrected to wait for Small Systems visibility before reading its retained counter; this was a hash-navigation synchronization issue in that temporary harness, not a source change.

The public Actions listing showed **no unfinished older runs** before accepting this verification; the previous `0449e2a`, `afbef7ee` and `5b1cb807` deployments were already completed. This documentation-only follow-up records that actual implementation release. Its own final main SHA, hosted workflow and final served-asset verification are reported in the delivery report after its deployment, again only after all older runs finish.

The final extreme-aspect-ratio audit also found that a 2×32 Canvas expanded to 3,190 CSS pixels high at 360px because its width was stretched to the card. A display-only correction uses intrinsic aspect ratio with both width and height bounded by 640px (and the available phone width). The existing browser scenario now checks 2×32 and 32×2 bounds, undistorted ratio and pointer selection of the last row-major site in all three profiles. No numerical code or RNG behavior changes. The complete local pipeline passed again: 970 unit tests, 418 browser passes and the same two skips, plus formatting, typecheck and production build. The final delivery verifies the resulting head after this correction's complete local and hosted pipeline.

## Remaining limits

No cluster XY, clock/nematic model, real-time dynamics, XY HMC, helicity modulus, BKT fit, automatic mixing/uncertainty certification, large-domain exact integral, arbitrary graph editor, new archive/sweep format or navigation redesign is introduced. References use double precision and explicit availability/error gates. Near-antipodal charges remain branch-sensitive and are omitted separately. Finite-size and autocorrelation effects persist, particularly in ordered/near-BKT regimes. The verified implementation closes the requested scientific core of M5. The documentation head still receives its own final deployment verification; future algorithms and persistence require separate scope.
