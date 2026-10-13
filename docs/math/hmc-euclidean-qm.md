# Hamiltonian Monte Carlo for a Euclidean quartic path

This guide describes the HMC option on Lattice QM's quartic/double-well page. The [interacting-oscillator guide](interacting-oscillator.md) defines the physical path measure and transfer reference; this guide concerns a numerical sampler for that same measure. Source links lead from each equation to its implementation and tests.

## Target path and force

In units ℏ=kB=m=1, the N independent positions are `x₀,…,xₙ₋₁`, with periodic `xₙ=x₀` and Euclidean spacing `a=β/N`. The ordinary product-Lebesgue target is

```text
π(x) ∝ exp[−Sₐ(x)],
Sₐ(x) = Σⱼ [(xⱼ₊₁−xⱼ)²/(2a) + a(r xⱼ²/2 + λxⱼ⁴/4 − h xⱼ)].
```

The closing kinetic bond is counted once; the repeated drawing endpoint at β is not another variable. Differentiating both bonds incident to site j and the full local potential gives

```text
gⱼ(x) = ∂Sₐ/∂xⱼ
      = (2xⱼ−xⱼ₋₁−xⱼ₊₁)/a + a(r xⱼ + λxⱼ³ − h).
```

[`quarticPathAction` and `quarticPathGradient`](../../src/models/quarticOscillator.ts) are pure functions. [`quarticHmc.test.ts`](../../src/algorithms/quarticHmc.test.ts) checks a four-site hand calculation, centered differences of the _full_ action at periodic endpoints across Gaussian, quartic, symmetric/tilted wells and several spacings, and the independent Gaussian precision matrix. A centered difference has `O(d²)` truncation and floating-point cancellation at very small d; it checks implementation, not a symbolic identity.

## Auxiliary Hamiltonian and proposal

At the start of **each** trajectory, draw independent `pⱼ~N(0,1)` and define

```text
H_HMC(x,p) = Sₐ(x) + K(p),       K(p)=Σⱼ pⱼ²/2.
```

The identity auxiliary mass makes momentum refresh easy to inspect. It is unrelated to the particle's physical mass or real-time momentum. [`quarticHmcHamiltonian`](../../src/algorithms/quarticHmc.ts) computes action, kinetic and total separately. The same module's `leapfrogQuartic` makes L steps of size ε using a half momentum kick, a position drift and a final half kick. Adjacent interior half kicks are combined without an extra gradient evaluation. The code records the _actual completed-step_ defects `H_MD(k)−H_MD(0)`, with at most L=32 values, and flips the final momentum. Auxiliary duration `τ_MD=Lε` is an integrator parameter, not the Euclidean coordinate `t=ja` or a physical/Monte Carlo time.

The kick `p←p−(ε/2)g(x)` and drift `x←x+εp` are triangular phase-space shears. Each Jacobian determinant is one; their composition preserves volume. Negating momentum preserves absolute volume. Reversing momentum and applying the same steps again returns to the starting phase point in exact arithmetic. This does **not** make finite-ε leapfrog an exact energy-preserving flow. The tests check practical reversibility for interacting and tilted paths, and independently finite-difference an 8×8 phase-space Jacobian with `|det J|≈1`. At fixed `τ_MD=0.4`, the test halves ε/doubles L and sees roughly fourfold reductions in the chosen smooth state's final `|ΔH|`, consistent with second-order global error; arbitrary stochastic trajectories need not show monotone defects.

The deterministic map with final momentum reversal is an involution in exact arithmetic. [`hmcQuarticTransition`](../../src/algorithms/quarticHmc.ts) accepts its proposed phase point with

```text
ΔH = H_HMC(proposed) − H_HMC(start),
α = exp[min(0, −ΔH)],      accept iff u < α,  u~Uniform[0,1).
```

Thus the Metropolis ratio uses the **complete** action-plus-kinetic change, never only `ΔS`. Gaussian refresh preserves the auxiliary conditional measure, and the reversible volume-preserving map plus this correction satisfies detailed balance for the joint measure. Discarding p after the decision leaves the desired x marginal invariant. A very large _finite_ positive `ΔH` may give α=0 by ordinary exponential underflow; it is still a valid Metropolis rejection. An intermediate nonfinite coordinate, momentum, force or Hamiltonian is a reported numerical divergence: the old x is retained. Even automatic acceptance, ordinary rejection and divergence consume the final decision uniform, so every attempt uses exactly `2N+1` uniforms through the repository's uncached Box–Muller normal draw. Momentum is freshly drawn next time. Tests inject deterministic draws to check this budget, acceptance and rejection.

## Observation and interpretation

One `Step` and one algorithmic transition mean a **whole HMC trajectory**. In contrast, one local Metropolis transition is one selected-site proposal and N such attempts form a nominal sweep. HMC warm-up and measurement stride are in complete trajectories; no intermediate leapfrog position is an equilibrium measurement. A rejected trajectory can still provide the unchanged path at a scheduled measurement. Compatible parameter or sampler changes preserve the current path and RNG while beginning a separate segment with fresh warm-up; Reset and N/model changes start seeded sessions. The global transition number remains monotone across segments, but heterogeneous increments do not represent equal work. [`FieldRun`](../../src/engine/fieldRun.ts) owns all stochastic state and full-segment path aggregates, [`FieldClient`](../../src/engine/fieldClient.ts) requests at most 16 HMC trajectories per Run batch, and a direct HMC worker advance is bounded by 32. Rendering and the independent transfer-analysis worker do not draw from the sampling RNG.

The optional [`QuarticHmcDiagnostics`](../../src/app/QuarticHmcDiagnostics.tsx) tool shows acceptance including warm-up, numerical divergences, recent signed defects, full-segment finite-defect mean/RMS/max and actual gradient work. `ΔH` is an **auxiliary integrator defect**, not physical quantum energy, a gap, or cumulative drift over the Markov chain. Small observed `|ΔH|` supports integrator accuracy only. Repeated paths, correlated measurements and a fixed warm-up budget can still hide poor mixing. The double-well path-average sign-change count is sampler- and cadence-dependent, not a physical tunneling rate. One HMC trajectory and one local Metropolis proposal also have very different computational costs; equal transition counts are not equal-cost comparisons. No independent-sample error bar, ESS estimate, automatic tuning or tunneling-rate estimate is supplied.

## Numerical anchors and exercises

The λ=0, r>0 limit is a displaced finite-lattice Gaussian: exact mean `h/r` and raw correlators come from the analytic periodic covariance. Four fixed seeded HMC chains are compared with that reference in [`quarticHmcBenchmark.test.ts`](../../src/engine/quarticHmcBenchmark.test.ts). The same test compares moderate interacting `C(0)` and `C(a)` with the separately resolved finite-spacing transfer calculation, not with the HMC sampler itself. These deterministic tolerance gates are deliberately wider than an independent-sample standard error because the finite Markov chains remain correlated; passing them does not certify every chain's equilibrium. [`quarticHmcRun.test.ts`](../../src/engine/quarticHmcRun.test.ts) tests segment, replay, rejection and history invariants.

1. Differentiate the two kinetic bonds incident to `x₀` for N=4, then add the quartic/tilt derivative. Check `x₋₁=x₃`.
2. With a chosen four-site x and p, perform one half kick, drift and half kick by hand. Compare `H_HMC` before and after; a nonzero `ΔH` is expected at finite ε.
3. Write the block Jacobian of a kick and a drift. Show directly that each triangular shear has determinant one, then explain why the momentum flip changes only the determinant's sign.
4. At fixed `τ_MD`, halve ε while doubling L. Plot the final `|ΔH|` for a smooth state and then for several refreshed random momenta. Explain why the order claim concerns a numerical regime, not monotonic behavior of every trajectory.
