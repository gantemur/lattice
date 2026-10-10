# Instructions for coding agents and contributors

## Read order

Before significant work, read `README.md`, `docs/SPECIFICATION.md`, `docs/ROADMAP.md`, and `docs/DECISIONS.md`. Treat the specification as a **living design contract**, not as a request to implement every feature at once. Work from the current milestone and acceptance criteria in the roadmap.

## Working method

1. Identify the smallest coherent vertical slice (a real model + update/sampling + display + verifiable output).
2. Before coding, state assumptions and the relevant mathematical conventions. If a proposed change conflicts with an accepted decision, document it instead of silently changing behavior.
3. Keep domain and model types separate from samplers, statistics, visualization, and React/component state.
4. Add unit tests for every new energy calculation, local action difference, exact result, and sampler invariant. Cover small pathological geometries: periodic 1×4, periodic 2×2, parallel edges, and self-links.
5. Make the browser usable on a phone at every milestone. Settings should be collapsible and controls accessible by touch/keyboard.
6. Validate `build`, `typecheck`, unit tests, and at least one browser smoke test before declaring a milestone complete. If a command cannot run, report the limitation plainly.
7. Update the roadmap and spec when behavior changes. Do not quietly mark aspirational or simulated functionality as implemented.

## Mathematical guardrails

- A graph edge has a unique ID. Never deduplicate edges merely because endpoints match. Periodic length-two axes generate parallel bonds; length-one axes may generate self-links.
- Distinguish site, link, and face variables. A compact U(1) gauge field generally lives on oriented **links**, not vertices. Check invariance of gauge observables under local gauge transformations.
- Be explicit about energy/action convention, factor of beta, field normalization, nearest-neighbor multiplicity, and boundary conditions.
- A Monte Carlo step is *not* physical time. Define proposal/transition, sweep, sample, and rendered frame separately.
- Separate warm-up samples from retained measurements. A changed physical parameter starts a new measurement segment; never merge measurements under different target measures.
- Label exact enumeration, analytical expressions, high-accuracy quadrature references, and Monte Carlo estimates distinctly. Give uncertainty estimates only when supported by the sampling record.
- Sampling/display rate must not alter the seeded random-number sequence for equivalent algorithmic updates.
- Catch invalid, non-normalizable, and singular models. Massless Gaussian periodic models need an explicit zero-mode convention.

## Scope control

Do not build infrastructure for hypothetical 3D or production-scale lattice QCD before the milestone requires it. Prefer simple, well-tested extensions to universal plugin abstractions. No backend, account system, cloud jobs, or external persistent service without an explicit design decision.

## Documentation maintenance

A feature PR should state: user-visible change, relevant specification section, numerical validation, UI/mobile validation, and remaining limits. If architecture changes substantially, add a dated decision to `docs/DECISIONS.md`. Keep the main specification readable; move long implementation details to focused docs only when needed.
