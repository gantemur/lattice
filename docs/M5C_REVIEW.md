# M5c — q-state Potts review

**Branch:** `codex/m5c-potts-models`. **Verified base:** `25049f351f5753bc99d1cbde0a94295c9fc21bbe`, matching fetched origin/main before implementation. The existing managed checkout was reused from a clean base. Original-checkout files and historical recovery stashes are untouched. This document records implementation and validation; the release section distinguishes local evidence from hosted deployment.

## Scope and architecture

One pure Potts family supplies Small Systems and Lattice Systems. The narrow bond adapter preserves graph metadata, stable physical edges (including K=0), parallel records and self-link constants, and uses the existing indexed lattice convention unchanged. A single PottsRun owns categorical state, RNG and measurements; separate clients own the two independently mounted sessions. Three small launchers and one lattice physical-system option leave the five top-level destinations, old configuration URLs, archive/sweep versions and older numerical engines unchanged. There is no model/worker registry or Ising extraction.

Supported graph settings are site, dimer, three-site chain, triangle, open 2×2 square and periodic 2×2 torus. Named examples are the dimer, antiferromagnetic triangle and torus. Rectangles support 2≤Lx,Ly≤32, independent axis boundaries, signed Kx/Ky and a uniform color-0 source. The torus keeps eight bonds/four faces. q=2,3,4 and each dimensionless K,h∈[−4,4] are explicit teaching bounds.

Small graphs have SVG site/bond selection; rectangles have a categorical Canvas and numeric site selection. A featured ToolDeck and at most six gallery tools expose conditionals, exact references, categorical occupations, action/order/agreement, bounded trajectories, raw correlations, actual update traces and q=2 correspondence. No geometry variable is confused with a display slot. Local acceptance excludes intentional self-proposals from its separately labeled recoloring ratio; heat bath and direct draws are N/A.

## Mathematical audit

The target is counting measure with `S_P=−ΣK_bδequal−hΣδcolor0`, without an extra beta. Signed source/couplings, zero edges, self-links and multiplicities enter full and local formulas independently. Stable categorical softmax is compared against full-action ratios. Every state/recoloring of each tiny preset is checked for q=2,3,4. Four independent 2×2 coordinate-loop boundary combinations test anisotropic negative/positive couplings, action differences and conditionals.

Enumeration caps at 256 states and uses shifted exponential normalization. Independent references give `Z1=e^h+q−1`, `Z_dimer=q(e^K+q−1)` and `Z_triangle=q e^(3K)+3q(q−1)e^K+q(q−1)(q−2)` at zero source for the latter two. Equal antiferromagnetic triangle bonds have q=2 minimum one agreeing bond/six ground states, q=3 zero/six, q=4 zero/24. Strongly concentrated valid couplings remain finite and normalized.

At q=2, color 0→+1, color 1→−1, J=K/2, b=h/2, `C=(ΣK+Vh)/2`, `S_P=S_I−C` and `log Z_P=log Z_I+C`. Exhaustive tests compare absolute actions, normalized probabilities, log Z, site/pair/bond expectations and magnetization moments to both existing graph and finite-lattice Ising references, including parallel/self bonds and all four lattice boundary choices. Injected uniforms match existing graph/indexed Ising local transitions. No released Ising restriction or arithmetic changed.

Complete triangle transition matrices for q=2,3,4, both signs of coupling and both local algorithms check row sums, detailed balance, positive diagonal and connectivity. They independently construct full-action conditional/acceptance laws and compare the actual sampler. Lazy Metropolis always consumes three uniforms (site, half-stay/other-color proposal, decision); heat bath two; direct exact whole-state draws one. Tests distinguish intentional stays, rejection, changed/unchanged heat-bath resampling and their actual action differences.

`m0=(q p0−1)/(q−1)` is distinct from nonnegative majority order, which has positive independent finite-volume expectation. S/V is dimensionless action density. Raw axial equality C and `(q C−1)/(q−1)` are not connected correlations. Open and mixed axes use their actual admissible origins; the independent source-biased law has C(r>0)=Σp², not necessarily 1/q. No independent-sample uncertainty or phase-transition claim follows from local-chain records. The [mathematical guide](math/potts-model.md) links equations, functions, tests and exercises.

## Fixed multiseed equilibrium comparisons

Four seeds (17,271,12345,89231) were chosen before observations. Tiny benchmarks use 200 warm-up sweeps, stride two and 6,000 retained configurations per seed (24,000 total per case). Direct draws ignore the local cadence and use 6,000 updates/seed; local counts are V×(200+2×6,000). h=0.3; dimer K=0.7, triangle K=−0.7, torus Kx=−0.6/Ky=0.9 and the rectangle has the same couplings with periodic x/open y. The independent Cartesian oracle does not call production action, encoding, observables or enumeration.

The table gives exact and sampled m₀. Tests additionally compare all color fractions, majority, dimensionless action, physical-bond agreement, every site's color occupancy and a pair equality. The fixed absolute gate is 0.055, with action scaled by bond count; these are conservative regression gates, not confidence intervals. The largest observed error across tested dimensionless global observables excluding action was 0.010869.

| q | Geometry | Exact m₀ | Direct | Metropolis | Heat bath |
|---|---|---:|---:|---:|---:|
| 2 | dimer | 0.197494 | 0.192042 | 0.203542 | 0.186625 |
| 2 | triangle | 0.080257 | 0.078778 | 0.079417 | 0.077944 |
| 2 | torus | 0.065460 | 0.064771 | 0.068792 | 0.063396 |
| 2 | rectangle | 0.073526 | 0.071583 | 0.070521 | 0.070896 |
| 3 | dimer | 0.132841 | 0.131781 | 0.129031 | 0.128125 |
| 3 | triangle | 0.066593 | 0.063208 | 0.065562 | 0.063625 |
| 3 | torus | 0.096040 | 0.091719 | 0.095906 | 0.093484 |
| 3 | rectangle | 0.084859 | 0.081859 | 0.084156 | 0.081313 |
| 4 | dimer | 0.098920 | 0.101806 | 0.090528 | 0.098250 |
| 4 | triangle | 0.057200 | 0.058648 | 0.056593 | 0.056167 |
| 4 | torus | 0.088171 | 0.087083 | 0.089333 | 0.085264 |
| 4 | rectangle | 0.074367 | 0.073625 | 0.069167 | 0.073569 |

| q | 8×8 scenario | Metropolis agreement | Heat-bath agreement |
|---|---|---:|---:|
| 2 | independent | 0.519534 | 0.519108 |
| 2 | ferromagnetic | 0.591401 | 0.592632 |
| 2 | anisotropic | 0.507028 | 0.505941 |
| 3 | independent | 0.347077 | 0.345876 |
| 3 | ferromagnetic | 0.417939 | 0.418170 |
| 3 | anisotropic | 0.343552 | 0.343142 |
| 4 | independent | 0.258666 | 0.258977 |
| 4 | ferromagnetic | 0.322432 | 0.322828 |
| 4 | anisotropic | 0.259785 | 0.259928 |

The 8×8 comparisons use the same four seeds and local warm-up/stride, 3,000 retained states and 396,800 attempts per seed, per algorithm. Independent K=0,h=0.4 cases use the analytical product law for occupations, action and every positive axial lag. Ferromagnetic Kx=Ky=0.35,h=0 cases use exact color symmetry and enhanced agreement; mixed-boundary Kx=−0.25,Ky=0.35,h=0 cases use color symmetry and opposite directional tendencies. The two samplers' global fractions/agreements are also compared within 0.035. The latter interacting large-lattice checks are symmetry/consistency gates, not an exact interacting solution. All 45 multiseed cases pass; these moderate examples do not validate rapid mixing at the parameter limits.

## Lifecycle, bounds and regression safety

All-color-0 initialization consumes no RNG and is not measured. V site attempts with replacement define a nominal sweep. Local retained measurements include self/rejected/unchanged transitions after complete warm-up and stride sweeps; direct draws retain each whole state. Compatible coupling/source/sampler/cadence changes preserve colors and RNG but isolate a new segment; q/topology/boundaries, Reset and explicit example launches initialize seeded sessions. A seed draft takes effect on Reset/support change. Top-level visibility and tools never reset or advance an unrelated worker.

A single in-flight batch and run/version checks govern the actual worker handler. Invalid/stale/oversized requests fail without changing numerical state; settings wait behind the posted batch, and Pause completes its acknowledgment. Run batches are 128 attempts on tiny systems and 1024 on larger ones; direct commands cap at 4096. Step/unequal-batch replay, fixed draw budgets, segment switches, reset, stale responses and disposal are covered. No existing sampler is extracted or rewritten; existing golden replay tests remain in the full pipeline.

At most eight segments survive, with an explicit discarded count, full Welford moments, per-site occupancies and per-physical-bond counts. Histories retain 256 measured scalar records, with color vectors only for at most eight sites. Tiny eligible systems have pair counts; larger rectangles have bounded axial correlations and no NxN pair matrix. Tests compare full aggregates, recent-window eviction and the final configuration against the same independently replayed sampling sequence. Render frequency does not schedule measurements.

## Browser evidence and readability

The new production-worker suite has six scenarios on each of desktop Chromium, 360px Chromium and mobile WebKit: named examples and q changes, signed drafts/validation, eight-bond selection, normalized references/frustration/q=2 tools, all samplers, Run/Pause/Step/Reset, parameter segments, selected sites/colors/bonds, history/correlations, feature/gallery exchange, bounded gallery, display-only replay, separate mounted sessions and return to Ising. The existing suite covers old Ising/scalar/gauge/field/QM, legacy URLs, archives and sweeps. No new skips are added.

Responsiveness is wall time from clicking Run, through a rendered increase in update count, clicking Pause and observing enabled Step (acknowledgment). A focused run at 32×32 with zero warm-up/stride one measured **217–271 ms desktop**, **159–247 ms 360px Chromium**, and **243–348 ms mobile WebKit**, across q=2,3,4 and both local samplers. These are desktop-host emulations, not a low-end-device guarantee or sampling throughput/mixing measurement. All are below the fixed 10-second regression ceiling. Full-suite/CI timings may differ under load.

Screenshots: [small desktop](screenshots/m5c-small-desktop.png), [small 360px](screenshots/m5c-small-phone.png), [small WebKit](screenshots/m5c-small-mobile-webkit.png), [lattice desktop](screenshots/m5c-lattice-desktop.png), [lattice 360px](screenshots/m5c-lattice-phone.png), [lattice WebKit](screenshots/m5c-lattice-mobile-webkit.png). Phone settings collapse and the gallery retains detail/compact-overview modes. Controls have explicit accessible names, numeric alternatives and keyboard graph selection. Local KaTeX HTML/MathML typesets the action/correspondence; equations fit the sidebar. Source comments explain counting, conditional exclusions, uniform budgets, worker acknowledgment and ownership. Pure modules can be read and tested without React; the source guide gives a student reading order.

## Validation and release gates

`CI=1 npm run check` passed: formatting, TypeScript, **708 unit tests in 85 files**, production build and **367 browser tests with the same two pre-existing skips** (2.6 minutes for the browser suite). This preserves all 584 baseline unit tests and 349 baseline browser tests, adding 124 numerical/protocol cases and 18 production-browser cases. `git diff --check` passed; 144 local documentation links resolve. The additional 1280px/360px production smoke preflight verified 19 JS/CSS/font assets and ten actual worker loads, including independent Potts instances and existing Ising/gauge/scalar/QM/field/experiment navigation, with no console errors, failed requests or horizontal overflow.

The publication diff contains only additive Potts science/UI/tests, narrowly scoped catalog/navigation integration, six new M5c screenshots and associated documentation. Regenerated historical screenshots are kept in a separate local recovery stash rather than included. M5b release-status lines are reconciled with its already successful hosted run.

Release uses PR-first workflow, with the explicitly authorized ordinary non-force fast-forward fallback only for the known HTTP 403 integration block and after fresh ancestry/clean-tree checks. Hosted validation, Pages deployment, remote SHA agreement and the served embedded SHA plus live desktop/360px checks remain post-publication gates. Their exact outcomes and workflow link are reported in the release delivery message; this pre-publication record does not substitute local success for deployment.

## Remaining limits / preparation for M5d

The main application bundle retains the existing Vite size warning. Storage is bounded and ephemeral; Potts deliberately has no new archive, CSV/JSON or sweep support. Local chains may mix slowly at strong coupling/source/frustration; there is no criticality finder, cluster update, equilibration claim, unvalidated Binder/susceptibility or general uncertainty estimator. Exact references stop at q^V=256; color histograms and all displayed correlations are categorical, not angular.

Stable physical bonds, explicit couplings and one categorical state/kernel prepare M5d's FK/Edwards–Sokal work. They do not implement it: FK probabilities require their own ferromagnetic checks, independent tests and state ownership. Negative K must never enter the usual `1−exp(−K)` bond probability. No clock/XY, random clusters, noninteger q, gauge changes or navigation redesign is included.
