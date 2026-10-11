# Lattice Lab — Living Product and Technical Specification

**Version:** 0.11 (through M3b2, 2026-10-11)

**Status:** M0–M3b2 are merged. This pre-M4 readability pass adds no new model behavior; later models remain planned.

**Audience:** researcher/instructor, students, contributors, coding agents  
**Related:** [Roadmap](ROADMAP.md), [Decisions](DECISIONS.md), [`AGENTS.md`](../AGENTS.md)

> **How to use this document.** This specifies intended behavior and key mathematical invariants. A feature is not implemented just because it appears here. The roadmap identifies what belongs in the next milestone. Change the specification in the same pull request as an intentional behavior change, and record consequential architectural decisions in the decision log. Do not freeze incidental visual details or library choices prematurely.

### Implemented scope through M1b

Small Systems retains the M0.5 Gaussian, single-spin and binomial models, and adds finite graph Ising on one to four sites. Seven graph/lattice presets, a lightweight SVG configuration view and numerical parameter editor, signed face topology, exact enumeration, direct configuration sampling and random-site local Metropolis/heat bath share the existing worker, bounded history and SVG plotting infrastructure. No new runtime dependency, backend or general plugin registry is introduced.

Start with two active distribution/trajectory plots (total magnetization for graph Ising). Add, remove, collapse, expand and reorder up to six independently assigned observable/view plots. Zero active plots is valid; Add Plot remains available. Graph geometry/configuration is separate. Desktop uses up to two columns, phone defaults to single detail with a compact single-column overview. Six limits simultaneous display only. Local KaTeX HTML + MathML and `/lattice/` static assets remain unchanged.

Apply starts separate measurements for changed parameters/algorithm/warm-up, retaining compatible configuration, RNG, previous segments and stable axes. Topology/model-family changes explicitly create new sessions. Reset clears/reseeds/refits; Fit All affects only plotting. Eight recent segments keep separate statistics, exact references, logarithmic checkpoints and up to 1000 exact transitions. Graph segments additionally accumulate full configuration counts and per-observable moments/checkpoints; plotting never reconstructs evicted trajectories or consumes RNG. Every post-warm-up state enters statistics, including rejected/stay states. Only direct Gaussian segments have known-variance uncertainty bands.

M2 adds a separate Lattice Systems workspace for rectangular 2D Ising systems up to 64×64. A typed-spin worker, indexed oriented bonds, incremental H/M, sweep-scheduled measurements, bounded segment histories, Canvas configuration and zero-to-six measurement plots leave Small Systems behavior intact. HMC, gauge dynamics and M3 experiment management remain out of scope. Mathematical conventions are detailed in D-021–D-030 and sections 3–6 below.

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

Purpose: detailed inspection through a **dynamic collection of zero to six plots**, independent of physical degrees of freedom. A periodic 2×2 U(1) gauge lattice would still have eight link variables; display limits never reduce physical state.

Core UI:

- Geometry view: a graph/cell diagram **separate from scientific plots**, with edge multiplicities, wrap information and selected site/bond; accessible selectors complement direct interaction.
- Plot collection: two model-appropriate defaults, Add Plot, removal, collapse, expansion and reordering. Every plot chooses a physical variable/observable and view; targets may repeat. No empty placeholders. Normally at most two desktop columns; phones use single detail or an optional compact overview of all active plots. All display changes are independent of numerical state and RNG.
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

Purpose: analysis of saved runs, reproducible parameter sweeps, side-by-side comparisons, finite-size diagnostics, and export/import. M3b1 provides mounted in-memory segment archives and portable records. M3b2 adds bounded independent 2D Ising sweeps, a dedicated worker, numeric parameter-axis comparison, and version-2 sweep manifests alongside the original point datasets. The Experiment workspace must show differing model and sampling metadata when comparing runs.

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

### 3.4 Preset geometry and numerical parameter editor

- Expose the seven presets; do not implement graphical edge creation/deletion or vertex dragging. Keep mathematical topology independent of drawing coordinates.
- A compact numerical list of per-site fields and per-edge couplings is the primary editing mechanism on desktop and phone. K4’s six pairwise weights can realize any simple four-site interaction graph by setting unwanted weights to zero. Positive, negative and zero couplings are supported.
- Graph selection remains interactive: separately selectable parallel arcs, site/bond selection, incident interaction highlighting and actual MCMC update inspection. Form-based selectors are the touch/keyboard alternative.
- **Selected site / Selected bond:** synchronized graph and form selections open compact collapsible local inspectors. Show the current spin, external field, each incident non-self bond's neighbor/spin/contribution, effective field, flip action difference and exact conditional probabilities given current neighbors (not equilibrium marginals). List self-links as constant action with zero flip contribution. Bond inspection shows unique ID, orientation, coupling, endpoint spins/product, action contribution and ordinary/wrapped/self classification. Editing links to the existing numerical form; Apply alone commits validated parameters/new segment/warm-up. Dark selection outlines/halos differ from gold latest-update marks. Inspection consumes no randomness; the existing selected-spin plot action is retained.
- Edge labels carry numeric weights; color/sign, thickness and fading distinguish positive/negative/zero interactions. Zero weights never remove mathematical bond records or faces.
- Preserve canonical lattice metadata and signed plaquettes on preset parameter edits. The 2×2 torus remains eight distinct bonds/four faces and is not substituted with K4. No generic faces are inferred from a drawing.
- Domain APIs and numerical tests retain arbitrary tiny graphs, parallel edges and self-links. Validate oriented face walks and `∂₁∂₂=0`; this UI simplification does not change mathematical requirements.

## 4. Physical model framework

### 4.1 Fundamental contract

A model specifies its degrees of freedom and action, parameter descriptions and constraints, permitted geometry, update methods, and observables. For a finite collection of variables, many early examples fit the form

`H(x) = sum_i V_i(x_i) + sum_{e=(i,j)} W_e(x_i, x_j)`, with target weight `exp(-β H(x))`.

This is a **model family**, not a universal assumption. Gauge actions naturally sum over oriented plaquettes and sometimes nonlocal Wilson-loop observables. Euclidean field-theory actions may already absorb the inverse-temperature factor; define the target as `exp(-S)` and display exactly how `S` depends on the chosen physical parameters. Avoid a hidden extra beta multiplier.

### 4.2 First models and benchmarks

| Model | Initial geometry | Parameters / outputs | Reference computation |
|---|---|---|---|
| Real scalar Gaussian / quartic | 1–4 graph vertices | `aᵢ, λᵢ, hᵢ, κₑ`, moments, conditionals, distribution | Analytic multivariate Gaussian; controlled 1D quadrature for independent quartic sites |
| Finite graph Ising | Graphs with ≤4 sites | bond weights, field, β, energy, magnetization, correlations | Exhaustive enumeration, at most 16 states |
| 1D periodic Ising | N-site ring incl. N=4 | β, J, h, transfer-matrix spectrum, correlations | 2×2 transfer matrix and small-volume enumeration |
| 2D square Ising | periodic/open rectangular lattices incl. 2×2 | β, Jx, Jy, h; M, E, correlations | Enumeration for tiny boxes; known large-lattice references where applicable |

#### M0.5 one-variable references

- **Gaussian:** `S(x)=a x²/2−h x`, `μ=h/a`, `σ²=1/a`, `log Z=½log(2π/a)+h²/(2a)`. Centered normalized density; `0.05≤a≤20`, `|h|≤10`.
- **Single spin:** `s=±1`, `S(s)=−hs`, `Z=2 cosh h`, `P(s)=exp(hs)/Z`, mean `tanh h`, variance `1−tanh²h`; `|h|≤10`. Evaluate probabilities/log Z and variance stably at strong fields.
- **Binomial:** integer `K=0,…,n`, `S(k)=−hk−log C(n,k)`, `h=log(p)−log1p(−p)`, `log Z=−n log1p(−p)`, mean `np`, variance `np(1−p)`. Use log factorials/combinatorics and normalized log PMFs. Supported `1≤n≤100`, `0.001≤p≤0.999`; singular endpoint fields are explicitly excluded. K is an aggregate observable over Bernoulli microstates, and the degeneracy factor is essential. Render masses as bars, not continuous density curves.

All three actions are dimensionless, with no additional beta multiplier. Display analytic moments and log partition separately from estimates. These references do not advance the graph/lattice or quartic milestones.

The 0D quartic potential can begin with `V(x)= a*x²/2 + λ*x⁴/4 - h*x`. The UI must prevent nonnormalizable choices, or clearly explain that a proposed parameter combination has no finite partition function. For general coupled quartic measures in four variables, exact integration is **not** assumed; analytic Gaussian references and independently checked quadrature/simulation comparisons are sufficient.

#### M1a finite graph Ising

For 1–4 sites use `S(s)=−Σ_e K_e s_tail(e)s_head(e)−Σ_i b_i s_i`, `s_i=±1`, with K and b dimensionless (beta absorbed), each in [−10,10]. Every edge is counted once, including parallel bonds. Self-links contribute constant −K, zero local field/flip difference. The numerical domain supports up to 16 distinct bonds and one to four sites; the UI exposes only presets with editable weights/fields. Choosing a different topology begins a new session. Zero-weight K4 bonds realize simple interaction graphs without altering domain records.

Enumerate all `2^N` configurations independently of sampling, normalize stably and display log Z. Exact outputs include configuration probabilities, each spin mean/marginal, M=Σs, m=M/N, |M|, total action E=S and their distributions/moments, pair correlations and connected covariance. Energy here denotes total dimensionless action, not a separately normalized Hamiltonian. An expandable table compares exact and empirical configuration frequencies. The original single-spin model remains compatible and numerically checked as the one-site special case.

Local field `H_i=b_i+Σ_(incident non-self e=(i,j)) K_e s_j`; `ΔS_i=2s_i H_i`; heat bath `P(s_i=+1|others)=1/(1+exp(−2H_i))`. Local Metropolis uses ½-lazy spin flips. At each update choose a uniform random site with replacement. Direct exact sampling is an optional independent benchmark implemented via inverse CDF. Trace and highlighted graph show the actual selected site, incident contributions, all local RNG draws and resulting configuration. Warm-up is excluded, not hidden.

For a uniform periodic four-site chain, `T_st=exp(Kst+b(s+t)/2)` and `Z=Tr(T^4)`. The one-dimensional 1×4 ring has four bonds; a 2D periodic 2×2 square has eight positive-axis bonds and four signed plaquettes. These geometries are independently validated, never deduplicated by endpoints.

#### M1b finite-graph real scalar field

For one real value per vertex, implement `S(x)=Σᵢ(aᵢxᵢ²/2+λᵢxᵢ⁴/4−hᵢxᵢ)+½Σₑκₑ(xₜ−xₕ)²` with weight `exp(−S)` and beta absorbed. Each oriented edge contributes once; orientation cancels in its gradient square, but parallel records remain distinct and self-links contribute zero. Reuse the M1a 1–4-site domain/presets plus a two-site Gaussian pair. Numeric bounds: `−10≤aᵢ≤20`, `|hᵢ|≤10`, `0≤κₑ≤10`; either `λᵢ=0, aᵢ≥0.05` or `0.01≤λᵢ≤10` with either sign of `aᵢ`. These are **sufficient**, not necessary, normalizability conditions; singular Gaussian zero modes are rejected.

At `λ=0`, construct `Qᵢᵢ=aᵢ+Σ_(non-self incident e)κₑ`, `Qᵢⱼ=−Σ_(edges joining i,j)κₑ`. Cholesky checks positive definiteness, then `μ=Q⁻¹h`, `C=Q⁻¹`, `log Z=N log(2π)/2−Σᵢlog Lᵢᵢ+hᵀμ/2`. The exact site conditional has variance `1/Qᵢᵢ` and mean `(hᵢ−Σⱼ≠ᵢQᵢⱼxⱼ)/Qᵢᵢ`. Direct sampling solves `Lᵀ(x−μ)=z` for standard normal `z`, yielding covariance `Q⁻¹`; it replaces the whole vector. Coordinate heat bath resamples one uniformly selected site from that conditional. Local Metropolis selects a site uniformly with replacement, proposes `xᵢ′=xᵢ+δ(2u−1)`, computes on-site and every non-self incident-edge difference, then consumes an acceptance uniform even downhill. A nominal sweep is N local attempts, not physical time.

One-dimensional quartic and quartic conditional references use stationary-point partitioning, an `exp(min V−V)` normalization, adaptive Simpson integration and a convex-tail bound on `1+x⁴` outside a disclosed `[-R,R]` interval. References include log Z, mean, variance, second/fourth moments and normalized density; failure to reach the supported tail/integration tolerance is reported. `λ=0` uses Gaussian formulas. Conditional quartic coefficients are `aᵢ+Σκₑ` and `hᵢ+Σκₑxⱼ`; neighbor-dependent constant terms cancel in its density. This **conditional** is distinct from the bare on-site potential and the equilibrium marginal. Independent quartic marginals and sums/products factor through 1D references. No exact coupled-quartic marginal is claimed.

Vector configurations are explicit real arrays in the worker, separate from old numeric scalar states and Ising bit masks. Per-segment bounded online target moments/histograms/logarithmic checkpoints cover each `xᵢ`, `xᵢ²`, pair products, total/mean field and S. Pair cross-sums support sampled covariance; 1000 recent exact vector transitions and sampled scatter pairs are retained. Compatible physical/sampler changes preserve vector and RNG with separate statistics and warm-up; topology changes start a new seeded session. Plot controls, graph selection and Fit All never sample. Two default scalar plots lead into zero-to-six target/view choices, including bare/conditional energy, conditional density, sampled marginal, trajectory, scatter, covariance, running mean/error when referenced and acceptance. The color scale is fixed, with numeric values always visible. No MCMC independent-sample uncertainty band is attached.

Scalar trajectories follow the latest 100 global algorithmic updates by default, with 500/1000-update windows, Follow latest, Older/Newer and bounded end-update navigation. The horizontal axis spans the selected window; evicted transitions and gaps between segments are never interpolated. Direct independent Gaussian draws are unconnected points. Coordinate heat bath and random-site Metropolis use step paths, including holds when the observed target does not change and rejection marks for Metropolis. Acceptance diagnostics use separate colored segment bars for accepted/rejected Metropolis attempts and include warm-up in counts. Direct Gaussian and coordinate heat bath have no accept/reject test: show N/A with their update counts, never a zero acceptance rate. These views remain projections of worker records and do not alter state or RNG.

A version-1 shareable URL contains only scalar model/domain parameters, sampler and seed. Validation rejects unsupported schema versions, invalid geometry and nonnormalizable/incompatible settings. It restores a new seeded session, never a Monte Carlo history.

### 4.3 Next models (not initial release)

- Massive Gaussian free field in 1D/2D; Fourier-space covariance and exact Gaussian sampling. A massless periodic case needs zero-mode removal or an explicit constraint.
- Euclidean lattice quantum mechanics (harmonic and double-well paths); correlators, transfer matrix, effective energy/gap.
- Continuous-spin lattice `φ⁴` in 1D/2D; local Metropolis and HMC; mass and correlation-length diagnostics.
- Potts and XY/`O(2)` site-spin models; discrete Potts updates, angular Metropolis/cluster methods when justified, vortices and BKT-related observables.
- Random-cluster/FK representation for comparison with Ising/Potts.
- `Z₂` and compact `U(1)` gauge models on oriented edges and plaquettes. Start with one open plaquette and small periodic tori. Show Wilson loops and gauge invariance explicitly. Do not imply a 2D gauge model has an Ising-like thermal transition without model-specific justification.

#### M2 indexed 2D Ising

Lattice Systems uses row-major site `i=x+Lx*y` and one positive-axis oriented bond from each site wherever its +x or +y neighbor exists. The x/y boundaries are independently open or periodic. Supported side lengths are integer 2–64; periodic length-two axes retain distinct parallel bonds. Open bond counts are `(Lx−1)Ly` and `Lx(Ly−1)`; periodic axes have `N` bonds. This indexed domain does not replace the small graph/cell-complex domain. The periodic 2×2 torus still corresponds to eight bonds and four M1a faces.

The physical Hamiltonian is `H=−Jx Σ_x s_i s_j−Jy Σ_y s_i s_j−h Σ_i s_i`, with `S=H/T`, `β=1/T`, `k_B=1`. M1a's dimensionless weights are `Kx=βJx`, `Ky=βJy`, `b=βh`. Finite controls allow `−10≤Jx,Jy,h≤10` and `0.05≤T≤100`; non-finite values are rejected. `M=Σs_i`, `m=M/N`, `|m|`, `e=H/N` and moments of `m²,e²` are distinct quantities. Negative bonds are supported without ferromagnetic theory claims. The indexed local field sums each incident bond, including parallel pairs; `ΔH=2s_i(Jx Σ_x s_j+Jy Σ_y s_j+h)`. A flipped spin changes `M` by `−2s_i`; energy and magnetization are maintained incrementally and independently recomputed in validation.

Random-site lazy Metropolis uses site, stay/flip and acceptance uniforms on every update. Heat bath uses site and resampling uniforms and a stable logistic conditional; it has no accept/reject test. All +, all − and seeded random ± initial states are available. A sweep is `N` elementary site updates with replacement, not physical time. Segment warm-up is specified in whole sweeps; after it, a measurement is taken every selected number of *segment-local* complete sweeps, including unchanged states. A parameter/sampler/schedule Apply on unchanged geometry preserves the spin configuration and RNG, recomputes H for the new parameters, starts an isolated segment and restarts warm-up. Geometry changes and Reset start a seeded session. Partial sweeps do not create extra measurements. Global update count remains exact; the plot's sweep coordinate is cumulative updates divided by N, possibly fractional after a mid-sweep quench.

Each segment retains online m, |m|, e, m² and e² moments; 41-bin full-segment m/e histograms; logarithmic mean checkpoints; and the latest 1,000 complete measurement records. At most eight segments survive. Full spin arrays are kept only for the current configuration, not for every update or measurement. The worker returns one current image with batched scalar summaries; Run uses bounded 4,096-update batches and a separate display timer. Plot windows, site selection, and rendering draw no random numbers. The M2 baseline has no independent-sample bands; M3a adds separately labeled, bounded-window MCMC diagnostics below.

The Canvas view shows complete spins and a selected 5×5 neighborhood; Step shows the worker's actual latest transition, incident terms and draws. Its hypothetical selected-spin flip cost is distinct from the Metropolis proposed-move cost and the actual transition change: rejection, lazy self-proposal and unchanged heat-bath resampling have actual `ΔH=ΔS=0`. The plot gallery defaults to m and e histories and offers histograms, |m| history, running means and outcome bars. Recent windows and navigation use global sweep coordinates and never join separate segments. Every 2×2 open, periodic or mixed-boundary box has a direct 16-state physical-parameter reference for log Z, probabilities, magnetization/energy moments and P(m), normalized with a lowest-action log-sum-exp offset across the full M2 parameter range. M1a's narrower dimensionless editing bounds remain unchanged. For positive Jx,Jy and h=0 only, the infinite-volume critical β satisfies `sinh(2βJx)sinh(2βJy)=1`; isotropic `Tc/J=2/log(1+√2)`. The Tc example preset explicitly sets the draft to `Jx=Jy=1`, `h=0`, `T≈2.269`; Apply retains its normal segment behavior. This is not a finite-volume transition temperature. At h=0 finite-volume exact 〈m〉 vanishes by spin-flip symmetry even when a finite local chain remains in one sector.

#### M3a physical observables and statistical diagnostics

For each retained M2 measurement, record `m⁴`, directional bond products `Gx(1),Gy(1)` and axial displacement products alongside the established `m,|m|,e,m²,e²`. Let `N=LxLy`, `β=1/T`. The laboratory defines `χ=βN(〈m²〉−〈m〉²)`, `U₄=1−〈m⁴〉/(3〈m²〉²)`, and heat capacity per site at fixed physical `Jx,Jy,h` as `cV=β²N(〈e²〉−〈e〉²)`. χ uses the **signed** magnetization mean. Sampled fluctuation estimates use the population variance (`Welford M₂/n`), distinct from the displayed `n−1` sample variance. A zero or numerically unusable Binder denominator is N/A. Exact 2×2 values use the stable physical-energy 16-state enumeration, including mixed boundaries and parallel bonds. Larger lattices receive no invented exact thermodynamic values.

`Gα(1)` averages `s_i s_j` over every actual positive-axis bond record in direction α, divided by that axis's bond count: `(Lx−1)Ly` or `N` horizontally and `Lx(Ly−1)` or `N` vertically. For an axial displacement `r`, average ordered origin/positive-displacement site pairs. Periodic axes wrap and contribute `N` pairs; open axes omit origins whose displaced site is outside and divide by the remaining pair count. Compute `r=0,…,min(4,floor(Lα/2))` periodically or `r=0,…,min(4,Lα−1)` openly. Only when **both axes are periodic** plot the plug-in connected estimate `Gα(r)−〈m〉²`; any open or mixed-boundary lattice displays **raw** `Gα(r)`. A cylinder can have row-dependent site means even along its periodic axis, so subtracting a single global mean squared would not be a connected covariance. Compute this bounded `O(Nr)` work only on retained measurements, not every update. Structure factors and correlation-length fits remain later work.

M2 and small-graph Ising each keep three aligned worker-owned rings of at most **8192 consecutive retained observations**: `m`, `|m|`, and physical `e` for M2, or dimensionless total action `E=S` for Small Systems. They are separate from full-segment moments/histograms and 1000 recent plotting records. At most eight parameter segments survive; each new parameter/sampler segment gets a new diagnostic ring and its own explicit cadence: M2 nominal sweeps per observation, graph local updates with site count, or independent whole-configuration draws. The worker refreshes compact analyses at measurement counts 1, every 16 through 256, then every 256. React receives summaries and at most 129 ACF points per observable, never the raw rings. The summary states analyzed count/range, full segment count, evictions, cadence and status. One M2 observation is separated from the next by `strideSweeps` nominal sweeps, each of `N` random-site updates; a rendered frame is unrelated. Graph local Ising retains each post-warm-up elementary update, so its τ in observations equals τ in elementary updates and τ in nominal sweeps is `τ/N`. Direct graph draws are independent whole-configuration observations; no nominal local-update sweep is defined. Exact and empirical τ use the same observation cadence.

For a recent record `x₁,…,xₙ`, use its mean `x̄`, `γ(k)=Σ_{i=1}^{n−k}(xᵢ−x̄)(xᵢ₊ₖ−x̄)/(n−k)`, `ρ(k)=γ(k)/γ(0)`, and `τ_int=½+Σ_{k=1}^{W}ρ(k)`. Evaluate at most `min(128,floor(n/10))` lags. The conventional initial-positive sequence uses complete pairs `Γ_j=γ(2j)+γ(2j+1)`, beginning at `γ(0)+γ(1)`; an unmatched final lag is ignored. The first nonpositive pair stops the usable sequence **before** that pair. Among positive complete-pair endpoints (odd `W`), choose the first self-consistent `W≥5 max(½,τ(W))`. If none exists, a still-positive tail at the lag limit is unresolved. A nonpositive pair before self-consistency yields only a **provisional/window-sensitive** estimate when at least five positive lags remain and `W≥3 max(½,τ(W))`; an earlier cutoff is unresolved and suppresses τ, ESS and SE. Fewer than 64 observations, zero/negligible variance, apparent first/second-half drift, unresolved tails and sensitivity to halving `W` have explicit status/warnings. Drift also suppresses τ, ESS and SE. Empirical `τ<½` is floored at ½ and ESS capped at `n`, with a warning. When supported, `ESS=min(n,n/(2τ))` and the **recent-window** mean's `SE≈sqrt(2τ s²/n)` uses `s²` with denominator `n−1`; never attach this SE automatically to a longer full-segment mean. M2 converts τ to nominal sweeps by multiplying by measurement stride; graph local updates convert by dividing by site count; direct draws have no such conversion. None of these checks proves equilibration or controls thermalization bias.

Independent blocking uses nonoverlapping blocks of sizes `1,2,4,…`, discards incomplete remainders, and requires at least 16 blocks per displayed SE point. It is a cross-check over the same recent window, not an automatically established plateau. Display controls, ACF plots and blocking computations consume no RNG; the analysis is scheduled by retained measurement count, not rendering cadence.

For every valid 1–4-spin graph Ising model, construct the **actual** selected one-update transition matrix: random-site ½-lazy Metropolis, random-site heat bath including unchanged resampling, or direct independent Gibbs draws. Preserve distinct parallel/self-link effects through the existing action/local-field functions. Normalize against exact Gibbs probabilities; check stochasticity and detailed balance. When all Gibbs probabilities exceed `10⁻¹²` and the reversible spectrum is stable, symmetrize with `sqrt(πᵢ/πⱼ)Pᵢⱼ`, diagonalize the small real symmetric matrix, and report nontrivial eigenvalues and gap `1−λ₂` per elementary update. For observable `f`, use centered equilibrium mode weights to calculate `γ_f(k)`, exact `τ_int`, and exact asymptotic variance `Σ_{a>0} c_a²(1+λ_a^q)/(1−λ_a^q)` for observations every `q` updates. `q=1` for graph measurements and `q=N·strideSweeps` for M2's exact 2×2 benchmark. Numerically concentrated or effectively closed chains, and constant observables, have explicit unavailable statuses. Exact stationary theory is compared with empirical recent-window diagnostics but is never presented as evidence of equilibration. The full matrix need not occupy the main interface.

M3a's numerical conventions remain unchanged. M3b1 stores their available segment aggregates and bounded recent observations on demand; M3b2 executes independent parameter sweeps using the existing M2 kernels. M0–M2 update kernels, RNG streams and direct-Gaussian analytic uncertainty references stay unchanged.

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
- M0.5: Gaussian direct and uniform random-walk Metropolis; spin direct, exact heat bath and lazy Metropolis; binomial direct Bernoulli sum and nearest-neighbor Metropolis. Gaussian displacement is uniform in `[−δ,δ]`, `0.01≤δ≤50`. Spin proposes self/flip with probability 1/2 each. Binomial proposes ±1 with probability 1/2, mapping out-of-range attempts to self. Proposal symmetry, detailed balance and aperiodicity are tested on small transition matrices.
- Every Metropolis update consumes two uniforms (proposal, then acceptance), including self/automatic acceptance. Record ΔS and `α=exp(min(0,−ΔS))`; use the full-precision comparison `u<α`. Count accepted moves, rejections and self-proposals separately. Acceptance includes self; movement excludes self. Counters include warm-up.
- Direct binomial uses n Bernoulli uniforms, spin direct/heat bath uses one. Single-spin heat bath is a resampling kernel with identical rows and therefore independent equilibrium draws. Do not attach fictitious Metropolis acceptance fields to these updates.
- Metropolis discards a configurable 0–10000 updates (default 200) per new segment. This is not a mixing guarantee. Direct and isolated single-spin heat-bath sampling need zero warm-up. Initial chain configurations are 0 (Gaussian), +1 (spin), round(np) (binomial), not measurements. Accepted, rejected and self states after warm-up all enter estimators at stride one.
- M1a implements graph Ising random-site local Metropolis/heat bath and direct enumeration sampling. Graph Metropolis consumes site/proposal/acceptance uniforms (three), graph heat bath site/resampling uniforms (two), direct exact one uniform for a full configuration. A nominal sweep is N local updates with replacement. Both local samplers discard configurable 0–10000 warm-up updates (default 200); local Reset starts all +1. Single-spin M0.5 heat bath retains zero warm-up and its original stream. M1b's real-scalar local updates and whole-vector Gaussian direct draws follow their separate conventions in §4.2.
- Later: Wolff or Swendsen–Wang/FK cluster updates for compatible models; HMC with reversible symplectic integrator and Metropolis correction for smooth continuous fields.
- Advanced samplers should be exposed only on models for which their validity has been implemented and tested; no universal algorithm picker with invalid choices.

### 5.4 Worker messaging and event traces

A minimal worker API can include `initialize`, `runBatch`, `step`, `pause`, `reset`, and `measure`, with acknowledgments carrying a run ID and monotonically increasing state version. Messages should reject stale run IDs. Use compact typed state arrays and transfer/copy strategies that do not accidentally detach the only authoritative state.

M0.5 implements `initialize`, `advance(count)`, `changeSettings`, and read-only `snapshot`. Initialize creates a fresh run with an increasing run ID. Version counts completed updates plus accepted setting changes. Step advances once, Run schedules batches of 128 (protocol limit 1024), and Pause stops further scheduling and waits for any in-flight acknowledgment. Apply is ordered after the pending batch and before another is scheduled; Run then continues. Repeated queued settings edits use the latest requested values. Unchanged settings are a no-op. The worker has no autonomous timer. Reset uses Initialize; stale commands and stale/regressing replies are rejected or ignored. Rendering and snapshot reads consume no RNG draws. Worker failures stop scheduling and label displayed state as last confirmed; Reset can recreate the worker.

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

The worker owns the authoritative evolving configuration. React/UI component state controls rendering and input, not the Monte Carlo transition sequence. Parameter edits start a separate measurement segment with fresh estimators while preserving prior segments for comparison. Carry the configuration and RNG stream where appropriate; never pool different target measures. Direct and single-spin heat-bath draws require no warm-up; Metropolis applies the segment’s configured discarded warm-up after physical or algorithm changes. Retained measurements never mix segments.

## 6. Observables, estimators, and plots

### 6.1 Plot library

In M3, introduce a shared registry of plot types, each declaring applicable data and observables: scalar time series; histogram/density; parameter comparison; two-point correlations; structure factor; autocorrelation; joint scatter/density; matrix heatmap; effective gap; Wilson-loop observables; finite-size comparison.

Plots require titles, axes and units/conventions, legends for overlays, run identification, and labeling of exact/reference vs sampled data. Hide incompatible plots rather than present empty nonsense.

#### M0.5 sample trajectories and inspection

The Sample Trajectory plot uses global elementary algorithmic update number (not physical time) and the current model variable. Direct draws are unconnected points; heat-bath/Metropolis states use step paths. Rejections are crosses at the repeated state; deliberate self-proposals are squares; accepted moves/resamples use circles. Warm-up marks are faint and explicitly excluded from estimates. Discrete state axes retain integer labels.

Each segment has a 1000-record ring retaining exact transitions, including before/result state, outcome, global/segment update indices and warm-up flag. Metropolis additionally retains proposed/attempted state, ΔS, α, uniform and acceptance; heat bath retains exact P(+1) and its resampling uniform. Display windows of 100/500/1000 updates can follow the latest or browse older retained updates. Missing/evicted history is disclosed and never connected as though exact intermediate samples existed. Segment colors match distribution/convergence overlays. Optional horizontal lines show exact mean and distribution ±σ, not uncertainty bars.

Step opens the latest-update inspector using the worker’s own record; no extra RNG calls or separate inspection kernel are allowed. Pause finishes the in-flight batch, Step advances once, and Run resumes the same sequence. Current variable display, counters, trace and trajectory must agree. An optional plot offers per-segment acceptance/movement summaries; no autocorrelation estimate or ESS is implemented.

#### M1a graph observable views

Reuse distribution, trajectory, running-mean and absolute-error plots for M, m, |M|, total E=S and each site spin. Graph transitions are projected onto the chosen observable without changing their update index/outcome/warm-up flags. Defaults are total M distribution and trajectory. Add Plot also offers a current connected-correlation matrix (exact/sample), local conditional probabilities for the selected site at current neighbors, and acceptance/movement diagnostics. The conditional is not a marginal; covariance/conditional panels show the current segment/configuration rather than ambiguous overlays. Distribution and mean overlays preserve compatible parameter segments. Site selection can add that spin’s trajectory with one action.

Each segment stores at most 16 full configuration counts, per-observable online moments and bounded checkpoints, and 1000 recent transitions. Empirical probabilities/correlations use all retained measurements, never just the visible trajectory window. Energy support is discrete but need not be integer. No independent-sample uncertainty formula is applied to interacting chains.

### 6.2 Initial Ising observables

M1a explicitly uses total `M = Σ_i s_i`, `m=M/N`, `|M|` and dimensionless total `E=S`. For later lattice models, use `m = N⁻¹ sum_i σ_i` and `e = H/N` unless explicitly stated otherwise. Display instantaneous `m` and `e` distinctly from their sampled means. In a symmetric finite system at `h=0`, report both `<m>` and `<|m|>` so that a nearly zero signed mean is not misread as absence of finite-size ordering.

Measurement priorities:

1. `m`, `|m|`, `e` time series; sample means and variances.
2. Histograms of magnetization and energy; acceptance rate.
3. Two-point functions and connected spatial correlation `C(r)` with stated distance/averaging convention.
4. Susceptibility and Binder cumulant after proper accumulation, with clearly stated convention and sample-quality warnings.
5. Integrated autocorrelation and effective sample size when enough data exist.
6. Structure factors, correlation length, finite-size scaling, and parameter sweeps later.

At `k_B=1`, one common fluctuation susceptibility convention is `χ=β N (<m²>-<m>²)`. The Binder cumulant is `U₄=1-<m⁴>/(3<m²>²)` where the denominator is nonzero. Provide the actual formula used in the UI. Do not assume these formulas automatically transfer unchanged to every model.

### 6.3 Monte Carlo error diagnostics

M0.5 preserves the narrowly scoped direct-Gaussian diagnostic: plot retained running means against logarithmic segment sample count `N`, each segment’s exact `μ`, and `μ±σ/√N` with known analytic `σ²`. At any fixed `N`, this envelope has about 68% coverage for independent Gaussian draws. It is **not** a simultaneous confidence band and does not promise containment of the whole trajectory. Optional log–log `|mean−μ|` displays the `σ N^(-1/2)` RMS reference (slope −½). A single stochastic error can rise, fall, or cross zero; zero errors are omitted from the log view and disclosed. Lines interpolate retained checkpoints, not every fluctuation.

The worker records checkpoints at `n₀=1`, `nₖ₊₁=ceil(1.125 nₖ)` and keeps the latest endpoint, independent of snapshot/render cadence. At most 320 scheduled checkpoints plus one endpoint cover the supported safe-integer sample-count range. Moments, histogram, and checkpoint mean are updated from the same draw in the same segment. Tests compare seeded sequences across batching/parameter changes and check theoretical RMS scaling and fixed-N coverage over an ensemble. Only direct Gaussian segments receive these known-variance bands/RMS references. Metropolis and discrete-model segments show their separate running means and exact references without confidence bands. These diagnostics do not implement autocorrelation or generic MCMC uncertainty estimates. Sample variance uses N−1 but remains subject to finite-chain correlation bias.

M1a refinement: zero-field odd expectations are exactly zero by global spin reversal, including heterogeneous signed pair couplings. Site means pair reversed configurations using their combined probability times `tanh(b·s)`; compute the field term separately from pair action to preserve tiny nonzero fields. M and m references derive from these site means. No blanket small-value rounding is permitted; correlations, covariance and log Z retain their mathematical definitions.

Absolute-error plots show each segment's current retained N and numerical `|mean−exact|`. The logarithmic floor is `max(σ,0.1)/(125 sqrt(max(2,N)))`, minimized across retained segments; the upper bound includes all positive errors and `1.25 max(σ,0.1)`. Here σ is the exact observable standard deviation; the 0.1 fallback gives constant observables a usable display. This is a **display resolution policy, not a confidence or mixing estimate**. Accidental tiny checkpoints never set the floor. Zero and below-range positive checkpoints are omitted with separate counts; paths break at omissions. All-zero histories have an explicit message. Axes expand only automatically; Fit All refits retained segments with the same floor policy, and may omit exceptionally small errors rather than stretch the log range to them. Reset retains its clear/reseed/refit semantics.

Observed error against an exact finite-volume reference differs from estimator uncertainty. Correlated MCMC updates can have far fewer effective independent samples than N. A small observed error proves neither equilibration nor adequate mixing. Graph heat bath and Metropolis receive no independent-sample uncertainty bands. The future exact tiny-chain spectral benchmarks are planned in the roadmap, not implemented here.

Later measurement capabilities:

- Maintain separate warm-up and measurement counters, with configurable measurement stride.
- Use numerically stable online moments; keep bounded history buffers for long runs, and export aggregated/decimated histories with disclosed sampling rules.
- For autocorrelation, specify the lag/window convention, e.g. `τ_int=1/2+sum_{t=1..W}ρ(t)` and approximate `N_eff=N_samples/(2τ_int)` when supported.
- Avoid reporting highly precise errors with insufficient independent data or a clearly drifting series. Give warnings near critical slowing down and for poor mixing/short histories.
- Statistical uncertainty, volume effects, and action-discretization effects require separate explanations.
- Do not pool measurements from different target parameters or distinct algorithms without recording their provenance and justifying the estimator.

### 6.4 Run storage and exports

Each archived parameter segment has immutable numerical provenance and separately editable annotations. The version-1 portable envelope is:

```ts
type PortableBundle = {
  format: 'lattice-lab-experiments';
  schemaVersion: 1;
  exportedAt: string;
  records: { scientific: ScientificDataset; annotation: Annotation }[];
};
```

M3b1 uses a version-1 `lattice-lab-experiments` JSON bundle as the authoritative portable file. Its records separate immutable scientific capture data from editable display annotations. Each scientific record identifies its source workspace/run/segment and worker version, capture update/time, model/domain/segment settings, seed, initialization, RNG version, source revision or `unknown`, bounded raw coverage, complete available aggregates/histograms, diagnostic summaries and optional current configuration tagged at its capture update. A warm-start historical segment is snapshot-only, not replayable from its final parameters and the original seed. Imported duplicates retain the original scientific dataset ID but receive separate local library IDs. The library holds at most 16 records and 12 MiB; a portable import is capped at 16 MiB and validated atomically. Records live in memory until explicitly exported, with no silent eviction or persistence service.

Both existing workers expose read-only, on-demand captures only at an acknowledged paused/idle boundary. Routine Run snapshots still transmit compact M3a summaries, while a capture copies the actual ordered diagnostic rings (at most 8192 observations) for lattice and graph Ising, or the available recent trajectory for other Small Systems models (at most 1000 transitions). Exact observation indices/cadence and disclosed eviction distinguish these from full-segment aggregate moments. A historical segment has no fabricated final configuration. Capture requests/replies carry monotonically checked IDs and worker versions; capture does not draw randomness or advance the model.

Separate downloads provide the complete JSON bundle, a CSV of available numeric observations, its JSON metadata sidecar, and a concise aggregate CSV summary. CSV measurement columns include scientific dataset ID, observable ID, units, segment-local observation index and algorithmic update; nominal sweeps are present only where meaningful. Summary rows expose each model's primary observable ID, unit, full-segment mean and N−1 sample variance. Model-specific columns keep dimensionless graph E=S, sampled scalar S, physical lattice e=H/N and equilibrium fluctuation observables distinct. CSV export prefixes formula-like text fields with an apostrophe, including after leading whitespace or controls, while numeric cells retain their values. Only the portable bundle is imported. Existing scalar configuration-only URLs retain their schema; no history is placed in a URL. No data are automatically sent to a server.

M3b2 adds a version-2 envelope with immutable sweep plan, point order/status, deterministic per-point seeds, physical parameters, work counts and references to completed version-1-style scientific datasets. Version-1 bundles import unchanged. Import validates the complete manifest and every point dataset atomically. At most 12 points, 8192 measurements per point, 10 million elementary updates and the existing 16-record/12 MiB archive bounds apply. Each point has fresh initialization and warm-up; Pause/Resume preserve the current worker state and Cancel archives completed points but marks an incomplete point discarded. A repeated Pause or Resume has no additional effect. The worker stages one completed point until the UI has committed its dataset and sent an ACK naming that point; stale or duplicate ACKs cannot release another point. A failed archive publication or ACK can be retried with the same dataset identity. Cancellation and fatal failure stop sampling and emit one terminal status, while an already staged completed capture remains available to archive. A read-only final diagnostic analysis aligns the exported summary with the final raw ring. The sweep comparison uses numeric parameter spacing and full-segment means/fluctuation observables; recent-window SE is never attached to those full estimates or to nonlinear observables. Only m, |m| and physical e have complete raw diagnostic series through 8192 measurements.

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
- Small Systems defaults to one detail plot on phones, with a visible compact overview showing all active plots in one column. Up to six plots remain navigable without six mandatory expanded charts; labels and touch controls remain readable.
- Large-lattice charts can stack vertically; preserve selection and zoom when rotating the device.
- Minimum comfortable touch targets; accessible keyboard navigation and text labels for icons.
- Do not encode discrete spin sign only by color; use legend, pattern, or inspectable tooltips and support adequate contrast.
- Control groups: Model Parameters, Geometry/Boundaries, Sampler, Measurements, Display, Advanced. Provide a compact mode and sensible defaults.

### 7.3 Parameter editing rules

- Label parameter meanings and valid ranges with the displayed action convention.
- Provide one-click presets for instructive regimes (e.g. high/low-temperature Ising, zero-field symmetry, double-well 0D potential, weak/strong coupling of a tiny graph).
- Apply preserves plotted history and starts a clearly labeled segment when the target measure changes. Each segment has separate parameters, sample count, statistics, histogram, and convergence reference. Never pool distributions into one equilibrium estimate.
- Preserve current numerical configuration and RNG stream where appropriate. Direct and single-spin heat-bath sampling need no warm-up; Metropolis segments apply their recorded warm-up budget.
- Keep axes stable: expand when needed, never automatically shrink/recenter on Apply. Compare old/new sampled and theoretical curves with segment labels/colors. Bounded retention must disclose removal of old data.
- Reset explicitly clears measurements and history, restarts the current applied model with the documented seed policy, and recenters/rescales plots. M0.5 uses the Seed on Reset field; Apply does not reseed.
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

Recommended initial stack (changeable after prototype): TypeScript + Vite; React or equivalent component UI; Canvas 2D for high-frequency lattice rendering; SVG for tiny graph selection/inspection; maintained charting library for plots; Web Worker for simulation. Unit tests with Vitest; smoke/responsiveness tests with Playwright or equivalent.

M0 adopts TypeScript/Vite/React, native accessible controls, small SVG density/convergence plots, local KaTeX HTML + MathML, Vitest, Playwright (Chromium and WebKit), and Prettier. No charting/component framework is needed for the one-dimensional density, and no graph/lattice framework is implemented ahead of M1. KaTeX renders authored formulas only, with trust disabled and bundled fonts; no CDN or formula editor. M0.5 and M1a add no runtime dependencies. M1a reuses SVG for its graph selection view and existing scalar plotting components through read-only observable projections. See D-013/D-014 and D-016–D-024 for the accepted implementation choices.

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

Source code is also teaching material. Mathematical entry points should state their action and unit conventions; non-obvious algorithms, numerical safeguards, state ownership, worker ordering, and data-provenance rules should have concise explanatory comments and independently understandable tests. Ordinary application code should likewise favor descriptive names and clear control flow. Avoid redundant line-by-line commentary and unmeasured complexity; review readability with every feature PR. See [SOURCE_GUIDE.md](SOURCE_GUIDE.md) for a reading path through the implementation.

### 9.4 Performance envelope

Start with modest lattice sizes (illustratively 16²–128² for 2D Ising, depending on phone performance). Batch updates without freezing the main thread, render at most at a useful UI refresh rate, and measure actual performance on at least one desktop and one ordinary phone. Do not promise a particular FPS/sweep throughput before measurements. When load becomes high, preferentially reduce rendering frequency, not the integrity of updates or measurement bookkeeping.

### 9.5 Resilience

- Reject invalid geometry and non-finite action/parameter values with actionable errors.
- Pause and recover from worker exceptions without showing stale data as current.
- Preserve results of previous runs in memory unless explicitly replaced, subject to reasonable memory limits. M0.5 retains the latest eight parameter/algorithm segments using online moments, histograms, logarithmic mean checkpoints and 1000 exact recent transitions per segment, with visible eviction notices. Apply preserves history; Reset explicitly clears it. This bounded comparison is not the M3 saved-run/experiment manager.
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
- Plot axes and sample-status labels present; graph selection and numerical parameter editing have touch targets.
- GitHub Pages deep link, JS chunks, worker URLs, static assets, and base-path deployment work under `/lattice/`.
- Smoke test on a real browser before a feature is marked delivered.

## 11. Stages and acceptance

See `ROADMAP.md` for implementation milestones. The following describes the initial public usable edition **after M1**, not the M0 acceptance gate. That edition need not include every model or plot in this document. It **must**:

- Deploy as a static site on its own repository.
- Show a working small-system model with a configurable collection of up to six inspection plots and touch-friendly collapsible controls.
- Support accurate graph/lattice presets including periodic 1×4 and periodic 2×2, not falsely conflated with an open square.
- Implement at least one validated exact finite-volume benchmark and one step-inspectable MCMC algorithm.
- Distinguish warm-up from measurement and show which values are sampled versus exact.
- Pass numerical tests and a phone browser smoke test.

Later milestones cover larger 2D Ising, robust statistics, continuous fields, HMC, and gauge models.

## 12. Open questions / design flexibility

These should not block a small vertical slice but should be resolved deliberately:

1. Phone plots: single-detail default plus compact overview; continue reviewing legibility with multiple segment overlays.
2. Relative priority of exact tiny-graph enumeration versus interactive continuous 0D quadrature; both are in the early roadmap.
3. Whether a later milestone should expose topology/face editing beyond M1a’s preset selection and numerical weights.
4. M0.5 overlays retained parameter/algorithm distributions and mean trajectories; recent sample trajectories use a bounded browseable update window; determine how explicit saved-run selection should work in M3.
5. Which maintained charting library gives adequate performance/accessibility with the smallest complexity burden.
6. Whether student exercise presets should be in JSON with a simple schema, or in typed TS modules for safer model references.
7. Which numerical tolerance and quadrature algorithm to use for quartic integrals after a validation study.
8. What licensing scheme to use for software and pedagogical text.

**Revision discipline:** Retain the design's scientific invariants as the implementation evolves. If an assumption proves inconvenient, revise the relevant requirement and its tests together. A living specification is most valuable when it records what the software actually promises, not when it becomes a wish list that nobody checks.
