# Lattice Lab

**Status:** M0–M4d2 and the model-interface architecture audit are released to main. M5a Z₂, M5b compact U(1) and M5c Potts are released to main with verified Pages deployment. M5d FK/Edwards–Sokal and Swendsen–Wang have passed hosted validation and Pages/live checks; release evidence and final documentation-head verification are recorded in the M5d review. Model-page Stages A–E unify the current workspaces; the 1D Ising chain extends Lattice Systems with a spatial transfer-matrix reference.

Lattice Lab is a browser-based laboratory for teaching and small-scale exploration of statistical mechanics, Euclidean lattice quantum mechanics, and lattice field theory. Its emphasis is on mathematical structure, observable quantities, transparent algorithms, and comparisons with exact results.

The repository is [gantemur/lattice](https://github.com/gantemur/lattice), independent of [SOL](https://gantemur.github.io/sol/). The GitHub Pages URL is [gantemur.github.io/lattice/](https://gantemur.github.io/lattice/). The product name remains **Lattice Lab**.

## M5d FK clusters and Swendsen–Wang

The existing Potts laboratories now offer exact tiny FK joint draws and whole-lattice Swendsen–Wang trajectories for h=0 and nonnegative physical couplings. One **FK clusters and Potts colors** launcher exposes distinct physical bonds, canonical component labels, spin colors, exact partition/connectivity identities and genuine sampled cluster statistics. SW warm-up and stride count whole trajectories; old local sweep conventions and seeded streams remain unchanged. See [mathematics](docs/math/fk-edwards-sokal.md) and [M5d review](docs/M5D_REVIEW.md). No new workspace, archive format, antiferromagnetic FK rule or independent-sample error claim is introduced.

## M5c categorical Potts models

Small Systems → **Small Potts systems** offers a dimer, antiferromagnetic triangle and periodic 2×2 torus. **Lattice Systems → 2D Potts** supports q=2,3,4 on bounded open/periodic rectangles. Both use one Potts implementation with independent worker sessions, signed dimensionless interactions, lazy Metropolis/heat bath, eligible exact independent draws, color/order/action measurements and raw equality correlations. Tiny exact references include the complete q=2 Ising normalization. See [mathematics](docs/math/potts-model.md) and [M5c review](docs/M5C_REVIEW.md) for numerical evidence, limits and release gates. Existing model sessions and archive formats are unchanged; M5d adds the eligible FK representation described above.

## M5b compact U(1) gauge theory

Small Systems → **Small gauge systems** now also offers compact U(1) on the open plaquette and periodic 2×2 torus. Canonical link angles, signed holonomies, local angular Metropolis, paused worker-owned vertex transformations, separate parameter segments and complex invariant measurements use an independent U(1) worker. Controlled Bessel/character references use normalized Haar measure, with Z(0)=1; open plaquette and continuous winding histograms distinguish theory from correlated samples. The five routes and all existing engines/archives remain compatible. See [mathematics](docs/math/u1-gauge.md) and [M5b review](docs/M5B_REVIEW.md) for validation and release status.

## M5a tiny Z₂ gauge theory

Small Systems → **Small gauge systems** offers a single open plaquette and the genuine periodic 2×2 torus, with four and eight physical link variables respectively. A dedicated seeded worker samples the dimensionless plaquette action using exact independent draws or lazy random-link Metropolis. Select oriented links, faces, vertices and Wilson loops; preview and apply a worker-owned gauge transformation while paused. Exact enumeration and independent analytical references accompany isolated parameter-segment statistics and bounded histories. No new top-level workspace, legacy engine change or gauge archive is introduced. See [mathematics](docs/math/z2-gauge.md) and [M5a review](docs/M5A_REVIEW.md).

## Configurable model pages (Stages A–D3)

Lattice QM, Lattice Fields, Lattice Systems, and all current Small Systems models show one configurable, full-width featured display above up to six optional gallery cards. Their default features are the Euclidean path, spatial field configuration, 2D Ising spin canvas, elementary exact distribution, small interactive Ising graph, and real scalar configuration, respectively. **Add tool** immediately opens an unrepresented useful view when available; its own selector can change the view. A gallery card's **Feature** action swaps whole assignments, while the featured selector replaces only the featured tool. Tool-specific display controls follow keyed assignments across exchanges. One open gallery card fills the desktop row; multiple cards use two columns. Phones retain single-detail and compact-overview modes. Technical details and short mathematics/exercises are collapsible below the gallery. These choices affect only presentation, not worker sampling or measurements. See the [Stage A](docs/FEATURED_STAGE_A_REVIEW.md), [Stage B](docs/MODEL_PAGE_STAGE_B_REVIEW.md), [Stage C](docs/MODEL_PAGE_STAGE_C_REVIEW.md), [Stage D1](docs/MODEL_PAGE_STAGE_D1_REVIEW.md) and [Stage D2](docs/MODEL_PAGE_STAGE_D2_REVIEW.md) reviews. [Stage D3](docs/PEDAGOGICAL_CATALOG_D3_REVIEW.md) adds the grouped Small Systems example chooser. [Stage E](docs/CUSTOM_ISING_GRAPH_STAGE_E_REVIEW.md) adds **Custom Ising graph (2–4 spins)** in Advanced examples: each simple pair has an explicit presence choice and signed coupling, so a present zero-weight bond remains distinct from an absent bond. Advanced K4, open chain and torus geometries remain accessible with their original topology.

## 1D classical Ising chain

In **Lattice Systems**, choose **1D Ising chain** to run an open chain of 2–64 spins or a periodic ring of 3–64 spins. The existing local Metropolis and heat-bath worker handles sampling with physical J, h and T. A dedicated spin-chain view, exact-versus-sampled spatial-correlation plot and configurable ToolDeck connect full-segment measurements with exact finite-length results from a scaled 2×2 transfer matrix. The bulk correlation length is labeled separately from finite-chain correlations and Monte Carlo mixing. There is no finite-temperature phase transition in this nearest-neighbor one-dimensional model. See the [mathematics guide](docs/math/ising-chain-transfer.md) and [implementation review](docs/ISING_CHAIN_REVIEW.md).

## M4c1 interacting Euclidean QM

Lattice QM can select a separate periodic quartic/double-well oscillator with editable N, β, r, λ, h and local Metropolis settings. Presets cover the Gaussian limit, single-well quartic, symmetric double well and tilted double well. A full-width periodic path and optional potential, full-segment correlator, transfer spectrum, effective-energy, path-average history and transition tools distinguish Euclidean time from algorithmic updates. The independent transfer analysis runs lazily in another worker, compares three coordinate quadratures, and withholds a trusted gap when resolution checks fail. Local-chain warm-up is only a budget; sign changes of whole-path averages diagnose possible sampling metastability, not physical tunneling. See [mathematics](docs/math/interacting-oscillator.md) and [M4c1 review](docs/M4C1_REVIEW.md).

## M4d1 interacting spatial φ⁴

**Lattice Fields** now separately selects an interacting φ⁴ measure on open/periodic 1D chains and 2D rectangles. Local Metropolis preserves every geometric bond, including length-two periodic parallels. Configurable tools show spatial x/y correlations, fixed-neighbor quartic inspection, retained history, actual proposals and full-segment scalar moments. Reference tools distinguish the analytic Gaussian limit, independent-site quadrature, and a lazy finite-ring transfer computation through the exact periodic-chain/QM action correspondence. The ordinary constant mode fluctuates; this is separate from the constrained Gaussian GFF. M4d2 adds HMC below; field archive schemas remain unchanged. See [spatial mathematics](docs/math/spatial-phi4.md) and [M4d1 review](docs/M4D1_REVIEW.md).

## M4d2 spatial Hamiltonian Monte Carlo

The interacting spatial φ⁴ page can also select identity-mass HMC with a full bond-based quartic force, fixed leapfrog trajectory and complete auxiliary-Hamiltonian Metropolis correction. One Step, warm-up and stride count whole-field trajectories; local Metropolis remains the default and retains nominal-sweep cadence. Compatible sampler and tuning changes preserve field/RNG in isolated segments. A selectable diagnostic and latest-transition inspector show acceptance, signed ΔH, divergences and gradient work. Exact QM golden replay protects the small shared integrator extraction. Independent Gaussian, quartic quadrature, dimer and periodic-chain transfer benchmarks validate the target distribution. No adaptation, spatial archive or physical-dynamics claim is added. See [spatial HMC mathematics](docs/math/hmc-spatial-phi4.md) and [M4d2 review](docs/M4D2_REVIEW.md).

## M4c2 Hamiltonian Monte Carlo

The quartic oscillator also offers identity-mass HMC with fresh Gaussian auxiliary momenta, reversible leapfrog trajectories and a Metropolis correction using the complete auxiliary Hamiltonian. Its Step, warm-up and measurement stride count whole trajectories; local Metropolis continues to count site attempts and nominal sweeps. A selectable diagnostic shows acceptance, numerical divergences, signed Hamiltonian defects and force-evaluation work, while the latest-transition tool inspects the actual proposal. Compatible sampler or tuning changes begin isolated segments and preserve the current path and RNG. The auxiliary integration time is unrelated to Euclidean coordinate time or physical dynamics. See [HMC mathematics](docs/math/hmc-euclidean-qm.md) and the [M4c2 review](docs/M4C2_REVIEW.md).

## M4c0 (merged)

Five mounted workspaces now have a shared navigation order: **Small Systems**, **Lattice Systems**, **Lattice QM**, **Lattice Fields**, and **Experiments**. The old `#fields-paths` link opens Lattice Fields; `#lattice-qm` opens the harmonic oscillator in its own numerical session. Tab changes retain separate workers, histories, selections and display settings, including a running worker. QM and Fields use one Run/Pause control and a bounded six-card tool deck. Each card can be changed, collapsed, expanded, moved or removed; phones offer single-detail and compact-overview views. Tool edits read existing snapshots and do not advance the simulation. The optional finite-grid transfer eigensolve runs only when its tool is open and caches validated parameters. See [M4c0 review](docs/M4C0_REVIEW.md).

## M4b (merged)

Lattice QM offers a periodic Euclidean-time harmonic oscillator path with physical controls for N, β and ω. It reuses Gaussian spectral, heat-bath and Metropolis sampling while validating oscillator-derived coefficients separately. The path, full-segment translation-averaged two-point correlator, exact finite-lattice and continuum references, effective gap, kinetic-normalized partition function, finite-grid transfer example and reflection-positive covariance illustration distinguish Euclidean separation from Monte Carlo update count. See [oscillator mathematics](docs/math/euclidean-oscillator.md) and [M4b review](docs/M4B_REVIEW.md).

## M4a2 (merged)

Fully periodic chains and rectangles now offer independent Fourier sampling and exact spectral covariance, eigenvalues, log partition and sampled full-segment mode power. The massless option uses `r=j=0`, positive stiffness in every active direction, and the induced Euclidean measure on `Σφ=0`; its constant Fourier mode is removed. Changing measure support starts a new seeded session. Open and mixed-boundary massive models retain the dense reference. See [Fourier field mathematics](docs/math/gaussian-fourier.md) and [M4a2 review](docs/M4A2_REVIEW.md).

## M4a1 (merged)

**Lattice Fields** explores massive real Gaussian fields on open or periodic 1D chains and 2D rectangles. Its action has positive quadratic coefficient `r`, nonnegative directional stiffnesses and a uniform source. Finite-volume Cholesky references supply the mean, covariance and log partition function for the supported at-most-64-site lattices. Independent whole-field draws, coordinate Gaussian heat bath and random-site Metropolis run in a separate seeded worker. A profile or fixed-scale heatmap, local conditional inspection, transition details and per-segment sampled/exact comparisons expose the mathematics without treating updates as physical time. Parameter changes isolate measurements while preserving compatible field state and RNG; geometry changes and Reset begin a new seeded session. Recent plotted field vectors are bounded, while online site/pair aggregates span each retained segment. See [Gaussian field mathematics](docs/math/gaussian-fields.md) and [M4a1 review](docs/M4A1_REVIEW.md) for equations, tests and limits.

## New in M3b2

Experiments can run a bounded 2D Ising parameter sweep in a dedicated worker. Temperature, field, and finite-size presets fill an editable plan. Start displays the validated elementary-update and archive budget. Every point creates a fresh seeded lattice run with its own warm-up and retained measurements; Pause/Resume preserve the current point, while Cancel discards its partial data and archives completed points. A numeric parameter-axis plot and table compare m, |m|, physical e=H/N, susceptibility, Binder, heat capacity and directional bond products. Short runs near criticality may mix slowly. The infinite-volume Tc marker appears only for the isotropic Jx=Jy=1, h=0 temperature configuration.

Completed captures and the sweep plan are portable in version-2 JSON; version-1 record bundles still import. Sweep summary and bounded m, |m|, e measurement CSVs are available. The in-memory library still has a 16-record and 12 MiB limit. Imported sweeps remain read-only until their plan is explicitly copied and started. See [M3b2 review](docs/M3B2_REVIEW.md).

## New in M3b1

Pause either live workspace, then save its current or available parameter segments to **Experiments**. Navigation preserves both live simulations. Each archived segment keeps its own settings, seed, worker version, full aggregate statistics, histograms, diagnostic quality and actually available bounded raw history. Graph/lattice Ising copies up to 8192 recent M3a observations on demand; other Small Systems retain up to 1000 recent transitions. Earlier raw records may be gone even when full-segment moments remain. A historical segment does not inherit today's configuration or falsely claim fresh-seed replayability.

Experiments stores at most 16 records and 12 MiB in browser memory. Rename, annotate, inspect and compare records through compatible observable definitions. Download a portable version-1 JSON bundle, measurements CSV, its metadata JSON sidecar or aggregate summary CSV. Import validates the complete JSON file before adding records; duplicate scientific IDs retain their original provenance. **Export before refreshing:** the library has no automatic persistence, backend or upload. Existing scalar configuration links still share settings only. [M3b1 review](docs/M3B1_REVIEW.md) documents schema, coverage and validation.

## New in M3a

Lattice Systems now reports the connected signed-magnetization susceptibility `χ=N(〈m²〉−〈m〉²)/T`, Binder cumulant `U₄=1−〈m⁴〉/(3〈m²〉²)`, fixed-Hamiltonian heat capacity per site `cV=N(〈e²〉−〈e〉²)/T²`, and directional nearest-neighbor bond products. Axial correlation plots average positive-displacement origin pairs up to four sites: fully periodic lattices show a plug-in connected estimate `G(r)−〈m〉²`, while open and mixed-boundary lattices show raw pair correlation. The exact 2×2 reference includes these observables for open, periodic and mixed boundaries.

A collapsible Statistical Diagnostics panel estimates autocorrelation, integrated time, recent-window ESS/standard error and blocking behavior from up to 8192 consecutive retained measurements per segment. It discloses measurement cadence, evictions and failure statuses. Local graph-Ising times use elementary updates (or updates divided by site count for nominal sweeps); direct draws have no local-sweep unit; M2 uses its selected sweep stride. These are estimates about the recent analyzed window, not automatic error bars for the full-segment mean or proof of equilibration. Tiny graph Ising and M2 2×2 additionally compare with exact stationary Markov-chain autocorrelation and spectral results for their actual selected sampler. ACF, blocking and spatial plots join the existing zero-to-six plot gallery. [M3a review](docs/M3A_REVIEW.md) documents the numerical methods and validation.

## New in M2

Choose **Lattice Systems** for rectangular 2D Ising boxes from 2×2 to 64×64. Open or periodic x/y boundaries, signed horizontal/vertical couplings, field and temperature are editable. The canvas shows every spin; pointer/touch or numeric controls select a site. A separate selectable Local 5×5 neighborhood tool displays a larger 5×5 image around that site, including open boundaries or periodic repeats. Run, Pause and Step use a separate seeded worker with lazy Metropolis or heat bath. The actual latest transition shows local bond contributions, physical field, ΔH, ΔS and random decisions.

The physical Hamiltonian is `H=−Jx Σ_x sᵢsⱼ−Jy Σ_y sᵢsⱼ−h Σᵢsᵢ`, with `S=H/T`, `k_B=1`. M1a's dimensionless graph weights equal `Kx=Jx/T`, `Ky=Jy/T`, `b=h/T`; a periodic 2×2 lattice keeps eight distinct bonds. N random-site updates are one nominal sweep, not physical time. Measurements start after configurable sweep warm-up and recur at a whole-sweep stride. The worker maintains H/M incrementally, online moments and full-segment histograms; only 1,000 recent measurements and eight segments remain for plotted history. Changed physical settings preserve spins/RNG and begin a fresh segment; geometry changes and Reset restart a seeded session. Plot choices never sample.

The spin image is the default full-width featured display; m and e histories are the two default gallery cards. The Local 5×5 neighborhood visualization and all 16 existing plot views remain selectable within six optional cards. History plots share a 100/500/1000-sweep navigation window, while spatial displacement belongs to its own card. Exact 2×2 references use direct stable physical-parameter enumeration and agree with M1a where its dimensionless range applies. The critical-temperature formula is labeled as **infinite-volume theory** and appears only for positive Jx/Jy at h=0. Finite-volume symmetry, local-chain mixing limits, and five suggested classroom experiments are explained in the interface. See the [M2 review](docs/M2_REVIEW.md) , [Stage C review](docs/MODEL_PAGE_STAGE_C_REVIEW.md), and [neighborhood review](docs/ISING_NEIGHBORHOOD_REVIEW.md).

## New in M1b

Choose **Real scalar field** to explore one to four real variables on the existing graph/lattice presets, plus a coupled two-site pair. The dimensionless action is `Σᵢ(aᵢxᵢ²/2 + λᵢxᵢ⁴/4 − hᵢxᵢ) + Σₑκₑ(xₜ−xₕ)²/2`. Six editable experiment presets cover a one-site Gaussian, Gaussian pair, symmetric/tilted double wells and four-site Gaussian/quartic systems. Numeric site/bond controls preserve distinct periodic bonds and faces. Positive quartic terms permit negative `a`; positive Gaussian `a` and nonnegative `κ` keep the supported region normalizable.

The graph shows actual real values with a fixed color scale. Selected sites compare bare and fixed-neighbor conditional potentials; selected bonds show gradient action. A normalized conditional density is labeled separately from the sampled equilibrium marginal. Gaussian models expose analytic mean, covariance, pair moments, conditionals and log Z, with independent whole-vector draws or local heat bath/Metropolis. Independent quartic sites have controlled one-dimensional quadrature references. Coupled quartic marginals remain sampled estimates.

The existing Run/Pause/Step, warm-up, historical segments, Reset and display-only Refit axes workflows apply to vector configurations. The current real-valued graph is featured above up to six optional tools. Histogram and scatter (or bare potential for one site) are initially open; tools can show marginal histograms, local potentials and conditionals, trajectories, running means/errors when referenced, scatter, covariance and acceptance. Scalar trajectories default to the latest 100 algorithmic updates, with 500/1000-update history windows; direct draws are points, while local chains use steps. Metropolis acceptance has a graphical count/percentage display, and direct/heat-bath acceptance is N/A. A versioned URL shares **configuration only** (model, graph, parameters, sampler and seed); it contains no Monte Carlo history. [M1b review notes](docs/M1B_REVIEW.md) document numerical tests, browser screenshots and limits.

## New in M1a

Explore **one to four interacting Ising spins** on a single site, open/periodic four-site chain, open 2×2 square, star, K4 or true periodic 2×2 square lattice. The torus has **eight distinct bonds and four oriented faces**; dashed wrap bonds remain separately selectable. A lightweight SVG graph view is separate from scientific plots. Select a site or bond directly or through accessible selectors; edit individual fields/couplings numerically in a compact list. K4’s six pairwise couplings can realize any simple four-site interaction graph by setting unwanted weights to zero. No graphical topology creation/deletion or dragging. Changing geometry presets starts a fresh session; weight edits retain every bond/face record.

The action is `S=−Σ_e K_e s_tail s_head−Σ_i b_i s_i`, weight `exp(−S)` (beta absorbed). Support positive, negative and zero K and b in [−10,10]. The numerical domain accepts at most 16 distinct bonds; the UI preserves preset topology. Every bond contributes separately; self-links add constants and zero spin-flip difference. Exact enumeration of at most 16 configurations provides log Z, full configuration probabilities, site marginals, magnetization/energy distributions, moments and correlations immediately.

- **Samplers:** direct independent exact configuration draws, local lazy Metropolis and local heat bath. Local updates choose sites uniformly with replacement; N elementary attempts are one nominal sweep, not physical time. Metropolis uses site/proposal/acceptance uniforms; graph heat bath uses site/resampling uniforms. Step shows the actual site, incident contributions, draws and resulting configuration.
- **Dynamic plots:** two defaults, distribution and trajectory (total M for graph Ising). Add, remove, collapse, expand or reorder **zero to six** independently selected views. Desktop normally uses two columns; phone uses one detail plot or a compact overview. Six limits the interface, not model size. Select a site and use “Plot selected spin” to inspect it.
- **Graph observables:** M, m=M/N, |M|, total dimensionless action E=S and each spin; distributions, exact/sample running means, trajectories, local conditionals and connected correlations. Configuration probability tables show exact and sampled masses. Local conditionals are explicitly distinct from equilibrium marginals.
- **Measurements:** local warm-up defaults to 200 updates (0–10000), excluded from all estimates; a fixed budget is not a mixing guarantee. Coupling/field/sampler changes preserve compatible configurations/RNG and create separate segments. Topology changes explicitly restart/reseed. Reset clears/reseeds/refits; Refit axes is display-only. Eight segments retain 1000 exact transitions each plus full configuration counts and bounded per-observable summaries. No MCMC confidence bands, ESS or saved-run manager.

[Initial review notes](docs/M1A_REVIEW.md) and [local-inspection refinement screenshots](docs/M1A_REFINEMENT_REVIEW.md) record the numerical and desktop/phone validation. Large-lattice Ising now lives in its separate M2 workspace; gauge dynamics and cluster algorithms remain deferred.

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
- **Stable axes:** physical-value axes expand without automatic recentering on Apply. Refit axes changes only the viewport. Trajectory windows can follow recent updates or inspect earlier retained history. Reset clears histories, refits plots, and restarts applied settings with the **Seed on Reset** field.
- **Local mathematics:** reusable KaTeX HTML + MathML components render formulas with bundled fonts. Expand optional model notes and suggested experiments when useful.

## Sampling and measurement conventions

Gaussian Metropolis proposes a uniform displacement in `[−δ,δ]`, with `0.01≤δ≤50`. Spin Metropolis proposes a stay or flip with equal probability, avoiding the period-two zero-field deterministic-flip chain. Binomial proposes ±1 equally and maps out-of-range attempts to self-proposals; this preserves a symmetric proposal at the endpoints. Every Metropolis update consumes one proposal uniform and one acceptance uniform, even when automatically accepted. Acceptance includes self-proposals; the separately displayed movement rate excludes them. Counters include warm-up.

Metropolis defaults to **200 discarded warm-up updates per new segment**, configurable from 0 to 10000. This budget does not guarantee mixing. Direct samplers need none. Single-spin heat bath also generates independent equilibrium draws: its resampling law does not depend on the old spin. After warm-up, every update—including rejection/self states—enters moments and histograms. Sample variance uses N−1, which does not remove finite-chain correlation bias.

Only **direct Gaussian** segments show the known-variance `μ±σ/√N` envelope (about 68% coverage at fixed N) and optional `σ N^(-1/2)` RMS error reference. These are not simultaneous confidence bands or promises of monotone error reduction. Metropolis plots show the running mean and exact reference without independent-sample bands. M3a's autocorrelation-adjusted errors and ESS apply to labeled recent Ising diagnostic windows when supported, never as automatic Gaussian independent-sample bands.

Each of the latest **eight segments** keeps its settings, start index, update/warm-up/acceptance counters, moments, histogram, logarithmic mean checkpoints and latest **1000 exact transitions**. Older transitions and then old segments are removed with disclosure; full segment statistics survive transition eviction. Gaussian histograms use 32 bins over each segment’s `μ±4σ`, with explicit tails included in normalization and moments. Discrete histograms have one bin per state. Checkpoints follow `n₀=1`, `nₖ₊₁=ceil(1.125 nₖ)`, at most 320 plus the latest endpoint, using retained measurement count only.

Mulberry32 midpoint v1 remains the RNG. Direct Gaussian Box–Muller v1 still consumes exactly two uniforms per draw; spin direct/heat bath uses one, direct binomial uses n, and Metropolis uses two per update. Reset initializes chains at 0 (Gaussian), +1 (spin), or round(np) (binomial); initialization is not a measurement. Reproducibility requires the same seed, settings/update sequence, algorithm and build; browser transcendental functions can differ in their last bits. Run posts batches of 128 with at most one in flight. Apply and Pause respect the batch acknowledgment boundary. Plotting, history browsing, snapshot frequency and Step inspection never consume RNG values.

**Gauge continuation:** tiny Z₂ and compact U(1) examples use eight oriented links on the periodic 2×2 torus, independent of teaching-tool count. Larger gauge systems and cluster algorithms remain future work.

## Read first

1. [Living specification](docs/SPECIFICATION.md): intended behavior, mathematical conventions, and current implementation limits.
2. [Development roadmap](docs/ROADMAP.md): staged delivery and acceptance gates.
3. [Design decisions](docs/DECISIONS.md): rationale and history.
4. [Agent instructions](AGENTS.md): contributor workflow.
5. [Source-reading guide](docs/SOURCE_GUIDE.md): code paths and independently checked examples.

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

Browser tests serve the **production build**, so run `npm run build` before `npm run test:browser`. Tests cover desktop Chromium, a 360px phone in Chromium, and an emulated iPhone in WebKit, including landscape, keyboard interactions, thousands of updates followed by Step/resume, all models, warm-up/inspection, trajectory browsing, seed replay, parameter switching, segment isolation, stable axes, Reset/Refit axes, plot assignment/rearrangement, local math/fonts, and subpath/worker loading. These are emulated browser tests, not measurements on physical phones. On Linux, install browser system dependencies with `npx playwright install --with-deps chromium webkit`.

`npm run format` formats source/configuration files and README; existing design documents retain their established formatting. `npm run preview` serves `dist` locally at `http://127.0.0.1:4173/lattice/`. Test screenshots and traces are written to ignored `test-results/`.

## Architecture and deployment

TypeScript + Vite + React, native accessible form controls, small SVG plots, a Canvas spin view, locally bundled KaTeX (including fonts), and separate small-system/lattice browser workers. Runtime packages are React, React DOM, and KaTeX. No backend, accounts, telemetry, CDN assets, plotting framework, or persistent service.

- `src/domain/`: finite graph/cell topology with stable incidence IDs, plus indexed rectangular geometry with distinct oriented positive-axis bond records.
- `src/models/`: scalar and finite Ising model union, actions, local differences, validation, exact densities/masses and independent enumeration.
- `src/algorithms/`: seeded RNG, direct/heat-bath/Metropolis kernels and discriminated transition traces; no UI dependencies.
- `src/observables/`: online moments, histogram counters, bounded convergence/transition records, physical Ising observables and worker-owned statistical diagnostic rings.
- `src/engine/`, `src/workers/`: authoritative small-system and large-lattice run states, typed messages, stale-run handling, bounded scheduling and paused-only capture.
- `src/experiments/`: versioned archive validation, compatible observable descriptors and portable JSON/CSV serialization.
- `src/app/`, `src/plotting/`: input/display state, dynamic plot assignments, stable viewports, and reusable SVG plotting.
- `src/ui/`: reusable inline/display math with HTML + MathML output.

Vite uses **`base: '/lattice/'`** in development and production. Navigation uses hash anchors, so `/lattice/#small-systems` can load directly or reload on GitHub Pages without server rewrites.

[CI/Pages workflow](.github/workflows/ci-pages.yml) validates pull requests and pushes to `main`. It uploads and deploys `dist` **only from `main`, after validation passes**. Hosting uses **Settings → Pages → Source → GitHub Actions**. This follows the [Vite Pages guide](https://vite.dev/guide/static-deploy.html#github-pages) and [GitHub publishing documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site). Feature-branch validation alone does not establish that the live site is deployed; the live URL and hash reload must be checked after deployment.

## License

**To decide before the first public release.** No license has yet been selected; do not assume permission to reuse code or documentation until an explicit license is added.
