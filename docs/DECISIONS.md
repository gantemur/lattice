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

## Open decisions

- Which charting and UI component library to adopt after a small measured prototype.
- Exact supported performance target for a low-end phone, to be measured rather than guessed.
- Whether advanced graph editing supports explicit addition/removal of oriented faces in the initial release (presets will include faces).
- How many concurrent saved run datasets can be held in memory before asking users to export.
- Whether presets and configuration-only URL sharing precede full dataset import.
- Choice of project software license and separate documentation license, if desired.
