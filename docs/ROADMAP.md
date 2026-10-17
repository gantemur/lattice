# Lattice Lab — Capability overview

This is an index of shipped capabilities and current product limits. Historical milestone labels identify features; they are not instructions to implement additional work. The [functional specification](SPECIFICATION.md) defines the numerical contract, the [source guide](SOURCE_GUIDE.md) maps its implementation, and the [release summary](RELEASES.md) links public validation evidence.

## Implemented scientific core

| Feature                       | Available capability                                                                                            | Independent baseline                                                                           |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| M0–M0.5                       | Gaussian, single spin, binomial; direct/local sampling, transition inspection, isolated histories               | Analytic moments, exact discrete laws, transition matrices, seeded replay                      |
| M1a                           | Tiny graph Ising, stable physical edges/faces, local inspection                                                 | Full finite enumeration, local/full action comparison, balance                                 |
| M1b                           | One-to-four real scalars, Gaussian pairs, quartic wells and conditional views                                   | Cholesky covariance, controlled independent-site quadrature                                    |
| M2                            | Open/periodic 2D Ising up to 64×64, local Metropolis/heat bath                                                  | Stable exact 2×2 reference throughout physical bounds                                          |
| M3a                           | Ising physical observables, spatial correlations, bounded ACF/ESS/SE                                            | Exact finite-state Markov spectra; matched measurement units                                   |
| M3b1–M3b2                     | Memory-only segment library, portable JSON/CSV, bounded independent Ising sweeps                                | Atomic import/provenance checks; independent point replay; point-specific ACK                  |
| M4a1–M4a2                     | Massive 1D/2D Gaussian fields, periodic Fourier draws and mean-zero GFF                                         | Dense precision/covariance, spectral pseudoinverse, scale-aware reality checks                 |
| M4b, M4c1–M4c2                | Harmonic and interacting Euclidean QM, quartic-path HMC                                                         | Finite-spacing/continuum harmonic formulas, refined transfer quadrature, full-force HMC checks |
| M4d1–M4d2                     | Spatial φ⁴, local Metropolis and HMC                                                                            | Gaussian limit, independent/dimer quadrature, periodic-chain/QM correspondence                 |
| M5a–M5b                       | Tiny Z₂ and compact U(1) gauge theory                                                                           | Gauge invariance, exact enumeration, controlled Bessel/character references                    |
| M5c–M5d                       | Potts, eligible FK/Edwards–Sokal and Swendsen–Wang                                                              | Finite-state balance, absolute partition identities, independent joint/BFS oracle              |
| M5e                           | Classical XY, von Mises heat bath and oriented lattice vortices                                                 | Independent angular quadrature, conditional sampling, winding and neutrality invariants        |
| Model pages and examples      | Five mounted workspaces, featured display plus six optional tools, grouped examples, custom simple Ising graphs | Display-only seeded capture/replay, old hash/URL/archive compatibility, phone controls         |
| 1D Ising and local inspection | Open chains/periodic rings, exact transfer correlation, selectable 5×5 neighborhood                             | Finite enumeration/transfer formulas, boundary and repeated-image tests                        |

## Current limits

- All computation remains in the browser. Size, history, reference and archive budgets are model-specific and explicit.
- Tiny exact results do not imply exact large-volume solutions. Coupled quartic marginals generally remain sampled; finite-grid transfer values have resolution gates.
- Warm-up budgets and a few seeded trajectories do not establish equilibrium. Local-chain errors are correlated; unsupported uncertainty, continuum or critical-point claims are withheld.
- The portable library supports existing Small Systems/Ising captures and Ising sweeps. New gauge, Potts/FK, XY and field/QM archive schemas are not implemented.
- Gauge geometries remain tiny. There is no arbitrary face editor, gauge HMC, general noninteger-q random-cluster dynamics, XY cluster/HMC sampler, helicity-modulus/BKT fit, or universal simulation framework.
- Browser phone emulation does not establish low-end physical-device throughput. The production build currently reports a nonfatal main-chunk size advisory.
- A software/documentation license remains undecided.

## Validation standard

A delivered feature connects a defined model, a real numerical calculation, inspectable measurements and usable desktop/phone presentation. Independent exact formulas or reference calculations, sampler/RNG invariants, parameter-segment isolation, bounded storage, old data/URL compatibility and a complete production-browser pipeline provide the acceptance evidence. Mathematical and presentation limits belong beside the relevant feature, not in implied promises of future scope.
