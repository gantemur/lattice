import {
  CUSTOM_ISING_DOMAIN_ID,
  customSimpleIsingDomain,
  isingGraphPreset,
  validateCustomSimpleIsingDomain,
  validateDomain,
} from '../domain/graph';
import type { Domain, IsingGraphPreset } from '../domain/graph';
/**
 * Tiny graph Ising uses S=−Σ_e K_e s_tail s_head−Σ_i b_i s_i, with β already
 * absorbed into K and b. Every edge ID contributes, including parallel bonds;
 * a self-link adds a constant to S but no single-spin flip cost. At most four
 * spins permit complete finite-state enumeration.
 */
export type IsingModel = {
  kind: 'ising';
  parameters: {
    domain: Domain;
    couplings: Record<string, number>;
    fields: Record<string, number>;
  };
  observable?: string;
};
export function isingPreset(preset: IsingGraphPreset = 'ring'): IsingModel {
  const domain = isingGraphPreset(preset);
  return {
    kind: 'ising',
    parameters: {
      domain,
      couplings: Object.fromEntries(domain.edges.map((e) => [e.id, 0.5])),
      fields: Object.fromEntries(domain.vertices.map((v) => [v.id, 0])),
    },
  };
}
/** Materialize editor choices as scientific data: absent pairs have no K entry. */
export function customIsingModel(
  vertexCount: number,
  enabledPairs: readonly string[],
  couplings: Readonly<Record<string, number>> = {},
  fields: Readonly<Record<string, number>> = {},
): IsingModel {
  const domain = customSimpleIsingDomain(vertexCount, enabledPairs);
  const model: IsingModel = {
    kind: 'ising',
    parameters: {
      domain,
      couplings: Object.fromEntries(
        domain.edges.map((edge) => [edge.id, couplings[edge.id] ?? 0.5]),
      ),
      fields: Object.fromEntries(
        domain.vertices.map((vertex) => [vertex.id, fields[vertex.id] ?? 0]),
      ),
    },
  };
  validateIsing(model);
  return model;
}
/** Integer bit configurations are internal only: bit i=1 is spin +1. */
export function spinAt(state: number, index: number): number {
  return state & (1 << index) ? 1 : -1;
}
export function spins(model: IsingModel, state: number): number[] {
  return model.parameters.domain.vertices.map((_, i) => spinAt(state, i));
}
export function validateIsing(model: IsingModel): void {
  const { domain, couplings, fields } = model.parameters;
  validateDomain(domain);
  if (domain.id === CUSTOM_ISING_DOMAIN_ID) {
    validateCustomSimpleIsingDomain(domain);
    // A present K=0 bond is kept; an absent pair cannot leave a phantom K in
    // worker settings or portable scientific captures.
    if (
      JSON.stringify(Object.keys(couplings).sort()) !==
        JSON.stringify(domain.edges.map((edge) => edge.id).sort()) ||
      JSON.stringify(Object.keys(fields).sort()) !==
        JSON.stringify(domain.vertices.map((vertex) => vertex.id).sort())
    )
      throw new Error(
        'Custom Ising parameters must match active sites and edges.',
      );
  }
  for (const [ids, values] of [
    [domain.edges.map((e) => e.id), couplings],
    [domain.vertices.map((v) => v.id), fields],
  ] as const)
    for (const id of ids)
      if (!Number.isFinite(values[id]) || Math.abs(values[id]!) > 10)
        throw new Error(
          'Couplings and fields must be finite and between −10 and 10.',
        );
  if (model.observable && !isingTargets(model).includes(model.observable))
    throw new Error('Unknown Ising observable.');
}
export function isingAction(model: IsingModel, state: number): number {
  const { domain, couplings, fields } = model.parameters,
    values = Object.fromEntries(
      domain.vertices.map((v, i) => [v.id, spinAt(state, i)]),
    );
  return (
    -domain.edges.reduce(
      (sum, e) => sum + couplings[e.id]! * values[e.tail]! * values[e.head]!,
      0,
    ) -
    domain.vertices.reduce((sum, v) => sum + fields[v.id]! * values[v.id]!, 0)
  );
}
/** Read-only bond inspection; stored orientation does not change Ising energy. */
export function bondInspection(
  model: IsingModel,
  state: number,
  edgeId: string,
) {
  const { domain, couplings } = model.parameters;
  const edge = domain.edges.find((e) => e.id === edgeId);
  if (!edge) throw new Error('Unknown bond.');
  const tailSpin = spinAt(
    state,
    domain.vertices.findIndex((v) => v.id === edge.tail),
  );
  const headSpin = spinAt(
    state,
    domain.vertices.findIndex((v) => v.id === edge.head),
  );
  const coupling = couplings[edgeId]!;
  return {
    ...edge,
    coupling,
    tailSpin,
    headSpin,
    product: tailSpin * headSpin,
    action: -coupling * tailSpin * headSpin,
    kind:
      edge.tail === edge.head
        ? 'Self-link'
        : edge.wraps
          ? 'Periodic/wrapped'
          : 'Ordinary',
  };
}
export function neighborhood(model: IsingModel, state: number, index: number) {
  // A self-link's s_i²=1 term is constant under a flip, so it is omitted from
  // the conditional local field while remaining in the full action.
  const { domain, couplings, fields } = model.parameters,
    id = domain.vertices[index]!.id;
  const contributions = domain.edges
    .filter((e) => e.tail !== e.head && (e.tail === id || e.head === id))
    .map((e) => {
      const neighbor = e.tail === id ? e.head : e.tail,
        spin = spinAt(
          state,
          domain.vertices.findIndex((v) => v.id === neighbor),
        );
      return {
        edgeId: e.id,
        neighbor,
        spin,
        coupling: couplings[e.id]!,
        contribution: couplings[e.id]! * spin,
      };
    });
  return {
    site: id,
    field: fields[id]!,
    contributions,
    localField:
      fields[id]! + contributions.reduce((s, c) => s + c.contribution, 0),
  };
}
export function flipDifference(
  model: IsingModel,
  state: number,
  index: number,
): number {
  return (
    2 * spinAt(state, index) * neighborhood(model, state, index).localField
  );
}
export function conditionalPlus(
  model: IsingModel,
  state: number,
  index: number,
): number {
  const z = 2 * neighborhood(model, state, index).localField;
  // P(s_i=+1 | others)=logistic(2 localField); branch avoids overflow.
  return z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z));
}
export function isingTargets(model: IsingModel): string[] {
  return [
    'M',
    'm',
    'absM',
    'E',
    ...model.parameters.domain.vertices.map((v) => v.id),
  ];
}
export function observableValue(
  model: IsingModel,
  state: number,
  target = model.observable ?? 'M',
): number {
  const values = spins(model, state),
    M = values.reduce((s, v) => s + v, 0);
  if (target === 'M') return M;
  if (target === 'm') return M / values.length;
  if (target === 'absM') return Math.abs(M);
  if (target === 'E') return isingAction(model, state);
  const index = model.parameters.domain.vertices.findIndex(
    (v) => v.id === target,
  );
  if (index < 0) throw new Error('Unknown observable.');
  return values[index]!;
}
export type ExactIsing = ReturnType<typeof enumerate>;
function enumerate(model: IsingModel) {
  // Shift by the minimum action before exponentiating: log Z = log Σw−offset.
  const size = 2 ** model.parameters.domain.vertices.length;
  const actions = Array.from({ length: size }, (_, state) =>
    isingAction(model, state),
  );
  const offset = Math.min(...actions),
    weights = actions.map((a) => Math.exp(offset - a)),
    sum = weights.reduce((s, w) => s + w, 0),
    logPartition = Math.log(sum) - offset;
  const probabilities = weights.map((w) => w / sum);
  // Pair s and −s. Their probability difference is pair mass × tanh(b·s).
  // Compute b·s separately: tiny fields must not be lost subtracting large actions.
  const differences = Array.from({ length: size / 2 }, (_, state) => {
    const field = model.parameters.domain.vertices.reduce(
      (sum, v, i) => sum + model.parameters.fields[v.id]! * spinAt(state, i),
      0,
    );
    return (
      (probabilities[state]! + probabilities[size - 1 - state]!) *
      Math.tanh(field)
    );
  });
  const means = model.parameters.domain.vertices.map((_, i) =>
    differences.reduce((sum, d, state) => sum + d * spinAt(state, i), 0),
  );
  const correlations = means.map((_, i) =>
    means.map((_, j) =>
      i === j
        ? 1
        : probabilities.reduce(
            (s, p, state) => s + p * spinAt(state, i) * spinAt(state, j),
            0,
          ),
    ),
  );
  return {
    logPartition,
    probabilities,
    actions,
    means,
    correlations,
    covariance: correlations.map((row, i) =>
      row.map((v, j) => v - means[i]! * means[j]!),
    ),
  };
}
// Model objects are immutable after validation; cached enumeration is never sampler-dependent.
const cache = new WeakMap<IsingModel, ExactIsing>();
export function exactIsing(model: IsingModel): ExactIsing {
  let exact = cache.get(model);
  if (!exact) {
    validateIsing(model);
    exact = enumerate(model);
    cache.set(model, exact);
  }
  return exact;
}
export function isingDistribution(
  model: IsingModel,
): { value: number; probability: number }[] {
  const masses = new Map<number, number>();
  exactIsing(model).probabilities.forEach((p, state) => {
    const v = observableValue(model, state);
    masses.set(v, (masses.get(v) ?? 0) + p);
  });
  return [...masses]
    .sort((a, b) => a[0] - b[0])
    .map(([value, probability]) => ({ value, probability }));
}
export function isingReference(model: IsingModel) {
  const dist = isingDistribution(model),
    exact = exactIsing(model),
    target = model.observable ?? 'M',
    site = model.parameters.domain.vertices.findIndex((v) => v.id === target),
    mean =
      target === 'M' || target === 'm'
        ? exact.means.reduce((s, v) => s + v, 0) /
          (target === 'm' ? exact.means.length : 1)
        : site >= 0
          ? exact.means[site]!
          : dist.reduce((s, d) => s + d.value * d.probability, 0),
    variance = dist.reduce(
      (s, d) => s + (d.value - mean) ** 2 * d.probability,
      0,
    );
  return {
    mean,
    variance,
    secondMoment: variance + mean * mean,
    standardDeviation: Math.sqrt(variance),
    logPartition: exactIsing(model).logPartition,
  };
}
