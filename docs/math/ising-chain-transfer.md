# The one-dimensional Ising chain and its spatial transfer matrix

Consider $N$ spins $s_i\in\{-1,+1\}$, physical coupling $J$, field $h$, and $k_B=1$:

\[
H(s)=-J\sum_{(i,i+1)}s_i s_{i+1}-h\sum_i s_i,
\qquad P(s)=Z_N^{-1}e^{-H(s)/T}.
\]

An open chain has bonds $(0,1),\ldots,(N-2,N-1)$, with $2\le N\le64$. A periodic ring adds $(N-1,0)$, with $3\le N\le64$. Each actual bond occurs once. A periodic two-site chain, which would have two parallel bonds, remains a separate small-graph lesson. The Lattice Systems chain uses physical $J,h,T$, unlike Small Systems graph Ising, whose $K,b$ are already dimensionless. Set $K=J/T$, $b=h/T$.

## Boundary vector and finite partition functions

In the ordered basis $(+1,-1)$, split the field evenly over a bond:

\[
T_{s,t}=\exp[Kst+b(s+t)/2],\qquad
T=\begin{pmatrix}e^{K+b}&e^{-K}\\e^{-K}&e^{K-b}\end{pmatrix}.
\]

For a ring, $Z_N=\operatorname{Tr}(T^N)$. An open chain lacks one half-field contribution at each end, so with $v=(e^{b/2},e^{-b/2})^T$,

\[
Z_N=v^T T^{N-1}v.
\]

`transferMatrix` and `finiteChainReference` in [`src/models/isingChainTransfer.ts`](../../src/models/isingChainTransfer.ts) implement these formulas. The latter rescales each positive 2×2 product and adds its logarithmic scale after contraction. This avoids directly forming $\lambda_+^N$, even at the supported $T=0.05$ and $|J|,|h|=10$. Tiny probabilities may still underflow without harming normalized finite-volume observables. The tests in [`isingChainTransfer.test.ts`](../../src/models/isingChainTransfer.test.ts) independently enumerate spin words for $N=2,3,4,5$, high/low temperatures, both boundaries, signs and fields. The four-site ring also agrees with the existing Small Systems exact graph result after $K=J/T,b=h/T$.

## Insertions and finite correlations

With $S=\operatorname{diag}(1,-1)$, a ring has

\[
\langle s_0s_r\rangle_N=
\frac{\operatorname{Tr}(S T^r S T^{N-r})}{\operatorname{Tr}(T^N)}.
\]

At open ends, site means depend on position. For $i\le j$,

\[
\langle s_i s_j\rangle_N=
\frac{v^T T^i S T^{j-i}S T^{N-1-j}v}{Z_N},
\quad
\langle s_i\rangle_N=\frac{v^T T^i S T^{N-1-i}v}{Z_N}.
\]

`finiteChainReference` returns site means, raw and **site-centered** connected correlations. Its displayed displacement value averages $\langle s_i s_{i+r}\rangle$ over the same ordered origins as `axialProducts` in [`src/observables/latticePhysics.ts`](../../src/observables/latticePhysics.ts): $N-r$ origins on an open chain, $N$ wrapping origins on a ring. Open-chain connected values subtract the corresponding $\langle s_i\rangle\langle s_{i+r}\rangle$ before averaging. A single global $\langle m\rangle^2$ is not a general open-chain connected covariance. The default comparison plot shows **raw** finite-$N$ exact and full-segment sampled curves, so both use precisely the same averaging convention.

At $h=0,J>0$, write $u=\tanh K$. The open chain gives $\langle s_i s_{i+r}\rangle=u^r$; the ring gives

\[
\langle s_0s_r\rangle=\frac{u^r+u^{N-r}}{1+u^N}.
\]

The tests use these closed forms independently. For antiferromagnetic $J<0$, signs can alternate; an unsigned positive-exponential fit would discard that information.

The exact physical energy density follows directly from the actual number of bonds, $\langle e\rangle=-J B\langle s_i s_{i+1}\rangle_{\mathrm{bond}}/N-h\langle m\rangle$, where $B=N-1$ or $N$. The finite-volume susceptibility here is $\chi=\operatorname{Var}(M)/(NT)$, $M=\sum_i s_i$, evaluated from all pair insertions. No exact Binder or heat-capacity number is claimed by this module.

## Spectrum and bulk decay length

The symmetric positive-entry matrix has $\lambda_+>0$ and a signed second eigenvalue:

\[
\lambda_\pm=e^K\cosh b\pm
\sqrt{e^{2K}\sinh^2 b+e^{-2K}},\qquad
\lambda_+\lambda_-=e^{2K}-e^{-2K}.
\]

`transferSpectrum` uses the determinant to recover the small second eigenvalue without subtracting nearly equal eigenvalues, and returns normalized orthogonal eigenvectors. For the infinite homogeneous chain,

\[
\xi^{-1}=-\log\left|\frac{\lambda_-}{\lambda_+}\right|.
\]

At $h=0,J>0$, this reduces to $\xi^{-1}=-\log\tanh(J/T)$. At $J=0$, the subleading mode vanishes and $\xi=0$; for $J<0$, the negative ratio adds alternating signs while $\xi$ remains a positive decay length. At extremely low temperature the two eigenvalues may be indistinguishable in floating point. The UI reports an unresolved length rather than unsupported precision. It also warns when a resolved bulk $\xi>N$: a finite chain then need not show an asymptotic decay regime. The ordinary nearest-neighbor 1D Ising model has no finite-temperature phase transition. Large low-temperature $\xi$ is not a finite-$T$ singularity.

## Sampling and three operators

The chain is represented by `lx=N, ly=1, periodicY=false, jy=0` in [`indexedLattice.ts`](../../src/domain/indexedLattice.ts), with zero vertical bonds. The existing [`latticeTransition.ts`](../../src/algorithms/latticeTransition.ts) supplies random-site lazy Metropolis and heat bath unchanged; [`latticeRun.ts`](../../src/engine/latticeRun.ts) records one measurement after the requested number of nominal sweeps, where a sweep is $N$ site selections with replacement. Algorithmic updates are **not** physical time. The y bond moment has count zero and null summary values; the y spatial series is empty. Legacy 2D captures retain their original populated y data and validation.

Do not conflate three spectra:

1. The **spatial Ising transfer matrix** above controls equilibrium partition functions and spatial decay.
2. The **Monte Carlo transition matrix** of the chosen sampler controls update-time mixing and autocorrelation.
3. The **Euclidean QM transfer operator** in Lattice QM relates imaginary-time propagation to quantum excitation energies.

The ratio $\lambda_-/\lambda_+$ here is a spatial statistical-mechanics quantity, not a harmonic-oscillator quantum gap or a real-time dynamics rate.

Suggested exercises: enumerate all $2^3$ configurations of an odd antiferromagnetic ring and compare its frustration with the transfer trace; derive the $h=0$ open and ring formulas; compute an open-chain connected covariance at nonzero field using its two distinct site means; compare Metropolis and heat-bath autocorrelation at fixed $N,J,h,T$ while holding the exact spatial $\xi$ fixed.
