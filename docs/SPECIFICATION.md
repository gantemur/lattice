# Lattice Lab — Living Product and Technical Specification

**Version:** 0.3 (M0 refinement, 2026-10-10)

**Status:** M0 implemented; later-stage requirements remain planned. Live deployment acceptance is tracked in the roadmap.

**Audience:** researcher/instructor, students, contributors, coding agents  
**Related:** [Roadmap](ROADMAP.md), [Decisions](DECISIONS.md), [`AGENTS.md`](../AGENTS.md)

> **How to use this document.** This specifies intended behavior and key mathematical invariants. A feature is not implemented just because it appears here. The roadmap identifies what belongs in the next milestone. Change the specification in the same pull request as an intentional behavior change, and record consequential architectural decisions in the decision log. Do not freeze incidental visual details or library choices prematurely.

### Implemented scope at M0

The current application implements only the single-site 0D Gaussian and the responsive Small Systems shell. Exactly four slots are always available, each assigned a variable/observable and a plot type. Slots 1–2 default to `x` density/histogram and running mean; slots 3–4 are compact unassigned selectors. The same physical variable may appear in multiple views. Assigned plots can close, reopen, and move without numerical effects. A separate single-site diagram represents topology. Phone detail mode and an optional 2×2 overview are available. Multi-variable models, graph editing, periodic domains, Ising, quartic models, and other workspaces remain later milestones.

The model uses dimensionless `S(x)=a x²/2−h x`, `p∝exp(−S)`, `μ=h/a`, `σ²=1/a`, and `log Z=½log(2π/a)+h²/(2a)`. Supported teaching ranges are `0.05≤a≤20` and `−10≤h≤10`; validation rejects non-finite or out-of-range parameters. Analytic density is evaluated in centered form. A seeded independent Box–Muller sampler needs no discarded warm-up: one update is one retained sample (stride 1). Histogram tails outside each segment’s `μ±4σ` remain in its moments and denominator. Authored model formulas and explanations use local KaTeX HTML + MathML, with reusable inline/display components and no formula editor.

Run/Pause/Step/Reset and a standard Gaussian preset are implemented. Apply and preset selection preserve old data, current value, and RNG stream, starting a separately labeled measurement segment only when parameters change. Each segment owns its parameters, start-update index, count, moments, histogram, and convergence trajectory. Up to eight recent segments remain in memory; removal of older segments is disclosed. No individual samples are retained. Reset clears all history, refits axes, and reseeds with the currently applied parameters and the Seed on Reset field. Fit All refits retained data without numerical effects. Axes otherwise expand only, including across parameter changes and segment eviction. Saved runs and exports remain deferred.

Running means use log sample-count coordinates, exact segment means, and theoretical pointwise one-standard-error bands; an optional log–log absolute-error view shows the `σ N^(-1/2)` RMS reference. These diagnostics apply specifically to independent Gaussian draws (section 6.3). Settings and display changes preserve numerical state. A worker owns samples and bounded accumulators; the client schedules at most one batch in flight. M0 uses hash navigation and `/lattice/` asset/worker paths; CI builds and tests feature PRs, while Pages deployment is restricted to `main`.

## 1. Mission and positioning

Lattice Lab is an open, browser-based collection of miniature numerical laboratories for statistical mechanics, Euclidean lattice quantum mechanics, and lattice field theory. It should be usable during lectures, for undergraduate and graduate computational exercises, and for modest individual explorations. It does **not** try to compete with industrial scientific simulators, HPC lattice gauge codes, or general symbolic math packages.

The guiding progression is not necessarily 0D → 1D → 2D. Tiny exactly solvable systems support close inspection of measures and algorithms, whereas larger lattices reveal collective statistical behavior. Both deserve permanent workspaces.

### 1.1 Primary user activities

1. **Explore:** pick a model and geometry, change physical parameters, see some representative configurations, and view a few default graphs.
2. **Measure:** collect samples, understand equilibration, compute observables, display correlations/histograms and uncertainty diagnostics.
3. **Inspect:** single-step a sampler, see its proposal, probability calculations, random decision, and state change.
4. **Compare:** overlay analytical reference curves and saved numerical runs; compare size, coupling, temperature, boundary condition, or algorithm.
5. **Investigate:** execute finite parameter sweeps and export datasets with sufficient metadata to reproduce them.

### 1.2 Design goals

- Mathematically explicit: display the model's state space and Hamiltonian/Euclidean action, including normalization and temperature convention.
- Credible numerics: exact benchmarks where available; separate sampling errors, finite-volume effects, discretization errors, and transients.
- Discoverable interaction: responsive from the first milestone, with collapsible controls and informative presets.
- Shared infrastructure: add models without duplicating simulators, plots, data handling, and control widgets.
- Reproducibility: seeded stochastic computations, stable model configuration schemas, provenance in exports.
- Low maintenance: statically hosted on GitHub Pages; computation in the browser with no user accounts.

### 1.3 Non-goals, at least initially

- Large-scale production Monte Carlo, distributed computing, or high-dimensional lattice QCD.
- Real-time quantum simulation, a general quantum-computing framework, or tensor network software.
- A general-purpose scientific programming language or universal model editor.
- A proof assistant. The interface can cite theorems and demonstrate finite examples, but simulations are not proofs.
- Exact integration of every coupled continuous model. Distinguish analytic exactness, numerical quadrature, and Monte Carlo.
- Cloud storage, collaborative sessions, authentication, or remote telemetry.

## 2. Workspaces and navigation

All workspaces use the same model specification, simulation state, measurement infrastructure, and run metadata. **A workspace is a way to inspect or operate on a model, not a separate physics implementation.**

### 2.1 Small Systems

Purpose: detailed inspection through **four principal variable-plot slots**, independent of the number of underlying degrees of freedom. When a model has more than four variables, users select up to four to inspect, or inspect multiple views of the same variable. For example, a periodic 2×2 square U(1) gauge lattice has four sites but **eight oriented link variables**, while the interface still offers four slots. Topology, physical variables, and display slots are separate concepts.

Core UI:

- Geometry view: a graph/cell diagram **separate from the four plots**, with visible edge multiplicities and orientations when relevant; tap/click to select a node/edge.
- Four-panel inspector: always offer exactly four slots in a configurable 2×2 overview. An assignment includes the physical variable or observable and plot type; variables may live on sites, links, or faces. Multiple slots may inspect one variable with different views. Defaults are model-specific; M0 activates density/histogram and running mean for `x`. Unassigned slots collapse to one-line selectors, and expanded plots use available space. Slots never create physical degrees of freedom. For larger models, selecting display targets retains the full physical state. Opening, closing, assigning, or rearranging slots must not affect numerical sampling.
- Configurable panels: current value; bare on-site potential; conditional energy holding neighbors fixed; exact/reference marginal; empirical marginal/histogram; discrete probability bars. Do not put energy and probability density on a falsely common axis—use separate axes with units, tabs, or explicit labeled overlays.
- One-step simulator: proposal details, local energy difference, acceptance probability, actual random uniform deviate when relevant, acceptance/rejection, and resulting configuration.
- A small observable gallery: joint scatter/density for two variables, correlation matrix, total energy, transition trace, or enumeration table.

For continuous coupled systems, the *on-site* potential is not the full conditional energy and is not the negative log of the marginal. These distinctions must be visible.

### 2.2 Lattice Systems

Purpose: interactive finite 1D/2D regular lattices with enough degrees of freedom to display spatial structure.

Core UI:

- Main configuration view: 1D row/line plot, 2D discrete spin or scalar heatmap, rotor arrows/vortices, or link/plaquette geometry for gauge models.
- Selectable overlay (model-dependent): spins, domains, coarse-grained fields, bonds, cluster assignments, chosen observables.
- Key readings near the display: progress in algorithmic updates and recorded measurements; energy; principal order parameter; acceptance rate as applicable.
- Below: a user-configurable plot gallery, including time series, histograms, spatial correlations, momentum-space structure factor, and autocorrelation.
- Optional comparison of datasets and known theory as capabilities mature.

### 2.3 Experiments

Purpose: analysis of saved runs, reproducible parameter sweeps, side-by-side comparisons, finite-size diagnostics, and export/import. Begin with saved in-memory runs and simple plot overlays; expand incrementally. The Experiment workspace must never claim that two runs are comparable without showing their differing model and sampling metadata.

### 2.4 Navigation contract

- Model selection is accessible without losing the identity of the current run; changing model creates or loads another run rather than blending measurements.
- The selected workspace, model, main parameter values, and current plot choices should be visible with minimal taps.
- A preset is a versioned model + geometry + algorithm + display configuration, not a static screenshot.
- Provide direct links to a mathematical summary and a small exercise list for each model.

## 3. Geometry: graphs, lattices, and cell complexes

### 3.1 General principles

A model domain cannot be represented by only a set of unordered vertex pairs. Parallel edges and self-links occur naturally on very small periodic lattices; gauge models may also require oriented faces. Represent topology with stable IDs and incidence relations:

- **Vertex:** ID, optional embedding/drawing coordinates and boundary labels.
- **Oriented edge:** unique ID, tail vertex, head vertex, optional lattice axis/wrap metadata and coupling. Multiple edges may have identical endpoints. Self-links are permitted.
- **Oriented face (when applicable):** ID and an ordered signed boundary sequence of edge IDs; orientation is required for plaquette holonomy.
- **Lattice descriptor:** dimension, lengths, periodic/open/fixed boundary information, coordinates, and mapping into this domain. Keep lattice metadata even when two domains share an abstract graph.

Site variables, edge variables, and face variables are distinct kinds of degrees of freedom. The physical model defines their type (Ising spin, real scalar, angle, group element, etc.).

### 3.2 Initial topologies

| Preset | Sites | Edges | Faces | Notes |
|---|---:|---:|---:|---|
| Single site | 1 | 0 | 0 | 0D integral or a single discrete spin |
| Path P4 | 4 | 3 | 0 | Open 1D chain |
| Cycle C4 / periodic 1×4 chain | 4 | 4 | 0 | Four bonds; one-dimensional periodic ring |
| Open 2×2 square | 4 | 4 | 1, when cell structure requested | Ordinary square graph with one oriented plaquette |
| Four-node star | 4 | 3 | 0 | Heterogeneous neighborhood structure |
| Complete K4 | 4 | 6 | None by default | Dense graph; faces not inferred from drawings |
| **Periodic 2×2 square torus** | **4** | **8** | **4** | One +x and one +y oriented bond per site; parallel links are essential |

For a periodic Cartesian lattice, generate an oriented bond `(x, direction)` from every site in every direction. If a periodic axis has length 2, this can produce two distinct oriented bonds with opposite endpoints; do not accidentally deduplicate them as an undirected edge. If an axis has length 1, it can produce a self-link; the effect is model-dependent and must be checked, not discarded automatically.

The notation **1×4 periodic** should mean the four-site **one-dimensional ring** by default. A *two-dimensional thin torus* with dimensions `(1,4)` is a distinct optional preset, with self-links in the short direction and the corresponding face structure. Label the distinction explicitly in the UI; do not silently treat `(1,4)` as interchangeable with `N=4` in every model.

### 3.3 Why this matters physically

Use, for instance, the periodic square-lattice Ising convention

`H(σ) = - sum_{x, μ=1..d} J_μ σ_x σ_(x+e_μ) - h sum_x σ_x`.

For the `2×2` torus, there are eight directed-by-axis bond records that each contribute once, even though some connect the same two sites. This is the conventional `sum_{x,μ}` form; replacing the lattice by a four-edge square changes the model. A self-bond in an Ising model adds a constant and contributes no spin-flip energy difference; a self-link in a U(1) gauge model has a different role and must not be eliminated on that ground.

Open, fixed, and periodic boundaries must be distinguishable. A drawn cycle and an oriented 2D plaquette may look similar but have different topological data; the UI should not infer faces merely from visual proximity or graph cycles.

### 3.4 Geometry editor, first implementation

- Start from presets; allow toggling edges in the four-node *generic graph* editor, and adding per-edge couplings/weights.
- Show parallel edges as separately selectable arcs and self-links as small loops.
- For regular lattice presets, preserve a canonical generated geometry; editing bonds converts to a custom graph (with a visible indicator) instead of silently corrupting the lattice descriptor.
- Face editing can be deferred; provided gauge-ready presets must include oriented faces and validated boundary sequences.
- Test chain complexes (where faces exist) by checking that the signed boundary of every face has zero vertex boundary: `∂₁∂₂=0`.

## 4. Physical model framework

### 4.1 Fundamental contract

A model specifies its degrees of freedom and action, parameter descriptions and constraints, permitted geometry, update methods, and observables. For a finite collection of variables, many early examples fit the form

`H(x) = sum_i V_i(x_i) + sum_{e=(i,j)} W_e(x_i, x_j)`, with target weight `exp(-β H(x))`.

This is a **model family**, not a universal assumption. Gauge actions naturally sum over oriented plaquettes and sometimes nonlocal Wilson-loop observables. Euclidean field-theory actions may already absorb the inverse-temperature factor; define the target as `exp(-S)` and display exactly how `S` depends on the chosen physical parameters. Avoid a hidden extra beta multiplier.

### 4.2 First models and benchmarks

| Model | Initial geometry | Parameters / outputs | Reference computation |
|---|---|---|---|
| 0D real scalar, Gaussian / quartic | 1 node; later up to 4 coupled nodes | `a, λ, h`, moments, distribution | Analytic Gaussian; explicitly labeled numerical quadrature for general quartic |
| Finite graph Ising | Graphs with ≤4 sites | bond weights, field, β, energy, magnetization, correlations | Exhaustive enumeration, at most 16 states |
| 1D periodic Ising | N-site ring incl. N=4 | β, J, h, transfer-matrix spectrum, correlations | 2×2 transfer matrix and small-volume enumeration |
| 2D square Ising | periodic/open rectangular lattices incl. 2×2 | β, Jx, Jy, h; M, E, correlations | Enumeration for tiny boxes; known large-lattice references where applicable |

The 0D quartic potential can begin with `V(x)= a*x²/2 + λ*x⁴/4 - h*x`. The UI must prevent nonnormalizable choices, or clearly explain that a proposed parameter combination has no finite partition function. For general coupled quartic measures in four variables, exact integration is **not** assumed; analytic Gaussian references and independently checked quadrature/simulation comparisons are sufficient.

### 4.3 Next models (not initial release)

- Massive Gaussian free field in 1D/2D; Fourier-space covariance and exact Gaussian sampling. A massless periodic case needs zero-mode removal or an explicit constraint.
- Euclidean lattice quantum mechanics (harmonic and double-well paths); correlators, transfer matrix, effective energy/gap.
- Continuous-spin lattice `φ⁴` in 1D/2D; local Metropolis and HMC; mass and correlation-length diagnostics.
- Potts and XY/`O(2)` site-spin models; discrete Potts updates, angular Metropolis/cluster methods when justified, vortices and BKT-related observables.
- Random-cluster/FK representation for comparison with Ising/Potts.
- `Z₂` and compact `U(1)` gauge models on oriented edges and plaquettes. Start with one open plaquette and small periodic tori. Show Wilson loops and gauge invariance explicitly. Do not imply a 2D gauge model has an Ising-like thermal transition without model-specific justification.

### 4.4 Model extensibility

Proposed TypeScript interfaces below express relationships, not final package APIs:

```ts
type Vertex = { id: string; x?: number; y?: number };
type Edge = {
  id: string; tail: string; head: string;
  axis?: number; wraps?: boolean;
};
type SignedEdge = { edgeId: string; sign: 1 | -1 };
type Face = { id: string; boundary: SignedEdge[] };

type Domain = {
  vertices: Vertex[];
  edges: Edge[];
  faces?: Face[];
  lattice?: {
    dimension: 1 | 2;
    lengths: number[];
    boundary: ("periodic" | "open" | "fixed")[];
  };
};

type DofDescriptor = {
  id: string; carrier: "vertex" | "edge" | "face";
  carrierId: string;
  kind: "ising" | "real" | "angle" | "group";
};

interface Model<State, Parameters> {
  id: string;
  validate(domain: Domain, params: Parameters): ValidationResult;
  initialize(domain: Domain, params: Parameters, rng: Rng): State;
  action(state: State, domain: Domain, params: Parameters): number;
  observables: ObservableDefinition<State, Parameters>[];
}
```

Do not force a generic user-defined formula parser into the first version. Reusable standard model templates are safer to validate and easier to teach.

## 5. Sampling engines and execution semantics

### 5.1 Required definitions

- **Elementary update:** one attempt or one heat-bath resampling operation. One Metropolis proposal may be rejected.
- **Sweep:** for a conventional local N-site sampler, nominally N elementary update attempts (with the actual site-selection convention recorded). A cluster flip or HMC trajectory has a different transition cost; do not equate their counters blindly.
- **Thermalization/warm-up:** algorithmic transitions omitted from equilibrium measurements.
- **Retained measurement:** a sample used in estimators, with a known sampling cadence.
- **Rendered frame:** one visualized configuration; may be much less frequent than updates or measurements.
- **Physical time:** separate concept, and not represented by ordinary MCMC steps.

### 5.2 Two operation modes

**Run mode:** batched updates executed in a Web Worker. Throttle configuration rendering to a browser-friendly cadence (not one frame per update); accumulate observables separately. Provide Pause/Resume, Reset, and parameter-controlled speed or budget. The UI must never become unresponsive because the simulation is busy.

**Step/Inspect mode:** execute one well-defined algorithmic transition, wait for the worker's acknowledgment, then present a trace. For Metropolis, display selected degree of freedom, old and proposed states, energy difference, acceptance rule/probability, RNG draw, and accept/reject. For heat bath, display conditional probabilities and the selected draw. HMC inspection can later show the leapfrog trajectory, Hamiltonian drift, and accept/reject event.

The RNG and sampler update sequence must not depend on how often the UI redraws. Going from Run to Step should pause at a precise state boundary without inventing missing updates.

### 5.3 Algorithms by delivery stage

- M0 (implemented): independent Gaussian draws using Box–Muller v1 and Mulberry32 midpoint v1, with an unsigned 32-bit seed, exactly two uniforms per draw, no cached second variate, zero warm-up, and stride 1.
- M1: local Metropolis with symmetric proposals for Ising/real scalars, heat-bath for finite discrete spins, and exact enumeration for tiny discrete systems.
- Later: Wolff or Swendsen–Wang/FK cluster updates for compatible models; HMC with reversible symplectic integrator and Metropolis correction for smooth continuous fields.
- Advanced samplers should be exposed only on models for which their validity has been implemented and tested; no universal algorithm picker with invalid choices.

### 5.4 Worker messaging and event traces

A minimal worker API can include `initialize`, `runBatch`, `step`, `pause`, `reset`, and `measure`, with acknowledgments carrying a run ID and monotonically increasing state version. Messages should reject stale run IDs. Use compact typed state arrays and transfer/copy strategies that do not accidentally detach the only authoritative state.

M0 implements `initialize`, `advance(count)`, `changeParameters`, and read-only `snapshot`. Initialize creates a fresh run with an increasing run ID. Version counts completed updates plus accepted parameter changes. Step advances once, Run schedules batches of 128 (protocol limit 1024), and Pause stops further scheduling and waits for any in-flight acknowledgment. Apply is ordered after the pending batch and before another is scheduled; Run then continues. Repeated queued parameter edits use the latest requested values. Unchanged parameters are a no-op. The worker has no autonomous timer. Reset uses Initialize; stale commands and stale/regressing replies are rejected or ignored. Rendering and snapshot reads consume no RNG draws. Worker failures stop scheduling and label displayed state as last confirmed; Reset can recreate the worker.

One possible trace payload is:

```ts
type UpdateTrace = {
  runId: string;
  updateIndex: number;
  targetDof: string;
  oldValue: unknown;
  proposedValue?: unknown;
  oldAction: number;
  deltaAction: number;
  acceptanceProbability?: number;
  uniformDraw?: number;
  accepted: boolean;
  newAction: number;
  algorithm: string;
};
```

The worker owns the authoritative evolving configuration. React/UI component state controls rendering and input, not the Monte Carlo transition sequence. Parameter edits start a separate measurement segment with fresh estimators while preserving prior segments for comparison. Carry the configuration and RNG stream where appropriate; never pool different target measures. The independent Gaussian requires no warm-up; future MCMC models must apply and disclose the necessary warm-up policy for the new segment.

## 6. Observables, estimators, and plots

### 6.1 Plot library

In M3, introduce a shared registry of plot types, each declaring applicable data and observables: scalar time series; histogram/density; parameter comparison; two-point correlations; structure factor; autocorrelation; joint scatter/density; matrix heatmap; effective gap; Wilson-loop observables; finite-size comparison.

Plots require titles, axes and units/conventions, legends for overlays, run identification, and labeling of exact/reference vs sampled data. Hide incompatible plots rather than present empty nonsense.

### 6.2 Initial Ising observables

For `N` spins, use `m = N⁻¹ sum_i σ_i` and `e = H/N` unless explicitly stated otherwise. Display instantaneous `m` and `e` distinctly from their sampled means. In a symmetric finite system at `h=0`, report both `<m>` and `<|m|>` so that a nearly zero signed mean is not misread as absence of finite-size ordering.

Measurement priorities:

1. `m`, `|m|`, `e` time series; sample means and variances.
2. Histograms of magnetization and energy; acceptance rate.
3. Two-point functions and connected spatial correlation `C(r)` with stated distance/averaging convention.
4. Susceptibility and Binder cumulant after proper accumulation, with clearly stated convention and sample-quality warnings.
5. Integrated autocorrelation and effective sample size when enough data exist.
6. Structure factors, correlation length, finite-size scaling, and parameter sweeps later.

At `k_B=1`, one common fluctuation susceptibility convention is `χ=β N (<m²>-<m>²)`. The Binder cumulant is `U₄=1-<m⁴>/(3<m²>²)` where the denominator is nonzero. Provide the actual formula used in the UI. Do not assume these formulas automatically transfer unchanged to every model.

### 6.3 Monte Carlo error diagnostics

M0 implements a narrowly scoped independent-Gaussian diagnostic: plot retained running means against logarithmic segment sample count `N`, each segment’s exact `μ`, and `μ±σ/√N` with known analytic `σ²`. At any fixed `N`, this envelope has about 68% coverage for independent Gaussian draws. It is **not** a simultaneous confidence band and does not promise containment of the whole trajectory. Optional log–log `|mean−μ|` displays the `σ N^(-1/2)` RMS reference (slope −½). A single stochastic error can rise, fall, or cross zero; zero errors are omitted from the log view and disclosed. Lines interpolate retained checkpoints, not every fluctuation.

The worker records checkpoints at `n₀=1`, `nₖ₊₁=ceil(1.125 nₖ)` and keeps the latest endpoint, independent of snapshot/render cadence. At most 320 scheduled checkpoints plus one endpoint cover the supported safe-integer sample-count range. Moments, histogram, and checkpoint mean are updated from the same draw in the same segment. Tests compare seeded sequences across batching/parameter changes and check theoretical RMS scaling and fixed-N coverage over an ensemble. These known-variance diagnostics do not implement autocorrelation or generic MCMC uncertainty estimates.

Later measurement capabilities:

- Maintain separate warm-up and measurement counters, with configurable measurement stride.
- Use numerically stable online moments; keep bounded history buffers for long runs, and export aggregated/decimated histories with disclosed sampling rules.
- For autocorrelation, specify the lag/window convention, e.g. `τ_int=1/2+sum_{t=1..W}ρ(t)` and approximate `N_eff=N_samples/(2τ_int)` when supported.
- Avoid reporting highly precise errors with insufficient independent data or a clearly drifting series. Give warnings near critical slowing down and for poor mixing/short histories.
- Statistical uncertainty, volume effects, and action-discretization effects require separate explanations.
- Do not pool measurements from different target parameters or distinct algorithms without recording their provenance and justifying the estimator.

### 6.4 Run storage and exports

Each run has a configuration snapshot and immutable provenance, plus mutable sampling state. Suggested serialized fields:

```ts
type RunMetadata = {
  schemaVersion: number;
  appVersion: string;
  modelId: string;
  domain: Domain;
  parameters: Record<string, unknown>;
  sampler: { id: string; settings: Record<string, unknown> };
  seed: string;
  warmupUpdates: number;
  strideUpdates: number;
  measurementCount: number;
  startedAt: string;
  notes?: string;
};
```

Export selected numeric series to CSV with a sidecar metadata JSON (or a single JSON bundle). Configuration-only share links may be introduced before full datasets; use an explicitly versioned schema and do not put huge measurement histories in URLs. No data are automatically sent to a server.

## 7. UI/UX and accessibility

### 7.1 Default desktop layout

1. Thin header with app/workspace/model selection.
2. A large central model visualization; a *collapsible* sidebar of controls on wider screens.
3. Fixed small row of Run/Pause, Step, Reset, key readings, and a button for presets.
4. A configurable gallery of charts below the visualization.
5. Optional expandable description/equations/experiments area (not giant permanent documentation).

### 7.2 Phone layout from day one

- Single-column first; controls hidden in a collapsible drawer or accordions. Changing control visibility does not reset state.
- Main configuration view should occupy meaningful screen width and remain responsive to orientation changes.
- Small Systems defaults to a detail panel on very narrow phones, with a visible option for a compact **2×2 four-panel overview**. Four plots are still possible simultaneously; their text and interactions must not become unreadable.
- Large-lattice charts can stack vertically; preserve selection and zoom when rotating the device.
- Minimum comfortable touch targets; accessible keyboard navigation and text labels for icons.
- Do not encode discrete spin sign only by color; use legend, pattern, or inspectable tooltips and support adequate contrast.
- Control groups: Model Parameters, Geometry/Boundaries, Sampler, Measurements, Display, Advanced. Provide a compact mode and sensible defaults.

### 7.3 Parameter editing rules

- Label parameter meanings and valid ranges with the displayed action convention.
- Provide one-click presets for instructive regimes (e.g. high/low-temperature Ising, zero-field symmetry, double-well 0D potential, weak/strong coupling of a tiny graph).
- Apply preserves plotted history and starts a clearly labeled segment when the target measure changes. Each segment has separate parameters, sample count, statistics, histogram, and convergence reference. Never pool distributions into one equilibrium estimate.
- Preserve current numerical configuration and RNG stream where appropriate. Independent Gaussian sampling needs no warm-up; future MCMC segments must include the necessary warm-up policy.
- Keep axes stable: expand when needed, never automatically shrink/recenter on Apply. Compare old/new sampled and theoretical curves with segment labels/colors. Bounded retention must disclose removal of old data.
- Reset explicitly clears measurements and history, restarts the current applied model with the documented seed policy, and recenters/rescales plots. M0 uses the Seed on Reset field; Apply does not reseed.
- Fit All changes only the viewport to fit retained segments. Plot assignments, visibility, order, and all other display options must not affect measurements or RNG state.
- If sampling is paused for inspection, allowing an update should never silently skip intermediate transitions.

### 7.4 Visual honesty

Labels should distinguish `current configuration`, `selected sample`, `Monte Carlo mean`, `analytic exact`, `numerical quadrature reference`, and `illustrative/heuristic` output. Never present a random configuration as necessarily representative of equilibrium without warm-up/mixing context. Animation of MCMC is algorithm evolution, not real-time dynamics.

## 8. Reference studies and classroom exercises

Built-in experiment recipes should be short and repeatable, each with a question, setup, expected qualitative behavior, measurable quantities, and cautions.

Recommended first examples:

- Enumerate all 16 Ising configurations on a four-site path, ring, and 2×2 periodic torus; compare partition functions and explain why periodic bond multiplicity matters.
- Watch one Metropolis transition; check `ΔS` and acceptance; compare with the equilibrium distribution obtained by enumeration.
- For a single Gaussian 0D variable, compare the density, quadrature or analytic moments, sampled histogram, and numerical error.
- Couple two of four scalar variables and compare bare on-site potentials, conditional distributions, and measured marginals.
- Compare 1D Ising transfer-matrix correlation lengths with Monte Carlo estimates as the chain grows; distinguish large-but-finite correlation length from a finite-temperature transition.
- For 2D Ising, compare high- and low-temperature configurations and locate finite-volume susceptibility peaks; contrast with the known infinite-volume critical point.
- Compare heat-bath and Metropolis autocorrelation near criticality (cautious about insufficient mixing).
- Later: sample a massive Gaussian field; compare Fourier covariance exactly, then study a `φ⁴` correction; extract effective energies from Euclidean QM correlators.

Each model may link to relevant graduate lecture notes, but these are optional resources and must not block using the laboratory offline.

## 9. Suggested implementation architecture

### 9.1 Deployment and dependencies

Recommended initial stack (changeable after prototype): TypeScript + Vite; React or equivalent component UI; Canvas 2D for high-frequency lattice rendering; SVG for tiny graph editor; maintained charting library for plots; Web Worker for simulation. Unit tests with Vitest; smoke/responsiveness tests with Playwright or equivalent.

M0 adopts TypeScript/Vite/React, native accessible controls, small SVG density/convergence plots, local KaTeX HTML + MathML, Vitest, Playwright (Chromium and WebKit), and Prettier. No charting/component framework is needed for the one-dimensional density, and no graph/lattice framework is implemented ahead of M1. KaTeX renders authored formulas only, with trust disabled and bundled fonts; no CDN or formula editor. See D-013/D-014 and D-016–D-018 for the accepted implementation choices.

The repository is [gantemur/lattice](https://github.com/gantemur/lattice); the project name remains Lattice Lab. The site is built into static assets and deployed with GitHub Actions → GitHub Pages. For `https://gantemur.github.io/lattice/`, Vite's `base` must be `/lattice/`. Build/test should run on pull requests; deploy only from the chosen protected/default branch. Never hard-code root-relative URLs that break the project subpath.

Useful authoritative deployment references: [Vite static deployment guide](https://vite.dev/guide/static-deploy.html), [GitHub Pages publishing sources](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

### 9.2 Proposed source decomposition

```text
src/
  app/             routing, workspaces, shell, responsive layout
  domain/          graph, lattice, oriented faces, DOF types
  models/          Ising, 0D scalar, Gaussian, phi4, ...
  algorithms/      RNG, Metropolis, heat bath, HMC, ...
  engine/          run controller, worker protocol, measurements
  observables/     model-observable registry and estimators
  plotting/        reusable charts, graph/lattice renderers
  experiments/     presets, comparisons, import/export
  ui/              controls, drawers, accessible inputs, status
  workers/         browser worker entry points
  tests/           numerical and UI fixtures
public/            icons and static references
.github/workflows/  CI and Pages deployment
docs/              living specification and roadmap
```

Do **not** create all directories as empty boilerplate; create modules when used. Keep numerical kernels runnable under unit tests without a browser. Use typed arrays and efficient local action differences where justified, but benchmark before adding WebAssembly/GPU complexity.

### 9.3 Separation of concerns

`Domain + Model` → `Action / local Δaction / observables` → `Sampler` → `Run controller and recorder` → `plots / UI`.

The simulation engine owns physical state and sampled measurements; UI state owns tab selections, plot viewports, and drawer visibility. Avoid coupling stepping behavior to React render cycles. Use a deterministic seeded RNG with a documented algorithm/version; never use `Math.random()` inside scientific kernels.

### 9.4 Performance envelope

Start with modest lattice sizes (illustratively 16²–128² for 2D Ising, depending on phone performance). Batch updates without freezing the main thread, render at most at a useful UI refresh rate, and measure actual performance on at least one desktop and one ordinary phone. Do not promise a particular FPS/sweep throughput before measurements. When load becomes high, preferentially reduce rendering frequency, not the integrity of updates or measurement bookkeeping.

### 9.5 Resilience

- Reject invalid geometry and non-finite action/parameter values with actionable errors.
- Pause and recover from worker exceptions without showing stale data as current.
- Preserve results of previous runs in memory unless explicitly replaced, subject to reasonable memory limits. M0 retains the latest eight parameter segments using online moments, fixed histogram bins and logarithmic checkpoints, with visible eviction notices. Apply preserves history; Reset explicitly clears it. This bounded comparison is not the M3 saved-run/experiment manager.
- Avoid hidden dependencies on network availability after static assets load (an installable/offline service worker can come later).

## 10. Validation and quality gates

Correctness is a release requirement, not optional polish.

### 10.1 Domain and topology tests

- Edge count, degree/incidence, and wrap direction of all presets, especially the 1×4 ring and periodic 2×2 torus.
- Parallel bonds retain distinct IDs; self-links behave according to model-specific action.
- Oriented face boundaries produce valid closed chains; reversing an edge orientation reverses its contribution in holonomy.
- Generated lattice coordinates agree with neighbor lookup for open and periodic boundaries.

### 10.2 Physics/math tests

- For every tiny Ising graph, compare cached incremental `ΔH` against recomputation of the full energy after every possible single-spin flip, at random coupling/field values.
- Enumerate all 16 configurations for 4-site models to validate partition function, magnetization moments, energy, correlations, and exact heat-bath conditional probabilities.
- 1D periodic transfer-matrix partition function matches enumeration for `N=4` (allow standard transfer-matrix normalization conventions, explicitly documented).
- Zero-field spin-flip symmetry and permutation symmetries where applicable.
- 0D Gaussian moments/covariance equal analytic formulas; quartic quadrature reports truncation/integration tolerance when used as numerical reference.
- Later, compare free-field sampled covariance with Fourier-space inverse; handle zero mode honestly.
- Later gauge models: action and Wilson loops invariant under generated local gauge transformations, including tiny periodic/self-link cases.

### 10.3 Sampling tests

- Seed replay gives identical update decisions and states (for the same algorithm/build/settings); UI redraw frequency does not consume RNG values.
- Detailed balance tested against enumerated equilibrium weights on tiny state spaces; ergodicity conditions and exceptional parameter values documented.
- Long seeded small-state runs converge approximately to enumeration within **statistically defensible** tolerances; avoid flaky hardcoded single-run thresholds.
- Warm-up exclusion and measurement stride accurate; parameter changes do not pool incompatible data.
- Worker Run/Step/Pause/Reset commands are ordered and stale acknowledgments ignored.

### 10.4 UI and deployment tests

- Basic model usable at narrow smartphone width, desktop width, portrait/landscape; drawer controls operate without overlapping charts or clearing state.
- Keyboard-accessible core controls, visible legends and basic contrast.
- Plot axes and sample-status labels present; graph editing has touch targets.
- GitHub Pages deep link, JS chunks, worker URLs, static assets, and base-path deployment work under `/lattice/`.
- Smoke test on a real browser before a feature is marked delivered.

## 11. Stages and acceptance

See `ROADMAP.md` for implementation milestones. The following describes the initial public usable edition **after M1**, not the M0 acceptance gate. That edition need not include every model or plot in this document. It **must**:

- Deploy as a static site on its own repository.
- Show a working small-system model with four configurable inspection slots and touch-friendly collapsible controls.
- Support accurate graph/lattice presets including periodic 1×4 and periodic 2×2, not falsely conflated with an open square.
- Implement at least one validated exact finite-volume benchmark and one step-inspectable MCMC algorithm.
- Distinguish warm-up from measurement and show which values are sampled versus exact.
- Pass numerical tests and a phone browser smoke test.

Later milestones cover larger 2D Ising, robust statistics, continuous fields, HMC, and gauge models.

## 12. Open questions / design flexibility

These should not block a small vertical slice but should be resolved deliberately:

1. Four-panel default presentation on phones: choose single-detail default plus 2×2 overview; test whether the overview can carry more than one curve legibly.
2. Relative priority of exact tiny-graph enumeration versus interactive continuous 0D quadrature; both are in the early roadmap.
3. How much user graph editing to expose before cell-complex face editing is ready.
4. M0 overlays retained parameter segments by default; determine how explicit saved-run selection should work in M3.
5. Which maintained charting library gives adequate performance/accessibility with the smallest complexity burden.
6. Whether student exercise presets should be in JSON with a simple schema, or in typed TS modules for safer model references.
7. Which numerical tolerance and quadrature algorithm to use for quartic integrals after a validation study.
8. What licensing scheme to use for software and pedagogical text.

**Revision discipline:** Retain the design's scientific invariants as the implementation evolves. If an assumption proves inconvenient, revise the relevant requirement and its tests together. A living specification is most valuable when it records what the software actually promises, not when it becomes a wish list that nobody checks.
