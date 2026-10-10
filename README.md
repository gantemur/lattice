# Lattice Lab

**Status:** M0 and M0.5 are merged. M1a — Interactive Small Graphs and Exact Ising Models is implemented on its feature branch; validation and limits are tracked in the [roadmap](docs/ROADMAP.md). M1b and later remain planned.

Lattice Lab is a browser-based laboratory for teaching and small-scale exploration of statistical mechanics, Euclidean lattice quantum mechanics, and lattice field theory. Its emphasis is on mathematical structure, observable quantities, transparent algorithms, and comparisons with exact results.

The repository is [gantemur/lattice](https://github.com/gantemur/lattice), independent of [SOL](https://gantemur.github.io/sol/). The GitHub Pages URL is [gantemur.github.io/lattice/](https://gantemur.github.io/lattice/). The product name remains **Lattice Lab**.

## New in M1a

Explore **one to four interacting Ising spins** on a single site, open/periodic four-site chain, open 2×2 square, star, K4 or true periodic 2×2 square lattice. The torus has **eight distinct bonds and four oriented faces**; dashed wrap bonds remain separately selectable. A lightweight SVG graph view is separate from scientific plots. Select a site or bond directly or through accessible selectors; edit individual fields/couplings numerically in a compact list. K4’s six pairwise couplings can realize any simple four-site interaction graph by setting unwanted weights to zero. No graphical topology creation/deletion or dragging. Changing geometry presets starts a fresh session; weight edits retain every bond/face record.

The action is `S=−Σ_e K_e s_tail s_head−Σ_i b_i s_i`, weight `exp(−S)` (beta absorbed). Support positive, negative and zero K and b in [−10,10]. The numerical domain accepts at most 16 distinct bonds; the UI preserves preset topology. Every bond contributes separately; self-links add constants and zero spin-flip difference. Exact enumeration of at most 16 configurations provides log Z, full configuration probabilities, site marginals, magnetization/energy distributions, moments and correlations immediately.

- **Samplers:** direct independent exact configuration draws, local lazy Metropolis and local heat bath. Local updates choose sites uniformly with replacement; N elementary attempts are one nominal sweep, not physical time. Metropolis uses site/proposal/acceptance uniforms; graph heat bath uses site/resampling uniforms. Step shows the actual site, incident contributions, draws and resulting configuration.
- **Dynamic plots:** two defaults, distribution and trajectory (total M for graph Ising). Add, remove, collapse, expand or reorder **zero to six** independently selected views. Desktop normally uses two columns; phone uses one detail plot or a compact overview. Six limits the interface, not model size. Select a site and use “Plot selected spin” to inspect it.
- **Graph observables:** M, m=M/N, |M|, total dimensionless action E=S and each spin; distributions, exact/sample running means, trajectories, local conditionals and connected correlations. Configuration probability tables show exact and sampled masses. Local conditionals are explicitly distinct from equilibrium marginals.
- **Measurements:** local warm-up defaults to 200 updates (0–10000), excluded from all estimates; a fixed budget is not a mixing guarantee. Coupling/field/sampler changes preserve compatible configurations/RNG and create separate segments. Topology changes explicitly restart/reseed. Reset clears/reseeds/refits; Fit All is display-only. Eight segments retain 1000 exact transitions each plus full configuration counts and bounded per-observable summaries. No MCMC confidence bands, ESS or saved-run manager.

[Review notes and screenshots](docs/M1A_REVIEW.md) record the numerical and desktop/phone validation. M1b continuous-variable models, larger lattices, gauge dynamics and cluster algorithms are deferred.

## Preserved single-variable laboratory

Choose a probability model and its sampling algorithm independently:

| Model                                 | Exact reference                                           | Sampling methods                                           |
| ------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------- |
| 0D Gaussian, `S(x)=a x²/2−h x`        | Mean `h/a`, variance `1/a`, normalized density, log Z     | Direct Box–Muller; uniform random-walk Metropolis          |
| Single Ising spin, `S(s)=−hs`, `s=±1` | Two-state enumeration; mean `tanh h`, variance `1−tanh²h` | Direct; heat bath; lazy spin-flip Metropolis               |
| Binomial count, `K=0,…,n`             | Exact PMF, mean `np`, variance `np(1−p)`, log Z           | Direct sum of Bernoulli draws; nearest-neighbor Metropolis |

All actions are dimensionless, with target proportional to `exp(−S)` and no extra β. Binomial K aggregates n Bernoulli variables; its action includes the combinatorial degeneracy. Discrete distributions use probability-mass bars. Supported teaching ranges: Gaussian `0.05≤a≤20`, field `−10≤h≤10`, binomial integer `1≤n≤100` and `0.001≤p≤0.999` (finite log-odds). Exact references use stable centered densities, log combinatorics and log partition functions.

- **Dynamic plot collection**, shared with graph Ising: two default distribution/trajectory plots, optional running mean, absolute error and acceptance views; graph and display state remain independent.
- **Run/Pause/Step inspection:** the same worker kernel and seeded stream drive batches and single steps. Metropolis displays before/proposed/result states, ΔS, acceptance probability, uniform draw and accepted/rejected/self outcome. Direct draws have no invented acceptance test; single-spin heat bath shows its exact probability and resampling draw.
- **Sample trajectories:** direct draws are unconnected points; chain states use steps, including repeated states after rejection. Crosses mark rejections, squares self-proposals, faint marks warm-up. Browse windows of 100, 500 or 1000 global algorithmic updates, with optional exact mean/distribution-scale references. Update number is **not physical time**.
- **Separate histories:** Apply preserves compatible configurations, the RNG stream and earlier segment estimates. Target, algorithm, proposal or warm-up changes start a labeled segment. A model-family change explicitly starts a new session. Decreasing binomial n clamps an excluded K to the new support, with notice.
- **Stable axes:** physical-value axes expand without automatic recentering on Apply. Fit All changes only the viewport. Trajectory windows can follow recent updates or inspect earlier retained history. Reset clears histories, refits plots, and restarts applied settings with the **Seed on Reset** field.
- **Local mathematics:** reusable KaTeX HTML + MathML components render formulas with bundled fonts. Expand optional model notes and suggested experiments when useful.

## Sampling and measurement conventions

Gaussian Metropolis proposes a uniform displacement in `[−δ,δ]`, with `0.01≤δ≤50`. Spin Metropolis proposes a stay or flip with equal probability, avoiding the period-two zero-field deterministic-flip chain. Binomial proposes ±1 equally and maps out-of-range attempts to self-proposals; this preserves a symmetric proposal at the endpoints. Every Metropolis update consumes one proposal uniform and one acceptance uniform, even when automatically accepted. Acceptance includes self-proposals; the separately displayed movement rate excludes them. Counters include warm-up.

Metropolis defaults to **200 discarded warm-up updates per new segment**, configurable from 0 to 10000. This budget does not guarantee mixing. Direct samplers need none. Single-spin heat bath also generates independent equilibrium draws: its resampling law does not depend on the old spin. After warm-up, every update—including rejection/self states—enters moments and histograms. Sample variance uses N−1, which does not remove finite-chain correlation bias.

Only **direct Gaussian** segments show the known-variance `μ±σ/√N` envelope (about 68% coverage at fixed N) and optional `σ N^(-1/2)` RMS error reference. These are not simultaneous confidence bands or promises of monotone error reduction. Metropolis plots show the running mean and exact reference without independent-sample bands. Autocorrelation-adjusted errors and ESS are deferred to M3.

Each of the latest **eight segments** keeps its settings, start index, update/warm-up/acceptance counters, moments, histogram, logarithmic mean checkpoints and latest **1000 exact transitions**. Older transitions and then old segments are removed with disclosure; full segment statistics survive transition eviction. Gaussian histograms use 32 bins over each segment’s `μ±4σ`, with explicit tails included in normalization and moments. Discrete histograms have one bin per state. Checkpoints follow `n₀=1`, `nₖ₊₁=ceil(1.125 nₖ)`, at most 320 plus the latest endpoint, using retained measurement count only.

Mulberry32 midpoint v1 remains the RNG. Direct Gaussian Box–Muller v1 still consumes exactly two uniforms per draw; spin direct/heat bath uses one, direct binomial uses n, and Metropolis uses two per update. Reset initializes chains at 0 (Gaussian), +1 (spin), or round(np) (binomial); initialization is not a measurement. Reproducibility requires the same seed, settings/update sequence, algorithm and build; browser transcendental functions can differ in their last bits. Run posts batches of 128 with at most one in flight. Apply and Pause respect the batch acknowledgment boundary. Plotting, history browsing, snapshot frequency and Step inspection never consume RNG values.

**Planned:** quartic/coupled continuous variables, larger lattice systems, gauge dynamics, saved experiments and exports. A future periodic 2×2 gauge lattice has eight oriented link variables, independent of the number of chosen plots.

## Read first

1. [Living specification](docs/SPECIFICATION.md): intended behavior, mathematical conventions, and current implementation limits.
2. [Development roadmap](docs/ROADMAP.md): staged delivery and acceptance gates.
3. [Design decisions](docs/DECISIONS.md): rationale and history.
4. [Agent instructions](AGENTS.md): contributor workflow.

## Develop and validate

Use Node.js **24 or newer** (Node 24 is used in CI) and npm. A lockfile pins dependencies.

```sh
npm ci
npx playwright install chromium webkit
npm run dev
```

Open the printed local URL with `/lattice/`, normally `http://localhost:5173/lattice/`.

```sh
npm run typecheck
npm test
npm run build
npm run test:browser
npm run format:check
# All five checks, in order:
npm run check
```

Browser tests serve the **production build**, so run `npm run build` before `npm run test:browser`. Tests cover desktop Chromium, a 360px phone in Chromium, and an emulated iPhone in WebKit, including landscape, keyboard interactions, thousands of updates followed by Step/resume, all models, warm-up/inspection, trajectory browsing, seed replay, parameter switching, segment isolation, stable axes, Reset/Fit All, plot assignment/rearrangement, local math/fonts, and subpath/worker loading. These are emulated browser tests, not measurements on physical phones. On Linux, install browser system dependencies with `npx playwright install --with-deps chromium webkit`.

`npm run format` formats source/configuration files and README; existing design documents retain their established formatting. `npm run preview` serves `dist` locally at `http://127.0.0.1:4173/lattice/`. Test screenshots and traces are written to ignored `test-results/`.

## Architecture and deployment

TypeScript + Vite + React, native accessible form controls, small SVG plots, locally bundled KaTeX (including fonts), and one browser Web Worker. Runtime packages are React, React DOM, and KaTeX. No backend, accounts, telemetry, CDN assets, plotting framework, or persistent service.

- `src/domain/`: finite graph/cell topology, stable incidence IDs, seven presets and separate drawing coordinates.
- `src/models/`: scalar and finite Ising model union, actions, local differences, validation, exact densities/masses and independent enumeration.
- `src/algorithms/`: seeded RNG, direct/heat-bath/Metropolis kernels and discriminated transition traces; no UI dependencies.
- `src/observables/`: online moments, histogram counters, and bounded convergence checkpoints and exact transition rings.
- `src/engine/`, `src/workers/`: authoritative run state, typed messages, stale-run handling, and bounded scheduling.
- `src/app/`, `src/plotting/`: input/display state, dynamic plot assignments, stable viewports, and reusable SVG plotting.
- `src/ui/`: reusable inline/display math with HTML + MathML output.

Vite uses **`base: '/lattice/'`** in development and production. Navigation uses hash anchors, so `/lattice/#small-systems` can load directly or reload on GitHub Pages without server rewrites.

[CI/Pages workflow](.github/workflows/ci-pages.yml) validates pull requests and pushes to `main`. It uploads and deploys `dist` **only from `main`, after validation passes**. Hosting uses **Settings → Pages → Source → GitHub Actions**. M0/M0.5 are merged; an approved M1a merge and successful workflow are required to publish this feature branch. This follows the [Vite Pages guide](https://vite.dev/guide/static-deploy.html#github-pages) and [GitHub publishing documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site). Feature-branch validation does not establish that the live site is deployed; the live URL and hash reload must be checked after deployment.

## License

**To decide before the first public release.** No license has yet been selected; do not assume permission to reuse code or documentation until an explicit license is added.
