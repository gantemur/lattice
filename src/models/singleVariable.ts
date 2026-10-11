import { scalarPreset, validateScalar, scalarReference } from './scalarField';
import type { ScalarModel } from './scalarField';
import {
  isingPreset,
  validateIsing,
  isingAction,
  isingReference,
  isingDistribution,
} from './ising';
import type { IsingModel } from './ising';
import {
  gaussianAction,
  gaussianDensity,
  gaussianReference,
  validateGaussian,
} from './gaussian';
import type { GaussianParameters } from './gaussian';

/**
 * Scalar-state Small Systems models share the dimensionless weight exp(−S).
 * The binomial count K represents n Bernoulli variables; its action includes
 * −log C(n,K), without which the count distribution would be wrong. Vector
 * scalar fields and graph Ising delegate their specialized mathematics.
 */

export type Model =
  | IsingModel
  | ScalarModel
  | { kind: 'gaussian'; parameters: GaussianParameters }
  | { kind: 'spin'; parameters: Readonly<{ h: number }> }
  | { kind: 'binomial'; parameters: Readonly<{ n: number; p: number }> };
export type ModelKind = Model['kind'];
export const modelNames: Record<ModelKind, string> = {
  ising: 'Graph Ising',
  scalar: 'Real scalar field',
  gaussian: '0D Gaussian',
  spin: 'Single Ising spin',
  binomial: 'Binomial count',
};
export function defaultModel(kind: ModelKind): Model {
  switch (kind) {
    case 'ising':
      return isingPreset();
    case 'scalar':
      return scalarPreset();
    case 'gaussian':
      return { kind, parameters: { a: 1, h: 0 } };
    case 'spin':
      return { kind, parameters: { h: 0 } };
    case 'binomial':
      return { kind, parameters: { n: 20, p: 0.5 } };
  }
}
export function variableName(model: Model): string {
  if (model.kind === 'ising') return model.observable ?? 'M';
  if (model.kind === 'scalar')
    return model.observable ?? model.parameters.domain.vertices[0]!.id;
  return model.kind === 'gaussian' ? 'x' : model.kind === 'spin' ? 's' : 'K';
}
export function validateModel(model: Model): void {
  switch (model.kind) {
    case 'scalar':
      validateScalar(model);
      return;
    case 'ising':
      validateIsing(model);
      return;
    case 'gaussian':
      validateGaussian(model.parameters);
      return;
    case 'spin':
      if (
        !Number.isFinite(model.parameters.h) ||
        Math.abs(model.parameters.h) > 10
      )
        throw new Error('Use a finite field h between −10 and 10.');
      return;
    case 'binomial': {
      const { n, p } = model.parameters;
      if (!Number.isInteger(n) || n < 1 || n > 100)
        throw new Error('Use an integer n between 1 and 100.');
      if (!Number.isFinite(p) || p < 0.001 || p > 0.999)
        throw new Error('Use p between 0.001 and 0.999 (finite log-odds).');
      return;
    }
    default:
      throw new Error('Unknown model.');
  }
}
const logFactorials = [0];
// log C(n,k) avoids overflowing factorials in the supported n≤100 range.
for (let n = 1; n <= 100; n++)
  logFactorials.push(logFactorials[n - 1]! + Math.log(n));
export function logChoose(n: number, k: number): number {
  if (
    !Number.isInteger(n) ||
    n < 0 ||
    n > 100 ||
    !Number.isInteger(k) ||
    k < 0 ||
    k > n
  )
    throw new Error('Invalid binomial indices.');
  return logFactorials[n]! - logFactorials[k]! - logFactorials[n - k]!;
}
export function validState(model: Model, value: number): boolean {
  if (model.kind === 'scalar') return false;
  if (model.kind === 'ising')
    return (
      Number.isInteger(value) &&
      value >= 0 &&
      value < 2 ** model.parameters.domain.vertices.length
    );
  return (
    Number.isFinite(value) &&
    (model.kind === 'gaussian' ||
      (model.kind === 'spin'
        ? value === -1 || value === 1
        : Number.isInteger(value) && value >= 0 && value <= model.parameters.n))
  );
}
export function modelAction(model: Model, value: number): number {
  if (!validState(model, value)) return Infinity;
  switch (model.kind) {
    case 'gaussian':
      return gaussianAction(value, model.parameters);
    case 'scalar':
      throw new Error('Scalar fields require a real-vector state.');
    case 'ising':
      return isingAction(model, value);
    case 'spin':
      return -model.parameters.h * value;
    case 'binomial': {
      const { n, p } = model.parameters;
      return -(Math.log(p) - Math.log1p(-p)) * value - logChoose(n, value);
    }
  }
}
export function actionDifference(
  model: Model,
  current: number,
  proposed: number,
): number {
  if (!validState(model, current) || !validState(model, proposed))
    throw new Error('Transition state is outside model support.');
  if (model.kind === 'scalar') throw new Error('Use vector local difference.');
  if (model.kind === 'gaussian') {
    // Factor the two actions before subtraction to avoid cancellation when
    // a small Metropolis displacement is made far from the origin.
    const { a, h } = model.parameters;
    return (proposed - current) * ((a * (proposed + current)) / 2 - h);
  }
  return modelAction(model, proposed) - modelAction(model, current);
}
export function modelReference(model: Model) {
  validateModel(model);
  if (model.kind === 'ising') return isingReference(model);
  if (model.kind === 'scalar') {
    const r = scalarReference(model);
    if (!r) throw new Error('No exact marginal for coupled quartic field.');
    return {
      ...r,
      secondMoment: r.mean * r.mean + r.variance,
      standardDeviation: Math.sqrt(r.variance),
    };
  }
  if (model.kind === 'gaussian') return gaussianReference(model.parameters);
  let mean: number, variance: number, logPartition: number;
  if (model.kind === 'spin') {
    const h = model.parameters.h,
      q = Math.exp(-2 * Math.abs(h));
    mean = Math.tanh(h);
    variance = (4 * q) / (1 + q) ** 2;
    logPartition = Math.abs(h) + Math.log1p(q);
  } else {
    const { n, p } = model.parameters;
    mean = n * p;
    variance = n * p * (1 - p);
    logPartition = -n * Math.log1p(-p);
  }
  return {
    mean,
    variance,
    secondMoment: variance + mean * mean,
    standardDeviation: Math.sqrt(variance),
    logPartition,
  };
}
export function probability(model: Model, value: number): number {
  if (model.kind === 'scalar')
    throw new Error('Use the scalar density reference when available.');
  if (model.kind === 'ising')
    return (
      isingDistribution(model).find((d) => d.value === value)?.probability ?? 0
    );
  if (!validState(model, value)) return 0;
  switch (model.kind) {
    case 'gaussian':
      return gaussianDensity(value, model.parameters);
    case 'spin': {
      const z = 2 * model.parameters.h * value;
      return z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z));
    }
    case 'binomial': {
      const { n, p } = model.parameters;
      return Math.exp(
        logChoose(n, value) +
          value * Math.log(p) +
          (n - value) * Math.log1p(-p),
      );
    }
  }
}
export function support(model: Model): number[] {
  if (model.kind === 'scalar') return [];
  if (model.kind === 'ising')
    return isingDistribution(model).map((d) => d.value);
  if (model.kind === 'gaussian') return [];
  return model.kind === 'spin'
    ? [-1, 1]
    : Array.from({ length: model.parameters.n + 1 }, (_, k) => k);
}
export function initialState(model: Model): number {
  if (model.kind === 'scalar')
    throw new Error('Scalar initial state is a real vector.');
  if (model.kind === 'ising')
    return 2 ** model.parameters.domain.vertices.length - 1;
  return model.kind === 'gaussian'
    ? 0
    : model.kind === 'spin'
      ? 1
      : Math.round(model.parameters.n * model.parameters.p);
}
export function modelSummary(model: Model): string {
  switch (model.kind) {
    case 'scalar':
      return `${model.parameters.domain.name}; a=[${Object.values(model.parameters.a)}], λ=[${Object.values(model.parameters.lambda)}], h=[${Object.values(model.parameters.h)}], κ=[${Object.values(model.parameters.kappa)}]`;
    case 'ising':
      return `${model.parameters.domain.name}; K=[${model.parameters.domain.edges.map((e) => model.parameters.couplings[e.id]).join(',')}], b=[${Object.values(model.parameters.fields).join(',')}]`;
    case 'gaussian':
      return `a=${model.parameters.a}, h=${model.parameters.h}`;
    case 'spin':
      return `h=${model.parameters.h}`;
    case 'binomial':
      return `n=${model.parameters.n}, p=${model.parameters.p}`;
  }
}
