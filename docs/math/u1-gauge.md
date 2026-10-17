# Compact U(1) on a plaquette and a tiny torus

M5b is a classical finite Euclidean probability model. Its coordinates are
**oriented link phases**, not XY site spins, electric fields, a Gauss-law Hilbert
space or real-time trajectories. Choose Small Systems → Small gauge systems.

## Links, orientation and normalized measure

The unchanged [graph domain](../../src/domain/graph.ts) supplies an open square
(4 vertices, 4 independent links, 1 face) or a periodic 2×2 torus (4 vertices,
**8 independent links and 4 faces**). The small shared
[gauge geometry](../../src/domain/gaugeGeometry.ts) preserves the released IDs,
parallel wrap bonds and signed closed walks. It contains no group arithmetic.

Each link has $U_e=e^{i\theta_e}$, with canonical representative
$\theta_e\in[-\pi,\pi)$. Reverse traversal gives
$U_e^{-1}=\overline{U_e}$, generally different from $U_e$. For a signed face,

$$
U_f=\prod_{(e,\epsilon)\in\partial f}U_e^\epsilon,
\qquad \theta_f=\operatorname{wrap}\sum_{(e,\epsilon)\in\partial f}
\epsilon\theta_e.
$$

The target is

$$
S_K=-K\sum_f\cos\theta_f,\qquad
 dP_K=Z(K)^{-1}e^{-S_K}\prod_e\frac{d\theta_e}{2\pi},
\qquad -4\le K\le4.
$$

Normalized product Haar measure gives **Z(0)=1** on both geometries. There is no
factor 16 or 256 as in the released Z₂ counting convention, no $(2\pi)^E$
factor, no gauge quotient, and no extra inverse temperature. The alternative
Wilson action $K\sum_f(1-\cos\theta_f)=S_K+KF$ has the same normalized law but
partition function $e^{-KF}Z$; that is not the action used here.

[`u1Gauge.ts`](../../src/models/u1Gauge.ts) implements `wrapAngle`, `phase`,
`multiplyPhase`, `conjugatePhase`, `plaquetteAngles`, `wilsonPhase` and
`circularDifference`. Angles near opposite ends of the interval may be nearby
on the circle; compare wrapped differences or complex phases. A plotted branch
crossing is not a discontinuity in the group element.

## Local action and gradient

Signed incidence is $c_{fe}=\sum_{\partial f:e}\epsilon$. It is an integer,
not the Z₂ odd-occurrence rule. For an angular displacement δ on link e,

$$
\Delta S=-K\sum_f[\cos(\theta_f+c_{fe}\delta)-\cos\theta_f],
\qquad \frac{\partial S}{\partial\theta_e}
 =K\sum_f c_{fe}\sin\theta_f.
$$

`u1LocalDifference` and `u1Gradient` implement these expressions. A link meets
one open face or two torus faces; both contributions are required. With only
e0=π/2 and all other angles zero, S is zero on the square and −2K on the torus.
The [model tests](../../src/models/u1Gauge.test.ts) check full-action differences
across branch cuts and centered finite differences. The gradient is a pure
primitive; compact-gauge HMC is not implemented.

## Vertex symmetry and Haar invariance

For $g_v=e^{i\alpha_v}$, `u1GaugeTransform` applies

$$
U_{v\to w}\mapsto g_vU_{v\to w}\overline{g_w},\qquad
\theta_{v\to w}\mapsto\operatorname{wrap}(\theta_{v\to w}+\alpha_v-\alpha_w).
$$

Every closed walk cancels its vertex factors, so its holonomy and the action
are invariant. Transformations compose by phase addition; a uniform vertex
phase acts trivially. Each link coordinate undergoes a fixed circle
translation, preserving $d\theta/(2\pi)$. Consequently the entire product Haar
measure, action weight, partition function and Gibbs law are invariant. Tests
illustrate this proof but do not replace it.

The selected-vertex preview is read-only. Apply requires a paused, acknowledged
worker and exact run/version identity. It changes angles and version, records
a deterministic event, and changes **no RNG, updates, measurements or segment**.
Invariance is exact mathematics with floating-point tolerance in the program.
Coupled subsequent proposals remain gauge-related up to roundoff; bitwise
reproducibility is promised only for the same settings/command sequence/build,
not between transformed and untransformed coordinate computations.

## Closed loops and periodic topology

The fixed positive winding walks are Wx=`+e0 +e2` and Wy=`+e1 +e5`.
The two-face walk is `+e0 +e2 +e1 −e6 −e4 −e1`, giving **Uf0 Uf1**.
The repeated e1 connector cancels by inversion. As in M5a, this contractible
lifted rectangle has a self-touching torus projection. The reduced boundary
of the wrapped two-face union has two components; it is not an embedded disk
with an ordinary simple planar boundary.

On the torus each link occurs with opposite signs in the complete face sum:

$$
\prod_f U_f=1,\qquad \sum_f\theta_f=0\pmod {2\pi}.
$$

Principal angles may sum to a **nonzero integer multiple of 2π**. Tests include
that case and check the group product rather than a false literal-zero rule.
A different winding representative can differ by intervening curvature.
Gauge transformations preserve winding holonomies, but local updates can change
them; they are not conserved Markov-chain sectors. No topological-charge
estimator is introduced.

## Independent finite-volume references

The open face marginal relative to ordinary dθ is

$$
Z_{\rm open}=I_0(K),\quad
\langle U_f\rangle=\frac{I_1(K)}{I_0(K)},\quad
\rho(\theta)=\frac{e^{K\cos\theta}}{2\pi I_0(K)},\quad
\langle S\rangle=-K\langle\Re U_f\rangle.
$$

This is a **plaquette-angle** distribution, not a raw-link distribution.
Its imaginary mean is zero by complex conjugation. At K=0.7,
I0=1.126303018306809 and I1/I0=0.330177289532671.

Expand $e^{K\cos\theta}=\sum_{n\in\mathbb Z}I_n(K)e^{in\theta}$.
Every independent link integration enforces equal character labels on adjacent
faces, leaving one common integer label on the closed torus:

$$
Z_{\rm torus}=\sum_{n\in\mathbb Z}I_n(K)^4,
\quad
\langle U_f\rangle=\frac{\sum_n I_{n+1}(K)I_n(K)^3}{Z},
\quad
\langle W_{\rm pair}\rangle=\frac{\sum_n I_{n+1}(K)^2I_n(K)^2}{Z}.
$$

The face mean also equals $\frac14\partial_K\log Z$.
The two-face insertion measures $\langle\cos(\theta_f+\theta_g)\rangle$,
**not** $\langle\cos\theta_f\cos\theta_g\rangle$. Their independent integrals
are visibly different. At K=0.7 the three torus anchors are
Z=1.647524496051455, face=0.359714439270084 and pair=0.213650981795920.
Changing K to −K preserves Z and pair but reverses the face mean.

The two global flat holonomies remain Haar distributed in this plaquette-only
law. Thus both winding real/imaginary means vanish and their individual angle
densities are $1/(2\pi)$. A finite local run may explore them poorly even when
its plaquette statistics agree with theory. The UI makes no mixing inference
from acceptance or agreement alone.

## Numerical convergence controls

[`u1GaugeReference.ts`](../../src/models/u1GaugeReference.ts), `besselI`, uses

$$
I_n(x)=\sum_{k\ge0}\frac{(x/2)^{2k+n}}{k!(n+k)!},\qquad x\ge0,\ n\ge0.
$$

Adjacent power terms have decreasing ratio
$x^2/[4(k+1)(n+k+1)]$. Once this ratio is below one, the next term divided by
one minus that ratio bounds the remaining positive tail. A conservative
operation-count floating-point allowance is added. Negative order uses
I−n=In; negative argument uses In(−x)=(−1)^n In(x). For torus numerators all
terms have common sign (odd insertion) or positive sign (even insertion), so
positive sums avoid cancellation, with parity restored afterward.

`u1Reference` sums n=−N…N. Let q=|K|/[2(N+1)]<1. Since
$I_{n+1}\le |K|I_n/[2(n+1)]$, the combined omitted tails for insertion
power p=0,1,2 have bound

$$
I_N(|K|)^4\frac{q^{4-p}+q^{4+p}}{1-q^4}.
$$

p=0 gives the two partition tails. The $q^{4-p}$ term is essential for the
negative-index tail's shifted $I_{m-1}$ factor. Coefficient errors and sum
roundoff are included, then propagated through numerator/Z using a positive
lower denominator. The default gate is 10⁻¹², relative for Z and absolute for
loop expectations, with maximum N=64. The UI reports actual N and allowances.
These are conservative numerical engineering bounds, not directed-rounding
interval certificates. Accuracy requests below 10⁻¹² or above 10⁻³ report
unsupported accuracy. An exhausted cutoff reports under-resolved and withholds
trusted values. K=0 is handled exactly in the coefficient series.

[Reference tests](../../src/models/u1GaugeReference.test.ts) independently
integrate Bessel coefficients on 64/128 periodic grids for K=0,±0.7,±2,±4.
Torus tests use 24³/48³ midpoint grids for K=−0.7,0.7,4 on
$\exp[K(\cos a+\cos b+\cos c+\cos(a+b+c))]$, inserting cos a and cos(a+b).
They call neither production Bessel nor production Wilson functions in the
oracle. The [validation summary](../RELEASES.md#u1-gauge) links the independent comparison tests and their error gates.

## Sampling and bounded measurement ownership

[`metropolisU1`](../../src/algorithms/u1GaugeSampler.ts) selects one link,
draws δ=width(2u−1), and accepts the wrapped proposal with min(1,exp(−ΔS)).
Exactly **three uniforms** are consumed in link/displacement/decision order,
including downhill moves and rejections. Width is fixed in [0.02,π], default
0.8 rad; no automatic tuning or deliberate 50% lazy stay is used.

The circular proposal density is symmetric and Haar-reversible, so multiplying
it by Metropolis acceptance gives equal forward/reverse Gibbs flux. Finite K
and positive width permit movement throughout the connected compact space.
The continuous displacement law supplies aperiodicity even at K=0; no Z₂
finite-state CDF sampler is ported.

[`U1GaugeRun`](../../src/engine/u1GaugeRun.ts) counts E random-link attempts with
replacement per nominal sweep. Default warm-up is 200 sweeps and stride four
is used in benchmarks (interactive default two). All scheduled configurations,
including rejections, are measured after complete warm-up/stride sweeps.
The initial zero-angle field is unmeasured. At most eight segments each keep
full real/imaginary plaquette and predefined-loop moments, mean real plaquette,
total S, 24-bin invariant-angle histograms, and the latest 256 **measured**
configurations. Full aggregates survive eviction. Circular/complex statistics
replace arithmetic angle means. No raw-link mean is called a gauge invariant.

Fixed-geometry K/width/cadence changes preserve angles/RNG in isolated
segments. Reset, geometry changes and explicit named-example launches restart
a seeded session. Top-level navigation only hides the mounted session. The
[client](../../src/engine/u1GaugeClient.ts) allows one 128-attempt batch in flight;
Pause waits for it. Direct worker advances are capped at 10,000. References
and tools never sample. Archives and sweeps keep their old schemas and do not
capture gauge data.

## Exercises and limits

1. Integrate three link angles on the open square and derive I0 without gauge
   fixing. Explain why the partition normalization differs from M5a.
2. Derive the common character index on the torus and each Wilson insertion.
3. Multiply the signed two-face walk explicitly; compare its complex product
   with the product of two real parts.
4. Construct principal face angles summing to 2π and verify the product is one.
5. Compare plaquette and winding histograms at K=0 and ±0.7 across independent
   seeds, then investigate width effects without treating correlated records
   as independent or a short warm-up as a certificate of equilibration.

High-|K| local mixing, particularly along global flat holonomies, is not
certified. No continuum extrapolation or confinement transition follows from
these tiny finite systems. Matter, gauge fixing, compact HMC, larger geometries,
non-Abelian groups, physical-time dynamics and gauge archives are excluded.
Future Potts/FK/XY work needs its own site/bond science and validation; oriented
link infrastructure does not make a site rotor into a gauge connection.
