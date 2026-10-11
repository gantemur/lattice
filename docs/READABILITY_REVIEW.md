# Pre-M4 source-readability review

**Scope:** Latest merged M3b2 baseline, before M4. This pass changes documentation and explanatory source comments only. No numerical, protocol, archive-format, UI, dependency, or test behavior was intentionally changed.

## Inventory and treatment

Every hand-authored file was considered in the ten requested `src/` directories, together with seven browser test files, `src/app/styles.css`, Vite/TypeScript/Playwright configuration, and the GitHub Pages deployment workflow. The existing layering remains the reading path: domain and models → sampling algorithms → observables → run/worker/client → experiments → plotting/UI.

| Area | Review focus and outcome |
| --- | --- |
| `src/domain/` | Clarified row-major site IDs, oriented positive-axis bonds, parallel periodic records, face incidence, and the difference between small graph and indexed lattice geometry. Simple single-site types needed no new comment. |
| `src/models/` | Added concise action and unit conventions for Gaussian, finite graph Ising, physical lattice Ising, real scalar, and finite references. Explained self-links, local differences, stable exact sums, Cholesky solves, quadrature, and finite-state Markov modes where they matter. |
| `src/algorithms/` | Documented uniform consumption and update semantics beside graph and lattice transitions. The RNG and direct Gaussian sampler already state their version/consumption contract clearly; their tests remain the executable reference. |
| `src/observables/` | Marked full-segment online moments versus bounded plot/diagnostic histories, N−1 variance, empirical uncertainty limits, cadence units, and spatial centering. |
| `src/engine/` and `src/workers/` | Clarified authoritative RNG/configuration ownership, per-segment warm-up, bounded snapshots, run/version/request IDs, deferred parameter changes, and sweep point ACK/terminal boundaries. Small worker entry files are thin adapters and needed no separate commentary. |
| `src/experiments/` | Explained immutable scientific captures versus labels, local versus scientific IDs, replayability, independent point seeds, atomic import checks, bounded export excerpts, unit-compatible comparison, and staged sweep records. Existing CSV formula-text protection and v1/v2 bundle checks were retained. |
| `src/plotting/` | Clarified Fit All versus nonshrinking plot axes and global-update trajectory windows. Most rendering modules are direct projections of supplied snapshots and did not benefit from line-by-line comments. |
| `src/app/` and `src/ui/` | Clarified mounted workspace state, draft lattice settings, asynchronous validated import, and sweep manifest retry. Reviewed responsive CSS, accessible controls, math rendering, and remaining application/plot components; ordinary JSX, CSS declarations, and small UI utilities needed no extra annotations. |
| Unit and browser tests | Reviewed the mathematical, seeded, archive, concurrency, and desktop/phone checks. Added a hand-checkable low-temperature 2×2 reference explanation and a worker-protocol race explanation; existing test names and assertions were otherwise sufficient. |

The [source guide](SOURCE_GUIDE.md) maps nine visible features to actual functions and independent tests. [`AGENTS.md`](../AGENTS.md) and [specification §9.3](SPECIFICATION.md) now require readable scientific and ordinary application code during future reviews, without file-length or comment-count rules.

## Behavior and verification

The source diff is comment-only; documentation updates align the project status with merged M3b2. No executable statement, mathematical formula, test assertion, seed, tolerance, public type, protocol, or serialization schema was changed. `git diff --check` passed, and a zero-context source diff had no non-comment code lines.

`npm run check` passed on 2026-10-11: Prettier format check, TypeScript typecheck, **274 unit tests in 34 files**, production Vite build, and **130 browser tests passed with 2 existing skips** across desktop, phone Chromium, and mobile WebKit projects. No new test suite was needed for comment-only edits.

## Deferred readability work

Several mature UI components and the stylesheet are long, notably the lattice and sweep workspaces. Splitting them now would create broad state-lifecycle risk for an editorial pass. During M4–M6, extract coherent pieces when feature work already touches them, document who owns simulation versus viewport state, keep new numerical modules close to small independent references, and explain any measured optimization at its implementation and test. Keep worker ACK and archive invariants visible whenever those paths change.
