# Lattice Lab — Development Roadmap

**Version:** 0.1, 2026-10-10  
**Status:** Proposed initial plan, not a claim of implementation  
**Specification:** [SPECIFICATION.md](SPECIFICATION.md)

## Guiding delivery rule

Build **vertical slices** that connect a mathematically correct model, a working sampler or exact computation, a readable configuration/plot, and a verified browser workflow. Never build every abstraction first and then add physics later. The order is chosen to establish reproducible correctness and genuinely useful on-phone behavior before expanding the model catalog.

Each milestone closes only when its acceptance tests pass. A milestone may be split into smaller pull requests; do not accumulate unreviewable sweeping changes. Do not implement later optional features simply because the specification mentions them.

## Release targets

| Milestone | User-visible result | Scientific baseline | Status |
|---|---|---|---|
| **M0: deployable foundation** | Responsive app shell, one single-variable 0D Gaussian view | Exact moments, seeded sample, static Pages deploy | Planned |
| **M1: Small Systems** | Four plot slots, tiny graph presets/editor, detailed Metropolis inspection | Full enumeration of 4-spin Ising; 1×4 ring and 2×2 torus checks; 0D quartic reference | Planned |
| **M2: 2D Ising** | Lattice configuration view, Run/Pause/Step, basic plots | Exact tiny-box checks, tested local update engines | Planned |
| **M3: Measurements & Experiments** | Saved comparisons, autocorrelation, error analysis, exports and finite sweeps | Reference-estimator tests, reproducibility metadata | Planned |
| **M4: Continuous lattice fields** | 1D/2D Gaussian and φ⁴, Euclidean lattice QM, HMC | Fourier covariance, oscillator correlators, HMC invariants | Planned |
| **M5: More models / gauge** | Potts, XY, FK, Z₂ / U(1) tiny gauge laboratory | FK / duality checks, gauge-invariance tests | Planned |
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

**Acceptance gate**

- Gaussian mean/variance match analytic formulas under several parameters, with correct normalization and no false exactness labels.
- App loads under the GitHub Pages subpath, not just localhost; worker code and assets load successfully.
- Phone-width controls are operable, dismissible, and do not delete numerical state.
- Basic Build/Typecheck/Unit/Browser pipeline passes.

**Explicitly out of scope:** generic formula editor, periodic lattices, coupled quartic integrals, gauge variables, parameter sweeps, advanced charts.

## M1 — Small Systems: four plot slots and true tiny lattices

**Objective:** make the first distinctive teaching instrument: a four-plot micro-laboratory backed by exact calculations and inspectable MCMC.

### M1a — Tiny geometry and discrete Ising

- Domain types: stable vertex, edge, face IDs; oriented edges; parallel edges and self-links preserved. Geometry construction independently tested from physics.
- Presets: one site, four-site open path, cycle/periodic 1×4 ring, open 2×2 square (with optional one oriented face), star, K4, and genuine periodic 2×2 torus (4 sites / 8 nearest-neighbor bonds / 4 oriented faces).
- Display: graph diagram with selected node and edge weights; clearly show parallel bonds; edit generic graph connectivity and per-edge couplings.
- Generic finite-graph Ising, including nonuniform couplings and external fields.
- Exact enumeration for up to four spins (16 states): partition function, energy, moments and selected correlations; enumerate even if a sampler is never run.
- Local Metropolis and discrete heat bath. Inspection trace includes selected spin, local neighborhood contribution, `ΔS`, proposal/conditional probability, RNG sample, and resulting state.
- Four assignable inspection slots, independent of physical variable count, for discrete spins (state probability bars/histograms, local conditional distributions); configurable display of exact vs sampled values. The graph visualization remains separate from the slots.

**Acceptance gate M1a**

- Every topology has the specified site/edge/face counts and incidence laws.
- For all four-spin configurations and representative random couplings, incremental flip differences match recomputed energy.
- A periodic 2×2 torus has *eight* bond records, not four; exact Ising `Z` agrees with full enumeration of that model.
- Periodic 1×4 Ising `Z` agrees with transfer matrix `Tr(T⁴)` under stated convention.
- Seeded step trace reproduces the run-mode transition sequence for identical updates.
- Four panels can be displayed together on desktop and as optional 2×2 overview on phone.

### M1b — Continuous 0D potentials

- Single-site quartic `V(x)=a x²/2 + λ x⁴/4 − h x`, with parameter validation and informative rejection of non-normalizable cases.
- Numerical high-accuracy quadrature for moments/density of one real variable, explicitly **labeled reference quadrature**, not analytic exactness. Display integration domain and tolerance/reference limitations if used.
- Independent and coupled 2–4 real-variable modes with per-node potential plots, conditional energy and Monte Carlo marginal; sampled plots must not be mislabeled as exact coupled marginals.
- Compare current local energy, conditional distribution at fixed neighbors, sampled marginal, and sampled histories.
- Minimal save/restore of **parameter configurations**, ideally a shareable link with schema version.

**Acceptance gate M1b**

- Gaussian limit agrees with M0 analytics; quadrature agrees with known test integrals and reports failure when error control is inadequate.
- When coupling is zero, sampled marginals agree with independent references. For nonzero coupling, bare potential, conditional potential, and marginal remain distinguished in labeling.
- Opening/closing four-panel controls does not alter sampler state.

## M2 — 2D Ising: the main lattice laboratory

**Objective:** deliver a robust demonstration of ordered/disordered regimes with controls and measurable observables.

**Deliverables**

- Rectangular square lattices with periodic and open boundaries; support 2×2 from the same lattice generator used in M1. Support anisotropic `Jx`, `Jy`, field `h`, and inverse temperature `β`.
- Optimized local Metropolis and heat bath using checked local `ΔS`; optional seeded spin initialization choices.
- UI: large 2D spin view, optional magnification/selection, Run/Pause/Step/Reset, visible progress/counters, temperature control; view frame rate independent of update rate.
- First plots: magnetization and energy histories, histograms, principal running means and acceptance rate; add elementary spatial correlations when reliable.
- Model information with exact finite-volume status, 1D and 2D reference points, and small experiments such as phase ordering and field response.
- Thermometer-style rapid parameter editing may initialize a new run from the previous configuration, but always resets incompatible measurements and discloses the warm start.

**Acceptance gate**

- Small 2×2 energy and observables match M1 enumeration.
- High- and low-temperature finite-lattice behavior is qualitatively correct without misrepresenting finite-volume phenomena as the infinite-volume theorem.
- The simulation remains responsive during long runs; it can pause precisely before step inspection.
- Graph/plot legends, measurement status, and touch controls function on a phone.

**Out of scope:** demanding infinite-volume critical exponent fits, guaranteed asymptotic error estimates, production performance tuning.

## M3 — Measurement and experiments layer

**Objective:** make the lab useful for reproducible, moderately quantitative student projects.

**Deliverables**

- Shared observable/plot registry. Select and rearrange plots; overlay exact and numerical curves with clear legends.
- Independent data segments and saved runs in memory, each with configuration, seed, algorithm, measurement schedule, version, and notes.
- More robust statistics: signed and absolute magnetization, susceptibility, Binder cumulant, connected correlations, structure factors, autocorrelation estimates, approximate ESS, blocking/batch errors with warnings for short or correlated data.
- Small bounded parameter sweeps (temperature/coupling/size) executed sequentially or with simple worker scheduling; clear per-run equilibration and budget policy.
- Export CSV + JSON metadata and one-file JSON bundle; configuration-only URL sharing and optional import.
- Experiment presets with question, expected qualitative outcome, sampling caveats, and reference to associated model equations.

**Acceptance gate**

- Saved run parameters cannot be silently mutated; changing the measure creates a distinct dataset/segment.
- Units, definitions, and sample/uncertainty status always accompany plots.
- Autocorrelation and estimator tests agree with independently generated reference sequences or exact small-state checks within understood finite-sample tolerance.
- Run export/import round-trip preserves key provenance; exported CSV carries a discoverable metadata record.

## M4 — Continuous fields and Euclidean quantum mechanics

**Objective:** take the lab beyond discrete spin systems while retaining validated numerics and a coherent UX.

**Subdeliverables**

1. **Gaussian fields, 1D/2D.** Discrete Laplacian, mass, periodic/open boundaries, covariance from Fourier or matrix inverse on tiny cases, exact Gaussian sampler, small Fourier-domain charts; explicit zero-mode policy for massless cases.
2. **Euclidean QM paths.** Harmonic oscillator and double well with periodic Euclidean time; path displays, two-point Euclidean correlator, effective gap and finite-spacing examples; exact oscillator benchmark first.
3. **Lattice φ⁴.** Local Metropolis, continuous scalar heatmaps, parameter exploration, and comparison to Gaussian limit.
4. **HMC.** Leapfrog with documented step size/trajectory length, acceptance and energy-drift diagnostics; do not expose until reversibility and invariant-distribution checks pass.

**Acceptance gate**

- Exact free-field covariance and oscillator correlator benchmarks agree with sampled and discrete theoretical calculations.
- Numerical HMC acceptance logic includes the correct Metropolis correction; reproducibility and area-preserving/time-reversal checks performed within numerical tolerance.
- Real-valued fields handle scaling and color maps safely without misleading auto-rescaling.

## M5 — More models and tiny gauge systems

**Objective:** demonstrate reuse of the domain/field/sampler/plot architecture.

**Deliverables**

- Potts and XY models on 2D square lattices; model-appropriate updates and observables. Add vortices only with a clear lattice winding convention.
- Optional random-cluster/FK view and valid cluster updates where the physical coupling assumptions permit them.
- `Z₂` gauge field on oriented edges with plaquette product; one open plaquette and 2×2 torus; visible gauge transformations.
- Compact `U(1)` link variables; plaquette holonomy, Wilson loops, tiny systems with more link DOFs than four selected inspection slots.
- Gauge-specific small-system interface: select four links to inspect while keeping the entire link configuration in the worker; do not mistake site rotors for gauge connections.

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

The first Codex task should implement **M0 only**. Give the agent the whole documentation package for context, but do not instruct it to implement the entire roadmap in one pass. A good M0 PR creates a working deployed mini-lab; it does not produce an elaborate untested framework.

## Definition of done for the initial public usable release

After M1, a student should be able to open the static website on a phone or laptop, inspect four connected variables, choose a periodic 1×4 or genuine periodic 2×2 graph, run and single-step a validated sampler, compare a result with finite exact enumeration, change presets without losing track of the current measurement regime, and understand what the displayed curves mean. All without installing software or creating an account.
