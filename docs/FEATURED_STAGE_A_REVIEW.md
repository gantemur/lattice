# Featured-tool Stage A review — Lattice QM and Lattice Fields

## Scope and behavior

Each pilot workspace has one full-width featured display above zero to six optional two-column gallery cards. QM initially features the current periodic Euclidean path and opens the two-point correlator in the gallery. Fields initially features the current 1D profile or 2D heatmap and opens selected-site/covariance inspection in the gallery. Gallery Add, change, collapse, expand, reorder and remove remain available, along with phone single-detail and compact-overview modes.

The featured selector **replaces** the current featured tool. A gallery card's **Feature** button instead exchanges its whole assignment with the featured assignment, even at gallery capacity. Each assignment has a unique key independent of its model-specific renderer ID; multiple placements may use the same renderer. The Fields latest-update tool and QM gap, effective-gap and reflection summaries are gallery-only because they are compact explanations rather than full-width visualizations. Unavailable Fourier spectra on nonperiodic fields continue to explain the periodicity requirement.

Available Fields tools are configuration, site/covariance inspection, Fourier spectrum, measurement history and latest update. Available QM tools are path, correlator, finite-spacing/continuum gaps, effective-gap table, transfer operator/quadrature, reflection positivity and recent path-average history. This pilot does not migrate the Small Systems, Lattice Systems or Experiments interfaces.

## State ownership and numerical invariants

Moving a renderer between two React containers can remount it. The selected Fourier momentum therefore lives in a small map keyed by assignment in `FieldWorkspace`, and a removed gallery assignment releases its entry. Existing site, path-range and time-lag choices remain owned by their workspaces. A swap carries the assignment key and collapse/width settings; explicit replacement retains the featured placement key. At most one renderer is mounted for each placement. The featured body is always active; an inactive phone gallery body or collapsed card is not rendered.

These operations are React presentation transitions over already delivered snapshots. `ToolDeck` has no worker client or numerical command callback. Gaussian/oscillator actions, exact references, samplers, measurement schedules, seeded RNG streams, parameter segments, worker instances and archive formats are unchanged. The existing independent QM and Fields sessions remain mounted across navigation. A seeded path replay after feature swaps and replacement matches the same first draw after Reset. Optional transfer quadrature remains lazy for an open, active tool body and uses its existing parameter cache; listing it in a chooser does not run it. Existing quality warnings remain with the active analysis.

## Validation and visual review

The pure assignment tests cover distinct keys and repeatable tool IDs, the independent six-card bound, add/move/remove, explicit replacement at capacity, whole-assignment swap and ineligible or stale commands. Production-browser tests cover both initial full-width defaults, feature/gallery exchange, replacement without eviction, Fourier momentum through two swaps and phone overview, one mounted Fourier renderer, seeded replay, desktop two-column gallery, tool changes across parameter changes and navigation, lazy transfer activity and narrow-width overflow. Existing numerical unit tests and worker tests are retained.

`npm run check` passed formatting, TypeScript, 348 unit tests across 45 files, the production build and 172 browser tests across desktop Chromium, phone Chromium and mobile WebKit (two existing platform-specific skips). [QM desktop](screenshots/featured-stage-a-qm-desktop.png), [QM phone](screenshots/featured-stage-a-qm-phone.png), [Fields desktop](screenshots/featured-stage-a-fields-desktop.png) and [Fields phone](screenshots/featured-stage-a-fields-phone.png) show the pilot layouts. The full-width visualizations retain their original coordinate conventions, fixed field scale and clipping disclosure. The production bundle still exceeds Vite's advisory 500 kB chunk size; the build and browser checks complete successfully.

## Source readability and next stage

`toolAssignments.ts` contains named, pure operations for adding, removing, moving, replacing and featuring assignments, with short tests that do not need React. `ToolDeck.tsx` renders those assignments and explains its remount boundary next to the keyed body. The pilot workspaces continue to select their own mathematical tools; no plugin registry, worker-side conditional measurements or new physics abstraction was added. Stage B may standardize the formula/settings sidebar, mathematics/exercises section and other workspaces; the named-example catalog and interacting models remain later work.
