import type { XYModel } from './xy';
import { TAU } from './xy';
export type XYReferenceValues = {
  Z: number;
  logZ: number;
  mx: number;
  my: number;
  action: number;
  bonds: number[];
};
export type XYReference = {
  status:
    | 'analytical'
    | 'character-sum'
    | 'quadrature'
    | 'unavailable'
    | 'under-resolved';
  reason: string;
  values: XYReferenceValues | null;
  error: number | null;
  resolution: number;
};
/** Independent XY evaluator: old U(1)'s |x|≤4 evaluator and replay stay intact.
 * Positive series I_n(a)=Σ(a/2)^(2k+n)/(k!(n+k)!). Decreasing term ratios
 * bound the entire omitted tail geometrically. Parity handles negative x.
 * The operation allowance is conservative floating-point error, not directed
 * interval arithmetic. |x|≤68 covers even the largest allowed local field. */
export function xyBessel(order: number, x: number, maxTerms = 256) {
  if (
    !Number.isInteger(order) ||
    Math.abs(order) > 128 ||
    !Number.isFinite(x) ||
    Math.abs(x) > 68 ||
    !Number.isInteger(maxTerms) ||
    maxTerms < 1 ||
    maxTerms > 512
  )
    throw new Error(
      'XY Bessel supports integer |n|≤128, |x|≤68 and 1–512 terms.',
    );
  const n = Math.abs(order),
    a = Math.abs(x);
  if (a === 0) return { value: n === 0 ? 1 : 0, error: 0, resolved: true };
  let term = 1;
  for (let j = 1; j <= n; j++) term *= a / (2 * j);
  let sum = term,
    tail = Infinity,
    terms = 1;
  while (true) {
    const ratio = (a * a) / (4 * terms * (n + terms));
    tail = ratio < 1 ? (term * ratio) / (1 - ratio) : Infinity;
    if (tail <= Number.EPSILON * sum || terms === maxTerms) break;
    term *= ratio;
    sum += term;
    terms++;
  }
  return {
    value: x < 0 && n % 2 ? -sum : sum,
    error: tail + 4 * Number.EPSILON * (n + 3 * terms + 1) * sum,
    resolved: tail <= Number.EPSILON * sum,
  };
}
export function xyConditionalDensity(
  angle: number,
  R: number,
  mu: number | null,
): number {
  return (
    Math.exp(R * Math.cos(angle - (mu ?? 0))) / (TAU * xyBessel(0, R).value)
  );
}
export function xyRotorReference(h: number) {
  const zero = xyBessel(0, h),
    one = xyBessel(1, h),
    two = xyBessel(2, h);
  return {
    Z: zero.value,
    mean: one.value / zero.value,
    cosineSecond: (1 + two.value / zero.value) / 2,
  };
}
/** This reference alone combines parallel cosine interactions into effective
 * pair weights. The physical model, selected bonds and vortex incidences never
 * change. d(log Z)/dK of every parallel record is the same pair correlation. */
function effectiveEdges(model: XYModel) {
  const edges: { tail: number; head: number; K: number; physical: number[] }[] =
    [];
  let constant = 0;
  model.bonds.forEach((b, i) => {
    if (b.tail === b.head) {
      constant += b.K;
      return;
    }
    const tail = Math.min(b.tail, b.head),
      head = Math.max(b.tail, b.head);
    let edge = edges.find((e) => e.tail === tail && e.head === head);
    if (!edge) {
      edge = { tail, head, K: 0, physical: [] };
      edges.push(edge);
    }
    edge.K += b.K;
    edge.physical.push(i);
  });
  return { edges, constant };
}
function zeroFieldReference(
  model: XYModel,
  limit: number,
  tolerance: number,
): XYReference {
  const { edges, constant } = effectiveEdges(model);
  if (edges.some((e) => Math.abs(e.K) > 8))
    return unavailable(
      'Effective pair couplings beyond |K|=8 have no certified small reference.',
    );
  const neighbors = Array.from({ length: model.size }, () => [] as number[]);
  edges.forEach((e) => {
    neighbors[e.tail]!.push(e.head);
    neighbors[e.head]!.push(e.tail);
  });
  const seen = new Set<number>();
  let components = 0;
  function visit(site: number) {
    if (seen.has(site)) return;
    seen.add(site);
    neighbors[site]!.forEach(visit);
  }
  for (let i = 0; i < model.size; i++)
    if (!seen.has(i)) {
      components++;
      visit(i);
    }
  const forest = edges.length === model.size - components;
  const cycle = components === 1 && neighbors.every((n) => n.length === 2);
  if (!forest && !cycle)
    return unavailable(
      'Zero-field character references support trees and simple effective cycles only.',
    );
  const coefficients = edges.map((e) =>
    Array.from({ length: limit + 3 }, (_, n) => xyBessel(n, e.K)),
  );
  const bonds: number[] = model.bonds.map((b) => (b.tail === b.head ? 1 : 0));
  if (forest) {
    let logZ = constant,
      action = -constant,
      error = 0;
    edges.forEach((e, i) => {
      const c = coefficients[i]!,
        mean = c[1]!.value / c[0]!.value;
      logZ += Math.log(c[0]!.value);
      action -= e.K * mean;
      e.physical.forEach((b) => {
        bonds[b] = mean;
      });
      error += (c[0]!.error + c[1]!.error) / c[0]!.value;
    });
    return {
      status: error <= tolerance ? 'analytical' : 'under-resolved',
      reason:
        'Normalized-Haar tree product Π I₀(K), including constant self-links.',
      values:
        error <= tolerance
          ? { Z: Math.exp(logZ), logZ, mx: 0, my: 0, action, bonds }
          : null,
      error,
      resolution: 1,
    };
  }
  const sums = Array<number>(edges.length + 1).fill(0),
    errors = sums.slice(),
    absoluteSums = sums.slice();
  let lastError = Infinity;
  for (let n = 0; n <= limit; n++) {
    for (let insertion = -1; insertion < edges.length; insertion++) {
      let value = 1,
        upper = 1;
      coefficients.forEach((c, i) => {
        const entry =
          i === insertion
            ? {
                value: (c[Math.abs(n - 1)]!.value + c[n + 1]!.value) / 2,
                error: (c[Math.abs(n - 1)]!.error + c[n + 1]!.error) / 2,
              }
            : c[n]!;
        value *= entry.value;
        upper *= Math.abs(entry.value) + entry.error;
      });
      const factor = n === 0 ? 1 : 2,
        at = insertion + 1;
      sums[at]! += factor * value;
      absoluteSums[at]! += factor * Math.abs(value);
      errors[at]! += factor * Math.max(0, upper - Math.abs(value));
    }
    // Absolute next-order bounds cover alternating odd-cycle sums too. For
    // n≥N+1, every factor (including derivative's I_(n−1)) decreases at most
    // q=max|K|/(2(N+1)); the product tail is a geometric series in q^m.
    const q = Math.max(...edges.map((e) => Math.abs(e.K))) / (2 * (n + 1));
    if (q >= 1) continue;
    const totalErrors = errors.map((error, index) => {
      let nextUpper = 1;
      coefficients.forEach((c, i) => {
        const upper = (j: number) => Math.abs(c[j]!.value) + c[j]!.error;
        nextUpper *=
          i === index - 1 ? (upper(n) + upper(n + 2)) / 2 : upper(n + 1);
      });
      return (
        error +
        (2 * nextUpper) / (1 - q ** edges.length) +
        16 * Number.EPSILON * (n + 1) * absoluteSums[index]!
      );
    });
    const Z = sums[0]!,
      lower = Z - totalErrors[0]!;
    if (lower <= 0) continue;
    const pairMeans = sums.slice(1).map((s) => s / Z);
    lastError = Math.max(
      totalErrors[0]! / Z,
      ...pairMeans.map(
        (v, i) => (totalErrors[i + 1]! + Math.abs(v) * totalErrors[0]!) / lower,
      ),
    );
    if (lastError <= tolerance) {
      edges.forEach((e, i) =>
        e.physical.forEach((b) => {
          bonds[b] = pairMeans[i]!;
        }),
      );
      const logZ = constant + Math.log(Z),
        action =
          -constant - edges.reduce((s, e, i) => s + e.K * pairMeans[i]!, 0);
      return {
        status: 'character-sum',
        reason: `Controlled signed character sum n=−${n}…${n}; absolute tails and cancellation allowance.`,
        values: { Z: Math.exp(logZ), logZ, mx: 0, my: 0, action, bonds },
        error: lastError,
        resolution: n,
      };
    }
  }
  return {
    status: 'under-resolved',
    reason: 'Character tail/roundoff gate not met; trusted values withheld.',
    values: null,
    error: lastError,
    resolution: limit,
  };
}
function unavailable(reason: string): XYReference {
  return {
    status: 'unavailable',
    reason,
    values: null,
    error: null,
    resolution: 0,
  };
}
/** Tiny nonzero-source reference only (at most two angles). Periodic midpoint
 * quadrature is refined twice; convergence is numerical evidence, not an exact
 * symbolic integral. A conservative 10⁻¹⁰ relative/absolute gate is explicit. */
function pairQuadrature(model: XYModel, n: number): XYReferenceValues {
  let weight = 0,
    spin = 0,
    actionSum = 0;
  const bonds = model.bonds.map(() => 0);
  const shift =
    model.size * Math.abs(model.h) +
    model.bonds.reduce((s, b) => s + Math.abs(b.K), 0);
  const angles = [0, 0];
  for (let i = 0; i < n; i++)
    for (let j = 0; j < (model.size === 1 ? 1 : n); j++) {
      angles[0] = (TAU * (i + 0.5)) / n - Math.PI;
      angles[1] = (TAU * (j + 0.5)) / n - Math.PI;
      const cosines = model.bonds.map((b) =>
        Math.cos(angles[b.head]! - angles[b.tail]!),
      );
      const magnetization =
        angles.slice(0, model.size).reduce((s, a) => s + Math.cos(a), 0) /
        model.size;
      const action =
        -model.h * model.size * magnetization -
        model.bonds.reduce((s, b, k) => s + b.K * cosines[k]!, 0);
      const w = Math.exp(-action - shift);
      weight += w;
      spin += w * magnetization;
      actionSum += w * action;
      bonds.forEach((_, k) => {
        bonds[k]! += w * cosines[k]!;
      });
    }
  const logZ = shift + Math.log(weight / n ** model.size);
  return {
    Z: Math.exp(logZ),
    logZ,
    mx: spin / weight,
    my: 0,
    action: actionSum / weight,
    bonds: bonds.map((b) => b / weight),
  };
}
export function xyReference(
  model: XYModel,
  options: { maxOrder?: number; tolerance?: number; grids?: number[] } = {},
): XYReference {
  const limit = options.maxOrder ?? 64,
    tolerance = options.tolerance ?? 1e-10;
  if (
    !Number.isInteger(limit) ||
    limit < 0 ||
    limit > 64 ||
    tolerance < 1e-12 ||
    tolerance > 1e-3 ||
    !Number.isFinite(tolerance)
  )
    throw new Error('Unsupported XY reference accuracy/cutoff.');
  if (model.size > 4) {
    if (model.bonds.every((b) => b.K === 0)) {
      const single = xyRotorReference(model.h),
        logZ = model.size * Math.log(single.Z);
      return {
        status: 'analytical',
        reason:
          'Independent-site von Mises product law; distinct-site dot correlation = (I₁/I₀)².',
        values: {
          Z: Math.exp(logZ),
          logZ,
          mx: single.mean,
          my: 0,
          action: -model.size * model.h * single.mean,
          bonds: model.bonds.map(() => single.mean ** 2),
        },
        error: 1e-12,
        resolution: 1,
      };
    }
    return unavailable(
      'No finite-volume exact reference for this interacting large lattice.',
    );
  }
  if (model.h === 0) return zeroFieldReference(model, limit, tolerance);
  if (model.size === 1) {
    const single = xyRotorReference(model.h),
      constant = model.bonds.reduce((s, b) => s + b.K, 0),
      logZ = constant + Math.log(single.Z);
    return {
      status: 'analytical',
      reason: 'Single rotor: normalized-Haar Z=I₀(h), ⟨cosθ⟩=I₁(h)/I₀(h).',
      values: {
        Z: Math.exp(logZ),
        logZ,
        mx: single.mean,
        my: 0,
        action: -constant - model.h * single.mean,
        bonds: model.bonds.map(() => 1),
      },
      error: 1e-12,
      resolution: 1,
    };
  }
  if (model.size > 2)
    return unavailable(
      'Nonzero-source coupled graphs above two sites have no reference in M5e.',
    );
  const grids = options.grids ?? [32, 64, 128];
  if (
    grids.length !== 3 ||
    grids.some(
      (n, i) =>
        !Number.isInteger(n) ||
        n < 4 ||
        n > 256 ||
        (i > 0 && n <= grids[i - 1]!),
    )
  )
    throw new Error('Use three increasing quadrature grids, 4–256.');
  const values = grids.map((n) => pairQuadrature(model, n));
  const vector = (v: XYReferenceValues) => [
    v.logZ,
    v.mx,
    v.my,
    v.action,
    ...v.bonds,
  ];
  const errors = [1, 2].map((i) =>
    Math.max(
      ...vector(values[i]!).map((v, j) =>
        Math.abs(v - vector(values[i - 1]!)[j]!),
      ),
    ),
  );
  const error = Math.max(...errors) + 64 * Number.EPSILON * grids[2]!;
  return {
    status: error <= tolerance ? 'quadrature' : 'under-resolved',
    reason: `Periodic two-angle quadrature ${grids.join('→')}; two refinements, no Monte Carlo RNG.`,
    values: error <= tolerance ? values[2]! : null,
    error,
    resolution: grids[2]!,
  };
}
const cache = new Map<string, XYReference>();
/** Called only by a mounted reference tool. Cache by physical values, bounded
 * independently of React snapshot identity or simulation/render frequency. */
export function cachedXYReference(model: XYModel): XYReference {
  const key = JSON.stringify([model.size, model.h, model.bonds]);
  let value = cache.get(key);
  if (!value) {
    value = xyReference(model);
    cache.set(key, value);
    if (cache.size > 32) cache.delete(cache.keys().next().value!);
  }
  return value;
}
