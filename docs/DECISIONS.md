# Design decisions

**Status:** living decision log. Record decisions here when they materially constrain implementation. Change an accepted decision by appending a superseding entry, not silently erasing the history. Dates are decision-record dates; entries marked *provisional* are recommendations to validate during implementation.

## Accepted by project direction — 2026-10-10

### D-001 — Separate repository

Keep Lattice Lab in its own repository and deploy it independently of SOL. SOL may link to it, but the code base and deployment are separate. **Why:** the growing simulator collection is not a lightweight standalone SOL tool.

### D-002 — Two simulation workspaces plus an experiment layer

Use Small Systems and Lattice Systems as distinct views, with an Experiments workspace added as measurement capabilities mature. Share numerical and plotting infrastructure. **Why:** microscopic inspection of four variables differs from visualization of large 2D configurations.

### D-003 — Up to four simultaneous detailed variable plots

Provide four graph/field inspection panels in a configurable 2×2 layout. They can show independent variables, coupled node variables, or four selected edge variables. On phones also provide a single-panel detail view; retain a four-panel overview option. **Why:** compare local distributions and their interactions without losing context.

### D-004 — Arbitrary tiny graph connectivity and true periodic geometry

Support user-configurable edges among four nodes; include path, open square, star, complete graph, periodic 1×4 ring, and true periodic 2×2 torus. Represent each bond by an **edge ID**, allowing parallel edges and self-links; optionally represent faces as oriented cycles. **Why:** a periodic 2×2 torus is not the same data object as an ordinary four-edge square.

### D-005 — Two simulation observation modes

Use a normal batched Run mode (sparse configuration display with continuous measurement) and a Step/Inspect mode (one elementary update with proposal, acceptance calculation, and result). **Why:** high-throughput sampling and pedagogical step inspection need different pacing.

### D-006 — Collapsible, mobile-first controls

Settings must not dominate screen space. Use responsive panels, collapsible categories, and a mobile controls drawer. Preserve simulation state when UI sections open, close, or change orientation.

### D-007 — Correctness and extensibility before raw speed

Use seeded RNG, exact finite benchmarks, explicit conventions, model/algorithm separation, and automated regression checks before optimizing large lattice performance.

## Provisional implementation choices — review at M0

### D-008 — Static TypeScript application

Recommendation: TypeScript, Vite, a component UI (React is a reasonable initial choice), 2D Canvas for fast lattice visualization, SVG for graph editing, a maintained lightweight plotting library, and Web Workers for simulation. GitHub Pages deploys the built static assets. **Why:** portability and reliable agent-assisted implementation. This is not a commitment to a specific UI or chart framework.

### D-009 — No accounts or backend

Keep computations, sample management, and exports on-device. Do not add login, telemetry, or server-side persistence to the initial project. **Why:** easy hosting, low maintenance, and privacy.

### D-010 — Measurement provenance

Every exported dataset carries the model, geometry, parameters, algorithm, seed, warm-up schedule, measurement cadence, and software/specification version. **Why:** a CSV without simulation metadata is not reproducible.

## Accepted clarifications — 2026-10-10

### D-011 — Repository identity and deployment path

The repository is **gantemur/lattice**, hosted at <https://github.com/gantemur/lattice>, with intended GitHub Pages URL <https://gantemur.github.io/lattice/>. Use `/lattice/` as the application base path for assets, workers, and navigation. The product may continue to be called **Lattice Lab**. This specifies D-001 and D-008 without renaming the product.

### D-012 — Four display slots independent of physical degrees of freedom

Supersedes the “up to four” ambiguity in D-003. Small Systems always offers **four principal variable-plot slots**, independent of model size. Users select which four physical variables to inspect when there are more than four. A periodic 2×2 square gauge lattice has four sites and eight oriented link variables under the standard +x/+y convention, yet still has four plot slots. The graph/lattice visualization is separate and does not consume a slot. With fewer than four variables, unused slots are explicitly unassigned or repeat a selected variable; they never imply extra physical variables. Preserve phone detail mode and a 2×2 overview. M0 establishes this shell with one Gaussian variable; multi-variable models and richer inspectors remain M1 or later.

## Accepted M0 implementation decisions — 2026-10-10

### D-013 — Small static React application with SVG and a worker

Adopt TypeScript, Vite, React, native form controls, and small SVG density plots for M0, validating D-008. Use Vitest for numerical/engine tests, Playwright for production browser smoke tests, and Prettier for source formatting. React and React DOM are the only runtime dependencies; defer charting libraries, graph editing packages, routing libraries, and generic registries until needed. Keep domain, model, sampler/RNG, estimators, worker engine, and rendering modules separate. No backend, telemetry, external runtime resources, or persistent services (D-009).

### D-014 — Independent Gaussian sampling and explicit segment replacement

The first model is `S(x)=a x²/2−h x`, on one real site variable, with target `exp(−S)` and no extra beta. M0 uses the practical supported ranges `0.05≤a≤20`, `−10≤h≤10`; these are UI/numerical bounds rather than the mathematical normalizability boundary `a>0`. Use analytic moments and centered normalized density. Store the partition reference as `log Z` to avoid overflow.

Use Mulberry32 midpoint v1 with a uint32 seed (including zero), and Box–Muller v1 consuming exactly two open-interval uniforms per Gaussian draw without a cached second variate. Every update is an independent retained sample, so warm-up is explicitly zero and stride is one. Replays are intended for the same algorithm/build; cross-engine transcendental last bits are not promised. This advances independent Gaussian sampling to M0; detailed Metropolis inspection remains M1.

Use online Welford moments (sample variance denominator `n−1`, undefined for fewer than two samples) and 32 fixed histogram bins over `μ±4σ`; all retained samples enter moments and histogram normalization, with explicit below/above counters. Provide no unsupported error estimates. The worker's authoritative state never depends on React render frequency. The M0 protocol is Initialize/Advance/Snapshot; the client keeps at most one update batch in flight, so Pause waits for that batch before Step, and rejects old-run/regressing replies. Apply, Reset, and preset selection explicitly replace the segment and clear measurements; saved run storage is deferred to M3. Changing plot assignments or control visibility consumes no randomness and changes no physical state.

### D-015 — Validate feature PRs; defer live deployment until approved merge

CI runs formatting, type checking, numerical/worker tests, production build, and browser tests on pull requests. Only validated `main` builds may deploy via GitHub Actions to `/lattice/`. Use hash navigation for static-host reloads, avoiding server rewrites. Preparing M0 on a feature branch does not authorize merging it: local subpath/browser validation and the live Pages acceptance check are tracked separately. Physical-phone performance and license selection remain open; emulated phone smoke tests are not a claim of hardware benchmarking.

## Accepted M0 refinement — 2026-10-10

### D-016 — Local mathematical typesetting and compact target/view slots

Extend D-013’s runtime dependencies with KaTeX. Reusable inline/display React components render authored formulas with HTML + MathML, trust disabled, and locally bundled CSS/fonts. No CDN, general-purpose formula editor, or additional component/plot framework is needed.

Refine D-012: exactly four slots are independent of physical variable count. Each assignment specifies a variable/observable and plot type; one variable may occupy multiple slots with different views. Unassigned slots are compact one-line selectors. M0 defaults to `x` density/histogram and running mean, with slots 3–4 unassigned. Preserve phone single detail and optional 2×2 overview. Assignment, close/open, reordering, and viewport changes remain entirely in display state and never consume randomness.

### D-017 — Independent-Gaussian convergence within M0

Add a running-mean plot with log sample count, exact segment mean and theoretical `μ±σ/√N` envelope using known analytic variance. Coverage is about 68% at a fixed N for independent Gaussian draws, **not simultaneous confidence** for the whole trajectory. The optional log–log absolute-error view includes the `σ N^(-1/2)` RMS reference; individual errors need not decrease monotonically. Omit exact zero errors on logarithmic axes with a notice. Do not transfer this uncertainty formula to correlated MCMC.

Collect checkpoints inside the worker after each draw’s moment/histogram update: `n₀=1`, `nₖ₊₁=ceil(1.125 nₖ)`, plus the current endpoint. At most 320 scheduled points plus one endpoint cover safe-integer counts. This schedule is independent of rendering and batching; individual samples are never retained. Validate the sequence and ensemble RMS/pointwise-coverage behavior. General MCMC diagnostics and plot registries remain M3.

### D-018 — Continuous parameter exploration, explicit Reset and Fit All

Supersede D-014’s segment replacement on Apply/preset selection. Changed physical parameters begin a fresh measurement segment while preserving the current configuration, RNG stream, and earlier plotted segments. Unchanged parameters are a no-op. Apply waits for an in-flight batch before switching, then continues Run if active. A segment owns its parameters, start-update index, count, moments, histogram, checkpoints, and exact references; no cross-measure pooling is allowed. Independent Gaussian sampling requires no warm-up. Future MCMC models should preserve configuration when appropriate and disclose/apply the new segment’s warm-up policy.

Keep the latest eight segments, each with 32 fixed histogram bins over its own `μ±4σ`, tail counters, moments, and bounded checkpoints. Disclose eviction of older segments. Give overlays segment labels/colors and distinct analytic/sampled styles. Axes expand as required but never automatically shrink or recenter on Apply or eviction. Fit All fits the retained data without touching numerical state. Reset clears all history, refits for the currently applied model, and restarts using the Seed on Reset field; Apply never reseeds. Replaying parameter exploration requires the same seed and parameter-change/update sequence.

This is bounded, in-memory M0 comparison, not full M3 experiment management: no named saved runs, persistence, import/export, sweeps, notes, or generic registry.

## Accepted M0.5 conventions — 2026-10-10

### D-019 — Comparative one-variable kernels before tiny graphs

Insert M0.5 between M0 and M1. Use explicit Gaussian / spin / binomial model and direct / heat-bath / Metropolis sampler unions, sharing references, measurements, worker execution and plots. No universal plugin registry or new dependency is needed. Keep Gaussian conventions and RNG algorithms unchanged. Single spin uses `S(s)=-hs`, `|h|≤10`; binomial uses `S(k)=-hk-log C(n,k)`, `h=log(p)-log1p(-p)`, `log Z=-n log1p(-p)`, `1≤n≤100`, `0.001≤p≤0.999`. These finite teaching ranges exclude singular endpoint fields; PMFs use log combinatorics. K is an aggregate count with degeneracy, not one Bernoulli microstate.

### D-020 — Explicit transitions, warm-up and limited error claims

Gaussian Metropolis uses `x'=x+δ(2u−1)`, `0.01≤δ≤50`. Spin Metropolis proposes staying with probability 1/2 and flipping with probability 1/2, so the zero-field chain is aperiodic. Binomial proposes ±1 equiprobably, mapping out-of-range attempts to self-proposals; the resulting proposal is symmetric. Every Metropolis update consumes one proposal uniform and one acceptance uniform, even on self/automatic-accept steps. Distinguish accepted moves, rejected proposals and deliberate self-proposals; acceptance rate includes accepted self-proposals, and movement rate excludes them.

Direct binomial draws sum n independent Bernoulli draws; single-spin direct and heat bath use the exact two-state probabilities. Single-spin heat bath is an exact resampling kernel with identical rows, hence independent equilibrium draws despite being presented as a heat-bath transition. Do not invent Metropolis acceptance fields for either direct or heat-bath draws.

Metropolis defaults to 200 discarded warm-up updates per new segment, configurable from 0 to 10000; this is a budget, not a mixing guarantee. Direct and single-spin heat bath require zero. Preserve compatible configurations and the RNG stream on parameter/algorithm/proposal/warm-up changes, start fresh segment statistics, and rerun the configured warm-up. If decreasing binomial n excludes the current K, clamp K to the new support and disclose it; incompatible model families start a new session with the selected seed. Reset initializes Gaussian chains at 0, spin at +1, binomial at round(np); these initial states are not measurements.

Extend D-017/D-018’s accumulator-only history with bounded exact transition records. Keep up to eight segments, each with its latest 1000 exact transitions (including warm-up), full online counters/moments/histograms and logarithmic mean checkpoints. Trajectory windows are display-only and gaps/eviction must be disclosed. Global update numbers are algorithmic, not physical time. Independent-Gaussian pointwise bands remain restricted to direct Gaussian segments; other models/samplers show means and exact references without confidence bands. M3 retains autocorrelation-adjusted uncertainty and saved experiment management.

## Accepted M1a conventions — 2026-10-10

### D-021 — Dynamic plot collection (supersedes D-003, D-012 and the fixed-count part of D-016)

Small Systems starts with two active plots, distribution and trajectory, and supports zero to six. Add, remove, collapse, expand and reorder are display-only operations. Each plot selects an observable and visualization; multiple plots can inspect the same target. Six is a provisional UI bound, not a physical-variable bound. Desktop normally uses two columns, with full-width expansion. Phones default to one selected detail and offer a compact single-column overview of all active plots, keeping labels and touch controls readable. There are no reserved empty cards. The graph configuration view remains separate. Historical four-slot delivery records describe M0/M0.5, not the current contract.

### D-022 — Finite graph Ising and exact configuration benchmarks

M1a adds immutable finite domains with stable vertex/edge/face IDs, oriented edges, signed face walks and lattice boundary metadata, separate from drawing coordinates and physical parameters. Preserve all parallel/self records. Presets: single site, open four-site chain, periodic one-dimensional four-site ring, open 2×2 square, star, K4 and periodic 2×2 torus. The torus has eight positive-axis bonds and four oriented plaquettes; the open square has four bonds/one face; generic graphs infer no faces. Editing topology converts to a custom graph and discards lattice/faces. Support 1–4 sites and at most 16 bonds, with finite dimensionless couplings/fields in [−10,10]. These are teaching bounds.

Use `S=−Σ_e K_e s_tail s_head−Σ_i b_i s_i`, weight `exp(−S)`, with inverse temperature absorbed. Every edge contributes once; self-links add constants and zero local flip difference. Enumerate all at most 16 configurations with log-sum-exp normalization. Report log Z, probabilities, site marginals/means, total M, mean m, |M|, total action E=S, pair and connected correlations. E is explicitly dimensionless total action, not an unspecified physical Hamiltonian. Enumeration is independent of sampling. Internal configurations use integer bit codes (bit i=1 means +1); user-facing configuration displays show spins, never codes. Existing scalar spin kernels retain their seeded behavior and are checked against the one-site graph formulas.

### D-023 — Random-site local kernels and bounded observable projections

Local updates choose sites uniformly with replacement. A nominal sweep is N elementary local updates; it need not visit every site. Metropolis then draws a ½-stay/½-flip proposal and an acceptance uniform: three uniforms every update, including self/automatic acceptance. Heat bath uses a site uniform and conditional resampling uniform: two per update, with unchanged resamples counted separately. Unlike isolated single-spin heat bath, graph heat bath is generally correlated and has configurable warm-up (default 200, 0–10000). Direct exact sampling uses one inverse-CDF uniform for a whole configuration and no warm-up. Local Reset initialization is all +1, not a measurement. Direct starts without a sample. Existing M0.5 random streams are unchanged.

The same worker/client protocol and kernels serve Run and Step. Each graph segment owns configuration frequency counts (at most 16), online moments/logarithmic checkpoints for each supported scalar observable, and the existing 1000-record transition ring. All post-warm-up configurations, including rejected and unchanged ones, contribute. Plots project these measurements without replaying or sampling. Counts also support exact-versus-sampled configuration probabilities and correlations. Keep eight segments; no saved experiment manager. Graph traces record selected site, local field and each incident non-self bond contribution, proposal/resampling draws and outcome.

Coupling/field/algorithm changes preserve compatible configurations and RNG, start separate statistics and rerun the configured warm-up. Topology changes explicitly start a new session/reseed, preventing comparison of incompatible variables. Reset clears/reseeds/refits; Fit All and graph/plot selection remain display-only. Parameter segments overlay compatible observables; conditional probability and covariance panels explicitly show the current segment/configuration. MCMC confidence intervals, ESS, cluster algorithms, continuous coupled fields, gauge dynamics and full experiment management remain deferred.

### D-024 — Preset topology with numerical parameter editing (supersedes D-004’s connectivity editor and D-022’s custom-editing UI)

The M1a interface exposes graph/lattice presets and a compact numerical list of individual edge couplings and site fields. Do not implement graphical edge creation/deletion, arbitrary vertex-count editing or vertex dragging. K4 retains six adjustable pairwise weights; setting unwanted weights to zero realizes any simple four-vertex interaction graph without deleting its records. Positive, negative and zero weights are supported and distinguished visually by sign/color, thickness and fading, with numeric labels. Selection, incident-interaction highlighting and actual MCMC-site inspection remain interactive, with touch/keyboard form alternatives.

This simplifies UI scope only. The domain and tests continue to support 1–4 sites, parallel bonds, self-links and signed faces. Preset selection may change topology and starts a fresh session. Coupling/field changes preserve the preset’s topology, including zero weights. The periodic 2×2 lattice always retains eight bond records and four faces; it is never replaced with K4 based on energetic equivalence. User-added topology and arbitrary graph drawing are deferred.

### D-025 — Local mathematical inspection and stable exact/log references — 2026-10-10

Selected site/bond panels are compact, collapsible read-only projections of the current configuration. Preserve unique parallel IDs and display self-links as constant action/zero flip contribution. Conditional probabilities are given current neighbors, not equilibrium marginals. User selections have dark marks distinct from gold latest-update marks. The bond's editing action opens/focuses the existing numerical form; no second parameter draft or alternative Apply path is introduced.

Refine D-022's exact references by pairing global spin reversals: odd site means use pair probability mass × tanh(b·s), with b·s evaluated separately. This enforces exact zero in zero fields without an arbitrary tolerance and preserves tiny nonzero field responses even with large pair actions. M and m derive from the site means; the displayed table and plotted references share this calculation.

Refine D-017/D-018's log-error fitting: use an observable-scale/sample-count floor, `max(σ,0.1)/(125 sqrt(max(2,N)))`, never the minimum positive checkpoint error. Fit All applies the same policy; automatic viewports expand only. Omit zero/below-range positive checkpoints and disclose their counts, break connecting lines, and explicitly label all-zero histories. Show current absolute error and retained N for each segment even when its point is omitted. The floor is a display choice, not a statistical bound. Independent Gaussian RMS/pointwise references remain unchanged; observed MCMC error is not uncertainty or proof of mixing. Exact transition-matrix spectral/autocorrelation/asymptotic-variance diagnostics remain a roadmap proposal.

## Accepted M1b conventions — 2026-10-10

### D-026 — Real-vector graph action and conservative stability

M1b adds a real-valued vector state, separate from numeric single-variable states and Ising bit configurations. The graph domain remains model-independent. Use `S=Σᵢ(aᵢxᵢ²/2+λᵢxᵢ⁴/4−hᵢxᵢ)+½Σₑκₑ(xₜ−xₕ)²`, inverse temperature absorbed. Preserve parallel bonds, oriented IDs/faces, and zero gradient energy from self-links. Support 1–4 vertices with finite `−10≤a≤20`, `|h|≤10`, `0≤κ≤10`, and either `λ=0,a≥0.05` or `0.01≤λ≤10` with negative `a` allowed. These sufficient bounds avoid nonnormalizable and singular Gaussian modes; they intentionally exclude some mathematically normalizable actions. Existing M0 Gaussian behavior and RNG streams are unchanged.

### D-027 — Gaussian benchmark and controlled quartic references

The λ=0 precision `Q` sums every non-self incident κ on diagonals and subtracts each bond on its endpoint off-diagonal. A small Cholesky implementation checks positivity; triangular solves supply `Q⁻¹h` and `Q⁻¹`. Direct whole-vector Gaussian draws solve `Lᵀ(x−μ)=z` for standard normal z. Exact conditional and pair moments are distinct from sampled covariance. Cache immutable small-matrix references by parameter key with a bounded cache. For quartic one-site/independent-site references, use stationary-point partitioning, exponent shift, adaptive Simpson and a convex tail bound through fourth moments. Label these numerical quadrature references, disclose the integration interval/bound and reject unsupported tolerance. Coupled quartic marginals are sampled only; fixed-neighbor conditionals use one-dimensional quadrature but are never labeled as equilibrium marginals.

### D-028 — Local vector updates, bounded measurements and scalar display

Random-site Metropolis uses three uniforms per update (site, proposal, acceptance), with `xᵢ′=xᵢ+δ(2u−1)` and on-site plus incident-edge ΔS. Coordinate Gaussian heat bath uses one site and two Box–Muller uniforms; direct Gaussian samples replace the vector, using two Box–Muller uniforms per site. Run and Step share the worker path. Rejections retain the entire old vector and count after warm-up. N local attempts are a nominal sweep. Up to eight segments each own all retained target moments/histograms/log checkpoints, cross-sums, and 1000 recent exact vector traces/scatter pairs. Targets include individual values/squares, pair products, total/mean field and S. Six dynamic plot views remain display-only. The SVG graph uses a fixed numeric/color scale, selected local bare/conditional mathematics and bond gradient contributions. Parameter changes preserve compatible vector and RNG; topology resets the session. No MCMC ESS or uncertainty estimator is implied.

The M1b plotting refinement uses global-update windows of 100 (default), 500 or 1000 for scalar traces, without reconstructing evicted data or joining segment gaps. Independent Gaussian draws render as points; local chains render as steps with holds and rejection marks. Graphical accepted/rejected Metropolis counts include warm-up and stay segment-specific. Direct Gaussian and coordinate heat bath show acceptance as N/A, because neither has an accept/reject test.

### D-029 — Configuration-only sharing

A version-1 URL query serializes scalar model/domain parameters, sampler and seed. Import validates schema, geometry, finite parameters and sampler compatibility before starting a fresh seeded session. Monte Carlo histories, raw trajectories and measurement datasets are never serialized in this M1b feature. Full experiment provenance/export remains M3.

## Accepted M2 conventions — 2026-10-10

### D-030 — Indexed large-lattice Ising runner and sweep-scheduled measurements

M2 adds a separate indexed rectangular domain and worker runner rather than expanding the 1–4-site graph engine into a universal large-system abstraction. Row-major sites and positive-axis bond records preserve orientation and periodic length-two multiplicity. Int8 spins, precomputed four-slot incidence, incremental physical H/M and full recomputation oracles meet the 64×64 performance target while retaining the M1a exact 2×2 graph representation as an independent benchmark. The new UI uses physical `Jx,Jy,h,T` with `S=H/T`; M1a keeps its beta-absorbed `K,b` convention. Finite signed parameter bounds and 2–64 side lengths are teaching/resource limits, not mathematical restrictions.

Both local samplers draw uniformly selected sites with replacement. Lazy Metropolis consumes three uniforms (site, proposal, acceptance), including deliberate stays; heat bath consumes site and resampling uniforms and reports no acceptance rate. Run and Step call the same transition kernel. One segment-local nominal sweep is N updates; warm-up and stride use whole sweeps, while global update number remains exact. Parameter/sampler/schedule changes preserve spins and RNG, recompute H, and begin isolated measurements with fresh warm-up. Geometry changes and Reset start a seeded session. Eight segments retain full online moments/histograms, bounded log checkpoints and 1,000 recent measurement records; the worker owns the only authoritative spin array. A 4,096-update batch and independent display timer keep rendering out of RNG decisions. Graphical selection and plot settings are display-only. No ESS, confidence bands, cluster algorithm, saved experiment system, or backend is implied.

M2 presents the 2×2 exact M1a enumeration and the infinite-volume ferromagnetic zero-field critical relation under explicitly separate assumptions. It excludes Ly=1 rather than generating vertical self-links or misapplying 2D theory. Nearest-neighbor bond-product plots are postponed until their per-segment normalization and rendering are fully validated; they are not needed for the current core acceptance gate.

## Accepted M3a conventions — 2026-10-11

### D-031 — Physical equilibrium observables and bounded spatial pairs

Extend D-030's measurement record, without changing its update kernel, with every retained `m⁴`, directional bond product and positive-axis displacement pair product. Use `χ=βN(〈m²〉−〈m〉²)`, `U₄=1−〈m⁴〉/(3〈m²〉²)`, and `cV=β²N(〈e²〉−〈e〉²)` for the fixed physical Hamiltonian. The fluctuation formulas use population moments; the separate N−1 sample variance remains labeled as such. Binder is unavailable when its denominator is numerically unusable. Periodic length-two bonds retain parallel multiplicity; open pair averages divide by actual valid origins. Only fully periodic plots subtract the square of the segment's mean m; open and mixed-boundary plots remain raw pair correlations, since a global subtraction can misstate boundary-dependent connected covariance. Cap displacement at four and compute only at retained measurements. No structure factor or fitted correlation length is implied.

### D-032 — Recent-window diagnostics and exact tiny-chain theory

Add a separate 8192-observation ring per retained segment for m, |m| and e/E, preserving order and explicit measurement cadence. Keep full-segment moments/histograms and 1000 recent plot records independent. Worker analyses refresh deterministically by measurement count; snapshots send compact summaries, not all raw observations. The empirical ACF uses lag-specific n−k normalization and a positive-pair/self-consistent window, at most 128 lags; insufficient, constant, drifting, unresolved and window-sensitive cases are explicit. Quote τ in retained observations and convert to nominal sweeps only for local-update or M2 sweep-based sampling. ESS is capped at n for noisy estimates; SE applies only to the recent-window mean and uses n−1 sample variance. Blocking uses nonoverlapping powers-of-two blocks with at least 16 blocks. These diagnostics do not certify equilibrium.

For 1–4-spin graph Ising and M2 2×2, reproduce the actual direct, lazy Metropolis or heat-bath one-update matrix and compare with exact Gibbs probabilities. Reversible symmetric Jacobi diagonalization yields stationary ACF, spectral gap and asymptotic variance at the actual measurement interval; highly concentrated or numerically closed chains report unavailable. This exact equilibrium benchmark is distinct from empirical recent-window uncertainty and is not a mixing guarantee for one run. Preserve M0–M2 RNG/update behavior. Saved experiments, sweeps, full exports and generalized graph editing remain outside M3a.

### D-033 — Pre-merge unit, boundary and pair-cutoff correction

Make diagnostic cadence a tagged numerical value: M2 stores nominal sweeps per observation, graph local samplers store site count for one elementary update per observation, and direct graph sampling stores whole-configuration draws with no local-sweep conversion. Local `τ_sweeps=τ_observations/N`, including the one-site case; M2 `τ_sweeps=τ_observations×strideSweeps`. Exact benchmark τ uses the same observation interval. This corrects the earlier ambiguous `DiagnosticHistory(1)` and shared sweep label without modifying any transition kernel or RNG consumption.

For spatial display, require **both** lattice axes periodic before using `Gα(r)−〈m〉²`. On a cylinder, site means can vary along the open axis even when the selected axis wraps; independent periodic columns can then yield a false positive globally centered value. Open and mixed-boundary plots therefore show raw pair products until site-dependent centering is implemented.

The conventional reversible-chain initial-positive sequence pairs are `Γ_j=γ(2j)+γ(2j+1)`, starting at zero, rather than the earlier shifted pairs `(γ1+γ2),(γ3+γ4),…`. Check only complete pairs, stop before the first nonpositive pair, and seek the first odd complete-pair endpoint satisfying `W≥5 max(½,τ(W))`. A still-positive tail without such a window is unresolved. If a negative pair arrives first, quote a clearly provisional/window-sensitive result only after at least five positive lags and `W≥3 max(½,τ(W))`; otherwise suppress τ/ESS/SE. A negative noisy pair alone is never called convergence. This is a finite-record heuristic, not a guarantee of stationarity.

## Accepted M3b1 conventions — 2026-10-11

### D-034 — Read-only segment capture and portable in-memory archive

Add a third mounted Experiments workspace and preserve both live simulation sessions while navigating. A saved record represents **one** parameter segment. Numerical payloads are copied from a paused, idle worker at an acknowledged run/version boundary, while annotations remain separately editable. Routine Run snapshots retain their compact behavior; on-demand capture copies graph/lattice Ising's ordered M3a 8192-observation rings, or the available recent Small Systems transitions. A historical segment has no invented final configuration. Capturing consumes no RNG, changes no model state, and stale request IDs/versions cannot commit an old reply.

The authoritative portable file is a validated JSON `lattice-lab-experiments` bundle with `schemaVersion:1`, stable scientific dataset IDs, local library IDs, and explicit source workspace/run/segment, model/domain/settings, seed, initialization, update/count/coverage, diagnostic status, capture timestamp and build revision or `unknown`. A parameter-changed inherited-state segment is snapshot-only, not reproducible from the final settings and original seed alone. Imported duplicate scientific IDs remain distinct local copies without overwriting provenance. Validate the complete bundle before mutation; reject oversize/inconsistent/non-finite data. Cap the memory library at 16 records and 12 MiB, with a 16 MiB file-input limit; never silently evict. CSV measurements, metadata sidecar and aggregate summary are derived exports. No automatic persistence, backend, upload, or history-bearing URL is introduced. Existing scalar configuration-only links retain their meaning. Automated sweep execution and parameter-axis plots remain M3b2.

## Accepted M3b2 conventions — 2026-10-11

### D-035 — Independent bounded Ising sweeps and portable manifests

M3b2 uses a dedicated sequential worker. Every point constructs a fresh M2 `LatticeRun` with a deterministic indexed seed, independent initialization, warm-up and stride; a parameter sweep is not a quench trajectory. The editable plan has 2–12 ordered values, at most 8192 measurements per point and 10 million elementary updates total. Completion captures the final read-only M3a analysis without updating state or RNG. Pause/Resume retain the worker point; Cancel discards only the partial point and keeps completed records.

The pre-merge worker-protocol correction makes repeated Pause/Resume idempotent and invalid controls recoverable. Each completed point has one pending `(sweep ID, point index)` archival identity; ACK must name it. The UI retains the committed dataset identity on retry, so a failed ACK send cannot append a second record. Terminal replies are single-shot and only follow genuine completion, cancellation or fatal failure. Cancellation while waiting for an ACK preserves the staged completed capture for archival and prevents any further updates.

Keep M3b1's immutable point datasets and 16-record/12 MiB in-memory limits. A version-2 JSON envelope contains a sweep manifest referring to those records, with explicit per-point plan, seed, status, work count and dataset ID. Version-1 imports remain valid. Validate the complete envelope atomically, reserve capacity before Start, and stage a completed capture in memory if a concurrent archive change prevents saving it. Imported sweeps are read-only until their plan is explicitly copied. Comparison uses numeric parameter spacing and only labels the theoretical infinite-volume Tc for the isotropic Jx=Jy=1, h=0 temperature configuration. CSV is derived and uses M3b1 formula-text protection. No backend, persistent job scheduler, automatic fit or later model is introduced.

## Accepted M4a1 conventions — 2026-10-11

### D-036 — Readable massive Gaussian lattice-field foundation

M4a1 extends the merged source-readability policy in `AGENTS.md` rather than replacing the source guide or rewriting older kernels. A distinct Fields & Paths worker owns a real field configuration, seeded RNG, parameter segments and bounded measurements; the fourth mounted workspace only schedules and displays snapshots. Geometry, action, dense reference, transitions, run, and React views live in separate modules with equations and small independent tests.

A 1D chain is explicit, not a 2D `Ly=1` special case. A 2D rectangle uses row-major sites and positive-axis bond records, with open sides omitting wraps and periodic length-two axes preserving parallel records. Supported shapes are 1D length 2–64 or 2D sides 2–8, at most 64 sites. Every supported lattice has a dense finite-volume Cholesky reference, so UI selection never has to imply an unavailable exact covariance. These are conservative teaching and resource limits; they can be revisited after measured performance evidence.

The dimensionless action is `S=rΣφᵢ²/2+Σ_bκ_b(φ_tail−φ_head)²/2−jΣφᵢ`, ordinary measure `∏dφᵢ`, with `0.05≤r≤20`, `0≤κx,κy≤10`, `|j|≤10`. Thus `Q=rI+` weighted bond Laplacian is positive definite without a zero-mode convention. The exact finite-volume reference computes `μ=Q⁻¹j1`, `C=Q⁻¹`, and log Z from the Cholesky diagonals, checking `QC≈I`. The coefficient `r` is not an oscillator particle mass. Fourier and massless cases are M4a2, not hidden options here.

One direct whole-field draw uses two seeded Box–Muller uniforms per component and has no acceptance or local-sweep unit. Random-site coordinate heat bath uses site plus two normal uniforms; random-site Metropolis uses site, symmetric-uniform proposal and acceptance uniforms, including on rejection. `N` local updates form a nominal sweep. Run and Step use the same transition function. Direct draws measure immediately; local samplers use segment-local whole-sweep warm-up and stride. A changed parameter or sampler on fixed geometry retains configuration/RNG but starts isolated aggregates; geometry change and Reset start a new seeded session. Full online moments and all pair-product sums span each segment, while only 256 recent full field vectors per segment are retained for plotting. Local-chain means receive no independent-sample uncertainty. M4e will define any portable archive extension; M3b1/v2 files remain unchanged.

### D-037 — Fixed, disclosed field visualization scale

The 1D profile and 2D heatmap use a visible user-controlled symmetric display range. Values outside it are clipped with a count and explicit disclosure; applying physical parameters does not silently recolor the same value. Site and pair selection, scale edits and history browsing are display-only. Exact conditional means are labeled as fixed-neighbor laws, separate from equilibrium marginal covariance. The pair table juxtaposes exact finite-volume and segment-specific sampled estimates without treating a finite chain trajectory as independent observations.

## Accepted M4a2 conventions — 2026-10-11

### D-038 — Explicit measure support and reference selection

An omitted field-measure discriminator means the M4a1 ordinary massive Gaussian, preserving prior configurations and dense sampling behavior. The separate mean-zero measure sets `r=j=0`, requires full periodicity and strictly positive active stiffness, and uses induced Euclidean measure on `Σφ=0`. Its covariance is `Q⁺`; its log partition has `N−1` Gaussian dimensions, not the delta-function normalization. Only spectral independent sampling preserves this support in M4a2. Switching between ordinary and constrained support starts a new seeded session in both UI and engine; same-support changes continue as isolated segments. Dense Cholesky never receives a singular constrained precision.

### D-039 — Finite DFT and bounded spectrum inspection

Periodic modes use row-major indices and a forward DFT without scale, inverse with `1/N`. Real white noise, generated with the existing uncached Box–Muller rule, supplies conjugate-paired coefficients; filtering by `1/√λ` preserves a real field. The massless constant coefficient is removed and residual mean projected away. A spectral draw uses `2N` uniforms, no warm-up or acceptance test. Open and mixed massive fields retain the dense reference because a periodic DFT does not diagonalize their precision. Spectrum views derive selected full-segment power from existing pair aggregates, avoiding another sample history or RNG use. The zero mode is marked removed rather than shown as infinite.

## Accepted M4b conventions — 2026-10-11

### D-040 — Physical oscillator adapter on the existing Gaussian worker

The harmonic path is a separate typed model within Fields & Paths, with ℏ=kB=m=1, `a=β/N`, ordinary periodic measure and `r=aω²`, `κ=1/a`, `j=0`. Its physical bounds are `N=4–64`, `β=2–16`, `ω=0.25–4`; M4a's standalone field UI coefficient bounds remain unchanged. A validated oscillator adapter reuses the field action, spectral reference and original transition kernels. The positive constant mode is retained. Switching models or changing N starts a seeded session; changing β, ω or sampler at fixed N preserves the path and RNG but isolates all measurements in a new segment. No archive schema change accompanies M4b.

### D-041 — Time, normalization and bounded correlator evidence

Euclidean coordinate time `t=ℓa` is never a Monte Carlo update or physical real time. Full-segment pair-product aggregates, not the 256 most recent path vectors, give the uncentered translation average `N⁻¹Σ_j〈x_j x_(j+ℓ)〉`. Exact symmetry makes the equilibrium mean zero, but individual paths are never de-meaned. Show the exact lattice correlator/gap alongside continuum thermal theory. Display a sampled cosh effective gap only after 64 retained paths in the current segment and when its arcosh is real; label it provisional and uncorrected, with no unsupported uncertainty. A 64-path count is not an equilibration or effective-sample-size guarantee. The raw product-Lebesgue Gaussian integral differs from the quantum trace by `(2πa)^(-N/2)`. The symmetric Trotter transfer kernel, its analytic finite-spacing spectrum, a bounded positive-weight coordinate quadrature and small reflection Gram matrices are distinct teaching calculations. Operator positivity follows from the factorization; numerical Gram checks only illustrate reflection positivity and are not a proof of the full OS axioms. Classify the fixed-grid quadrature against the analytic gap (>5% relative discrepancy) and leading eigenvalue bound, disclose numerical failure, and retain its approximate value even when under-resolved. The path scale is fixed and clipping disclosed. Interacting oscillators, HMC and persistence remain later decisions.

## Accepted M4c0 conventions — 2026-10-11

### D-042 — Separate mounted QM and Fields workspaces

The five top-level destinations are Small Systems, Lattice Systems, Lattice QM, Lattice Fields and Experiments. `#lattice-qm` is explicit; `#fields-paths` remains a compatible link to Lattice Fields. QM and Fields use separate `FieldClient` and worker instances, although they reuse the same Gaussian mathematical modules. Their components remain mounted while hidden, so navigation preserves configurations, parameter segments, RNG streams and local view choices without pausing a run. Changing a model or geometry within a workspace keeps the existing M4a/M4b reset semantics. This separates Euclidean-time path teaching from spatial Gaussian fields without imposing a one-coordinate-per-site rule on future models.

### D-043 — Bounded, display-only teaching tools

QM and Fields each use one Run/Pause control and a local six-card tool deck. A tool is a named, model-specific visualization, plot or analysis, not a programmable plugin. Add/change, collapse/open, expand, reorder, remove, phone detail/overview and viewport choices operate only on React presentation state; worker measurements remain unconditional and unchanged. Optional finite-grid oscillator quadrature is computed only when an open transfer card renders and is cached by validated physical parameters. A hidden workspace retains its mounted worker, but unselected or collapsed expensive analysis does not run. A posted batch may finish after Pause. The older Small Systems and Lattice Systems plot galleries retain their working internals in this milestone.

### D-044 — Full-width featured assignment for QM and Fields

Stage A gives each of QM and Fields one always-visible, full-width featured assignment above an optional gallery of at most six cards. A tool ID names a model-specific renderer; a unique assignment key names one placement, so the same tool type may appear in multiple places. An explicit featured-selector choice replaces the tool in that placement. A card's Feature action instead exchanges the two whole assignments, preserving their keys and presentation settings without silently evicting a card at gallery capacity. Ineligible analyses remain gallery-only. Desktop retains two gallery columns; phone retains single-detail and compact-overview modes below the featured display.

React can remount a tool moved between containers. Persistent Fourier mode selection therefore belongs to its keyed assignment in the Fields workspace, and removed assignments release that state. Other persistent viewport, time-lag and site choices remain owned by the corresponding workspace. All these operations read existing snapshots only: they do not post update commands, consume random numbers, reset a segment, or change worker ownership. Inactive or collapsed transfer analysis remains lazy and cached. This is a presentation pilot, not a universal tool registry or a migration of Small Systems, Lattice Systems or Experiments.

## Accepted model-page Stage B conventions — 2026-10-12

### D-045 — Direct, model-ordered gallery additions and contextual display controls

In QM and Fields, Add tool immediately creates one card. A small pure helper takes the page's existing tool order and, where known, a list of currently suitable views. It first chooses a suitable type absent from both the featured position and gallery; after exhausting those types it chooses a useful duplicate. Applicability affects only this default, not explicit choices in a card selector. Six is the gallery limit regardless of the featured assignment. A newly added card becomes the active phone detail. Replacing the featured tool retains its placement key; Feature exchanges whole keyed assignments. A persistent display range, comparison site, effective-gap lag or Fourier momentum follows that key across exchange. The selected field site is intentionally shared across relevant tools. None of these presentation operations posts numerical commands.

The model-page hierarchy keeps a concise action and conventions above collapsible parameter drafts in the sidebar, with Run/Pause/Step/Reset and readings, full-width featured display, diagnostics gallery, collapsible technical details and short mathematics/exercises in the main column. One open gallery card spans the desktop grid; two or more open cards use two columns. Quiet action styling retains named controls, visible keyboard focus and touch-size targets. Optional numerical analyses remain selectable tools and are activated only by an open body. Small Systems, Lattice Systems and Experiments retain their existing layouts until separate migrations.

### D-046 — Deferred Small Systems display-control labels

The present Small Systems **Fit All** operation recomputes viewport axes from retained segments and analytical references without changing samples or model parameters; axes otherwise tend to grow rather than shrink. In the later Small Systems migration, label this operation **Refit axes** and explain that it only changes the display, not numerical parameter fitting. The current global Histogram checkbox affects sampled histogram overlays on all distribution cards. A future migration should give each applicable card its own histogram choice keyed by assignment, including separate states for repeated distribution views. Stage B does not change those existing controls or their scientific projections.

## Accepted Lattice Systems model-page Stage C convention — 2026-10-12

### D-047 — Preserve the Ising canvas and scientific projections as independent teaching tools

Lattice Systems adopts the QM/Fields model-page hierarchy. The existing interactive square-lattice spin canvas is extracted into one renderer and featured by default; the two default gallery cards show signed magnetization and physical energy density against nominal sweeps. The original 16 plot IDs and their model-specific projections remain available as zero to six optional cards in the existing `ToolDeck`. The 2×2 exact reference, full-segment finite observables, M3a statistical readout, parameter segments and measurement coverage remain below the gallery in collapsible technical details. The local transition inspector remains near Run/Pause and Step. This changes presentation, not Hamiltonian, transition kernels, worker measurements, archive data or sweep commands.

The selected canvas site belongs to the Lattice Systems workspace so it survives a feature/gallery exchange; selection does not flip a spin or consume randomness. The synchronized 100/500/1000 nominal-sweep history window belongs to the Lattice Systems presentation adapter and appears only when an active history tool needs it. Separate spatial displacement choices belong to keyed spatial-tool assignments and follow them across exchanges. React may remount a renderer when moved; the worker snapshot remains authoritative. Tool edits, viewport navigation and collapse state cannot change sampling or merge parameter segments. The finite lattice's fully periodic connected-versus-open/mixed raw spatial-correlation convention, exact 2×2 bond multiplicity and conditional infinite-volume critical-temperature label remain intact. Small Systems and Experiments are not migrated by this decision.

## Accepted Small Systems model-page Stage D1 convention — 2026-10-12

### D-048 — Keep numerical ownership while standardizing elementary and graph-Ising presentation

The Gaussian, single-spin, binomial and finite graph-Ising pages use the same one-featured-plus-six-gallery assignment system as the other model pages. Elementary models feature their exact distribution and start with a trajectory card; graph Ising features its interactive, read-only topology/configuration and starts with magnetization distribution and trajectory cards. The existing seven Small Systems scientific renderers remain the sole implementations of these plots. Connected correlation and local conditional views are offered only for graph Ising. A graph plot's observable and a distribution card's empirical-histogram choice belong to its keyed presentation assignment; a feature/gallery exchange preserves them. Refit axes replaces the old Small Systems Fit All label and recomputes display bounds only. The real scalar graph keeps its legacy inspector and Fit All label until Stage D2.

Graph visualization/selection and local inspection are separate from the sidebar's numerical coupling, field and topology editor. The selected site and edge belong to the mounted Small Systems workspace, so remounting the graph visualization never selects a new numerical state. Draft parameters still apply through the established `applyGraph`/topology-key path: compatible values begin isolated segments while topology changes start seeded sessions. The worker, RNG, exact calculations, capture/archive formats, periodic multigraph edges and faces remain unchanged. Existing graph presets remain accessible; the named-example catalog and edge-presence editing wait for Stage D3.

## Open decisions

- Whether later plots need a charting or UI component library beyond M0's native controls and small SVG plot.
- Exact supported performance target for a low-end phone, to be measured rather than guessed.
- Whether advanced graph editing supports explicit addition/removal of oriented faces in the initial release (presets will include faces).
- How many concurrent saved run datasets can be held in memory before asking users to export.
- Whether presets and configuration-only URL sharing precede full dataset import.
- Choice of project software license and separate documentation license, if desired.
