import { createIndexedLattice } from '../domain/indexedLattice';
import type { IsingModel } from './ising';
import {
  conditionalPlus,
  exactIsing,
  flipDifference,
  observableValue,
} from './ising';
import type { LatticeParameters } from './latticeIsing';
import { flipEnergy, localField, totalEnergy } from './latticeIsing';
import { exactLatticeTwoByTwo } from './latticeExact';
import type { LatticeSampler } from '../algorithms/latticeTransition';

/**
 * Exact tiny-state, one-update Markov kernels and stationary diagnostics.
 * These are finite-chain equilibrium calculations, not estimates from one
 * simulated trajectory. Graph K,b are dimensionless; M2 uses ΔH/T.
 */

export type SmallSampler = LatticeSampler | 'direct';
export type ExactKernel = {
  probabilities: number[];
  matrix: number[][];
  sampler: SmallSampler;
  siteCount: number;
};

function buildKernel(
  probabilities: number[],
  siteCount: number,
  sampler: SmallSampler,
  flipCost: (state: number, site: number) => number,
  plus: (state: number, site: number) => number,
): ExactKernel {
  // One local update chooses a site uniformly. Lazy Metropolis proposes a
  // flip only half the time, hence P(state→flipped)=α/(2N); heat bath assigns
  // the two possible post-update spins directly, including unchanged draws.
  const count = probabilities.length;
  const matrix = Array.from(
    { length: count },
    () => Array(count).fill(0) as number[],
  );
  for (let state = 0; state < count; state++) {
    if (sampler === 'direct') {
      matrix[state] = [...probabilities];
      continue;
    }
    for (let site = 0; site < siteCount; site++) {
      const bit = 1 << site;
      if (sampler === 'metropolis') {
        const alpha = Math.exp(Math.min(0, -flipCost(state, site)));
        const move = alpha / (2 * siteCount);
        matrix[state]![state ^ bit]! += move;
        matrix[state]![state]! += 1 / siteCount - move;
      } else {
        const p = plus(state, site);
        matrix[state]![state | bit]! += p / siteCount;
        matrix[state]![state & ~bit]! += (1 - p) / siteCount;
      }
    }
  }
  return { probabilities, matrix, sampler, siteCount };
}

export function graphIsingKernel(
  model: IsingModel,
  sampler: SmallSampler,
): ExactKernel {
  const count = model.parameters.domain.vertices.length;
  return buildKernel(
    exactIsing(model).probabilities,
    count,
    sampler,
    (state, site) => flipDifference(model, state, site),
    (state, site) => conditionalPlus(model, state, site),
  );
}

export function latticeTwoByTwoKernel(
  p: LatticeParameters,
  sampler: LatticeSampler,
): ExactKernel {
  const exact = exactLatticeTwoByTwo(p);
  const lattice = createIndexedLattice(p);
  const spins = (state: number) =>
    Int8Array.from({ length: 4 }, (_, i) => (state & (1 << i) ? 1 : -1));
  return buildKernel(
    exact.probabilities,
    4,
    sampler,
    (state, site) => flipEnergy(lattice, p, spins(state), site) / p.temperature,
    (state, site) => {
      const z =
        (2 * localField(lattice, p, spins(state), site)) / p.temperature;
      return z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z));
    },
  );
}

function jacobiSymmetric(input: number[][]) {
  // Repeated plane rotations diagonalize a symmetric matrix of at most 16
  // states. Retain eigenvectors for observable-mode projections below.
  const n = input.length;
  const a = input.map((row) => [...row]);
  const vectors: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  );
  for (let sweep = 0; sweep < 20 * n * n; sweep++) {
    let p = 0,
      q = 1,
      largest = 0;
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++)
        if (Math.abs(a[i]![j]!) > largest) {
          largest = Math.abs(a[i]![j]!);
          p = i;
          q = j;
        }
    if (largest < 1e-13) break;
    const angle = 0.5 * Math.atan2(2 * a[p]![q]!, a[q]![q]! - a[p]![p]!);
    const c = Math.cos(angle),
      s = Math.sin(angle);
    const app = a[p]![p]!,
      aqq = a[q]![q]!,
      apq = a[p]![q]!;
    a[p]![p] = c * c * app - 2 * s * c * apq + s * s * aqq;
    a[q]![q] = s * s * app + 2 * s * c * apq + c * c * aqq;
    a[p]![q] = a[q]![p] = 0;
    for (let k = 0; k < n; k++)
      if (k !== p && k !== q) {
        const akp = a[k]![p]!,
          akq = a[k]![q]!;
        a[k]![p] = a[p]![k] = c * akp - s * akq;
        a[k]![q] = a[q]![k] = s * akp + c * akq;
      }
    for (let k = 0; k < n; k++) {
      const vkp = vectors[k]![p]!,
        vkq = vectors[k]![q]!;
      vectors[k]![p] = c * vkp - s * vkq;
      vectors[k]![q] = s * vkp + c * vkq;
    }
  }
  return Array.from({ length: n }, (_, i) => ({
    value: a[i]![i]!,
    vector: vectors.map((row) => row[i]!),
  })).sort((x, y) => y.value - x.value);
}

export type ExactMarkovDiagnostics =
  | {
      status: 'ill-conditioned' | 'constant';
      message: string;
      gap: number | null;
      eigenvalues: number[];
      acf: number[];
      tauMeasurements: null;
      asymptoticVariance: null;
      variance: number | null;
    }
  | {
      status: 'ok';
      message: string;
      gap: number;
      eigenvalues: number[];
      acf: number[];
      tauMeasurements: number;
      asymptoticVariance: number;
      variance: number;
    };

/** Reversible symmetrization and Jacobi spectrum of the actual one-update kernel. */
export function exactMarkovDiagnostics(
  kernel: ExactKernel,
  values: readonly number[],
  intervalUpdates = 1,
  lags = 32,
): ExactMarkovDiagnostics {
  const { probabilities: pi, matrix: P } = kernel;
  if (!Number.isSafeInteger(intervalUpdates) || intervalUpdates < 1)
    throw new Error('Observation interval must be positive integer updates.');
  if (values.length !== pi.length)
    throw new Error('Observable size differs from the chain.');
  const unavailable = (message: string): ExactMarkovDiagnostics => ({
    status: 'ill-conditioned',
    message,
    gap: null,
    eigenvalues: [],
    acf: [],
    tauMeasurements: null,
    asymptoticVariance: null,
    variance: null,
  });
  if (Math.min(...pi) < 1e-12)
    return unavailable(
      'Gibbs weights are too concentrated for reliable finite-state spectral analysis.',
    );
  const n = pi.length;
  for (let i = 0; i < n; i++) {
    const rowsum = P[i]!.reduce((a, b) => a + b, 0);
    if (Math.abs(rowsum - 1) > 1e-10)
      return unavailable('Transition matrix is not stochastic.');
    for (let j = i + 1; j < n; j++)
      if (Math.abs(pi[i]! * P[i]![j]! - pi[j]! * P[j]![i]!) > 1e-10)
        return unavailable('Detailed balance failed numerically.');
  }
  // Detailed balance makes D^(1/2) P D^(-1/2) symmetric for D=diag(π).
  const symmetric = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => Math.sqrt(pi[i]! / pi[j]!) * P[i]![j]!),
  );
  const modes = jacobiSymmetric(symmetric);
  const eigenvalues = modes.map((mode) => mode.value);
  if (
    Math.abs(eigenvalues[0]! - 1) > 1e-8 ||
    eigenvalues.slice(1).some((v) => v > 1 + 1e-9 || v < -1 - 1e-9)
  )
    return unavailable('Reversible spectrum is numerically unstable.');
  const gap = 1 - eigenvalues[1]!;
  const mean = pi.reduce((sum, p, i) => sum + p * values[i]!, 0);
  const centered = values.map((v, i) => Math.sqrt(pi[i]!) * (v - mean));
  const variance = centered.reduce((sum, v) => sum + v * v, 0);
  if (variance < 1e-14)
    return {
      status: 'constant',
      message:
        'The selected observable has no resolvable equilibrium variance.',
      gap,
      eigenvalues,
      acf: [],
      tauMeasurements: null,
      asymptoticVariance: null,
      variance,
    };
  let asymptoticVariance = 0;
  const components = modes.slice(1).map((mode) => {
    // At observation spacing q, mode λ contributes λ^q per lag and
    // c²(1+λ^q)/(1−λ^q) to the asymptotic variance of the sample mean.
    const coefficient = mode.vector.reduce(
      (sum, v, i) => sum + v * centered[i]!,
      0,
    );
    const power = mode.value ** intervalUpdates;
    if (1 - power < 1e-12)
      return { weight: coefficient * coefficient, power, valid: false };
    asymptoticVariance +=
      (coefficient * coefficient * (1 + power)) / (1 - power);
    return { weight: coefficient * coefficient, power, valid: true };
  });
  if (components.some((c) => !c.valid))
    return unavailable(
      'A numerical mode is effectively closed at this observation interval.',
    );
  const acf = Array.from({ length: lags + 1 }, (_, k) =>
    k === 0
      ? 1
      : components.reduce((sum, c) => sum + c.weight * c.power ** k, 0) /
        variance,
  );
  return {
    status: 'ok',
    message: `Exact finite-state equilibrium result; observations every ${intervalUpdates} ${kernel.sampler === 'direct' ? 'whole-configuration draw(s)' : 'elementary site update(s)'}.`,
    gap,
    eigenvalues,
    acf,
    tauMeasurements: asymptoticVariance / (2 * variance),
    asymptoticVariance,
    variance,
  };
}

export function graphObservableValues(model: IsingModel, target: string) {
  return Array.from(
    { length: 2 ** model.parameters.domain.vertices.length },
    (_, state) => observableValue(model, state, target),
  );
}

export function latticeTwoByTwoObservableValues(
  p: LatticeParameters,
  target: 'm' | 'absM' | 'e',
) {
  if (p.lx !== 2 || p.ly !== 2)
    throw new Error('Exact observable values require 2×2.');
  const lattice = createIndexedLattice(p);
  return Array.from({ length: 16 }, (_, state) => {
    const spins = Int8Array.from({ length: 4 }, (_, i) =>
      state & (1 << i) ? 1 : -1,
    );
    const m = spins.reduce((sum, spin) => sum + spin, 0) / 4;
    return target === 'm'
      ? m
      : target === 'absM'
        ? Math.abs(m)
        : totalEnergy(lattice, p, spins) / 4;
  });
}
