# Lattice Lab

Lattice Lab is a browser-based laboratory for teaching and small-scale exploration of statistical mechanics, Euclidean lattice quantum mechanics, and lattice field theory. It emphasizes explicit mathematical conventions, inspectable sampling algorithms, and comparison with exact or controlled finite-volume references.

Open [Lattice Lab](https://gantemur.github.io/lattice/). The source is [gantemur/lattice](https://github.com/gantemur/lattice), independent of [SOL](https://gantemur.github.io/sol/). The scientific core through M5e is released; see [release provenance and validation](docs/RELEASES.md). Finite simulations do not certify equilibrium, phase transitions or continuum limits.

## Laboratories

| Workspace       | Available models and activities                                                                                                                     | Reading                                                                                                                                                                      |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Small Systems   | 0D Gaussian, single Ising spin, binomial count; one-to-four-site Ising and real scalar graphs; tiny Z₂/U(1) gauge systems, Potts/FK and XY examples | [Model conventions](docs/SPECIFICATION.md#4-physical-model-framework)                                                                                                        |
| Lattice Systems | 1D classical Ising chain, 2D Ising, 2D Potts with eligible Swendsen–Wang, and 2D XY with vortex inspection                                          | [Ising transfer matrix](docs/math/ising-chain-transfer.md), [Potts](docs/math/potts-model.md), [FK](docs/math/fk-edwards-sokal.md), [XY](docs/math/xy-model.md)              |
| Lattice QM      | Periodic harmonic and interacting quartic/double-well Euclidean paths; local updates and quartic-path HMC                                           | [Harmonic oscillator](docs/math/euclidean-oscillator.md), [interacting oscillator](docs/math/interacting-oscillator.md), [HMC](docs/math/hmc-euclidean-qm.md)                |
| Lattice Fields  | Massive Gaussian fields, periodic mean-zero GFF, and interacting spatial φ⁴ with local Metropolis/HMC                                               | [Gaussian fields](docs/math/gaussian-fields.md), [Fourier/GFF](docs/math/gaussian-fourier.md), [φ⁴](docs/math/spatial-phi4.md), [spatial HMC](docs/math/hmc-spatial-phi4.md) |
| Experiments     | In-memory saved Small Systems/Ising segments, portable JSON/CSV and bounded independent Ising parameter sweeps                                      | [Capture, formats and limits](docs/SPECIFICATION.md#64-run-storage-and-exports)                                                                                              |

Tiny gauge examples use a four-link open plaquette or the genuine eight-link, four-face periodic 2×2 torus. Their degrees of freedom are links, unlike XY site angles. Read the [Z₂](docs/math/z2-gauge.md) and [U(1)](docs/math/u1-gauge.md) guides. Gauge, Potts/FK, XY and field/QM live sessions do not add new portable archive formats.

Small Ising examples include a single spin, open dimer, three-site chain, triangle and frustrated triangle, four-site ring, star and open square. Advanced settings retain K4 and periodic topology, and a custom two-to-four-site simple graph has separate edge-presence and coupling controls: a present zero-weight bond is not an absent bond. Real scalar examples include a Gaussian pair, symmetric/tilted quartic wells and coupled four-site fields. Named examples reuse existing mathematical families.

## Explore and measure

- **Run/Pause/Step:** Run batches worker updates; Pause acknowledges an in-flight batch; Step inspects a real transition. Algorithmic updates, sweeps, Euclidean coordinates and physical time are different quantities. Direct draws and heat bath have no invented Metropolis acceptance rate.
- **Apply:** compatible parameter changes preserve state and the seeded random stream, starting separate measurement segments. Topology/support/family changes follow their documented session-reset rules. Never pool measurements from different target distributions.
- **Reset:** clears the live history and restarts with the selected seed and applied settings. Display-only Refit axes, selection, history browsing and tool changes do not sample or reseed.
- **Tools:** one featured display and up to six optional gallery cards. Assignment keys preserve applicable view controls during exchanges; phones offer single-detail and compact-overview layouts. Physical variable counts are independent of display slots.
- **References and diagnostics:** distinguish analytic/enumerated results, numerical quadrature, sampled marginal distributions and fixed-neighbor conditionals. Direct Gaussian pointwise standard-error bands are not simultaneous bands and do not apply to correlated chains. Ising ACF/ESS/SE describe explicitly bounded recent windows, not automatic error bars for all full-segment means.
- **Bounded storage:** model-specific histories retain recent configurations while full-segment aggregates retain broader coverage. Warm-up and evictions are disclosed. The experiment library is memory-only (16 records/12 MiB); export explicitly before reloading. Imported JSON is validated atomically; CSV is a derived export.

The five workspaces retain independent mounted sessions when hidden; navigating away does not silently pause an active worker. Hash URLs work on static hosting, and the legacy `#fields-paths` route still opens Lattice Fields. Scalar configuration URLs contain settings, not sample histories. Reproducibility requires matching build, seed, settings, algorithm and update sequence; browser transcendental functions can differ in their last bits.

## Read first

1. [Functional specification](docs/SPECIFICATION.md): mathematics, behavior and numerical limits.
2. [Capability overview](docs/ROADMAP.md): shipped scope and unsupported extensions.
3. [Source-reading guide](docs/SOURCE_GUIDE.md): concrete code paths, independent examples and scientific contribution standards.
4. [Release and validation summary](docs/RELEASES.md): public provenance, tests and screenshots.

## Develop and validate

Use Node.js **24 or newer**; CI uses Node 24. The npm lockfile pins dependencies.

```sh
npm ci
npx playwright install chromium webkit
npm run dev
```

Open the printed local URL with `/lattice/`, normally `http://localhost:5173/lattice/`.

```sh
npm run format:check
npm run typecheck
npm test
npm run build
npm run test:browser
# The complete pipeline:
CI=1 npm run check
```

Browser tests serve the production build. They cover desktop Chromium, 360px Chromium and emulated iPhone WebKit, including worker loading, old URLs, seeded replay, segment isolation, history windows, controls, local math/fonts and overflow. These are emulated-browser checks, not physical-phone benchmarks. On Linux use `npx playwright install --with-deps chromium webkit`.

`npm run format` formats source/configuration and README; top-level design documents retain their established formatting through `.prettierignore`. `npm run preview` serves `dist` at `http://127.0.0.1:4173/lattice/`. Runtime screenshots/traces go to ignored `test-results/`; browser scenarios also regenerate selected tracked `docs/screenshots/` evidence, so review generated image differences separately from source changes.

## Architecture and deployment

TypeScript + Vite + React, native accessible forms, SVG/Canvas views, locally bundled KaTeX HTML + MathML/fonts, and browser workers. Runtime dependencies are React, React DOM and KaTeX. There is no backend, account system, telemetry, external runtime CDN, or persistent service.

Geometry (`src/domain/`), mathematical models/references (`src/models/`), seeded sampling (`src/algorithms/`), measurements (`src/observables/`), execution (`src/engine/`, `src/workers/`), portable experiments (`src/experiments/`) and presentation (`src/app/`, `src/plotting/`, `src/ui/`) remain separate. Numerical modules can be tested without React.

Vite uses **`base: '/lattice/'`**. Hash navigation such as `/lattice/#small-systems` reloads without server rewrites. The [CI/Pages workflow](.github/workflows/ci-pages.yml) validates pull requests and main pushes; only validated main builds deploy `dist`. GitHub Pages uses **Settings → Pages → Source → GitHub Actions**. Feature-branch validation does not establish deployment. After a release, verify the served revision, asset/worker paths and hash reload. See the [Vite Pages guide](https://vite.dev/guide/static-deploy.html#github-pages) and [GitHub publishing documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## License

No software or documentation license has yet been selected. Do not assume permission to reuse material until an explicit license is added.
