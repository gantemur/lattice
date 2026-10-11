# Periodic Fourier Gaussian fields and the mean-zero GFF

Start with the [bond geometry](../../src/domain/fieldLattice.ts) and [dimensionless action](../../src/models/gaussianField.ts): `S(φ)=rΣφ²/2+Σ_bκ_b(φ_tail−φ_head)²/2−jΣφ`. Sites and frequencies use row-major `x+Lx y`. A periodic length-two direction has two separate bonds; that multiplicity is essential to the Fourier eigenvalue.

[`fieldFourier.ts`](../../src/models/fieldFourier.ts) implements the direct finite transform

`F(k)=Σ_x f(x) exp(−2πi(kx x/Lx+ky y/Ly))`, `f(x)=N⁻¹Σ_k F(k) exp(+2πi(kx x/Lx+ky y/Ly))`.

For a chain, omit the y coordinate. Its [`fieldFourier.test.ts`](../../src/models/fieldFourier.test.ts) checks an independent direct phase sum, inverse, Parseval `Σ|f|²=N⁻¹Σ|F|²`, real-input conjugate symmetry and Nyquist modes. Applying `Q` to cosine modes independently checks `λ(k)=r+4κx sin²(πkx/Lx)+4κy sin²(πky/Ly)` (omit y on a chain). A two-site periodic chain has `λ=(r,r+4κx)`; a periodic anisotropic 2×2 rectangle has `(r,r+4κx,r+4κy,r+4κx+4κy)`.

[`spectralGaussianField`](../../src/models/gaussianFieldSpectral.ts) uses `μ=j/r`, `Cᵢⱼ=N⁻¹Σ_k cos(k·(i−j))/λ(k)` and `log Z=N log(2π)/2−Σ_k log λ(k)/2+N j²/(2r)` for the ordinary massive product-Lebesgue measure. Its tests compare [the independent dense Cholesky reference](../../src/models/gaussianFieldReference.ts) for multiple geometries and nonzero source. In particular `Var(N⁻¹Σφ)=1/(Nr)`.

The massless model has `r=j=0`, periodicity in every direction and positive stiffness on each active axis. `λ(0)=0`; remove this mode and use the **induced Euclidean measure** on the `(N−1)`-dimensional subspace `Σφ=0`. The reference gives `C=Q⁺` and `log Z=(N−1)log(2π)/2−Σ_{k≠0}log λ(k)/2`. This differs from inserting `δ(Σφ)` into the ambient product measure by a factor `√N` in Z. Tests check `QC=I−11ᵀ/N`, `C1=0`, nonnegative quadratic forms and, independently, `C=(Q+11ᵀ/N)⁻¹−11ᵀ/N` via dense Cholesky. For two periodic sites and stiffness κ, `C=[[1,−1],[−1,1]]/(8κ)`.

[`drawSpectralField`](../../src/algorithms/spectralFieldSampler.ts) draws N independent real standard normals in site order, Fourier transforms them, divides each retained coefficient by `√λ(k)`, and inverse transforms. Because the input is real, `F(−k)=conj F(k)`; a real symmetric filter also covers self-conjugate Nyquist modes. The constrained version zeros `k=0` and subtracts only a roundoff residual spatial mean. Each whole-field draw uses exactly `2N` seeded uniforms from the same uncached Box–Muller convention as M4a1. Step and Run call the same [`FieldRun.advance`](../../src/engine/fieldRun.ts) path. An ordinary fixed-neighbor conditional is invalid on the constrained support: once the other `N−1` values are fixed, the last value is determined.

[`sampledModePower`](../../src/observables/fieldSpectrum.ts) obtains `P(k)=E[|F(φ−μ)(k)|²]/N` from full-segment `E[φᵢφⱼ]` and site means. The exact power is `1/λ(k)` for retained modes. [`FieldSpectrum`](../../src/app/FieldSpectrum.tsx) selects modes without sampling; eviction of 256-vector display history leaves the aggregate unchanged. The removed zero mode has no ordinary Gaussian power. Sample power has no uncertainty or autocorrelation adjustment.

Suggested exercises: (1) hand-calculate the periodic two-site precision and explain its `4κ` nonzero eigenvalue; (2) change `κx` on a 2×2 torus and predict which modes move; (3) derive the `√N` normalization difference between the induced and delta-function constrained measures; (4) use [`spectralFieldSampler.test.ts`](../../src/algorithms/spectralFieldSampler.test.ts) to compare ensemble action with `(N−1)/2`.
