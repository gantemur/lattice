import { describe, expect, it } from 'vitest';
import { graphPreset } from '../domain/graph';
import { createRng } from '../algorithms/rng';
import { isingTransition } from '../algorithms/isingTransition';
import { analyzeSeries } from '../observables/statisticalDiagnostics';
import { exactIsing, observableValue } from './ising';
import type { IsingModel } from './ising';
import {
  exactMarkovDiagnostics,
  graphIsingKernel,
  graphObservableValues,
  latticeTwoByTwoKernel,
} from './isingMarkov';
import type { LatticeParameters } from './latticeIsing';

const graph: IsingModel = {
  kind: 'ising',
  parameters: {
    domain: graphPreset('torus'),
    couplings: Object.fromEntries(
      graphPreset('torus').edges.map((e) => [e.id, 0]),
    ),
    fields: Object.fromEntries(
      graphPreset('torus').vertices.map((v) => [v.id, 0]),
    ),
  },
};
const p: LatticeParameters = {
  lx: 2,
  ly: 2,
  periodicX: true,
  periodicY: true,
  jx: 0,
  jy: 0,
  field: 0,
  temperature: 2,
};

function poissonVariance(matrix: number[][], pi: number[], values: number[]) {
  const n = pi.length;
  const mean = values.reduce((sum, v, i) => sum + pi[i]! * v, 0);
  const g = values.map((v) => v - mean);
  const augmented = Array.from({ length: n }, (_, i) => [
    ...Array.from(
      { length: n },
      (_, j) => (i === j ? 1 : 0) - matrix[i]![j]! + pi[j]!,
    ),
    g[i]!,
  ]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++)
      if (Math.abs(augmented[row]![col]!) > Math.abs(augmented[pivot]![col]!))
        pivot = row;
    [augmented[col], augmented[pivot]] = [augmented[pivot]!, augmented[col]!];
    const scale = augmented[col]![col]!;
    for (let j = col; j <= n; j++) augmented[col]![j]! /= scale;
    for (let row = 0; row < n; row++)
      if (row !== col) {
        const factor = augmented[row]![col]!;
        for (let j = col; j <= n; j++)
          augmented[row]![j]! -= factor * augmented[col]![j]!;
      }
  }
  const var0 = g.reduce((sum, v, i) => sum + pi[i]! * v * v, 0);
  return (
    2 * g.reduce((sum, v, i) => sum + pi[i]! * v * augmented[i]![n]!, 0) - var0
  );
}

describe('exact tiny-Ising transition matrices', () => {
  it.each(['metropolis', 'heat-bath', 'direct'] as const)(
    '%s rows normalize and preserve the Gibbs measure by detailed balance',
    (sampler) => {
      const kernel = graphIsingKernel(graph, sampler);
      const pi = exactIsing(graph).probabilities;
      for (let i = 0; i < 16; i++) {
        expect(kernel.matrix[i]!.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
        for (let j = 0; j < 16; j++)
          expect(pi[i]! * kernel.matrix[i]![j]!).toBeCloseTo(
            pi[j]! * kernel.matrix[j]![i]!,
            12,
          );
        expect(
          pi.reduce((sum, v, j) => sum + v * kernel.matrix[j]![i]!, 0),
        ).toBeCloseTo(pi[i]!, 12);
      }
    },
  );
  it('reproduces lazy Metropolis and unchanged heat-bath probabilities', () => {
    const metro = graphIsingKernel(graph, 'metropolis');
    const heat = graphIsingKernel(graph, 'heat-bath');
    expect(metro.matrix[0]![0]).toBeCloseTo(0.5, 12);
    expect(heat.matrix[0]![0]).toBeCloseTo(0.5, 12);
    expect(metro.matrix[0]![1]).toBeCloseTo(1 / 8, 12);
  });
  it('gets the independent-spin spectrum and spectral versus Poisson asymptotic variance', () => {
    const values = graphObservableValues(graph, 'M');
    for (const sampler of ['metropolis', 'heat-bath', 'direct'] as const) {
      const kernel = graphIsingKernel(graph, sampler);
      const exact = exactMarkovDiagnostics(kernel, values);
      expect(exact.status).toBe('ok');
      if (exact.status !== 'ok') continue;
      expect(exact.gap).toBeCloseTo(sampler === 'direct' ? 1 : 0.25, 10);
      expect(exact.tauMeasurements).toBeCloseTo(
        sampler === 'direct' ? 0.5 : 3.5,
        9,
      );
      expect(exact.asymptoticVariance).toBeCloseTo(
        poissonVariance(kernel.matrix, kernel.probabilities, values),
        9,
      );
      expect(exact.acf[1]).toBeCloseTo(sampler === 'direct' ? 0 : 0.75, 10);
    }
  });
  it('matches the M1a torus kernel after physical-to-dimensionless conversion and stride powers', () => {
    const model: IsingModel = {
      kind: 'ising',
      parameters: {
        domain: graphPreset('torus'),
        couplings: Object.fromEntries(
          graphPreset('torus').edges.map((e) => [
            e.id,
            (e.axis === 0 ? 0.7 : -1.1) / 2,
          ]),
        ),
        fields: Object.fromEntries(
          graphPreset('torus').vertices.map((v) => [v.id, 0.2 / 2]),
        ),
      },
    };
    const physical = { ...p, jx: 0.7, jy: -1.1, field: 0.2 };
    for (const sampler of ['metropolis', 'heat-bath'] as const) {
      const a = graphIsingKernel(model, sampler),
        b = latticeTwoByTwoKernel(physical, sampler);
      for (let i = 0; i < 16; i++) {
        expect(a.probabilities[i]).toBeCloseTo(b.probabilities[i]!, 12);
        for (let j = 0; j < 16; j++)
          expect(a.matrix[i]![j]).toBeCloseTo(b.matrix[i]![j]!, 12);
      }
    }
    const kernel = latticeTwoByTwoKernel(p, 'metropolis');
    const values = Array.from({ length: 16 }, (_, state) =>
      observableValue(graph, state, 'm'),
    );
    const q1 = exactMarkovDiagnostics(kernel, values, 1),
      q20 = exactMarkovDiagnostics(kernel, values, 20);
    expect(q1.status).toBe('ok');
    expect(q20.status).toBe('ok');
    if (q1.status === 'ok' && q20.status === 'ok') {
      expect(q20.acf[1]).toBeCloseTo(q1.acf[20]!, 10);
      expect(q20.tauMeasurements).toBeLessThan(q1.tauMeasurements);
    }
  });
  it('marks extreme concentration unavailable rather than claiming a reliable spectrum', () => {
    expect(
      exactMarkovDiagnostics(
        latticeTwoByTwoKernel(
          { ...p, jx: 10, jy: 10, temperature: 0.05 },
          'metropolis',
        ),
        graphObservableValues(graph, 'M'),
      ).status,
    ).toBe('ill-conditioned');
  });
  it('handles genuine periodic parallels and custom self-links without changing transition multiplicity', () => {
    const domain = graphPreset('site');
    domain.edges.push(
      { id: 'loop-a', tail: 'v0', head: 'v0' },
      { id: 'loop-b', tail: 'v0', head: 'v0' },
    );
    const model: IsingModel = {
      kind: 'ising',
      parameters: {
        domain,
        couplings: { 'loop-a': 3, 'loop-b': -2 },
        fields: { v0: 0 },
      },
    };
    const kernel = graphIsingKernel(model, 'metropolis');
    expect(kernel.matrix).toEqual([
      [0.5, 0.5],
      [0.5, 0.5],
    ]);
    expect(
      exactMarkovDiagnostics(kernel, graphObservableValues(model, 'M')).status,
    ).toBe('ok');
    const torus = graphIsingKernel(graph, 'metropolis');
    expect(torus.siteCount).toBe(4);
    expect(graph.parameters.domain.edges).toHaveLength(8);
  });
  it('resolves a slow but numerically conditioned four-spin mode', () => {
    const model: IsingModel = {
      ...graph,
      parameters: {
        ...graph.parameters,
        couplings: Object.fromEntries(
          graph.parameters.domain.edges.map((e) => [e.id, 1.5]),
        ),
      },
    };
    const benchmark = exactMarkovDiagnostics(
      graphIsingKernel(model, 'metropolis'),
      graphObservableValues(model, 'M'),
    );
    expect(benchmark.status).toBe('ok');
    if (benchmark.status === 'ok') {
      expect(benchmark.tauMeasurements).toBeGreaterThan(3.5);
      expect(benchmark.gap).toBeLessThan(0.25);
    }
  });
  it('empirical stationary ensemble lag-one correlation agrees with the exact four-spin result', () => {
    const exact = exactMarkovDiagnostics(
      graphIsingKernel(graph, 'metropolis'),
      graphObservableValues(graph, 'M'),
    );
    expect(exact.status).toBe('ok');
    let numerator = 0,
      denominator = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const rng = createRng(seed);
      let state = Math.floor(rng.uniform() * 16);
      for (let update = 0; update < 5000; update++) {
        const before = observableValue(graph, state, 'M');
        state = isingTransition(
          graph,
          { kind: 'metropolis', width: 1, warmup: 0 },
          state,
          rng,
        ).result!;
        const after = observableValue(graph, state, 'M');
        numerator += before * after;
        denominator += before * before;
      }
    }
    expect(numerator / denominator).toBeCloseTo(exact.acf[1]!, 1);
  });
  it('benchmarks the revised empirical window against exact four-spin autocorrelation', () => {
    const exact = exactMarkovDiagnostics(
      graphIsingKernel(graph, 'metropolis'),
      graphObservableValues(graph, 'm'),
    );
    expect(exact.status).toBe('ok');
    if (exact.status !== 'ok') return;
    const empiricalTau: number[] = [];
    const lagOne: number[] = [];
    for (let seed = 101; seed <= 108; seed++) {
      const rng = createRng(seed);
      let state = Math.floor(rng.uniform() * 16);
      const values = Array.from({ length: 8192 }, () => {
        state = isingTransition(
          graph,
          { kind: 'metropolis', width: 1, warmup: 0 },
          state,
          rng,
        ).result!;
        return observableValue(graph, state, 'm');
      });
      const result = analyzeSeries(values, 'm', { kind: 'local', sites: 4 });
      lagOne.push(result.acf[1]!.rho);
      if (result.tauMeasurements !== null)
        empiricalTau.push(result.tauMeasurements);
    }
    expect(lagOne.reduce((a, b) => a + b, 0) / lagOne.length).toBeCloseTo(
      exact.acf[1]!,
      1,
    );
    expect(empiricalTau.length).toBeGreaterThanOrEqual(6);
    expect(
      empiricalTau.reduce((a, b) => a + b, 0) / empiricalTau.length,
    ).toBeCloseTo(exact.tauMeasurements, 0);
  });
});
