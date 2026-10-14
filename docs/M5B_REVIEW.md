# M5b — Compact U(1) gauge laboratory review

**Branch:** `codex/m5b-compact-u1-gauge`. **Verified base:** `6634d771e0af7eb653ac3af62930f7d4c5f118a9`, matching freshly fetched origin/main. The managed checkout was clean; unrelated original-checkout files and existing recovery stashes were not changed. Implementation and local validation are recorded below. Released at `25049f351f5753bc99d1cbde0a94295c9fc21bbe` by the authorized ordinary fast-forward after PR creation returned HTTP 403. The [main workflow](https://github.com/gantemur/lattice/actions/runs/38508189972) passed validation and Pages deployment. Public 1280px/360px checks verified the served SHA, 16 JS/CSS/font assets, seven worker loads and existing navigation, with no errors or horizontal overflow.

## Architecture and source readability

The authoritative square/torus constructors remain unchanged. A small `domain/gaugeGeometry.ts` extraction shares only oriented IDs, validated walks and loop descriptions. A `GaugeCellGraph` extraction shares drawing and accessible carrier selection; family wrappers supply sign or complex-phase labels. Z₂ action, enumeration, samplers, run/client/worker and seeded RNG remain unchanged. A pre-extraction full-snapshot golden fixture covers both geometries and both Z₂ samplers, including a transformation and parameter segment; its SHA-256 is `20bf8dd21391b1b69cd52921115d984f6de17b507e5b9bbe4551c58ad5f1b8b0`.

U(1) has separate pure arithmetic/action, bounded numerical reference, three-draw Metropolis, run/client/worker, workspace controls, read-only tools and plotting modules. The catalog adds only `u1-square` and `u1-torus`, alongside 20 legacy recipes and two Z₂ examples. No legacy Model union, route, archive/sweep schema, dependency or earlier numerical engine is broadened. Explicit named-gauge-example launches restart that family's seeded defaults; top-level tabs merely hide independently mounted sessions, including running workers.

The source guide follows geometry → phase/action → series → sampler → recorder/protocol → presentation. Comments explain signed incidence, Haar normalization, series tail controls, RNG ordering, acknowledgment boundaries, bounded measurement ownership and draft parsing. Hand-checkable π/2 fixtures, independent complex products and independent angular quadrature keep the scientific code readable without React. The UI separates its draft/session owner from the long model-specific tool renderer and small plots. No universal gauge-group framework is introduced.

## Scientific gates

Canonical angles are in [−π,π); circular differences and complex phases handle branch cuts. Every independent periodic bond survives. Reversed transport is conjugation, explicitly tested on asymmetric non-real fixtures. The two-face walk retains the opposite e1 connector and gives Uf0 Uf1, not the product of real parts. Wx uses +e0 +e2, Wy +e1 +e5. Tests verify the torus product constraint and a fixture whose principal angles sum to 2π.

The action is −KΣcosθ_f with normalized product Haar, K∈[−4,4], Z(0)=1 and no extra beta, counting factor or gauge quotient. Every link difference is checked against full actions for positive, zero and negative K, including branch crossings. The full gradient is checked by centered differences. Thirty-two asymmetric configurations per geometry test complex gauge invariance, action, inverse/composition and uniform vertex transformations to 10⁻¹² precision. Haar invariance is justified by circle-translation invariance in [the mathematical guide](math/u1-gauge.md), not inferred merely from numerical tests.

The Bessel power series has a decreasing-ratio remainder bound and roundoff allowance. Character sums include both integer tails and shifted-index Wilson numerator bounds. At default tolerance 10⁻¹² the series resolves at |n|≤4 for |K|=0.7 and |n|≤8 for K=4. Relative partition and absolute loop allowances are displayed. Cutoff exhaustion and unsupported precision withhold trusted values. These are conservative floating-point engineering bounds, not formal interval arithmetic.

At K=0.7: open I0=1.126303018306809 and mean plaquette=0.330177289532671; torus Z=1.647524496051455, mean plaquette=0.359714439270084, oriented two-face mean=0.213650981795920. Negative K preserves torus Z/pair and reverses the face mean. Both Z(0) values are exactly one. Imaginary means and both winding means vanish in equilibrium, without implying any finite chain has mixed.

### Independent quadrature evidence

The oracle never calls production Bessel or Wilson calculations. Bessel I0/I1 and selected higher orders match independent 64/128-point angular grids at K=0,±0.7,±2,±4 with absolute error below 2×10⁻¹³. Torus quadrature independently integrates three angles and the cos a / cos(a+b) insertions on 24³ then 48³ grids.

| K | Relative Z discrepancy (48³ vs series) | Absolute face discrepancy | Absolute pair discrepancy | Series maximum allowance |
| ---: | ---: | ---: | ---: | ---: |
| −0.7 | 2.66×10⁻¹⁴ | 2.30×10⁻¹⁴ | 6.66×10⁻¹⁶ | 1.06×10⁻¹³ |
| 0.7 | 2.65×10⁻¹⁴ | 1.22×10⁻¹⁵ | 4.05×10⁻¹⁵ | 1.06×10⁻¹³ |
| 4 | 1.24×10⁻¹⁴ | 1.13×10⁻¹⁴ | 5.44×10⁻¹⁵ | 3.56×10⁻¹³ |

The 24³→48³ change is below 3×10⁻¹⁴ in relative Z and absolute inserted means in these recorded runs (test gate 2×10⁻⁹). At K=0.7, cos(a+b) averages 0.2136509818 while cos a cos b averages 0.1661050045, demonstrating the required distinction. A fourth-order finite difference of log Z independently checks the 1/4 derivative identity at ±0.7. Strong K=4 quadrature supplies a deterministic reference gate, not a short-chain mixing claim.

## Sampling, worker and statistical evidence

Metropolis selects link/displacement/decision using exactly three uniforms even downhill or on rejection. Width is fixed in [0.02,π], default 0.8 radians. Independent full-action forward/reverse flux checks verify continuous detailed balance; an independently generated open Gibbs ensemble (three Haar links, rejection-sampled von Mises face, solved fourth link; 20,000 draws) is invariant under one kernel application within conservative distribution gates. No production independent U(1) sampler is exposed.

Step, unequal batches, Reset and pure-reference/display calls preserve exact seeded replay. Cadence tests retain scheduled rejections only after complete warm-up/stride sweeps. Separate tests reconstruct the originating sampling sequence independently of the recorder and compare all complex moments, histogram totals and final configuration after 400 measurements with only 256 vectors retained. Parameter changes preserve angles/RNG and earlier aggregates, isolate new settings/cadence, and cap retention at eight segments.

The actual command handler rejects stale runs/versions, invalid α/vertices/settings and oversized advances without partial mutation. Gauge commands increment version and record a distinct event while preserving all counts, settings, histories and RNG. Two coupled chains remain gauge-related for 300 subsequent attempts to 10⁻¹¹ tolerance. Client tests exercise busy/running/pending-Pause transformation rejection, one in-flight batch, Reset and stale replies. Interactive batches contain 128 attempts; direct worker commands cap at 10,000. There is no autonomous worker timer.

### Declared equilibrium ensemble

Each geometry/K uses seeds **17, 271, 12345, 89231**, width 0.8, **200 warm-up sweeps**, stride **four sweeps**, and **12,000 measurements per seed** (48,000 per ensemble). Per-seed work is 192,800 open-square attempts or 385,600 torus attempts, with three uniforms each. Tolerances were declared before reading outcomes: 0.045 for real/imaginary loop means, action scaled by face count/coupling, and 0.015 absolute mass per 24-bin angle histogram. The square histogram compares independently integrated von Mises bin masses; winding bins compare with uniform 1/24. These broad regression gates acknowledge correlation; they are not independent-sample confidence intervals.

| Geometry | K | Reference mean real plaquette | Sampled mean real plaquette | Sampled total action | Sampled Re two-face loop |
| --- | ---: | ---: | ---: | ---: | ---: |
| Open | −0.7 | −0.33017729 | −0.33151416 | −0.23205991 | N/A |
| Open | 0 | 0 | 0.00065643 | 0 | N/A |
| Open | 0.7 | 0.33017729 | 0.33210242 | −0.23247169 | N/A |
| Torus | −0.7 | −0.35971444 | −0.36149062 | −1.01217372 | 0.21646800 |
| Torus | 0 | 0 | −0.00240347 | 0 | 0.00281950 |
| Torus | 0.7 | 0.35971444 | 0.35684624 | −0.99916947 | 0.21232481 |

All imaginary, winding and histogram gates pass. At torus K=0.7, sampled Re Wx=0.00721033 and Re Wy=−0.00553563 against zero. At K=0, Re Wy=−0.01180809 illustrates finite local-chain fluctuations rather than an exactly uniform finite record. Sampled configurations obey the complex global face constraint. No high-|K| equilibrium gate or unsupported MC error bar is added.

## Browser and implementation validation

The focused scientific suite passes 48 new U(1) cases, plus the Z₂ replay fixture. Browser coverage exercises the real production worker on desktop Chromium, 360px Chromium and mobile WebKit: both gauge families, all physical links, settings drafts/validation, segments, Run/Pause/Step/Reset, transformations and ±π wrapping, complex loop directions, independent reference values/signs, bounded measured history, display-only seeded replay, phone tools and legacy catalog/scalar navigation. All old archive, URL and workspace regression tests remain in the full pipeline.

Initial focused browser failures exposed duplicate-tool test locator scope and a test's incorrect Unicode-minus expectation; these were corrected without changing scientific results. Phone visual review led to separate link-ID and angle lines, preventing parallel-link label crowding. Charts explicitly fit narrow tool cards. Screenshots: [desktop](screenshots/m5b-desktop.png), [360px phone](screenshots/m5b-phone.png), [mobile WebKit](screenshots/m5b-mobile-webkit.png).

`npm run check` passes formatting, TypeScript, **584 unit tests in 79 files**, production build, and **349 browser tests** in 2.3 minutes. The **two pre-existing browser skips** remain unchanged. Measured torus Run→first-render→acknowledged-Pause times are **261 ms desktop Chromium, 115 ms 360px Chromium, and 209 ms mobile WebKit**. These are observed local run times, not hardware-independent guarantees. Final desktop and phone screenshots were visually reviewed: parallel-link IDs/angles remain distinguishable, selectors and controls fit narrow cards, and the phone layout has no horizontal page overflow. Relative documentation links and `git diff --check` also pass. Existing Vite large-main-chunk advisory remains (approximately 712 kB minified, 206 kB gzip in the initial build). No new dependencies or test skips are introduced. Historical screenshots regenerated by browser tests are preserved separately and excluded from the intended diff.

## Limits and release status

This slice supports only the declared open/torus complexes, bounded K/width and local angular Metropolis. No gauge fixing, matter, gauge HMC, non-Abelian groups, larger lattices, sector estimator, archive/sweep extension, physical-time dynamics, continuum extrapolation or confinement-transition claim is included. Fixed warm-up is not a mixing guarantee; global flat holonomies need their own sampling scrutiny. Browser profiles are emulations, not physical-phone hardware measurements.

Potts/FK/XY can proceed as separately scoped site/bond model work; neither the compact-link representation nor its gauge observables should be reused as XY site-spin science. The tested oriented geometry and pure gradient leave future gauge work possible without implementing it here.

Release gates passed for the commit and workflow recorded above: 584 unit tests and 349 browser tests passed with two pre-existing skips. Hosted browser validation took approximately 12.2 minutes. Public desktop/phone Run-to-render-and-acknowledged-Pause observations were 171/173 ms. This release record was reconciled during M5c; no M5b numerical behavior changed.
