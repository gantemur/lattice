# M4d2 — Spatial φ⁴ Hamiltonian Monte Carlo review

**Branch:** `codex/m4d2-spatial-phi4-hmc` · **Verified base:** `14ae50cf749e0864c105789aa5a0787bc444ec17`. Remote main matched the requested base before implementation. Work uses a clean managed worktree; unrelated screenshot copies in the original checkout are untouched. Implementation and complete local validation are complete. Remote release and deployment verification are reported with the released commit and workflow URL.

## Architecture plan and delivered slice

The initial plan was to share only a small pure leapfrog calculation, sampler/trace types and read-only diagnostic rendering; keep physical actions, gradients, validation and numerical failure classification in model-specific wrappers; extend the existing worker cadence/accumulators and one-in-flight client protocol; protect historical behavior with fixtures captured before extraction. This is the delivered architecture, not a new general sampler registry.

The spatial φ⁴ page offers its original default local Metropolis and identity-mass HMC for the same M4d1 action and ordinary product-Lebesgue measure. There is no extra beta, mean-zero constraint or physical momentum interpretation. The unchanged spatial action/gradient include all oriented positive-axis bond records, including periodic length-two parallel bonds, anisotropic stiffness and omitted open wraps. Geometry and parameter bounds are unchanged.

[`leapfrog.ts`](../src/algorithms/leapfrog.ts) contains pure kick-drift-kick arithmetic and common types. [`quarticHmc.ts`](../src/algorithms/quarticHmc.ts) retains its public exports and action/momentum/decision ordering through a thin adapter. [`phi4Hmc.ts`](../src/algorithms/phi4Hmc.ts) supplies the spatial Hamiltonian, typed overflow policy and full corrected transition. Pre-refactor fixtures in [`hmcReplay.test.ts`](../src/algorithms/hmcReplay.test.ts) pin exact field/trace outputs and cumulative uniform counts for accepted, rejected and divergent QM attempts, plus hashes of entire released QM HMC and spatial local worker snapshots. Equality is exact, not a relaxed numerical comparison.

Strict spatial applied settings contain either local width/sweep cadence or ε/L/trajectory cadence. Draft controls remember each sampler's tuning separately; presets change only draft physical coefficients. Default HMC ε=0.06, L=12, warm-up 20 and stride 1 are explicit and never automatically retuned. The original local defaults remain. Fixed-geometry physics/sampler/tuning/cadence changes preserve field/RNG in new segments; geometry/family changes and Reset seed new sessions. One HMC Step is one complete whole-field proposal. Rejected fields remain measurement-eligible; intermediate MD configurations do not.

The existing [`FieldRun`](../src/engine/fieldRun.ts) owns all stochastic state and full site, m²/m⁴, action-density and pair aggregates. HMC uses the existing stable scaled ΔH accumulator, acceptance including warm-up and bounded 256-record error history. Eight segments and 256 recent field vectors remain the limits. Spatial diagnostics count attempted force calls, including a force that overflows; QM's released successful-force count on failure remains unchanged. [`FieldClient`](../src/engine/fieldClient.ts) schedules eight spatial trajectories, 16 QM trajectories or 128 prior local updates. Direct HMC requests above 32 fail before mutation. Pause and pending settings respect completed in-flight batches. Archives, sweep schemas, transfer analysis and other mathematical kernels are unchanged.

The field remains the default feature, with spatial correlations and local inspection as initial gallery tools. HMC diagnostics and latest whole-field inspection are optional tools. Shared diagnostic rendering retains QM terminology by default and supplies spatial labels explicitly. Spatial distance, auxiliary integration duration, monotone global update index and separate QM Euclidean time are distinguished. Sampler segments retain different computational units; equal update counts are not equal work.

## Deterministic scientific validation

The existing M4d1 action/gradient tests remain, supplemented by centered full-action differences on Gaussian/quartic/negative-r/tilted open and periodic chains, the periodic dimer and anisotropic/mixed rectangles. Gaussian force is also checked against independent Qφ−j1. A hand dimer fixture gives S(1,−1)=7.25 and g=(7.5,−7.5); ε=0.1 with p=(0.5,−0.5) drifts to (1.0125,−1.0125).

The flipped deterministic map is tested twice at three ε/L choices for symmetric and tilted fields, with recovery at the 10⁻¹¹ decimal-scale gate and unchanged inputs. An independently coded backwards Verlet loop agrees. A centered-difference 4×4 dimer phase-space Jacobian has absolute determinant within the 10⁻⁷ decimal-scale gate of one. The mathematical argument is triangular determinant-one kick/drift shears; the final momentum reversal preserves absolute volume and is distinguished from the symplectic composition.

At fixed auxiliary duration 0.4, L=8,16,32 yield final |ΔH| **0.000309106906826**, **0.0000771993594687**, **0.0000192950087600**, giving the expected approximately fourfold reductions for this smooth fixture. Successful L-step trajectories use L+1 gradients. These are practical floating-point checks, not assertions of exact finite-step energy conservation.

Injected draws test complete ΔH rather than ΔS, downhill probability one, uphill acceptance/rejection, whole-field rejection, typed divergence and exactly **2V+1 uniforms**. A force-overflow fixture retains the old field and counts the attempted force call. Invalid starting fields/settings throw before spatial momentum draws. No arbitrary finite-ΔH cutoff exists. The required spatial N=16, κ=2, r=−1, λ=0.5, j=0 and mapped QM N=16, β=8, r=−2, λ=1, h=0 agree in action, force, final phase point and ΔH within 10⁻¹² decimal-scale summation tolerance. Same-model golden replay is exact.

## Independent equilibrium evidence

Unless stated otherwise, each case uses seeds **1203, 9041, 19383, 47017**, **500 warm-up trajectories**, **2500 retained fields per chain**, stride **3**, ε=**0.06**, L=**12**. Thus each chain attempts 8000 trajectories and evaluates **104000 gradients**. Fixed tolerances were declared before executing the benchmarks: typical mean/pair/second-moment gates 0.025–0.04, fourth-site moment 0.065, dimer total action 0.06. They are deliberately broad correlated-chain regression gates, not independent-sample error bars. No tolerance was relaxed after a failure.

| Reference case | HMC ensemble | Independent reference | Acceptance |
|---|---|---|---|
| Periodic anisotropic 2×2 Gaussian: r=2, λ=0, κx=1, κy=0.5, j=0.4 | mean 0.201487; site second 0.301799; raw pairs (0,1)/(0,2) 0.154770/0.111056; m²/m⁴ 0.164928/0.078887 | 0.2; 0.300417; 0.154583/0.112917; 0.165/0.078475 | 0.996875 |
| Open 2×2, same coefficients | mean 0.201714; site second 0.362450; raw pairs 0.135559/0.092392 | 0.2; 0.360833; 0.135833/0.094167 | 0.997563 |
| Four independent quartic sites, r=λ=1, j=0 | mean 0.001997; site second/fourth 0.471195/0.539677; m²/m⁴ 0.115828/0.038687 | 0; 0.467920/0.532080; 0.116980/0.039103 | 0.998875 |
| Same independent quartic, j=0.3 | mean 0.141495; site second/fourth 0.485700/0.566867; m²/m⁴ 0.134551/0.050919 | 0.139819; 0.481925/0.560021; 0.135143/0.050945 | 0.998813 |
| Open quartic dimer, r=λ=1, κ=0.7, j=0.2 | mean 0.092081; second 0.407430; pair 0.111059; total S 0.786122 | 0.099715; 0.404256; 0.111818; 0.774567 | 0.998875 |
| Periodic dimer, same coefficients, two bonds | mean 0.094914; second 0.375622; pair 0.161851; total S 0.816392 | 0.103262; 0.372388; 0.162422; 0.802192 | 0.998531 |

The periodic Gaussian independently checks eigenvalues **2,6,4,8**, every site mean/second moment, two different raw/connected pairs and field-average moments. A separate invariance test applies one HMC transition to **12000 independent exact Gaussian fields**, with distinct reference and production RNG streams: output site means 0.197106–0.202085, seconds 0.296982–0.300540, raw pair 0.157860 and acceptance 0.996333. It checks a stationary one-step marginal without assuming successive chain samples are independent.

Quartic site quadrature is unchanged. Tilted independent m⁴ follows the partition-of-indices expansion of (Σφ)⁴, with the third moment independently obtained by integrating V′ exp(−V). Both zero/nonzero distinct-site products are checked. The test-only dimer integral is shared with M4d1's tests, not with production action or either sampler; 160² points on [−4,4]² versus 200² on [−5,5]² agree within 5×10⁻¹⁰, retaining the earlier coarse-grid check in the M4d1 suite.

For the **mandatory N=16 double-well transfer case**, use the same four seeds, **800 warm-up**, **4000 retained per chain**, stride **4**, ε=**0.08**, L=**16**. Sampled C(0)/C(1) are **1.295188/1.097385**, compared with independently resolved finite-ring **1.293314/1.095211**. Acceptance is **0.990804**, with **285600 gradients per chain**. The mean 0.017885 is a finite-chain observation, not a symmetry-breaking claim. Existing transfer gap ≈0.329211319864 and spatial ξ≈6.07512 sites are unrelated to HMC mixing speed; no reference gate changed.

A **4×4 periodic single well**, r=λ=κx=κy=1, j=0, uses the default benchmark budget: mean −0.0000768, site second/fourth 0.215336/0.129769, m²/m⁴ 0.039440/0.004563, acceptance 0.992156. Symmetry, positivity and finite moments are primary sanity checks. A separate four-seed local chain (800 warm-up sweeps, 3000 retained at stride 3, width 1.5) gives second moment 0.213888, used only as secondary evidence. This interacting 2D check is exploratory, not an exact equilibrium certificate.

## State, browser and resource validation

Worker/client tests cover Step versus unequal batches and Reset; exact stream preservation through physical, ε/L, cadence and local→HMC→local changes; trajectory warm-up/stride; repeated rejected measurements; full pair/m⁴ and ΔH aggregates after bounded-history eviction; segment eviction; atomic invalid settings/work budgets; Gaussian-only λ=0 reference; geometry/family initialization; and queued changes/Pause/Step ordering. The original field worker remains the command authority.

Focused production-browser tests passed **36 cases** across desktop Chromium, 360px Chromium and mobile WebKit, covering the new HMC page plus released spatial-local and QM HMC behavior. They check draft/applied separation and validation, one full trajectory, warm-up/stride, real rejection inspection, worker diagnostics, sampler segments, Reset replay, Run/Pause acknowledgment, lazy transfer while sampling, open/periodic/mixed/anisotropic geometries, site selection, gallery changes, Gaussian switching, console errors and horizontal overflow. Screenshots were visually reviewed: [desktop](screenshots/m4d2-desktop.png), [phone](screenshots/m4d2-phone.png). A stale original-checkout preview server was detected and stopped before the successful focused run; subsequent validation disables server reuse.

The workload metric is **Run click through the first increased worker update displayed in the DOM and acknowledged Pause**, including scheduling, computation, rendering and test polling. Each row gives L=12 / L=32 latency in ms. Chains use κ=2, ε=0.06; rectangles use strong κx=κy=10, ε=0.02, with r=−1, λ=0.5, j=0. The lazy reference tool stays mounted (resolved where supported, explicitly unavailable otherwise).

| Workload | Desktop Chromium | 360px Chromium | Mobile WebKit |
|---|---:|---:|---:|
| Chain N=16 | 166 / 147 | 140 / 235 | 240 / 173 |
| Chain N=64 | 145 / 142 | 246 / 147 | 238 / 208 |
| Rectangle 4×4 | 263 / 247 | 159 / 245 | 171 / 183 |
| Rectangle 8×8 | 247 / 269 | 162 / 173 | 188 / 144 |

All meet the conservative 15-second gate, supporting the fixed eight-trajectory spatial batch. Polling/scheduling noise means these are not kernel throughput comparisons or guarantees for physical low-end phones. They do not establish that HMC mixes better per unit work.

The complete `CI=1 npm run check` pipeline passes formatting, TypeScript, **487 unit tests in 67 files** (including all 464 baseline cases), production build and **331 browser tests, with two unchanged existing skips**, across desktop Chromium, phone Chromium and mobile WebKit. No new skipped tests or retries were needed. `git diff --check` and relative documentation-link checks pass. No dependency, archive or sweep-schema changes are introduced; the existing large-main-chunk build advisory remains.

## Readability and remaining limits

The [source guide](SOURCE_GUIDE.md) and [mathematics guide](math/hmc-spatial-phi4.md) connect equations, hand calculations and actual functions. Pure integration, model-specific correction, worker ownership, draft controls and read-only tools remain separate. Comments explain arithmetic preservation, failure classification, time/work units and retained-data coverage. Golden fixtures are captured numerical records rather than a second implementation; independent derivative/Jacobian/quadrature tests supply mathematical checks.

No mass preconditioning, adaptation, NUTS, larger geometry, new archive, automatic autocorrelation/uncertainty, continuum extrapolation, 2D mass fitting or later milestone is implemented. Large/stiff fields can require smaller ε; the bounds do not guarantee stability. Double wells can remain metastable despite high acceptance and small ΔH. Practical divergence rejection is not a proof of exact floating-point detailed balance. Supported periodic transfer references retain their existing parameter and numerical-resolution limits. The feature supplies a validated finite-field HMC foundation, not a physical tunneling rate or a general lattice-QFT framework.
