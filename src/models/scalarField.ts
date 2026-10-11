import { graphPreset, validateDomain } from '../domain/graph';
import type { Domain, GraphPreset } from '../domain/graph';
import type { Rng } from '../algorithms/rng';

export type ScalarModel = {
  kind: 'scalar';
  parameters: {
    domain: Domain;
    a: Record<string, number>;
    lambda: Record<string, number>;
    h: Record<string, number>;
    kappa: Record<string, number>;
  };
  observable?: string;
};
export type RealVector = number[];
export type ScalarPreset =
  | 'baseline'
  | 'pair'
  | 'double-well'
  | 'tilted-well'
  | 'four-gaussian'
  | 'four-quartic';
export function scalarPreset(kind: ScalarPreset = 'pair'): ScalarModel {
  const graph: GraphPreset =
    kind === 'baseline' || kind.includes('well')
      ? 'site'
      : kind === 'pair'
        ? 'path'
        : 'square';
  const domain = graphPreset(graph);
  if (kind === 'pair') {
    domain.id = 'pair';
    domain.name = 'Coupled Gaussian pair';
    domain.vertices = domain.vertices.slice(0, 2);
    domain.edges = domain.edges.slice(0, 1);
    delete domain.lattice;
  }
  const quartic =
    kind === 'double-well' || kind === 'tilted-well' || kind === 'four-quartic';
  return {
    kind: 'scalar',
    parameters: {
      domain,
      a: Object.fromEntries(
        domain.vertices.map((v) => [v.id, kind.includes('well') ? -2 : 1]),
      ),
      lambda: Object.fromEntries(
        domain.vertices.map((v) => [v.id, quartic ? 1 : 0]),
      ),
      h: Object.fromEntries(
        domain.vertices.map((v) => [v.id, kind === 'tilted-well' ? 0.6 : 0]),
      ),
      kappa: Object.fromEntries(
        domain.edges.map((e) => [
          e.id,
          kind === 'pair' || kind === 'four-quartic' || kind === 'four-gaussian'
            ? 0.7
            : 0,
        ]),
      ),
    },
  };
}
export function validateScalar(model: ScalarModel): void {
  const { domain, a, lambda, h, kappa } = model.parameters;
  validateDomain(domain);
  for (const v of domain.vertices) {
    const A = a[v.id],
      L = lambda[v.id],
      H = h[v.id];
    if (
      !Number.isFinite(A) ||
      !Number.isFinite(L) ||
      !Number.isFinite(H) ||
      A! < -10 ||
      A! > 20 ||
      L! < 0 ||
      L! > 10 ||
      Math.abs(H!) > 10 ||
      (L === 0 && A! < 0.05) ||
      (L! > 0 && L! < 0.01)
    )
      throw new Error(
        'Each site needs −10 ≤ a ≤ 20, |h| ≤ 10, λ = 0 with a ≥ 0.05 or 0.01 ≤ λ ≤ 10. These sufficient bounds ensure normalizability.',
      );
  }
  for (const e of domain.edges)
    if (!Number.isFinite(kappa[e.id]) || kappa[e.id]! < 0 || kappa[e.id]! > 10)
      throw new Error(
        'Gradient coupling κ must be finite and between 0 and 10.',
      );
}
export function scalarTargets(model: ScalarModel): string[] {
  return [
    ...model.parameters.domain.vertices.map((v) => v.id),
    ...model.parameters.domain.vertices.map((v) => `${v.id}²`),
    ...model.parameters.domain.vertices.flatMap((v, i) =>
      model.parameters.domain.vertices
        .slice(i + 1)
        .map((w) => `${v.id}·${w.id}`),
    ),
    'sum',
    'mean',
    'S',
  ];
}
export function scalarObservable(
  model: ScalarModel,
  x: RealVector,
  target = model.observable ?? model.parameters.domain.vertices[0]!.id,
): number {
  if (target === 'sum') return x.reduce((s, v) => s + v, 0);
  if (target === 'mean') return x.reduce((s, v) => s + v, 0) / x.length;
  if (target === 'S') return scalarAction(model, x);
  if (target.includes('·')) {
    const [a, b] = target.split('·');
    const ids = model.parameters.domain.vertices.map((v) => v.id),
      i = ids.indexOf(a!),
      j = ids.indexOf(b!);
    if (i < 0 || j < 0 || i === j) throw new Error('Unknown pair observable.');
    return x[i]! * x[j]!;
  }
  const square = target.endsWith('²');
  const id = square ? target.slice(0, -1) : target;
  const i = model.parameters.domain.vertices.findIndex((v) => v.id === id);
  if (i < 0) throw new Error('Unknown scalar observable.');
  return square ? x[i]! ** 2 : x[i]!;
}
export function localPotential(
  model: ScalarModel,
  i: number,
  z: number,
): number {
  const id = model.parameters.domain.vertices[i]!.id,
    { a, lambda, h } = model.parameters;
  return (a[id]! * z * z) / 2 + (lambda[id]! * z ** 4) / 4 - h[id]! * z;
}
export function scalarAction(model: ScalarModel, x: RealVector): number {
  const { domain, kappa } = model.parameters;
  if (x.length !== domain.vertices.length || x.some((v) => !Number.isFinite(v)))
    return Infinity;
  const idx = (id: string) => domain.vertices.findIndex((v) => v.id === id);
  return (
    x.reduce((s, v, i) => s + localPotential(model, i, v), 0) +
    domain.edges.reduce(
      (s, e) =>
        s + (kappa[e.id]! * (x[idx(e.tail)]! - x[idx(e.head)]!) ** 2) / 2,
      0,
    )
  );
}
export function localDifference(
  model: ScalarModel,
  x: RealVector,
  i: number,
  proposed: number,
) {
  const { domain, kappa } = model.parameters,
    id = domain.vertices[i]!.id,
    old = x[i]!;
  const onsite =
    localPotential(model, i, proposed) - localPotential(model, i, old);
  const edges = domain.edges
    .filter((e) => e.tail !== e.head && (e.tail === id || e.head === id))
    .map((e) => {
      const neighbor = e.tail === id ? e.head : e.tail,
        j = domain.vertices.findIndex((v) => v.id === neighbor),
        other = x[j]!;
      return {
        edgeId: e.id,
        neighbor,
        value: other,
        coupling: kappa[e.id]!,
        delta:
          (kappa[e.id]! * ((proposed - other) ** 2 - (old - other) ** 2)) / 2,
      };
    });
  return {
    onsite,
    edges,
    total: onsite + edges.reduce((s, e) => s + e.delta, 0),
  };
}
export function conditionalPotential(
  model: ScalarModel,
  x: RealVector,
  i: number,
  z: number,
): number {
  return (
    localPotential(model, i, z) +
    localDifference(model, x, i, z).edges.reduce(
      (s, e) => s + (e.coupling * (z - e.value) ** 2) / 2,
      0,
    )
  );
}
export function precision(model: ScalarModel): number[][] {
  const { domain, a, kappa } = model.parameters,
    n = domain.vertices.length;
  const Q = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) =>
      i === j ? a[domain.vertices[i]!.id]! : 0,
    ),
  );
  for (const e of domain.edges) {
    const i = domain.vertices.findIndex((v) => v.id === e.tail),
      j = domain.vertices.findIndex((v) => v.id === e.head),
      k = kappa[e.id]!;
    if (i === j) continue;
    Q[i]![i]! += k;
    Q[j]![j]! += k;
    Q[i]![j]! -= k;
    Q[j]![i]! -= k;
  }
  return Q;
}
export function cholesky(Q: number[][]): number[][] {
  const n = Q.length,
    L = Array.from({ length: n }, () => Array<number>(n).fill(0));
  for (let i = 0; i < n; i++)
    for (let j = 0; j <= i; j++) {
      let v = Q[i]![j]!;
      for (let k = 0; k < j; k++) v -= L[i]![k]! * L[j]![k]!;
      if (i === j) {
        if (!(v > 1e-12) && Number.isFinite(v))
          throw new Error('Gaussian precision is not positive definite.');
        if (!Number.isFinite(v))
          throw new Error('Non-finite Gaussian precision.');
        L[i]![i] = Math.sqrt(v);
      } else L[i]![j] = v / L[j]![j]!;
    }
  return L;
}
function solveLower(L: number[][], b: number[]): number[] {
  const y: number[] = [];
  for (let i = 0; i < L.length; i++) {
    let v = b[i]!;
    for (let j = 0; j < i; j++) v -= L[i]![j]! * y[j]!;
    y[i] = v / L[i]![i]!;
  }
  return y;
}
function solveUpperFromLower(L: number[][], y: number[]): number[] {
  const x = Array<number>(L.length).fill(0);
  for (let i = L.length - 1; i >= 0; i--) {
    let v = y[i]!;
    for (let j = i + 1; j < L.length; j++) v -= L[j]![i]! * x[j]!;
    x[i] = v / L[i]![i]!;
  }
  return x;
}
const gaussianCache = new Map<
  string,
  ReturnType<typeof calculateGaussianScalar>
>();
export function gaussianScalar(model: ScalarModel) {
  const key = JSON.stringify(model.parameters);
  const hit = gaussianCache.get(key);
  if (hit) return hit;
  const result = calculateGaussianScalar(model);
  if (gaussianCache.size >= 32)
    gaussianCache.delete(gaussianCache.keys().next().value!);
  gaussianCache.set(key, result);
  return result;
}
function calculateGaussianScalar(model: ScalarModel) {
  validateScalar(model);
  if (
    model.parameters.domain.vertices.some(
      (v) => model.parameters.lambda[v.id] !== 0,
    )
  )
    throw new Error('Gaussian reference requires λ = 0 at every site.');
  const Q = precision(model),
    L = cholesky(Q),
    n = L.length,
    h = model.parameters.domain.vertices.map((v) => model.parameters.h[v.id]!);
  const mean = solveUpperFromLower(L, solveLower(L, h));
  const covariance = Array.from({ length: n }, (_, j) =>
    solveUpperFromLower(
      L,
      solveLower(
        L,
        Array.from({ length: n }, (_, i) => (i === j ? 1 : 0)),
      ),
    ),
  );
  const C = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => covariance[j]![i]!),
  );
  const logZ =
    (n / 2) * Math.log(2 * Math.PI) -
    L.reduce((s, row, i) => s + Math.log(row[i]!), 0) +
    h.reduce((s, v, i) => s + (v * mean[i]!) / 2, 0);
  return {
    Q,
    L,
    mean,
    covariance: C,
    logZ,
    correlations: C.map((row, i) => row.map((v, j) => v + mean[i]! * mean[j]!)),
  };
}
export function gaussianConditional(
  model: ScalarModel,
  x: RealVector,
  i: number,
) {
  const { Q } = gaussianScalar(model),
    id = model.parameters.domain.vertices[i]!.id;
  const mean =
    (model.parameters.h[id]! -
      Q[i]!.reduce((s, v, j) => s + (j === i ? 0 : v * x[j]!), 0)) /
    Q[i]![i]!;
  return { mean, variance: 1 / Q[i]![i]! };
}
export function directGaussianScalar(model: ScalarModel, rng: Rng): RealVector {
  const { L, mean } = gaussianScalar(model),
    z = mean.map(
      () =>
        Math.sqrt(-2 * Math.log(rng.uniform())) *
        Math.cos(2 * Math.PI * rng.uniform()),
    );
  const shift = solveUpperFromLower(L, z);
  return mean.map((m, i) => m + shift[i]!);
}
export function scalarReference(
  model: ScalarModel,
  target = model.observable ?? model.parameters.domain.vertices[0]!.id,
) {
  const gaussian = model.parameters.domain.vertices.every(
    (v) => model.parameters.lambda[v.id] === 0,
  );
  if (gaussian) {
    const g = gaussianScalar(model),
      ids = model.parameters.domain.vertices.map((v) => v.id),
      i = ids.indexOf(target.replace('²', ''));
    if (target.includes('·')) {
      const [a, b] = target.split('·'),
        u = ids.indexOf(a!),
        v = ids.indexOf(b!);
      if (u < 0 || v < 0 || u === v)
        throw new Error('Unknown pair observable.');
      const mu = g.mean[u]!,
        mv = g.mean[v]!,
        cuu = g.covariance[u]![u]!,
        cvv = g.covariance[v]![v]!,
        cuv = g.covariance[u]![v]!;
      return {
        kind: 'Analytic exact' as const,
        mean: mu * mv + cuv,
        variance:
          mu * mu * cvv +
          mv * mv * cuu +
          2 * mu * mv * cuv +
          cuu * cvv +
          cuv * cuv,
        logPartition: g.logZ,
      };
    }
    if (i >= 0) {
      const m = g.mean[i]!,
        v = g.covariance[i]![i]!;
      return {
        kind: 'Analytic exact' as const,
        mean: target.endsWith('²') ? m * m + v : m,
        variance: target.endsWith('²') ? 2 * v * v + 4 * m * m * v : v,
        logPartition: g.logZ,
      };
    }
    if (target === 'sum' || target === 'mean') {
      const scale = target === 'mean' ? 1 / ids.length : 1;
      return {
        kind: 'Analytic exact' as const,
        mean: g.mean.reduce((s, v) => s + v, 0) * scale,
        variance:
          g.covariance.flat().reduce((s, v) => s + v, 0) * scale * scale,
        logPartition: g.logZ,
      };
    }
    if (target === 'S')
      return {
        kind: 'Analytic exact' as const,
        mean:
          ids.length / 2 -
          g.mean.reduce(
            (s, v, i) => s + (model.parameters.h[ids[i]!]! * v) / 2,
            0,
          ),
        variance: ids.length / 2,
        logPartition: g.logZ,
      };
  }
  if (
    target.includes('·') &&
    model.parameters.domain.edges.every(
      (e) => model.parameters.kappa[e.id] === 0,
    )
  ) {
    const [a, b] = target.split('·');
    const ids = model.parameters.domain.vertices.map((v) => v.id);
    if (!ids.includes(a!) || !ids.includes(b!) || a === b)
      throw new Error('Unknown pair observable.');
    const qa = quarticReference(
        model.parameters.a[a!]!,
        model.parameters.lambda[a!]!,
        model.parameters.h[a!]!,
      ),
      qb = quarticReference(
        model.parameters.a[b!]!,
        model.parameters.lambda[b!]!,
        model.parameters.h[b!]!,
      );
    return {
      kind:
        qa.kind === 'Numerical quadrature reference' ||
        qb.kind === 'Numerical quadrature reference'
          ? ('Numerical quadrature reference' as const)
          : ('Analytic exact' as const),
      mean: qa.mean * qb.mean,
      variance: qa.secondMoment * qb.secondMoment - (qa.mean * qb.mean) ** 2,
      logPartition: qa.logPartition + qb.logPartition,
    };
  }
  if (
    (target === 'sum' || target === 'mean') &&
    model.parameters.domain.edges.every(
      (e) => model.parameters.kappa[e.id] === 0,
    )
  ) {
    const parts = model.parameters.domain.vertices.map((v) =>
      quarticReference(
        model.parameters.a[v.id]!,
        model.parameters.lambda[v.id]!,
        model.parameters.h[v.id]!,
      ),
    );
    const scale = target === 'mean' ? 1 / parts.length : 1;
    return {
      kind: parts.some((p) => p.kind === 'Numerical quadrature reference')
        ? ('Numerical quadrature reference' as const)
        : ('Analytic exact' as const),
      mean: parts.reduce((s, p) => s + p.mean, 0) * scale,
      variance: parts.reduce((s, p) => s + p.variance, 0) * scale * scale,
      logPartition: parts.reduce((s, p) => s + p.logPartition, 0),
    };
  }
  const ids = model.parameters.domain.vertices.map((v) => v.id),
    i = ids.indexOf(target.replace('²', ''));
  if (
    i >= 0 &&
    model.parameters.domain.edges.every(
      (e) => model.parameters.kappa[e.id] === 0,
    )
  ) {
    const q = quarticReference(
      model.parameters.a[ids[i]!]!,
      model.parameters.lambda[ids[i]!]!,
      model.parameters.h[ids[i]!]!,
    );
    return {
      kind: q.kind,
      mean: target.endsWith('²') ? q.secondMoment : q.mean,
      variance: target.endsWith('²')
        ? q.fourthMoment - q.secondMoment ** 2
        : q.variance,
      logPartition: q.logPartition,
    };
  }
  return null;
}
const quadratureCache = new Map<
  string,
  ReturnType<typeof calculateQuarticReference>
>();
export function quarticReference(a: number, lambda: number, h: number) {
  const key = JSON.stringify([a, lambda, h]);
  const hit = quadratureCache.get(key);
  if (hit) return hit;
  const result = calculateQuarticReference(a, lambda, h);
  if (quadratureCache.size >= 64)
    quadratureCache.delete(quadratureCache.keys().next().value!);
  quadratureCache.set(key, result);
  return result;
}
function calculateQuarticReference(a: number, lambda: number, h: number) {
  if (lambda === 0) {
    if (!(a > 0)) throw new Error('Non-normalizable Gaussian limit.');
    const mean = h / a,
      variance = 1 / a;
    return {
      kind: 'Analytic exact' as const,
      mean,
      variance,
      secondMoment: variance + mean * mean,
      fourthMoment:
        mean ** 4 + 6 * mean * mean * variance + 3 * variance * variance,
      logPartition: Math.log((2 * Math.PI) / a) / 2 + (h * h) / (2 * a),
      domain: [-Infinity, Infinity] as [number, number],
      tailBound: 0,
      density: (x: number) =>
        Math.sqrt(a / (2 * Math.PI)) * Math.exp((-a * (x - mean) ** 2) / 2),
    };
  }
  if (!(lambda > 0)) throw new Error('Quartic coefficient must be positive.');
  const V = (x: number) => (a * x * x) / 2 + (lambda * x ** 4) / 4 - h * x,
    dV = (x: number) => a * x + lambda * x ** 3 - h;
  // A complete stationary-root search: derivative is monotone between its at most two turning points.
  const turn = a < 0 ? Math.sqrt(-a / (3 * lambda)) : 0,
    roots: number[] = [];
  const nodes = [-512, -turn, turn, 512].filter(
    (v, i, A) => i === 0 || v > A[i - 1]!,
  );
  for (let k = 0; k < nodes.length - 1; k++) {
    let lo = nodes[k]!,
      hi = nodes[k + 1]!;
    if (dV(lo) * dV(hi) > 0) continue;
    for (let j = 0; j < 80; j++) {
      const mid = (lo + hi) / 2;
      if (dV(lo) * dV(mid) <= 0) hi = mid;
      else lo = mid;
    }
    roots.push((lo + hi) / 2);
  }
  const offset = Math.min(...roots.map(V), V(0));
  let R = 2,
    tailAbsolute = Infinity;
  while (R < 512) {
    const slope = Math.min(dV(R), -dV(-R)),
      convex = a + 3 * lambda * R * R >= 0;
    if (convex && slope > 0) {
      // Beyond ±R, convexity gives V(±(R+t)) ≥ V(±R)+slope*t.
      // Integrate (1+x⁴)e^(−slope*t) analytically to bound tails of Z and moments through fourth order.
      tailAbsolute =
        2 *
        Math.exp(offset - Math.min(V(R), V(-R))) *
        ((1 + R ** 4) / slope +
          (4 * R ** 3) / slope ** 2 +
          (12 * R ** 2) / slope ** 3 +
          (24 * R) / slope ** 4 +
          24 / slope ** 5);
      if (tailAbsolute < 1e-11) break;
    }
    R *= 2;
  }
  if (R >= 512)
    throw new Error('Quadrature tail tolerance unavailable for this model.');
  const integrate = (power: number) => {
    const f = (x: number) => x ** power * Math.exp(offset - V(x));
    const simp = (
      l: number,
      _m: number,
      r: number,
      fl: number,
      fm: number,
      fr: number,
    ) => ((r - l) * (fl + 4 * fm + fr)) / 6;
    const recurse = (
      l: number,
      m: number,
      r: number,
      fl: number,
      fm: number,
      fr: number,
      whole: number,
      tol: number,
      depth: number,
    ): number => {
      const lm = (l + m) / 2,
        mr = (m + r) / 2,
        flm = f(lm),
        fmr = f(mr),
        left = simp(l, lm, m, fl, flm, fm),
        right = simp(m, mr, r, fm, fmr, fr),
        err = (left + right - whole) / 15;
      if (Math.abs(err) < tol) return left + right + err;
      if (depth === 0)
        throw new Error(
          'Quadrature tolerance unavailable; integration did not converge.',
        );
      return (
        recurse(l, lm, m, fl, flm, fm, left, tol / 2, depth - 1) +
        recurse(m, mr, r, fm, fmr, fr, right, tol / 2, depth - 1)
      );
    };
    const breaks = [-R, ...roots.filter((v) => v > -R && v < R), 0, R]
      .sort((a, b) => a - b)
      .filter((v, i, A) => i === 0 || v > A[i - 1]!);
    let sum = 0;
    for (let k = 0; k < breaks.length - 1; k++) {
      const l = breaks[k]!,
        r = breaks[k + 1]!,
        m = (l + r) / 2;
      sum += recurse(
        l,
        m,
        r,
        f(l),
        f(m),
        f(r),
        simp(l, m, r, f(l), f(m), f(r)),
        (1e-10 * Math.max(1, R ** power / 100)) / (breaks.length - 1),
        30,
      );
    }
    return sum;
  };
  const z = integrate(0),
    m1 = integrate(1) / z,
    m2 = integrate(2) / z,
    m4 = integrate(4) / z,
    variance = m2 - m1 * m1;
  if (!(z > 0) && Number.isFinite(z))
    throw new Error('Quadrature normalization failed.');
  return {
    kind: 'Numerical quadrature reference' as const,
    mean: m1,
    variance,
    secondMoment: m2,
    fourthMoment: m4,
    logPartition: Math.log(z) - offset,
    domain: [-R, R] as [number, number],
    tailBound: tailAbsolute / z,
    density: (x: number) => Math.exp(offset - V(x)) / z,
  };
}
