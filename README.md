# Lattice Lab

**Status:** M0 implemented; local validation and deployment status are tracked in the [roadmap](docs/ROADMAP.md). M1 and later features remain planned.

Lattice Lab is a browser-based laboratory for teaching and small-scale exploration of statistical mechanics, Euclidean lattice quantum mechanics, and lattice field theory. Its emphasis is on mathematical structure, observable quantities, transparent algorithms, and comparisons with exact results.

The repository is [gantemur/lattice](https://github.com/gantemur/lattice), independent of [SOL](https://gantemur.github.io/sol/). The intended GitHub Pages URL is [gantemur.github.io/lattice/](https://gantemur.github.io/lattice/). The product name remains **Lattice Lab**.

## Available in M0

- A responsive **Small Systems** workspace with collapsible settings, keyboard/touch controls, and a separate single-site diagram. Exactly four inspection slots accept a variable/observable and plot type. Defaults are Gaussian density/histogram and running mean; slots 3–4 are compact unassigned selectors. Slots can repeat a variable, close/reopen, or move; phones offer single detail and an optional 2×2 overview.
- A real 0D Gaussian with dimensionless action `S(x) = a x²/2 − h x`, target density proportional to `exp(−S)`, and no extra beta factor. The teaching UI supports `0.05 ≤ a ≤ 20` and `−10 ≤ h ≤ 10`. Authored formulas use locally bundled KaTeX HTML + accessible MathML.
- Analytically normalized density and exact mean `h/a`, variance `1/a`, and second moment `1/a + (h/a)²`. Sampled estimates are labeled separately; sample variance uses `n−1` and is unavailable before two draws.
- Independent Box–Muller sampling from seeded Mulberry32 in a Web Worker. Run/Pause/Step/Reset and a standard Gaussian preset work with **zero warm-up** and one retained measurement per update. Updates are not physical time.
- Running means on a logarithmic sample-count axis, with each segment’s exact mean and pointwise `μ ± σ/√N` envelope (about 68% coverage at a fixed N). An optional log–log absolute-error view compares the trajectory with the `σ N^(-1/2)` RMS reference. Single-trajectory errors are not monotone; the envelopes are not simultaneous confidence bands.
- Apply preserves earlier measurements, the current value, and the RNG stream, and starts a separately labeled segment when physical parameters change. Statistics are never pooled across segments. Reset clears history, refits axes, and restarts the currently applied parameters with the **Seed on Reset** field. Fit All changes only the viewport. Display changes never touch numerical state.

Each of the latest **eight segments** retains its own parameters, start-update index, count, online moments, 32 histogram bins over its own `μ ± 4σ`, tail counters, and convergence checkpoints. Histograms normalize with all segment samples, including tails. Older segments are removed with a visible notice; individual draws are not stored. Worker checkpoints follow `n₀=1`, `nₖ₊₁=ceil(1.125 nₖ)`, with at most 320 scheduled points plus the latest endpoint per segment. Rendering frequency does not affect checkpoint collection.

Axes expand as needed and never automatically shrink or recenter on Apply, even when an old segment is removed. Fit All refits the retained curves; Reset recenters for the current model. Curves share segment colors and have distinct analytic/sampled styles. Run posts batches of 128 draws with at most one in flight. Apply waits for that batch, then continues Run under the new parameters; Pause waits for acknowledgment before Step. Reproducibility requires the same seed, parameter-change/update sequence, algorithm, and build; browser transcendental functions may differ in their last bits.

**Planned:** Lattice Systems and Experiments (shown without active navigation), multi-variable models, tiny periodic geometries, Ising, quartic potentials, detailed Metropolis inspection, saved runs, exports, general MCMC uncertainty analysis, and larger lattices. A periodic 2×2 square gauge lattice will have eight oriented link variables and still offer four display slots. Graph topology, physical variables, and plot slots are distinct.

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

Browser tests serve the **production build**, so run `npm run build` before `npm run test:browser`. Tests cover desktop Chromium, a 360px phone in Chromium, and an emulated iPhone in WebKit, including landscape, keyboard interactions, run/pause/step, seed replay, parameter validation and switching, segment isolation, stable axes, Reset/Fit All, compact plot assignment/rearrangement, local math/fonts, and subpath/worker loading. These are emulated browser tests, not measurements on physical phones. On Linux, install browser system dependencies with `npx playwright install --with-deps chromium webkit`.

`npm run format` formats source/configuration files and README; existing design documents retain their established formatting. `npm run preview` serves `dist` locally at `http://127.0.0.1:4173/lattice/`. Test screenshots and traces are written to ignored `test-results/`.

## Architecture and deployment

TypeScript + Vite + React, native accessible form controls, small SVG plots, locally bundled KaTeX (including fonts), and one browser Web Worker. Runtime packages are React, React DOM, and KaTeX. No backend, accounts, telemetry, CDN assets, plotting framework, or persistent service.

- `src/domain/`: single-site topology, separate from physical variable descriptors.
- `src/models/`: Gaussian action, validation, density, and analytic moments.
- `src/algorithms/`: seeded RNG and independent sampler; no UI dependencies.
- `src/observables/`: online moments, histogram counters, and bounded convergence checkpoints.
- `src/engine/`, `src/workers/`: authoritative run state, typed messages, stale-run handling, and bounded scheduling.
- `src/app/`, `src/plotting/`: input/display state, four-slot assignments, stable viewports, and reusable SVG plotting.
- `src/ui/`: reusable inline/display math with HTML + MathML output.

Vite uses **`base: '/lattice/'`** in development and production. Navigation uses hash anchors, so `/lattice/#small-systems` can load directly or reload on GitHub Pages without server rewrites.

[CI/Pages workflow](.github/workflows/ci-pages.yml) validates pull requests and pushes to `main`. It uploads and deploys `dist` **only from `main`, after validation passes**. To activate hosting, set the repository's **Settings → Pages → Source** to **GitHub Actions**, then merge an approved PR (or dispatch the workflow on `main`). This follows the [Vite Pages guide](https://vite.dev/guide/static-deploy.html#github-pages) and [GitHub publishing documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site). Feature-branch validation does not establish that the live site is deployed; the live URL and hash reload must be checked after deployment.

## License

**To decide before the first public release.** No license has yet been selected; do not assume permission to reuse code or documentation until an explicit license is added.
