# M5d — FK / Edwards–Sokal and Swendsen–Wang review

## Baseline and scope

Base: released main `8b0bbdef2ddea1053b82362b243eb37e14192380`; branch `codex/m5d-fk-edwards-sokal-sw`. The clean managed worktree was reused; unrelated files in the original checkout and previous recovery stashes were preserved. Both M5d1 and M5d2 are implemented. No M5e, new top-level workspace, persistence format, universal framework or prior Ising/gauge/scalar/QM kernel change is included.

The common PottsRun now supports eligible exact FK joint draws and Swendsen–Wang, alongside its unchanged three released samplers. Both Small/Lattice clients remain independent. One FK launcher and optional configuration/reference/statistics tools expose physical bonds, component labels, spin colors, actual transitions and cluster histories. Unsupported negative K or h≠0 explains why and fails atomically; the old Potts algorithms retain their full signed/source support. The equal-negative-triangle formula is now shown only for equal couplings. README/spec/roadmap and M5c's review reconcile its verified release.

## Mathematical review and independent evidence

The [mathematical guide](math/fk-edwards-sokal.md) derives both ES marginals, absolute `log Z_P=log Z_FK+ΣK`, the connectivity and occupation identities, q=2 Ising constants, and SW detailed balance. The source review checked these against independently constructed test oracles, not only production helpers. No separate human review is claimed.

- q=2,3,4 × site/dimer/three-site chain/triangle/open square/eight-bond torus × K=0,0.7,4 compare every FK word with independent BFS and joint product sums, exact Potts enumeration and the alternative expanded partition sum.
- The q=3, K=log2 dimer gives Z_FK=6, Z_P=12, open/connectivity=1/4 and equality=1/2.
- A q=4 torus checks all **65,536** spin/bond pairs, both full marginals and both conditional laws. Impossible open K=0 words remain zero. Nonuniform positive/zero bonds, a self-link, the test-only periodic 1×4 cell complex (four self-links/four cycle bonds/four faces), and all four anisotropic indexed boundary combinations are covered. Direct comparisons with both existing graph-Ising and 2×2 lattice-Ising references check absolute partition constants; graph comparisons also check every connectivity entry.
- Independent complete SW matrices cover dimer, triangle and open square for q=2,3,4, plus the q=2 periodic torus. Row sums, positivity, positive diagonal, stationarity and detailed balance pass. The empty-bond route proves finite-coupling irreducibility. Injected uniforms exercise production against independent conditional branches and recolorings.
- K=0 one-step independence is checked for every q and site/dimer/triangle/torus. Parallel, self, disagreeing and present-zero bonds each consume their designated trial. Equal colors on disconnected components never merge them.

Exact FK draws use **1+k** uniforms, including the degenerate CDF draw; SW uses **E+k**. Direct independence follows from fresh inputs and absence of previous-state dependence, not a noisy empirical autocorrelation estimate. SW has no acceptance test.

## Fixed multiseed equilibrium comparisons

Seeds are **17, 271, 12345, 89231**, declared before observations. Each tiny case retains **4,000** joint measurements per seed. FK-direct uses 4,000 updates, no warm-up/stride; SW uses **200 warm-up trajectories, stride 2, 8,200 total trajectories** per seed. A separate Cartesian-color/direct-product/BFS oracle supplies full bond and spin distributions, Potts m₀/majority/action/agreement, FK occupancy/cluster count/largest fraction/connectivity and largest-size probabilities. The pure sampler's full word counts are replayed through the engine in bounded batches and final states agree.

All 18 tiny cases pass fixed normalized absolute moment gates **0.045** and individual probability gates **0.035**. Action/occupied counts are divided by physical bond count for the gate, cluster counts by V. These are conservative deterministic regression tolerances, not independent-sample confidence intervals. The table reports cluster means and pair connectivity (site0 to last site); all other named observables and distributions are checked too. Work counts include warm-up.

| Case                       | Algorithm | Exact clusters | Sample clusters | Exact connectivity | Sample connectivity | Bond visits | Component colors |
| -------------------------- | --------- | -------------: | --------------: | -----------------: | ------------------: | ----------: | ---------------: |
| dimer q2                   | fk-direct |       1.663624 |        1.658000 |           0.336376 |            0.342000 |       16000 |            26528 |
| dimer q2                   | sw        |       1.663624 |        1.658500 |           0.336376 |            0.341500 |       32800 |            54429 |
| dimer q3                   | fk-direct |       1.747430 |        1.745750 |           0.252570 |            0.254250 |       16000 |            27932 |
| dimer q3                   | sw        |       1.747430 |        1.739000 |           0.252570 |            0.261000 |       32800 |            57152 |
| dimer q4                   | fk-direct |       1.797806 |        1.795563 |           0.202194 |            0.204438 |       16000 |            28729 |
| dimer q4                   | sw        |       1.797806 |        1.789125 |           0.202194 |            0.210875 |       32800 |            58725 |
| triangle q3                | fk-direct |       2.219118 |        2.218750 |           0.322094 |            0.323000 |       48000 |            35500 |
| triangle q3                | sw        |       2.219118 |        2.222687 |           0.322094 |            0.319812 |       98400 |            72786 |
| torus q2                   | fk-direct |       1.631670 |        1.628563 |           0.644531 |            0.646000 |      128000 |            26057 |
| torus q2                   | sw        |       1.631670 |        1.656562 |           0.644531 |            0.632750 |      262400 |            54393 |
| torus q4                   | fk-direct |       2.178652 |        2.169188 |           0.402880 |            0.403625 |      128000 |            34707 |
| torus q4                   | sw        |       2.178652 |        2.193125 |           0.402880 |            0.400500 |      262400 |            71870 |
| mixed anisotropic q3       | fk-direct |       2.908337 |        2.894187 |           0.115270 |            0.120687 |       96000 |            46307 |
| mixed anisotropic q3       | sw        |       2.908337 |        2.901250 |           0.115270 |            0.118125 |      196800 |            95067 |
| nonuniform present zero q4 | fk-direct |       3.284804 |        3.290188 |           0.032191 |            0.031125 |       64000 |            52643 |
| nonuniform present zero q4 | sw        |       3.284804 |        3.297937 |           0.032191 |            0.031750 |      131200 |           108160 |
| zero torus q3              | fk-direct |       4.000000 |        4.000000 |           0.000000 |            0.000000 |      128000 |            64000 |
| zero torus q3              | sw        |       4.000000 |        4.000000 |           0.000000 |            0.000000 |      262400 |           131200 |

Dimer/triangle/torus uniform K is 0.7. The mixed rectangle is periodic x/open y, Kx=0.2, Ky=1.1. The open-square nonuniform example has physical couplings 0,0.3,0.8,1.3. The zero torus keeps all eight physical records.

The 8×8 periodic checks use each q with K=0 and K=0.35, the same four seeds, 200 warm-up units, stride2 and **1,600 retained states/seed**. SW performs 3,400 trajectories/seed; heat bath performs 64×3,400 site updates/seed. Analytical product-law agreement at K=0 and zero-source color symmetry are primary references; agreement with heat bath at K=0.35 is secondary consistency evidence. Gates are 0.025 on color fractions/local agreement comparisons, 0.015 on the product law and occupation identity. Each SW case visits **1,740,800** physical bonds including warm-up across four seeds.

| 8×8 case     | SW color0 fraction | SW agreement | Heat-bath agreement | SW occupied fraction | Component colors |
| ------------ | -----------------: | -----------: | ------------------: | -------------------: | ---------------: |
| 8x8 q2 K0    |           0.498684 |     0.500037 |            0.500488 |             0.000000 |           870400 |
| 8x8 q2 K0.35 |           0.499404 |     0.592966 |            0.593120 |             0.175143 |           567450 |
| 8x8 q3 K0    |           0.332627 |     0.333933 |            0.333577 |             0.000000 |           870400 |
| 8x8 q3 K0.35 |           0.334055 |     0.416830 |            0.418849 |             0.122708 |           656666 |
| 8x8 q4 K0    |           0.248806 |     0.250026 |            0.250586 |             0.000000 |           870400 |
| 8x8 q4 K0.35 |           0.249492 |     0.323668 |            0.322799 |             0.095460 |           704359 |

All 24 benchmark cases pass. These moderate equilibrium cases do not certify rapid mixing at strong coupling or criticality. The q=3 16×16 isotropic K=log(1+√3) browser case is an exploratory responsiveness check, not an interphase-mixing or critical-exponent gate. Strong q=4 K=1.6 runs show a dominant component; a short trajectory series is insufficient to establish equilibration. No unsupported standard errors or speedup claim is made.

## Worker, storage and compatibility

Six complete snapshot hashes captured from released M5c **before** engine edits cover direct/Metropolis/heat-bath on graph and rectangular geometries, segment switches, unequal batches, recent-history eviction and seeded Reset. All replay exactly. Old sampler code, mathematical Potts action and reference functions are untouched. The existing benchmark helper has only a type annotation narrowed to historical settings; its numerical budgets and assertions are unchanged.

New regressions cover trajectory cadence, same-seed unequal batches/Reset, scheduled unchanged configurations, full spin/FK aggregate alignment, eight-segment and 256-history limits, fixed-support local↔SW↔FK-direct changes, cleared auxiliary images and atomic ineligible/stale/oversized requests. Actual client/handler tests cover one in-flight eight-trajectory Run batch, queued Apply, repeated controls, acknowledged Pause and stale Reset replies. Per-command cluster cap is32; old 128/1024 Run policies and 4096 cap remain. Large tests show no full auxiliary arrays in historical records and no NxN pair matrix. Work totals include warm-up; scientific estimates exclude it.

Tool-local options are workspace-owned and keyed to assignments, so featured/gallery exchange preserves them. Deterministic component hues use no RNG. Browser Reset replay checks that selectors, histories, tool changes and representation toggles leave the next actual joint sample unchanged. Existing archive, URL and all other workspace pipelines remain in the full suite.

## Production browser evidence and screenshots

Six new scenarios run on desktop Chromium, 360px Chromium and mobile WebKit: discovery/exact eight-bond inspection combined with keyed exchange/capacity/display replay; eligibility and dimer/triangle/old-sampler return; SW cadence/segments/independent sessions; and the three box sizes. The focused new plus historical Potts suite passed **36 tests**. No console errors or horizontal overflow were observed.

Latency is wall time from Run click, through a rendered update-count increase, to Pause click and enabled Step after acknowledgment. Initial focused observations:

| Geometry and coupling | Desktop | 360px Chromium | Mobile WebKit |
| --------------------- | ------: | -------------: | ------------: |
| 8×8 q2, K=0.7         |  154 ms |         155 ms |        237 ms |
| 16×16 q3, K=log(1+√3) |  214 ms |         171 ms |        252 ms |
| 32×32 q4, K=1.6       |  253 ms |         213 ms |        294 ms |

All meet the fixed 10-second ceiling. These are host browser emulations, not physical-phone performance guarantees or equal-work algorithm comparisons. Full-suite/hosted load may change timings.

Screenshots: [small desktop](screenshots/m5d-small-desktop.png), [small 360px](screenshots/m5d-small-phone.png), [small WebKit](screenshots/m5d-small-mobile-webkit.png), [lattice desktop](screenshots/m5d-lattice-desktop.png), [lattice 360px](screenshots/m5d-lattice-phone.png), [lattice WebKit](screenshots/m5d-lattice-mobile-webkit.png). Settings remain collapsible; the existing mobile detail/overview and keyboard/numeric selection mechanisms remain. The graph keeps all parallel bond IDs and local MathML/HTML KaTeX explains the joint identities.

## Readability and remaining limits

The pure FK weight/component module, capped exact reference and explicit two-stage sampler can be read without React. Comments explain canonical component ownership, impossible weights, absolute normalization, RNG budgets and measurement boundaries. The independent BFS/cartesian oracle and rational dimer exercise make numerical checks hand-auditable. The source guide extends the existing student reading order. No older numerical modules were rewritten.

Bounds remain q=2,3,4, V≤4/E≤8 exact FK, 32×32 rectangular sampling, eight segments, 256 scalar history records and one current auxiliary image. No general external-field/antiferromagnetic FK, noninteger q, ghost spins, other cluster algorithms, gauge clusters, XY, new archives/sweeps or automatic decorrelation is claimed. Large connectivity matrices/axial FK estimators are not added; tiny pair connectivity and full per-bond counts are available. The pre-existing main-bundle size warning remains.

## Full validation and publication

`CI=1 npm run check` passed on the final source: formatting, TypeScript, **843 unit tests in 91 files**, production build, and **385 browser passes with the same two pre-existing skips** (2.9 minutes for browsers). This preserves the 708/367 baseline and adds 135 unit and 18 browser cases. `git diff --check` passed. The prior full pipeline also passed before the last explicit measurement/topology regressions and labeling polish. The final intended diff contains only FK/Potts integration, focused compatible tests/catalog counts, six new M5d screenshots and documentation; regenerated historical screenshots are preserved in a separate recovery stash. The original checkout and unrelated files remain untouched. Publication uses PR-first, with the user's explicitly authorized ordinary non-force fast-forward fallback only if the PR integration returns HTTP403 and fresh ancestry/clean-tree checks pass. Hosted validation, Pages, exact remote/served SHA and live asset/worker/desktop/360px checks are separate gates; local success alone is not deployment evidence.

The final local production preflight at 1280px and 360px verified FK exact inspection, SW Step/Run/Pause, atomic nonzero-source rejection, independent Small/Lattice sessions and legacy Ising, gauge, scalar, QM, Fields and Experiments navigation. Nineteen JS/CSS/font responses and ten actual worker loads per viewport stayed under `/lattice/`, with no failed requests, console errors or horizontal overflow. All **168** local links in the edited documentation resolve. Hosted commit identity is verified separately using the workflow-provided `VITE_GIT_SHA`; ordinary local builds leave provenance as `unknown`.

### Publication evidence

The implementation commit is `5b1cb807384f8e4ddf189a47a91e249c7b9402a2`. It was pushed to `codex/m5d-fk-edwards-sokal-sw`; PR creation returned HTTP403, “Resource not accessible by integration,” and no GitHub CLI was installed. Under the explicit release authorization, a fresh fetch, clean-tree check, ancestor check and exact 38-file diff review preceded an ordinary non-force push to main. Remote main and feature SHAs matched the implementation commit. No concurrent changes or unrelated files were overwritten.

The implementation's [hosted validation and Pages run](https://github.com/gantemur/lattice/actions/runs/38599121113) is the release audit trail. This evidence-only follow-up does not change executable code. Hosted completion and live served-SHA/asset/worker checks are still pending at the time this paragraph is committed; the final delivery report records their verified results, including the final documentation head. A successful Git push is not treated as deployment success.
