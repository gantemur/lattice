# M4c0 review — workspaces and teaching tools

## Scope and taxonomy

The top-level order is Small Systems, Lattice Systems, Lattice QM, Lattice Fields, Experiments. Lattice QM contains the M4b periodic Euclidean-time oscillator. Lattice Fields contains the M4a 1D/2D Gaussian fields. The legacy `#fields-paths` hash now routes to Lattice Fields; `#lattice-qm` opens QM. The labels describe the teaching domain, not a permanent restriction on coordinates per site. No M4c1 interacting-path work or numerical kernel change is included.

## State ownership and lifecycle

`App` mounts all five surfaces and hides inactive ones. `SiteHeader` supplies one ordered, keyboard-accessible navigation list. Each QM or Fields `useField` call creates its own `FieldClient` and worker; neither shares configuration, RNG or measurement history. Moving between tabs leaves both sessions and their local display state intact. A running hidden worker continues under the existing client scheduling policy. The two workspaces use one Run/Pause button each, plus Step and Reset. Pause may allow a posted batch to finish before the worker is idle; that boundary is unchanged. Physical parameter, geometry, support and Reset behavior remain as defined in M4a/M4b.

## Teaching-tool contract

The deck holds zero to six cards with stable IDs and a model-specific visualization, plot or analysis type. Users may add, replace, collapse/open, expand/restore width, reorder or remove cards. A phone can use single detail or compact overview. QM defaults to path and correlator; exact gaps, effective gaps/table, transfer, reflection and recent path-average history remain available. Fields defaults to configuration and selected-site/covariance inspection; Fourier spectrum, recent measurements and latest-update inspection remain available. Open/mixed-boundary Fourier selection explains why a periodic spectrum is unavailable. The new QM history uses retained per-segment vectors versus global algorithmic update count; it does not reconstruct evicted paths or join segments.

Tool edits live entirely in React presentation state. They do not send worker commands, alter measurement scheduling or draw RNG values. The finite-grid transfer eigensolve runs only when an open transfer card renders, then uses a bounded cache keyed by validated `N`, `β` and `ω`. The analytic gap and partition references retain M4b's conventions. The older Small Systems and Lattice Systems plot galleries keep their own mature implementation.

## Validation

Browser tests exercise all five routes and history navigation, separate QM/Fields sessions, navigation while running, seeded replay after display changes, unified Run/Pause, Step/Reset, card operations and the six-card limit, unavailable Fourier guidance, phone overview/detail and narrow-width overflow. Existing M4a/M4b browser tests were migrated to select optional cards explicitly instead of assuming every analysis is always visible. Mathematical and worker unit tests remain unchanged because their kernels and data formats were not edited. `npm run check` passed: formatting, TypeScript, 341 unit tests across 44 files, production build, and 166 browser tests across desktop Chromium, phone Chromium and mobile WebKit (two existing platform-specific skips).

Screenshots: [QM desktop](screenshots/m4c0-desktop.png), [QM phone](screenshots/m4c0-phone.png), [Fields desktop](screenshots/m4c0-fields-desktop.png), [Fields phone](screenshots/m4c0-fields-phone.png).

## Source readability and limits

`useField` makes worker ownership explicit; `ToolDeck` has one small presentation-state contract and cannot call a simulation client; `RunPauseControl` documents the batch boundary. `OscillatorHistory` labels update counts rather than Euclidean time. The optional eigensolve guard and cache are next to the analysis implementation. Numerical modules remain independently readable and testable without React. This milestone intentionally defers a universal tool-card framework, conditional worker measurements, persistence of tool preferences across page reloads, archive changes, interacting fields and additional samplers. The existing production bundle exceeds Vite's advisory 500 kB chunk threshold; this did not block the build or browser validation.
