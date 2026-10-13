# M5a — Tiny Z₂ lattice gauge theory review

**Branch:** `codex/m5a-z2-gauge`. **Verified base:** `fca9e1fab7ebd4d3dff5ff2e25578ad6cf366842`, matching fetched origin/main before implementation. Work reuses a clean managed checkout; unrelated original-checkout screenshots and earlier recoverable stashes remain untouched. Implementation and the complete local pipeline are complete; remote release and live deployment verification are pending.

## Architecture plan and delivered slice

Reuse only the existing oriented Domain and square/torus presets, established Mulberry32 RNG, Welford moments and configurable ToolDeck. Introduce a pure link model, independent reference module, explicit one-/three-uniform samplers and a separate gauge run/client/worker. A narrow presentation launcher adds two Small Systems choices without widening the legacy Model union. Keep old numerical engines, routes, archive/sweep formats and all 20 named recipes unchanged. This is the implemented architecture; no universal model runner or navigation redesign was needed.

The two examples feature an interactive diagram showing 4 or 8 physical links, orientation, IDs, wrap arcs, values, selected vertex/link/face and plaquette signs. Accessible selectors complement keyboard/touch targets. Optional tools show full-segment invariant means and plaquette-sign counts, exact references, loop inspection, worker-owned symmetry preview/apply, bounded measured histories, winding joint counts and the actual latest transition. Six gallery cards and phone detail/overview behavior come from the existing ToolDeck. Phone settings initially collapse. Gauge and legacy Small Systems workers remain mounted independently after first use; ordinary tab visibility never samples or resets them.

## Scientific conventions and checks

The dimensionless classical Euclidean action is `S=−K ΣP`, K∈[−4,4], with counting measure over every unfixed link word and no additional beta. The initial all-positive word is unmeasured. The original oriented topology retains 4 vertices/4 links/1 face or 4 vertices/8 links/4 faces. Local differences count odd face-edge incidence, with one affected open face or two distinct torus faces. Gauge transformations act at vertices while physical variables live on links.

Exhaustive tests cover every one of 16 open and 256 periodic states, all 16 vertex-sign assignments, all elementary link flips, every declared Wilson loop and reversed walks. They verify invariance, involution, global-sign identity, the torus plaquette constraint, distinct edge/wrap records and independent full-action differences. Orbit enumeration finds eight states per orbit, two open orbits and 32 torus orbits; eight allowed torus plaquette patterns each have 32 link words. Plaquette pattern plus fixed winding signs distinguish the orbits.

Exact log-sum-exp enumeration is checked against independently implemented closed formulas at K=−4,−0.7,0,0.7,4: open Z=16 cosh K, torus Z=256 cosh⁴K(1+tanh⁴K), plaquette/action means, every distinct face-pair expectation, winding means and four joint probabilities. No reference consumes simulation randomness.

The torus representatives are Wx=e0·e2 and Wy=e1·e5. The two-face walk `+e0 +e2 +e1 −e6 −e4 −e1` is a contractible lifted rectangle with a self-touching periodic projection. Its product is Pf0·Pf1. The reduced boundary of the wrapped two-face union has two components; the repeated connector is retained to give an actual closed walk. This subtlety is explained in source, UI and [mathematics](math/z2-gauge.md), rather than hiding the multigraph behind a simple-square drawing. Gauge transformations preserve winding; local MC flips need not.

Direct CDF sampling consumes exactly one uniform. Lazy link Metropolis consumes exactly three in link/lazy/decision order, even for stays or rejection. Independent full transition matrices verify detailed balance at positive, zero and negative K on both geometries. Positive finite-K flip probabilities connect the state hypercube; self-probability ≥1/2 establishes aperiodicity. Acceptance excludes intentional self-proposals; counts include warm-up; hypothetical flip cost is separate from actual ΔS.

## Worker, storage and distribution evidence

Step, unequal batches and Reset replay; direct/no-warm-up cadence; complete local sweep warm-up/stride; unchanged scheduled measurements; state/RNG-preserving K and sampler segments; eight-segment eviction; full-moment and sign/winding-count retention after history eviction; and fresh geometry initialization are covered. A single bounded ring keeps the latest 256 transitions per segment, with an explicit measurement flag; the history plot uses only scheduled retained records. Full-segment statistics never depend on rendering or ring retention.

A transformation requires a paused acknowledged client and exact worker run/version. Tests verify unchanged RNG draws, update/sample/segment counts and aggregate history, a distinct event and increased version, invalid/stale command atomicity and double-transform identity. Coupled local chains remain related by the same vertex transform for 200 subsequent updates, with identical gauge-invariant observables and random draws. Client tests reject busy/running transformations without posting a command and protect one-batch ordering and stale replies.

Equilibrium tests use seeds 17, 271, 12345 and 89231, K=−0.7,0,0.7 and both geometries/samplers. Each direct run retains 12,000 draws. Each local run uses 200 warm-up sweeps then 12,000 observations at stride two sweeps: 48,000 retained observations per ensemble. Fixed absolute gates are 0.025 (direct) and 0.045 (local) for plaquette/pair/winding means and joint probabilities, with an action gate scaled by face count/coupling. These deliberately conservative finite-run checks passed without tuning to a seed. They neither assign independent-sample error bars to a local chain nor establish high-|K| mixing.

### Recorded ensemble means

Each entry pools four independent seeded runs with equal budgets (48,000 observations total), not different physical parameter segments. Exact values are from the independent formulas; the table reports mean plaquette.

| Geometry | K | Exact | Direct | Lazy local Metropolis |
| --- | ---: | ---: | ---: | ---: |
| Open | −0.7 | −0.60436778 | −0.60704167 | −0.61112500 |
| Open | 0 | 0 | 0.00075000 | −0.00250000 |
| Open | 0.7 | 0.60436778 | 0.60012500 | 0.61112500 |
| Torus | −0.7 | −0.72799396 | −0.72656250 | −0.72887500 |
| Torus | 0 | 0 | −0.00297917 | 0.00033333 |
| Torus | 0.7 | 0.72799396 | 0.72631250 | 0.72887500 |

At torus K=0.7 the sampled mean actions are −2.033675 (direct) and −2.04085 (local), against −2.038383096 exact. Joint winding frequencies, in (−−,−+,+−,++) order, are (0.250792, 0.250500, 0.249146, 0.249563) direct and (0.242333, 0.247625, 0.254979, 0.255063) local, against (0.25,0.25,0.25,0.25). Contractible pair and winding-mean gates also pass. These are reproducible numerical observations, not confidence intervals.

## UI, validation and performance

The 48 new numerical/protocol cases pass; all 487 pre-existing unit tests also pass. Production browser tests cover all physical links, presets, parameters/segments, direct/local sampling, gauge preview/apply, loops, exact guidance, tool capacity and display-only seeded replay on desktop Chromium, 360px Chromium and mobile WebKit. The original catalog browser expectations now allow exactly two additional entries while retaining its original groups and numerical examples. Initial browser validation caught and corrected unreliable curved SVG hit targets; dedicated label targets now support touch and keyboard while visible paths remain clickable. Assertions are scoped to the active gauge deck because other workspaces deliberately remain mounted.

Screenshots: [desktop](screenshots/m5a-desktop.png), [phone](screenshots/m5a-phone.png), [mobile WebKit](screenshots/m5a-mobile-webkit.png). The full `CI=1 npm run check` passed formatting, TypeScript, **535 unit tests in 72 files**, production build and **340 browser tests with the two existing skips unchanged**. No new skips or retries were needed in the final run. `git diff --check` and 134 relative documentation links passed. No dependency, legacy numerical kernel, archive schema or sweep change is included. The existing large-main-chunk build advisory remains (main JS about 681 kB minified / 197 kB gzip).

The measured workload is Run click → first increased worker update rendered → acknowledged Pause, with 128-attempt torus batches: **136 ms desktop Chromium, 218 ms 360px Chromium, 115 ms mobile WebKit** in the final complete pipeline. These include browser scheduling and polling, not isolated kernel timings or guarantees for physical phones. They support the deliberately small fixed batch without an optimization framework.

## Readability and remaining limits

The [source guide](SOURCE_GUIDE.md) links geometry → pure model → independent formulas → explicit sampler draws → worker state/measurements → presentation launcher and tools. Hand-checkable one-link examples accompany exhaustive and ensemble tests. Numerical modules are React-independent; comments explain incidence parity, loop projection, RNG order, acknowledgment ownership and retention.

No U(1), arbitrary/larger topology, gauge fixing, matter, quantum dynamics, conserved-winding claim, critical-temperature claim, gauge archives/sweeps or uncertainty/ESS estimator is implemented. High-|K| local sampling can mix slowly. Finite enumeration is intentionally tiny; readable reference implementations take priority over a new optimization framework. U(1) may reuse oriented IDs and walks but needs its own group arithmetic, measure normalization, transformations, samplers and independently validated references.

## Release evidence

The complete local release gate has passed. The implementation commit, remote main/workflow and public-site results will be recorded after the authorized PR or ordinary fast-forward release; local success alone is not a deployment claim.
