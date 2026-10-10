# Lattice Lab

**Status:** M0 implemented; local validation and deployment status are tracked in the [roadmap](docs/ROADMAP.md). M1 and later features remain planned.

Lattice Lab is a browser-based laboratory for teaching and small-scale exploration of statistical mechanics, Euclidean lattice quantum mechanics, and lattice field theory. Its emphasis is on mathematical structure, observable quantities, transparent algorithms, and comparisons with exact results.

The repository is [gantemur/lattice](https://github.com/gantemur/lattice), independent of [SOL](https://gantemur.github.io/sol/). The intended GitHub Pages URL is [gantemur.github.io/lattice/](https://gantemur.github.io/lattice/). The product name remains **Lattice Lab**.

## Available in M0

- A responsive **Small Systems** workspace with collapsible settings, keyboard/touch controls, a separate single-site diagram, and four principal variable-plot slots. One slot initially shows the sole Gaussian variable; the other three are unassigned and may also inspect that same variable. Phone users can switch detail slots or show a 2×2 overview.
- A real 0D Gaussian with dimensionless action `S(x) = a x²/2 − h x`, target density proportional to `exp(−S)`, and no extra beta factor. The teaching UI supports `0.05 ≤ a ≤ 20` and `−10 ≤ h ≤ 10`.
- Analytically normalized density and exact mean `h/a`, variance `1/a`, and second moment `1/a + (h/a)²`. Sampled estimates are labeled separately; sample variance uses `n−1` and is unavailable before two draws. M0 does not report error bars.
- Independent Box–Muller sampling from a seeded Mulberry32 generator in a Web Worker. Run/Pause/Step/Reset, a standard Gaussian preset, and a histogram with explicit tail counts. Every draw is retained; **zero warm-up is needed for this independent sampler**. Updates are not physical time.
- A new measurement segment on Apply, Reset, or preset selection. Previous measurements are explicitly cleared; closing settings, changing display slots, and hiding the histogram preserve numerical state. Reset replays the seed.

The density view covers `μ ± 4σ` with 32 fixed bins. Histogram normalization and online moments include all retained samples, including tails. Memory does not grow with the number of draws. Run posts batches of 128 draws, with at most one batch in flight; Pause acknowledges that batch before enabling Step. Snapshots and UI redraws do not consume random draws. Reproducibility is for the same seed, parameters, algorithm, and build; transcendental functions may differ in their last bits across browser engines.

**Planned:** Lattice Systems and Experiments (shown without active navigation), multi-variable models, tiny periodic geometries, Ising, quartic potentials, detailed Metropolis inspection, saved runs, exports, uncertainty analysis, and larger lattices. A periodic 2×2 square gauge lattice will have eight oriented link variables and still offer four display slots. Graph topology, physical variables, and plot slots are distinct.

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

Browser tests serve the **production build**, so run `npm run build` before `npm run test:browser`. Tests cover desktop Chromium, a 360px phone in Chromium, and an emulated iPhone in WebKit, including landscape, keyboard interactions, run/pause/step, seed replay, parameter validation, four slots, and subpath/worker loading. These are emulated browser tests, not measurements on physical phones. On Linux, install browser system dependencies with `npx playwright install --with-deps chromium webkit`.

`npm run format` formats source/configuration files and README; existing design documents retain their established formatting. `npm run preview` serves `dist` locally at `http://127.0.0.1:4173/lattice/`. Test screenshots and traces are written to ignored `test-results/`.

## Architecture and deployment

TypeScript + Vite + React, native accessible form controls, small SVG density plots, and one browser Web Worker. React and React DOM are the only runtime packages. No backend, accounts, telemetry, external fonts, plotting framework, or persistent service.

- `src/domain/`: single-site topology, separate from physical variable descriptors.
- `src/models/`: Gaussian action, validation, density, and analytic moments.
- `src/algorithms/`: seeded RNG and independent sampler; no UI dependencies.
- `src/observables/`: online moments and histogram counters.
- `src/engine/`, `src/workers/`: authoritative run state, typed messages, stale-run handling, and bounded scheduling.
- `src/app/`, `src/plotting/`: input/display state and reusable SVG plotting.

Vite uses **`base: '/lattice/'`** in development and production. Navigation uses hash anchors, so `/lattice/#small-systems` can load directly or reload on GitHub Pages without server rewrites.

[CI/Pages workflow](.github/workflows/ci-pages.yml) validates pull requests and pushes to `main`. It uploads and deploys `dist` **only from `main`, after validation passes**. To activate hosting, set the repository's **Settings → Pages → Source** to **GitHub Actions**, then merge an approved PR (or dispatch the workflow on `main`). This follows the [Vite Pages guide](https://vite.dev/guide/static-deploy.html#github-pages) and [GitHub publishing documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site). Feature-branch validation does not establish that the live site is deployed; the live URL and hash reload must be checked after deployment.

## License

**To decide before the first public release.** No license has yet been selected; do not assume permission to reuse code or documentation until an explicit license is added.
