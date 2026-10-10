# Lattice Lab

**Status:** Design stage (specification v0.1; no simulator implemented yet).

Lattice Lab is a browser-based laboratory for teaching and small-scale exploration of statistical mechanics, Euclidean lattice quantum mechanics, and lattice field theory. Its emphasis is on mathematical structure, observable quantities, transparent algorithms, and comparisons with exact results wherever possible.

The project lives at [gantemur/lattice](https://github.com/gantemur/lattice), separate from [SOL](https://gantemur.github.io/sol/). Its intended static GitHub Pages URL is [gantemur.github.io/lattice/](https://gantemur.github.io/lattice/), without a backend or user accounts. The project name remains **Lattice Lab**.

## Workspaces

- **Small Systems:** four principal variable-plot slots, independent of the number of physical variables. Select which four variables to inspect when there are more than four; the graph/lattice visualization is separate. Planned graph presets include a path, open square, four-site periodic ring, complete graph, and a genuine periodic 2×2 square lattice (eight oriented link variables for a link-based gauge model).
- **Lattice Systems:** interactive 1D and 2D lattices with configuration views, numerical samplers, and observables.
- **Experiments:** stored runs, parameter sweeps, theory/simulation comparisons, error analysis, and exports (delivered incrementally, not all at launch).

These are UI workspaces, not separate physics engines. They share model definitions, samplers, measurements, and reproducibility facilities.

## Read first

1. [Living specification](docs/SPECIFICATION.md): project requirements, physical/mathematical conventions, architecture, and test standards.
2. [Development roadmap](docs/ROADMAP.md): staged delivery plan and acceptance gates.
3. [Design decisions](docs/DECISIONS.md): rationale and history of key decisions.
4. [Agent instructions](AGENTS.md): operating rules for coding agents and contributors.

## Development status

The documents describe an intended implementation, not features already available. First milestone: a deployable mobile-friendly shell and a verified small-system model. See the roadmap for the current sequence.

## Hosting and technology (proposed)

A TypeScript/Vite static application, with an accessible component UI, Web Worker computation, canvas/SVG rendering, and lightweight charting. The framework and plotting-library choices are implementation preferences, not mathematical contracts. GitHub Actions will build, test, and deploy the static output to GitHub Pages. For the repository `gantemur/lattice`, configure Vite's base path as `/lattice/`.

## Conventions

Models, methods, datasets, and displays must be distinguishable. A Monte Carlo step is an update of a sampling algorithm, **not physical time evolution**. Plots need clear axes, units/conventions, equilibration status, and uncertainty labels. Exact, quadrature-reference, numerical Monte Carlo, and heuristic predictions must not be presented as interchangeable.

## License

**To decide before the first public release.** Do not assume permission to reuse code or documentation until an explicit license has been added.
