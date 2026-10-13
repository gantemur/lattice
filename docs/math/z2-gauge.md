# Tiny classical Z₂ gauge theory

M5a samples a **classical Euclidean finite measure**, not a quantum Hamiltonian,
Gauss-law Hilbert space or real-time evolution. Start in Small Systems → Small
gauge systems. The single plaquette and periodic 2×2 torus share one link model.

## State, orientation and measure

Each independently identified oriented edge carries $U_e\in\{-1,+1\}$.
The existing [graph domain](../../src/domain/graph.ts) supplies four vertices,
four links and one face on the open square, or four vertices, **eight distinct
links and four faces** on the torus. Parallel wrapping links are never merged.
For a signed face boundary,

$$
P_f(U)=\prod_{(e,\epsilon)\in\partial f}U_e^\epsilon,\qquad
S_K(U)=-K\sum_f P_f(U),\qquad
\pi(U)=Z^{-1}e^{-S_K(U)}.
$$

Here $-4\leq K\leq4$ is already dimensionless. There is no additional beta.
$Z$ sums over all $2^E$ unfixed link words with counting measure: it is **not**
a gauge-quotient or normalized-Haar partition function. Z₂ inversion is
trivial, but signed incidence and the closed-walk checks remain explicit for
later groups. See `gaugeModel`, `validateGaugeLoop`, `plaquettes`, `gaugeAction`
and `gaugeFlipDifference` in [z2Gauge.ts](../../src/models/z2Gauge.ts).

Flipping one link changes each face containing it an odd number of times:

$$
\Delta S_e=2K\sum_{f:\,n_{fe}\text{ odd}}P_f.
$$

An open-square link affects one face; a torus link affects two. This is a
face-incidence calculation, not a site-Ising local field. For example, all links
positive on the square give $S=-K$; flipping e0 gives $S=+K$ and $\Delta S=2K$.
On the torus the same flip changes f0 and f2, giving $\Delta S=4K$.

## Gauge symmetry and actual loops

For vertex signs $g_v$, `gaugeTransform` implements
$U_{v\to w}\mapsto g_v U_{v\to w}g_w$. Every closed Wilson product
$W_C=\prod_{(e,\epsilon)\in C}U_e^\epsilon$ is unchanged because each visited
vertex sign cancels. The all-negative vertex assignment acts trivially.
On these connected four-vertex graphs each gauge orbit contains $2^{4-1}=8$
link words. The open square has two orbits; the torus has 32.

The torus uses these **fixed representatives**:

- $W_x=U_{e0}U_{e2}$, the positive x walk v0→v1→v0.
- $W_y=U_{e1}U_{e5}$, the positive y walk v0→v2→v0.
- The two-face contractible closed walk is
  `+e0 +e2 +e1 −e6 −e4 −e1`, with product $P_{f0}P_{f1}$.

The last walk is the projection of a lifted 2×1 rectangular boundary. On this
very small torus it touches itself: e1 is traversed in opposite directions and
cancels. The union of the two identified faces wraps the torus; its **reduced
boundary has two components**, not a simple embedded disk boundary. Retaining
the connecting traversal gives an actual closed, zero-winding contractible
walk without inventing or deleting physical edges. It should not be drawn as
an ordinary simple loop enclosing two distinct planar squares.

Plaquettes describe local curvature. Winding representatives are not determined
by plaquettes alone; a parallel representative can differ by enclosed flux.
The plaquette pattern together with these two winding signs distinguishes all
32 gauge orbits. A gauge transformation never changes either winding product;
a local Monte Carlo link flip can. Winding signs are **not conserved sampling
sectors**.

## Independent exact references

[Enumeration](../../src/models/z2GaugeExact.ts), `exactGauge`, uses log-sum-exp
over every link word. The separate `analyticGauge` uses the following finite
high-temperature expansions, with $t=\tanh K$:

| Geometry     | Counting-measure Z   | Common plaquette mean |
| ------------ | -------------------- | --------------------- |
| Open square  | $16\cosh K$          | $t$                   |
| Periodic 2×2 | $256\cosh^4K(1+t^4)$ | $(t+t^3)/(1+t^4)$     |

Each open plaquette sign has eight link states and
$\Pr(P=+1)=(1+t)/2$. On the torus $\prod_f P_f=1$: exactly eight even-parity
plaquette patterns, each with 32 link words. Distinct faces obey
$\langle P_fP_g\rangle=2t^2/(1+t^4)$. Both fixed winding means vanish and their
four joint probabilities are $1/4$. The mean total action is
$-K F\langle P\rangle$. At K=0, Z is 16 or 256, providing a hand-checkable
normalization test. Negative K is supported; there is no infinite-volume
phase-transition inference from these tiny systems.

## Sampling, measurements and symmetry commands

[Samplers](../../src/algorithms/z2GaugeSampler.ts):

- Direct exact sampling takes **one uniform**, selects a complete link word
  from the enumerated CDF, and retains every draw without warm-up.
- Lazy random-link Metropolis takes **three uniforms in order**: link selection,
  lazy proposal, acceptance decision. Half the proposals stay intentionally.
  Genuine flips accept with $\min(1,e^{-\Delta S})$. All three uniforms are
  consumed for stays, rejection and downhill flips. Acceptance excludes lazy
  self-proposals; counts include warm-up. A rejected or self transition has
  actual $\Delta S=0$, regardless of the hypothetical flip cost.

Single-flip proposal probabilities are symmetric, so the Metropolis ratio
establishes detailed balance. Every flip has positive acceptance at finite K,
giving irreducibility through the hypercube of link words; the explicit stay
probability establishes aperiodicity even at K=0.

One local nominal sweep is E attempts with replacement. Local measurements
begin after the selected whole-sweep warm-up, then occur at the selected
whole-sweep stride, including scheduled unchanged configurations. Algorithmic
updates are never physical time. Initialization is an unmeasured all-positive
configuration. Moderate-coupling ensemble tests do not certify equilibration at
large |K|; no independent-sample uncertainty is assigned to local-chain means.

[GaugeRun and GaugeEngine](../../src/engine/z2GaugeRun.ts) own state, RNG,
counters and measurements. At most eight parameter segments retain 256 recent
transition configurations each, marked as measured or unretained, while full-segment moments, plaquette-sign counts and
joint winding counts continue accumulating. Fixed-topology K/sampler/cadence
changes preserve links/RNG and isolate measurements; topology changes and Reset
restart the selected seed. No gauge archive/export format is added.

[GaugeClient](../../src/engine/z2GaugeClient.ts) permits one acknowledged batch
at a time. Pause allows that batch to finish. A gauge transformation requires
an idle, paused client and an exact run/version identity in the worker. It
increments snapshot version but no RNG, update, measurement or segment count.
Invalid/stale commands cannot partially mutate the run. Subsequent coupled
local proposals remain related by the same gauge transformation.

## Reading and exercises

Read the graph domain → pure model → independent references → samplers → run
and client → [workspace](../../src/app/GaugeWorkspace.tsx). Numerical modules
have no React dependency. Exhaustive [model tests](../../src/models/z2Gauge.test.ts),
independent [transition-matrix tests](../../src/algorithms/z2GaugeSampler.test.ts),
[worker tests](../../src/engine/z2GaugeRun.test.ts) and
[ensemble tests](../../src/engine/z2GaugeBenchmark.test.ts) connect the equations
to code. The [review](../M5A_REVIEW.md) records browser evidence and limits.

1. Enumerate the eight open-square words with positive plaquette. Relate them
   by vertex transformations; explain why four independent vertex signs yield
   only eight distinct transformations of the links.
2. Flip each torus link once and identify its two affected faces. Verify the
   global plaquette constraint before and after each flip.
3. Hold a plaquette pattern fixed and classify its 32 words by the two winding
   signs. Verify eight words in each class.
4. Compare direct draws and local Metropolis at K=0 and ±0.7. Then investigate
   slow local mixing at large |K| without interpreting short-run discrepancies
   as a changed equilibrium law.

Future compact U(1) work can reuse edge IDs, signed incidences and validated
walks, but must add angles, nontrivial inversion, its own Haar normalization,
local gauge transformation, reference calculations and samplers. No Z₂ sign
kernel, site-Ising science or archive record is silently generalized to U(1).
