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

## Open decisions

- Whether later plots need a charting or UI component library beyond M0's native controls and small SVG plot.
- Exact supported performance target for a low-end phone, to be measured rather than guessed.
- Whether advanced graph editing supports explicit addition/removal of oriented faces in the initial release (presets will include faces).
- How many concurrent saved run datasets can be held in memory before asking users to export.
- Whether presets and configuration-only URL sharing precede full dataset import.
- Choice of project software license and separate documentation license, if desired.
