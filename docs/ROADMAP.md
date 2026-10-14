# Lattice Lab — Development Roadmap

**Version:** 0.16, 2026-10-14

**Status:** M0–M4d2, the architecture audit and model-page Stages A–E are released. M5a–M5d are released through main `0449e2a`; M5e XY is implemented, with validation/publication evidence in its review.

**Specification:** [SPECIFICATION.md](SPECIFICATION.md)

## Guiding delivery rule

Build **vertical slices** that connect a mathematically correct model, a working sampler or exact computation, a readable configuration/plot, and a verified browser workflow. Never build every abstraction first and then add physics later. The order is chosen to establish reproducible correctness and genuinely useful on-phone behavior before expanding the model catalog.

Each milestone closes only when its acceptance tests pass. A milestone may be split into smaller pull requests; do not accumulate unreviewable sweeping changes. Do not implement later optional features simply because the specification mentions them.

## Release targets

| Milestone | User-visible result | Scientific baseline | Status |
|---|---|---|---|
| **M0: deployable foundation** | Responsive app shell, one 0D Gaussian with density/convergence and segment comparisons | Exact moments, seeded sample, static Pages deploy | Completed and deployed |
| **M0.5: Comparative Sampling Laboratory** | Gaussian, single-spin and binomial models; direct/Markov sampling, trajectories and transition inspection | Exact distributions, transition-matrix balance, warm-up exclusion and seeded replay | Merged |
| **M1a: Interactive graph Ising** | Dynamic zero-to-six plots, preset graph parameter editor, local transition inspection | Full 1–4-spin enumeration; transfer matrix, periodic multiplicity, balance and sampling checks | Merged |
| **M1b: Continuous small systems** | Real graph fields, quartic wells, local conditionals and sampled marginals | Exact 1–4-variable Gaussian, controlled 1D quadrature, local-action tests | Merged |
| **M2: 2D Ising** | Lattice configuration view, Run/Pause/Step, basic plots | Exact tiny-box checks, tested local update engines | Merged in PR #7 |
| **M3a: Diagnostics & observables** | χ, Binder, heat capacity, spatial correlations, bounded ACF/ESS/SE, exact tiny-chain benchmarks | Independent enumeration, Markov spectra and statistical estimator tests | Merged in PR #8 |
| **M3b1: Saved experiments** | In-memory segment archive, comparison, portable JSON/CSV export and import | Capture invariance, provenance and round-trip tests | Merged in PR #9 |
| **M3b2: Sweeps** | Bounded independently seeded parameter sweeps and comparison plots | Seed, budget, numerical and import/replay tests | Merged in PR #10 |
| **M4: Continuous lattice fields and paths** | M4a1 massive 1D/2D Gaussian foundation, M4a2 Fourier/massless, M4b harmonic oscillator, M4c0 workspaces/tools, Stages A–E model pages, M4c1 interacting QM, M4c2 quartic-path HMC; M4d1 spatial φ⁴ | Tiny-matrix covariance, Fourier/oscillator invariants; full-force HMC validation | Through M4d2 released to main |
| **M5: More models / gauge** | Potts, XY, FK, Z₂ / U(1) tiny gauge laboratory | FK / duality checks, gauge-invariance tests | M5a–M5d released; M5e implemented, publication gates below |
| **M6: Research-facing extensions** | Improved actions, deeper spectral diagnostics, geometry and regulator comparisons | Model-specific benchmarks and performance studies | Exploratory |

## M0 — Deployable foundation and one exact model

**Objective:** immediately prove that the chosen tools, responsive UX, worker protocol, and static hosting work together. Avoid a skeleton without usable mathematical content.

**Deliverables**

- New public (or initially private, subject to GitHub Pages plan) repository, independent of SOL; README and versioned docs committed.
- TypeScript + Vite application configured for the project base path. Set up tests, type checking, formatting, and CI; deploy via GitHub Actions to GitHub Pages. Confirm live URL and direct/reload navigation.
- Landing view with workspace navigation. Only functional links enabled; future models marked `planned` rather than presented as available.
- Responsive application shell: model panel, main visualization, default chart, compact command row, collapsible controls/drawer, and a usable narrow-phone layout.
- One 0D Gaussian variable: select quadratic coefficient and source term, draw analytically normalized density and correctly labeled moment values; implement a simple seeded sampler and display sampled points/histogram with warm-up status.
- A validated RNG abstraction and a small worker stepping interface. A test must demonstrate that rendering frequency does not perturb the sequence of Monte Carlo random draws.
- One simple preset, one mobile browser smoke test, plus working build/test/deploy commands documented in README.
- Focused M0 refinement: local accessible KaTeX; four compact target/view slots, default density + convergence; known-variance independent-Gaussian diagnostics with bounded worker checkpoints; recent parameter-segment comparison, stable axes, explicit Reset, and display-only Fit All.

**Acceptance gate**

- Gaussian mean/variance match analytic formulas under several parameters, with correct normalization and no false exactness labels.
- App loads under the GitHub Pages subpath, not just localhost; worker code and assets load successfully.
- Phone-width controls are operable, dismissible, and do not delete numerical state.
- Basic Build/Typecheck/Unit/Browser pipeline passes.

**Explicitly out of scope:** generic formula editor, periodic lattices, coupled quartic integrals, gauge variables, parameter sweeps, generic plot registries and MCMC error analysis.

### M0 delivery record — 2026-10-10

Implemented in `codex/m0-gaussian-foundation`: TypeScript/Vite/React shell, separate single-site topology and scalar model, four compact target/view slots, collapsible settings, phone detail/2×2 modes, analytic density/moments, seeded independent draws, online moments and tail-aware histograms, Run/Pause/Step/Reset, a standard preset, and a typed worker protocol. Numerical and UI state remain separate. No M1 models, periodic geometry generators, formula editors, exports, or saved-run manager were added.

The refinement adds local KaTeX HTML + MathML, default density and running-mean views, optional log–log absolute error, and worker-generated logarithmic checkpoints. Pointwise known-variance bands and RMS scaling are distinguished from a single nonmonotone trajectory. Apply preserves the RNG stream and previous parameter segments; up to eight segments have separate statistics, curves, and reference values. Axes expand only until Fit All or Reset. Reset explicitly clears history and replays the chosen seed under the current parameters; Fit All is display-only. This supersedes the initial M0 behavior of clearing measurements on Apply, without advancing the M3 experiment manager.

Tooling: npm lockfile, Vitest, TypeScript, Prettier, production-build Playwright tests for desktop Chromium and emulated phones in Chromium/WebKit, and a GitHub Actions validation/Pages workflow. Vite uses `/lattice/`; navigation uses hash anchors. KaTeX and its fonts are local static assets.

Local refinement validation: formatting and TypeScript checks, production build, **63 unit tests**, and **21 browser tests**. Numerical tests cover Gaussian action/normalization/moments, RNG vectors/replay, batching and snapshot invariance, logarithmic checkpoint bounds, ensemble RMS scaling and pointwise coverage, parameter switching and segment isolation, bounded retention, Reset, viewport expansion, and slot assignment. Browser tests cover local math/fonts/worker loading, hash reload, desktop and phone overflow, keyboard controls, compact slots, assignment/close/open/rearrange without sampling, Run/Apply/Pause/Step ordering, stable axes, Reset/Fit All, seed replay, invalid inputs, and worker recovery. Desktop and phone screenshots are visually reviewed. `npm run check` runs the full pipeline.

M0 was merged in PR #1 and is deployed at https://gantemur.github.io/lattice/. Physical-phone performance measurements and license selection remain open. Periodic geometry tests belong to M1, when those geometries exist.

## M0.5 — Comparative Sampling Laboratory

**Objective:** compare exact one-variable distributions and sampling algorithms while preserving the M0 design, history, mathematical typesetting, static deployment and reproducibility.

**Deliverables**

- Gaussian direct and random-walk Metropolis; single-spin direct, heat bath and lazy Metropolis; binomial direct and boundary-safe nearest-neighbor Metropolis.
- Small explicit model/sampler types, separate numerical kernels, exact references and worker-owned accumulators.
- Exactly four plot slots: distribution, recent sample trajectory, running mean, and Metropolis acceptance when applicable (otherwise collapsed).
- Exact bounded recent transition histories, adjustable windows, step inspection, acceptance/self/rejection counters, configurable discarded Metropolis warm-up.
- Separate parameter/algorithm segments; preserve compatible configurations and RNG, stable physical axes, Reset and display-only Fit All. Incompatible models start a new session.
- No independent-Gaussian uncertainty bands on MCMC segments. No advanced autocorrelation/ESS, graph editing, coupled fields, lattice generation, exports or experiment manager.

**Acceptance gate**

Exact formulas and extremes; discrete transition-matrix stationarity/detailed balance/aperiodicity; correct proposal boundaries and rejection/self semantics; independent and post-warm-up Metropolis equilibrium benchmarks; batching/Step/RNG replay; segment and warm-up isolation; trajectory/counter consistency; full formatting/typecheck/unit/build/desktop and phone browser pipeline; visual screenshot review.

### M0.5 delivery record — 2026-10-10

Implemented on `codex/m05-comparative-sampling`, branched from current `main` after M0 PR #1. All three models and their requested samplers are available with separate settings, exact references, recent trajectories, Step inspection, warm-up exclusion and acceptance counters. Compatible settings changes retain segments and the RNG stream; model-family changes start an explicit new session. No M1 graphs/lattices or full M3 experiment management were introduced, and no runtime dependency was added.

Validation: **103 unit tests** cover exact formulas/normalization/extremes, independent sampler moments, discrete transition-matrix stationarity/detailed balance/aperiodicity, Metropolis frequencies using exact matrix covariance bounds, Gaussian Metropolis ensemble moments, warm-up exclusion, bounded exact histories, seeded Step/batch replay, segment isolation, settings changes, Reset, viewport stability and conditional uncertainty rendering. **36 production browser tests** pass across desktop Chromium, 360px phone Chromium and emulated iPhone WebKit. They include thousands of updates followed by Pause/Step/Resume, trajectory browsing without numerical mutation, all models and samplers, current-state/inspection agreement, compact slots, Reset/Fit All, keyboard controls, invalid inputs, local math/worker loading, and portrait/landscape overflow. Formatting, typecheck and production build pass under `/lattice/`.

Desktop and phone screenshots are reviewed and included in [the review evidence](M05_REVIEW.md). M0.5 is not deployed by the feature branch. Remaining limits: fixed warm-up is not a mixing guarantee; latest eight segments and 1000 exact transitions per segment only; finite binomial parameter range excludes p=0/1; no autocorrelation/ESS, saved runs or exports; no physical-phone performance benchmark. M0.5 was subsequently merged in PR #2; the feature branch itself did not deploy it.

## M1 — Small Systems: configurable plots and true tiny lattices

**Objective:** make the first distinctive teaching instrument: a configurable micro-laboratory backed by exact calculations and inspectable MCMC.

### M1a — Tiny geometry and discrete Ising

- Domain types: stable vertex, edge, face IDs; oriented edges; parallel edges and self-links preserved. Geometry construction independently tested from physics.
- Presets: one site, four-site open path, cycle/periodic 1×4 ring, open 2×2 square (with optional one oriented face), star, K4, and genuine periodic 2×2 torus (4 sites / 8 nearest-neighbor bonds / 4 oriented faces).
- Display: preset graph diagram with selected nodes/bonds and signed/zero edge weights; distinguish parallel/wrapped bonds. Compact numerical coupling/field lists; K4 zero weights realize simple four-site graphs. No graphical creation/deletion or dragging; preserve all preset topology.
- Generic finite-graph Ising, including nonuniform couplings and external fields.
- Exact enumeration for up to four spins (16 states): partition function, energy, moments and selected correlations; enumerate even if a sampler is never run.
- Local Metropolis and discrete heat bath. Inspection trace includes selected spin, local neighborhood contribution, `ΔS`, proposal/conditional probability, RNG sample, and resulting state.
- Dynamic zero-to-six plot collection; two defaults (M distribution/trajectory), Add Plot, remove/collapse/reorder/expand; site/global targets, running means, energy, exact/sample covariance and local conditionals. Separate prominent graph view with touch/keyboard form alternatives.

**Acceptance gate M1a**

- Every topology has the specified site/edge/face counts and incidence laws.
- For all four-spin configurations and representative random couplings, incremental flip differences match recomputed energy.
- A periodic 2×2 torus has *eight* bond records, not four; exact Ising `Z` agrees with full enumeration of that model.
- Periodic 1×4 Ising `Z` agrees with transfer matrix `Tr(T⁴)` under stated convention.
- Seeded step trace reproduces the run-mode transition sequence for identical updates.
- Up to six plots, normally two desktop columns, phone single detail and compact overview; plot/graph display edits leave numerical state and RNG unchanged.

### M1a delivery record — 2026-10-10

Implemented on `codex/m1a-small-graph-ising` from `origin/main` at merge `056ac30` (M0.5 PR #2). Domain/physics/sampler/worker/display remain separate. Seven presets include the genuine eight-bond/four-face torus; the numerical domain supports 1–4 sites and up to 16 distinct bonds. The UI uses presets and compact numerical coupling/field lists, supporting negative/zero/heterogeneous values; K4 zero weights realize simple four-site graphs. No graphical topology editing is included. Signed face walks and periodic multiplicity are validated. Exact configurations, observables and pair/covariance results are independent of sampling.

Random-site lazy Metropolis, local heat bath and direct exact sampling share the existing worker/Step protocol. Graph counts and per-observable accumulators project into existing SVG charts; the detailed trace highlights the real selected site and incident contributions. Dynamic zero-to-six plots supersede the fixed-four UI; no numerical behavior depends on plot assignment. Coupling/field changes preserve configuration/RNG with new segments; topology changes explicitly reset the session. Reset/Fit All retain their established separation.

Validation and visual evidence: [M1a review notes](M1A_REVIEW.md). Numerical tests include full-action/local-difference comparisons, independent explicit bond enumeration, transfer-matrix `Tr(T⁴)`, heat-bath conditionals, balance/stationarity/aperiodicity, seeded batching, warm-up/segment/Reset checks and finite-chain covariance-based ensemble tolerances. Full `npm run check` passes: formatting, typecheck, **156 unit tests**, production build, and **51 browser tests** (desktop Chromium, 360px phone Chromium and emulated iPhone WebKit). Desktop/phone, Step and numerical-parameter screenshots have been reviewed. Local validation does not deploy or merge the feature branch.

No M1b continuous extension, large-lattice engine, gauge dynamics, cluster algorithm, backend, new dependency or M3 saved-run manager was introduced.

### M1b — Continuous scalar systems

- Single-site quartic `V(x)=a x²/2 + λ x⁴/4 − h x`, with parameter validation and informative rejection of non-normalizable cases.
- Numerical high-accuracy quadrature for moments/density of one real variable, explicitly **labeled reference quadrature**, not analytic exactness. Display integration domain and tolerance/reference limitations if used.
- Independent and coupled 2–4 real-variable modes with per-node potential plots, conditional energy and Monte Carlo marginal; sampled plots must not be mislabeled as exact coupled marginals.
- Compare current local energy, conditional distribution at fixed neighbors, sampled marginal, and sampled histories.
- Minimal save/restore of **parameter configurations**, ideally a shareable link with schema version.

**Acceptance gate M1b**

- Gaussian limit agrees with M0 analytics; quadrature agrees with known test integrals and reports failure when error control is inadequate.
- When coupling is zero, sampled marginals agree with independent references. For nonzero coupling, bare potential, conditional potential, and marginal remain distinguished in labeling.
- Opening/closing plot controls does not alter sampler state.

### M1b delivery record — 2026-10-10

Implemented on `codex/m1b-continuous-scalars` from `origin/main` at the M1a refinement merge `c967e89`. Real-vector worker state, graph presets including a coupled pair, six editable experiment configurations, dimensionless gradient/quartic action, exact multivariate Gaussian benchmarks/direct and coordinate-heat-bath samplers, local Metropolis, conditional/potential inspections, bounded per-target measurements and product/covariance/scatter plots are included. Compatible parameter changes preserve vector/RNG and start separate warm-up/measurements; topology switches start a new session. Versioned configuration-only URL sharing is included. No M1b numerical behavior is represented as full multivariate quartic exactness. See [M1b review evidence](M1B_REVIEW.md) for validation results and screenshots.

The plotting refinement on the same branch gives scalar trajectories 100/500/1000-update history windows and sampler-appropriate point/step rendering. Scalar Metropolis acceptance now uses per-segment graphical bars; direct Gaussian and coordinate heat bath show N/A. These are display-only corrections; worker measurements and sampler sequences remain unchanged.

## M2 — 2D Ising: the main lattice laboratory

**Objective:** deliver a robust demonstration of ordered/disordered regimes with controls and measurable observables.

**Deliverables**

- Rectangular square lattices with periodic and open boundaries; support 2×2 from the same lattice generator used in M1. Support anisotropic `Jx`, `Jy`, field `h`, and inverse temperature `β`.
- Optimized local Metropolis and heat bath using checked local `ΔS`; optional seeded spin initialization choices.
- UI: large 2D spin view, optional magnification/selection, Run/Pause/Step/Reset, visible progress/counters, temperature control; view frame rate independent of update rate.
- First plots: magnetization and energy histories, histograms, principal running means and acceptance rate; add elementary spatial correlations when reliable.
- Model information with exact finite-volume status, 1D and 2D reference points, and small experiments such as phase ordering and field response.
- Thermometer-style rapid parameter editing may initialize a new run from the previous configuration, but always begins fresh segment estimators and discloses the warm start/warm-up policy while preserving bounded prior segments for comparison.

**Acceptance gate**

- Small 2×2 energy and observables match M1 enumeration.
- High- and low-temperature finite-lattice behavior is qualitatively correct without misrepresenting finite-volume phenomena as the infinite-volume theorem.
- The simulation remains responsive during long runs; it can pause precisely before step inspection.
- Graph/plot legends, measurement status, and touch controls function on a phone.

**Out of scope:** demanding infinite-volume critical exponent fits, guaranteed asymptotic error estimates, production performance tuning.

### M2 feature-branch delivery record — 2026-10-10

The new Lattice Systems workspace supports 2–64 sites per side, independent open/periodic x/y boundaries, signed anisotropic bonds, field and temperature. An indexed typed-spin runner preserves distinct periodic bonds, updates H/M incrementally, runs lazy Metropolis or heat bath in bounded worker batches and records measurements on segment-local sweep boundaries. Canvas configuration, selected 5×5 detail, actual worker transition inspection, separate parameter segments, dynamic plots and 2×2 exact/theoretical references are implemented. Run/Pause/Step and phone layout are validated against the production build; numerical and measured performance evidence is in [M2 review](M2_REVIEW.md). This record does not mark deployment or merge complete.

Pre-merge correction: the 2×2 exact panel now enumerates directly in physical M2 units for every supported temperature/coupling/field combination and mixed boundaries, avoiding M1a's narrower dimensionless editing limits. Step distinguishes hypothetical flip, Metropolis proposed-move and actual transition energy/action changes. The Tc example sets the isotropic zero-field draft explicitly. Regression and production browser evidence is recorded in [M2 review](M2_REVIEW.md); the branch remains unmerged.

Current M2 limits: side length one is excluded; nearest-neighbor bond-product averages and long-range correlations are deferred; no physical-phone throughput measurement or MCMC error bars are claimed. Experiment prompts are concise in-app notes, not saved experiments. The M2 acceptance gate remains subject to PR review and any documented final validation issues.

M2 was merged in PR #7. M3a adds the deferred nearest-neighbor products and bounded axial correlations; the historical M2 limit above describes that milestone's delivery state.

### M1a refinement — local inspection and convergence clarity

Selected site/bond panels expose current local fields, flip costs, conditional probabilities and bond action contributions, with read-only selection and a link to the existing Apply form. Symmetry-aware exact references preserve true tiny nonzero responses. Log absolute-error plots use an explicit scale/N floor, disclose omitted checkpoints, and show current numerical errors/counts. See [refinement review notes](M1A_REFINEMENT_REVIEW.md) and D-025 for validation and screenshots.

## M3 — Measurement and experiments layer

**Objective:** make the lab useful for reproducible, moderately quantitative student projects.

### M3a — Statistical diagnostics and physical observables

M3a on `codex/m3a-statistical-diagnostics` adds full-segment fourth-magnetization and directional/spatial pair moments, the finite-volume connected susceptibility, Binder cumulant and physical-energy heat capacity. The M2 exact 2×2 enumerator supplies the same quantities for open, periodic and mixed boundaries. Worker-owned 8192-observation rings for m, |m| and e (or graph Ising E) produce a bounded ACF, a documented conventional initial-positive/self-consistent τ window, recent-window ESS/SE and nonoverlapping blocking views. Statuses distinguish insufficient, constant, unresolved, drift and window-sensitive records. Small graph Ising and M2's 2×2 case receive exact selected-kernel matrices, reversible spectra, stationary ACF and asymptotic variance at the correct measurement cadence. Local graph, direct-draw and M2 sweep units are separately labeled; only fully periodic spatial plots use global-mean centering. The dynamic six-plot collection remains display-only and phone responsive. Details and limitations are in [M3a review](M3A_REVIEW.md).

**M3a acceptance:** independent exact and stochastic reference tests; preserved seeded Run/Step/segment behavior; clear separation of physical fluctuation identities, empirical uncertainty and exact stationary-chain benchmarks; full formatting/typecheck/unit/build/desktop and phone browser checks. A finite τ from a short or drifting record does not imply reliable mixing. Structure factors, correlation-length fitting and general experiment storage are deferred.

**M3a validation record — 2026-10-11:** `npm run check` passes formatting, typecheck, 234 unit tests in 28 files, production build and 111 production browser tests across desktop Chromium, 360px Chromium phone and emulated iPhone WebKit. Desktop/phone screenshots, numerical methods, local throughput observations and limits are recorded in [M3a review](M3A_REVIEW.md). The branch is not merged or deployed.

### M3b1 — Saved experiments and portable data

M3b1 adds a third mounted Experiments workspace. Paused/idle, version-checked worker capture copies one parameter segment's full aggregate summary and actually available bounded raw observations. It never alters an interactive sampler or its RNG. Each saved scientific payload is immutable while name/notes remain editable. The in-memory library has explicit count/byte limits and no silent eviction. A version-1 JSON bundle round trips validated records; CSV measurements, sidecar metadata and a summary CSV are separate downloads. Compatibility descriptors permit a small side-by-side comparison without equating dimensionless graph action with physical lattice energy density. M3a's 8192-point rings are copied on demand only, not sent during Run; non-Ising Small Systems retain their recent 1000 transitions. Historical segments do not acquire a fabricated current configuration or a false fresh-seed replay claim. Details are in [M3b1 review](M3B1_REVIEW.md).

**M3b1 acceptance:** save active/historical segments from both mounted live workspaces after Pause, inspect complete provenance and coverage, export a JSON bundle, reload/import to recover identical stored numbers, reject malformed imports atomically, keep desktop/phone layout accessible, and pass full numerical/build/browser checks. Refreshing without export can lose the memory-only library. Existing scalar configuration-only URLs remain unchanged; a lattice configuration-only URL is deferred.

**M3b1 validation record — 2026-10-11:** `npm run check` passes formatting, typecheck, 248 unit tests in 30 files, production build and 117 browser tests across desktop Chromium, 360px Chromium phone and emulated iPhone WebKit. Resource limits, local capture size/latency, screenshots and remaining limitations are recorded in [M3b1 review](M3B1_REVIEW.md). The feature branch is not merged or deployed.

### M3b2 — Parameter sweeps and experiment comparison (feature branch)

The M3b2 slice extends the merged M3b1 archive with independently seeded bounded 2D Ising sweep points, a dedicated worker, editable sweep presets, a parameter-axis comparison plot and complete permitted point records. Each point is a fresh run, never an inherited-temperature trajectory. A version-2 portable manifest references the original point records; version-1 imports remain valid. Completed results survive Cancel, whereas partial point data are marked discarded. See [M3b2 review](M3B2_REVIEW.md) for limits and validation.

**M3b2 feature-branch validation — 2026-10-11:** The pre-merge worker-protocol correction makes repeated controls safe and completed-point ACKs identity-specific, with single terminal replies and retry-safe archival. `npm run check` passes formatting, typecheck, 274 unit tests, production build and 130 browser tests across desktop Chromium, 360px Chromium phone and iPhone WebKit (two desktop-only benchmark instances intentionally skip on phone/WebKit). Screenshots, resource observation and remaining limits are in [M3b2 review](M3B2_REVIEW.md). Merge and Pages deployment remain separate review steps.

**Deliverables**

- Small bounded parameter sweeps (temperature/coupling/size) executed sequentially or with simple worker scheduling; clear per-run equilibration and budget policy.
- Experiment presets with question, expected qualitative outcome, sampling caveats, and reference to associated model equations.

**Acceptance gate**

- Saved run parameters cannot be silently mutated; changing the measure creates a distinct dataset/segment.
- Units, definitions, and sample/uncertainty status always accompany plots.
- Autocorrelation and estimator tests agree with independently generated reference sequences or exact small-state checks within understood finite-sample tolerance.
- Run export/import round-trip preserves key provenance; exported CSV carries a discoverable metadata record.

## M4 — Continuous fields and Euclidean quantum mechanics

**Objective:** take the lab beyond discrete spin systems while retaining validated numerics and a coherent UX.

**Subdeliverables**

1. **M4a1 Gaussian fields, 1D/2D (merged).** Positive-`r` bond-Laplacian action, open/periodic boundaries, dense Cholesky mean/covariance/log Z through 64 sites, direct/heat-bath/Metropolis worker sampling, fixed-scale profile/heatmap and local/pair inspection. Full-segment moments and bounded histories have independent tiny-matrix and seeded tests. The [M4a1 review](M4A1_REVIEW.md) records remaining limits.
2. **M4a2 Gaussian spectral and massless work (merged).** Finite DFT, periodic spectral reference and independent draws, mode-power inspection, and induced-measure mean-zero massless GFF; see [review](M4A2_REVIEW.md). Open/mixed massive fields remain dense.
3. **M4b harmonic Euclidean oscillator (merged).** Periodic N-site path, physical β/ω controls, independent Fourier and local Gaussian sampling, full-segment two-point correlator, finite-spacing and continuum gaps, kinetic-normalized transfer trace, bounded quadrature and reflection-covariance illustration. The [M4b review](M4B_REVIEW.md) records its validation and limits; M4c1 adds the separate interacting path family.
4. **M4c0 workspace and teaching tools (merged).** Separate mounted QM and Fields sessions, five shared routes, unified Run/Pause, and configurable six-card galleries. Optional transfer quadrature is lazy; presentation changes preserve the numerical stream. See [review](M4C0_REVIEW.md).
5. **Featured-tool migration Stage A (implemented).** Pilot one full-width assignment plus up to six optional gallery tools in QM and Fields. Whole-assignment swaps retain keys and presentation choices; explicit replacement retains every gallery card. Existing numerical workers and archive data are unchanged. See the [architecture audit](MODEL_INTERFACE_AUDIT.md) and [Stage A review](FEATURED_STAGE_A_REVIEW.md).
6. **QM/Fields model-page Stage B (implemented).** The model formula and collapsible editable settings lead the sidebar; the main column has controls/readings, feature, compact zero-to-six-card diagnostics, collapsible technical coverage and short mathematics/exercises. Add creates a suitable card directly; one open desktop gallery card spans both columns. Tool-specific display controls stay with their tools, keyed across feature exchange. The [Stage B review](MODEL_PAGE_STAGE_B_REVIEW.md) records tests and screenshots. Small Systems and Experiments are migrated separately.
7. **Lattice Systems model-page Stage C (implemented).** The existing 2D Ising canvas is the default full-width feature; m and physical-e histories are the initial gallery cards. All 16 prior plot types use the shared six-card tool deck, with one synchronized nominal-sweep history window and assignment-local spatial displacement controls. Exact 2×2 references, full-segment observables, recent diagnostics and archives remain accessible below in collapsible technical details. Sampling, worker protocols and capture formats are unchanged. See the [Stage C review](MODEL_PAGE_STAGE_C_REVIEW.md).
8. **Small Systems model-page Stage D1 (implemented).** Gaussian, single spin, binomial count and existing graph Ising now use a model-specific featured display and zero-to-six-card ToolDeck gallery. Their original scientific plots are reused with graph-only applicability, per-card histogram overlays and display-only Refit axes. Graph drawing/selection is separate from its sidebar parameter editor; exact results and diagnostics remain in technical details. Seeded sessions, worker captures and archive formats remain unchanged. See the [Stage D1 review](MODEL_PAGE_STAGE_D1_REVIEW.md).
9. **Small Systems real scalar Stage D2 (implemented).** The existing scalar graph is the featured display with histogram and scatter/bare-potential defaults. Ten pre-existing scientific renderers live in the six-card gallery; per-assignment targets, histogram visibility, viewports and trajectory windows survive feature exchange. The sidebar owns geometry and draft coefficients; local and exact references are collapsible. Worker numerics, RNG, archives and configuration-only URLs are unchanged. See the [Stage D2 review](MODEL_PAGE_STAGE_D2_REVIEW.md).
10. **Ising Local neighborhood teaching tool (implemented).** The canvas remains the default Lattice Systems feature, with m/e histories as default gallery cards. A separate selectable and featureable 5×5 view reads the same selected site and spin snapshot, with open-boundary marking and independent periodic wrapping. No worker, numerical, archive or plot renderer changed. See the [neighborhood review](ISING_NEIGHBORHOOD_REVIEW.md).
11. **Named examples Stage D3 (implemented).** Group directly selectable elementary, small-Ising and scalar examples. Add dimer, three-site chain and triangle geometries without new Ising kernels; keep K4, open chain and true torus in advanced access. Example selection preserves same-topology segment rules, legacy scalar URLs and archive data. See the [D3 review](PEDAGOGICAL_CATALOG_D3_REVIEW.md).
12. **Custom simple-graph editing Stage E (implemented).** Directly select a custom two-to-four-spin Ising graph and edit site count, each possible simple-pair presence, signed active coupling and site field in a draft sidebar form. Canonical `pair:v0:v1`-style IDs survive edge additions. Present K=0 bonds remain in the domain; absent pairs do not. Apply starts a seeded session for topology changes or an isolated parameter segment for K/b changes. The existing Ising exact/sampling/diagnostic kernels and archive schema are reused; periodic multigraph and cell-complex presets remain distinct. See the [Stage E review](CUSTOM_ISING_GRAPH_STAGE_E_REVIEW.md).
13. **1D classical Ising chain (implemented).** Extend the indexed Ising worker with a one-row chain: open N=2–64 or periodic N=3–64, no transverse bond or fabricated y observable. Reuse local Metropolis/heat bath, segment and archive semantics. A pure, scaled 2×2 transfer reference provides finite-N log Z, site means, energy, susceptibility and pair correlations; its signed eigenvalue ratio gives the separately labeled bulk spatial correlation length. The chain-specific ToolDeck features a readable spin chain and defaults to exact-versus-sampled spatial correlations plus magnetization history. See [mathematics](math/ising-chain-transfer.md) and [review](ISING_CHAIN_REVIEW.md).
14. **M4c1 interacting Euclidean QM (released).** A separate quartic/double-well path model uses pure periodic action and local Metropolis kernels, full-segment correlations, metastability counts and a lazy worker-owned three-grid transfer study. Resolved and under-resolved finite-spacing spectrum/correlator statuses are explicit; the harmonic model's analytic references and RNG are unchanged. Independent harmonic, finite-difference, quadrature-refinement, seeded-worker and desktop/phone browser checks passed. See [mathematics](math/interacting-oscillator.md) and [review](M4C1_REVIEW.md).
15. **M4c2 quartic HMC (released).** Identity-mass auxiliary momenta, full quartic force, reversible/volume-preserving leapfrog, complete-ΔH correction, trajectory-based warm-up/stride, bounded energy-defect and effort diagnostics, and sampler-aware worker batches. Finite-difference, reversibility, Jacobian, refinement, multi-seed Gaussian/interacting and desktop/phone checks gate release. The [mathematics](math/hmc-euclidean-qm.md) and [review](M4C2_REVIEW.md) give the conventions and evidence. M4d1 implements spatial φ⁴ below; spatial-field HMC is implemented in M4d2 below.
16. **M4d1 spatial lattice φ⁴ (released to main).** Distinct ordinary 1D/2D interacting field, strict three-uniform local Metropolis, validated full gradient, full-segment m²/m⁴ and spatial x/y correlations. Analytic Gaussian, decoupled quartic quadrature, independent coupled-dimer quadrature and exact periodic-chain/QM transfer correspondence gate scientific correctness. A separate field model session, controlled profile/heatmap, local quartic conditional inspection, scalar and proposal tools, lazy reference statuses and six-card phone gallery preserve existing kernels and archives. See [mathematics](math/spatial-phi4.md) and [M4d1 review](M4D1_REVIEW.md) for validation and release evidence.
17. **M4d2 spatial HMC (released).** Whole-field identity-mass trajectories reuse a small pure leapfrog calculation with exact QM golden replay. Strict trajectory cadence, eight-trajectory Run batches, complete-ΔH correction, bounded diagnostics, preserved spatial observables and model-specific controls extend M4d1. Independent force, reversibility, Jacobian, energy-order, Gaussian/quartic/dimer/transfer, seeded-worker and desktop/phone checks gate release. See [mathematics](math/hmc-spatial-phi4.md) and [review](M4D2_REVIEW.md).

**Acceptance gate**

- Exact free-field covariance and oscillator correlator benchmarks agree with sampled and discrete theoretical calculations.
- Numerical HMC acceptance logic includes the correct Metropolis correction; reproducibility and area-preserving/time-reversal checks performed within numerical tolerance.
- Real-valued fields handle scaling and color maps safely without misleading auto-rescaling.

## M5a — Tiny Z₂ gauge theory (released)

Delivered scope: open plaquette and genuine periodic 2×2 cell complex, independent exact and lazy local link samplers, worker-owned paused gauge transformations, full invariant statistics and bounded segments, independent enumeration/analytic references, all physical link IDs accessible on desktop and phone. Two Small Systems launchers leave the five top-level destinations and old numerical engines intact. The [review](M5A_REVIEW.md) records exhaustive invariance/orbits, finite-state balance, fixed-seed ensemble checks, actual worker protocol, production browser coverage and release status. No gauge archive or sweep format is introduced.

## M5b — Compact U(1) tiny gauge theory

Implemented on `codex/m5b-compact-u1-gauge` from verified main `6634d771e0af7eb653ac3af62930f7d4c5f118a9`. Two continuous-link examples reuse oriented square/torus geometry and drawing, with distinct U(1) arithmetic, angular Metropolis and worker-owned complex measurements. Controlled Bessel/character references, independent one-/three-angle quadrature, gauge invariance and coupled-chain tests, seeded segments and full desktop/phone regression gate delivery. The [mathematics](math/u1-gauge.md) and [review](M5B_REVIEW.md) describe exact conventions, actual numerical evidence and release status. No gauge archive or universal simulation framework is introduced. Released as `25049f351f5753bc99d1cbde0a94295c9fc21bbe`: hosted validation and Pages [passed](https://github.com/gantemur/lattice/actions/runs/38508189972); public desktop/360px behavior, served SHA and worker/assets were verified.

## M5c — q-state Potts models

Implemented on `codex/m5c-potts-models` from verified released main `25049f351f5753bc99d1cbde0a94295c9fc21bbe`. q=2,3,4 small graphs and 2≤Lx,Ly≤32 rectangles share pure categorical mathematics and one Potts engine, with separate Small/Lattice sessions. Signed/anisotropic interactions, exact tiny enumeration, lazy Metropolis, heat bath, eligible independent draws, isolated measurement segments, categorical tools and raw axial correlations are implemented. [Mathematics](math/potts-model.md) and [review](M5C_REVIEW.md) record independent formulas, full tiny transition matrices, q=2 action/partition correspondence, multiseed sampling and desktop/phone evidence. Released as `8b0bbdef2ddea1053b82362b243eb37e14192380`: hosted validation and Pages [passed](https://github.com/gantemur/lattice/actions/runs/38514716290), with served SHA, assets/workers and desktop/360px behavior verified.

## M5d — FK, Edwards–Sokal and Swendsen–Wang

Implemented on `codex/m5d-fk-edwards-sokal-sw` from released main `8b0bbdef2ddea1053b82362b243eb37e14192380`. Both internal stages are present: exact physical-bond enumeration/joint identities and genuine conditional bond-refresh/component-recolor SW. Tiny exact FK draws, strict eligibility, explicit trajectory cadence, bounded worker-owned FK measurements and Small/Lattice teaching tools retain the five workspaces and old seeded kernels. Independent BFS/joint sums, complete tiny transition matrices, released replay hashes, fixed multiseed comparisons and desktop/phone production tests gate completion. [Mathematics](math/fk-edwards-sokal.md) and [review](M5D_REVIEW.md) record actual evidence and limits. Implementation `5b1cb807384f8e4ddf189a47a91e249c7b9402a2` and the documentation follow-up passed hosted validation and Pages/live checks. The review records actual results and a detected late older deployment; final documentation-head verification is reported separately. Local success alone does not claim deployment. That release stopped before M5e and did not expand persistence.

## M5e — Classical XY and lattice vortices

Implemented on `codex/m5e-xy-vortices` from main `0449e2a993a5f4a363fa28081c8de74abc234333`. One site-angle family connects small Bessel/character/quadrature examples to bounded 2D lattices. Both local samplers, signed physical geometry, strict RNG accounting, principal-lift integer vortices, ambiguity coverage, periodic neutrality and worker-owned global rotation have independent mathematical/replay checks. Four named examples, Canvas arrows/overlays and the existing ToolDeck retain five workspaces and older sessions. [Mathematics](math/xy-model.md) and [review](M5E_REVIEW.md) declare ensembles, error gates, browser evidence and limits. Full local and hosted validation plus final served-SHA verification after older deployments finish gate release. Stop after M5e: no new archive, XY cluster/HMC, BKT fitting or M6 implementation.

## Remaining M5 extensions (not part of the planned scientific core)

**Objective:** demonstrate reuse of the domain/field/sampler/plot architecture.

**Deliverables**

- Potts and XY/vortices are implemented in M5c/M5e above. Their planned scientific scope closes when M5e deployment is verified; later algorithms require new scope.
- M5d implements the zero-field ferromagnetic FK/ES representation and SW below; broader random-cluster dynamics require new scope.
- The tiny `Z₂` slice above is implemented; larger gauge geometries require their own explicit scope and validation.
- Compact `U(1)` is implemented for the two tiny cell complexes above; larger domains and alternative samplers need separate scope and validation.
- Gauge-specific small-system interface: select links to inspect while keeping the entire link configuration in the worker; do not mistake site rotors for gauge connections.

**Acceptance gate**

- Gauge-action and Wilson-loop values invariant under local gauge transformations, including tiny periodic topology and orientation reversals.
- Link/face rendering and controls work on phone without requiring all link-variable panels simultaneously.
- Exactly solvable/strong-coupling or enumeration benchmarks used where feasible; no unsupported claims about confinement or criticality.

## M6 — Optional research-facing extensions

Consider only after the common architecture is stable: improved lattice actions, alternative samplers, general correlation-matrix spectroscopy, larger parameter scans, finite-size scaling assistants, geometry-coupled observables, dynamical lattice regulators, and additional lattice field/gauge models.

Research-facing numerical work may exceed what is comfortable in a browser. At that stage one may add *offline export and import* rather than a server; do not assume cloud computation is necessary.

## Practical working cadence

For every feature or small pull request, require:

1. A model/mathematics note: action, state, boundary convention, and what is being estimated.
2. Working UI slice visible in a browser and usable at phone width.
3. Automated tests against an independent reference, exact formula, or a clearly justified invariant.
4. A screenshot/smoke-test note and explicit list of limitations.
5. Necessary updates to this roadmap/specification and a decision record if architectural assumptions changed.

M0–M4d2, the readability pass and the architecture audit are released to main. **Model-page Stages A–E are implemented for QM, Fields, Lattice Systems and Small Systems**. M5a Z₂, M5b U(1) and M5c Potts are released to main. M5d is released through main `0449e2a`. M5e implements XY with release gates above; later archive stages remain future scope.

## Definition of done for the initial public usable release

After M1, a student should be able to open the static website on a phone or laptop, inspect four connected variables, choose a periodic 1×4 or genuine periodic 2×2 graph, run and single-step a validated sampler, compare a result with finite exact enumeration, change presets without losing track of the current measurement regime, and understand what the displayed curves mean. All without installing software or creating an account.
