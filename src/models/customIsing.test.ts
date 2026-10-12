import { describe, expect, it } from 'vitest';
import { createRng } from '../algorithms/rng';
import { isingTransition } from '../algorithms/isingTransition';
import {
  customPairIds,
  customSimpleIsingDomain,
  drawingPositions,
  topologyKey,
  validateCustomSimpleIsingDomain,
  validateDomain,
} from '../domain/graph';
import { SimulationRun } from '../engine/simulationEngine';
import {
  createArchiveEntry,
  exportBundle,
  importBundle,
} from '../experiments/archive';
import { exportMeasurementsCsv, exportSummaryCsv } from '../experiments/export';
import {
  conditionalPlus,
  customIsingModel,
  exactIsing,
  flipDifference,
  isingAction,
  isingPreset,
} from './ising';

function spin(state: number, site: number) {
  return state & (1 << site) ? 1 : -1;
}

describe('custom simple Ising graphs', () => {
  it('checks all 74 labeled presence patterns with an independent finite sum', () => {
    for (const n of [2, 3, 4]) {
      const available = customPairIds(n);
      for (let mask = 0; mask < 2 ** available.length; mask++) {
        const present = available.filter((_, i) => mask & (1 << i));
        const couplings = Object.fromEntries(
          available.map((id, i) => [
            id,
            i % 3 === 0 ? 0 : (i % 2 ? -1 : 1) * 0.35,
          ]),
        );
        const fields = Object.fromEntries(
          Array.from({ length: n }, (_, i) => [`v${i}`, (i - 1) * 0.2]),
        );
        const model = customIsingModel(n, present, couplings, fields);
        const { domain } = model.parameters;
        validateDomain(domain);
        validateCustomSimpleIsingDomain(domain);
        expect(domain.vertices.map((v) => v.id)).toEqual(
          Array.from({ length: n }, (_, i) => `v${i}`),
        );
        expect(domain.edges.map((edge) => edge.id)).toEqual(present);
        expect(Object.keys(model.parameters.couplings)).toEqual(present);
        expect(domain.edges.map((edge) => [edge.tail, edge.head])).toEqual(
          present.map((id) => id.split(':').slice(1)),
        );
        expect(domain.faces).toEqual([]);
        expect(domain.lattice).toBeUndefined();
        const actions = Array.from({ length: 2 ** n }, (_, state) => {
          const bondSum = available.reduce((sum, pair, i) => {
            if (!(mask & (1 << i))) return sum;
            const [, tail, head] = pair.split(':');
            return (
              sum +
              couplings[pair]! *
                spin(state, Number(tail!.slice(1))) *
                spin(state, Number(head!.slice(1)))
            );
          }, 0);
          const fieldSum = Array.from(
            { length: n },
            (_, i) => fields[`v${i}`]! * spin(state, i),
          ).reduce((a, b) => a + b, 0);
          return -bondSum - fieldSum;
        });
        const weights = actions.map((action) => Math.exp(-action));
        const partition = weights.reduce((sum, weight) => sum + weight, 0);
        const exact = exactIsing(model);
        expect(exact.logPartition).toBeCloseTo(Math.log(partition), 12);
        expect(exact.probabilities.reduce((a, b) => a + b, 0)).toBeCloseTo(
          1,
          13,
        );
        for (let state = 0; state < 2 ** n; state++) {
          expect(isingAction(model, state)).toBeCloseTo(actions[state]!, 12);
          expect(exact.probabilities[state]).toBeCloseTo(
            weights[state]! / partition,
            12,
          );
          for (let site = 0; site < n; site++) {
            const flipped = state ^ (1 << site);
            const delta = actions[flipped]! - actions[state]!;
            expect(flipDifference(model, state, site)).toBeCloseTo(delta, 12);
            const plus = spin(state, site) === 1 ? state : flipped;
            const minus = spin(state, site) === -1 ? state : flipped;
            const probabilityPlus =
              weights[plus]! / (weights[plus]! + weights[minus]!);
            expect(conditionalPlus(model, state, site)).toBeCloseTo(
              probabilityPlus,
              12,
            );
            // Site-selection factors cancel in these pairwise balance checks.
            const metroForward = 0.5 * Math.min(1, Math.exp(-delta));
            const metroReverse = 0.5 * Math.min(1, Math.exp(delta));
            expect(weights[state]! * metroForward).toBeCloseTo(
              weights[flipped]! * metroReverse,
              11,
            );
            const heatForward =
              spin(flipped, site) === 1 ? probabilityPlus : 1 - probabilityPlus;
            const heatReverse =
              spin(state, site) === 1 ? probabilityPlus : 1 - probabilityPlus;
            expect(weights[state]! * heatForward).toBeCloseTo(
              weights[flipped]! * heatReverse,
              11,
            );
          }
        }
      }
    }
  });

  it('distinguishes an absent pair from a present zero-weight edge', () => {
    const id = 'pair:v0:v1';
    const absent = customIsingModel(2, []);
    const zero = customIsingModel(2, [id], { [id]: 0 });
    expect(exactIsing(absent).probabilities).toEqual(
      exactIsing(zero).probabilities,
    );
    expect(exactIsing(absent).logPartition).toBeCloseTo(Math.log(4), 14);
    expect(absent.parameters.domain.edges).toEqual([]);
    expect(zero.parameters.domain.edges).toHaveLength(1);
    expect(topologyKey(absent.parameters.domain)).not.toBe(
      topologyKey(zero.parameters.domain),
    );
    expect(absent.parameters.couplings).toEqual({});
    expect(zero.parameters.couplings).toEqual({ [id]: 0 });
  });

  it('matches named dimer and triangle while preserving independent identities', () => {
    for (const [n, pairs, preset] of [
      [2, ['pair:v0:v1'], 'dimer'],
      [3, customPairIds(3), 'triangle'],
    ] as const) {
      const custom = customIsingModel(n, pairs);
      const named = isingPreset(preset);
      expect(custom.parameters.domain.edges.map((edge) => edge.id)).not.toEqual(
        named.parameters.domain.edges.map((edge) => edge.id),
      );
      expect(exactIsing(custom).probabilities).toEqual(
        exactIsing(named).probabilities,
      );
      expect(exactIsing(custom).logPartition).toBeCloseTo(
        exactIsing(named).logPartition,
        13,
      );
    }
    const af = customIsingModel(
      3,
      customPairIds(3),
      Object.fromEntries(customPairIds(3).map((id) => [id, -1])),
    );
    const actions = exactIsing(af).actions;
    expect(
      actions.filter((action) => action === Math.min(...actions)),
    ).toHaveLength(6);
  });

  it('factorizes disconnected components and supports large finite fields', () => {
    const pair = customIsingModel(
      2,
      ['pair:v0:v1'],
      { 'pair:v0:v1': -0.7 },
      { v0: 0.4, v1: -0.2 },
    );
    const disconnected = customIsingModel(
      4,
      ['pair:v0:v1'],
      { 'pair:v0:v1': -0.7 },
      { v0: 0.4, v1: -0.2, v2: 0.5, v3: -0.3 },
    );
    expect(exactIsing(disconnected).logPartition).toBeCloseTo(
      exactIsing(pair).logPartition +
        Math.log(2 * Math.cosh(0.5)) +
        Math.log(2 * Math.cosh(-0.3)),
      13,
    );
    const strong = customIsingModel(
      4,
      customPairIds(4),
      Object.fromEntries(customPairIds(4).map((id) => [id, -10])),
      { v0: 10, v1: -10, v2: 10, v3: -10 },
    );
    expect(
      exactIsing(strong).probabilities.reduce((a, b) => a + b, 0),
    ).toBeCloseTo(1, 13);
    expect(exactIsing(strong).probabilities.every(Number.isFinite)).toBe(true);
  });

  it('rejects malformed custom incidence without restricting legacy multigraphs', () => {
    expect(() => customPairIds(1)).toThrow();
    expect(() =>
      customSimpleIsingDomain(4, ['pair:v0:v1', 'pair:v0:v1']),
    ).toThrow();
    expect(() => customSimpleIsingDomain(4, ['pair:v1:v0'])).toThrow();
    const invalid = customSimpleIsingDomain(2, ['pair:v0:v1']);
    invalid.edges[0]!.tail = 'v1';
    expect(() => validateCustomSimpleIsingDomain(invalid)).toThrow();
    const reordered = customSimpleIsingDomain(2, ['pair:v0:v1']);
    reordered.edges = [{ head: 'v1', id: 'pair:v0:v1', tail: 'v0' }];
    expect(() => validateCustomSimpleIsingDomain(reordered)).not.toThrow();
    const phantom = customIsingModel(2, []);
    phantom.parameters.couplings['pair:v0:v1'] = 0;
    expect(() => exactIsing(phantom)).toThrow(/active sites and edges/);
    expect(
      Object.keys(drawingPositions(customSimpleIsingDomain(4, []))),
    ).toEqual(['v0', 'v1', 'v2', 'v3']);
    expect(isingPreset('torus').parameters.domain.edges).toHaveLength(8);
    expect(isingPreset('torus').parameters.domain.faces).toHaveLength(4);
  });

  it('replays the established direct and local kernels on a custom graph', () => {
    const model = customIsingModel(4, ['pair:v0:v1', 'pair:v0:v3'], {
      'pair:v0:v1': -0.8,
      'pair:v0:v3': 0,
    });
    for (const sampler of [
      { kind: 'direct' } as const,
      { kind: 'heat-bath', warmup: 0 } as const,
      { kind: 'metropolis', width: 1, warmup: 0 } as const,
    ]) {
      const replay = () => {
        const rng = createRng(2781);
        let state: number | null = sampler.kind === 'direct' ? null : 0;
        return Array.from({ length: 64 }, () => {
          const move = isingTransition(model, sampler, state, rng);
          if (state !== null && move.kind === 'metropolis')
            expect(
              isingAction(model, move.result) - isingAction(model, state),
            ).toBeCloseTo(move.accepted ? move.delta : 0, 13);
          if (state !== null && move.kind === 'heat-bath')
            expect(
              isingAction(model, move.result) - isingAction(model, state),
            ).toBeCloseTo(
              move.result === state
                ? 0
                : flipDifference(model, state, move.ising!.index),
              13,
            );
          state = move.result;
          return move;
        });
      };
      expect(replay()).toEqual(replay());
    }
  });

  it('isolates parameter segments, rejects topology changes, and round trips captures', () => {
    const initial = customIsingModel(4, ['pair:v0:v1']);
    const configuration = {
      model: initial,
      sampler: { kind: 'direct' as const },
      seed: 475,
    };
    const run = new SimulationRun(1, configuration);
    const control = new SimulationRun(1, configuration);
    run.advance(17);
    control.advance(17);
    const state = run.snapshot().currentValue;
    const changed = customIsingModel(
      4,
      ['pair:v0:v1'],
      { 'pair:v0:v1': -0.8 },
      { v0: 0.6 },
    );
    run.changeSettings({ model: changed, sampler: configuration.sampler });
    control.changeSettings({ model: changed, sampler: configuration.sampler });
    expect(run.snapshot().currentValue).toBe(state);
    expect(
      run.snapshot().segments.map((segment) => segment.moments.count),
    ).toEqual([17, 0]);
    run.advance(19);
    control.advance(19);
    expect(run.snapshot()).toEqual(control.snapshot());
    const old = run.capture(1);
    const current = run.capture(2);
    expect(old.segment.model).toEqual(initial);
    expect(current.segment.model).toEqual(changed);
    expect(old.currentState).toBeNull();
    expect(current.segment.moments.count).toBe(19);
    const entries = [old, current].map((capture) =>
      createArchiveEntry(capture, 'custom', 'custom graph'),
    );
    const imported = importBundle([], exportBundle(entries));
    expect(imported.map((entry) => entry.scientific.capture)).toEqual([
      old,
      current,
    ]);
    expect(exportBundle(imported)).toContain('custom-simple-ising');
    expect(exportSummaryCsv(imported)).toContain('small,ising');
    expect(exportMeasurementsCsv(imported)).toContain('small,ising');
    const reorderedBundle = JSON.parse(exportBundle(entries));
    reorderedBundle.records[0].scientific.capture.segment.model.parameters.domain.edges[0] =
      {
        head: 'v1',
        id: 'pair:v0:v1',
        tail: 'v0',
      };
    expect(importBundle([], JSON.stringify(reorderedBundle))).toHaveLength(2);
    const tampered = JSON.parse(exportBundle(entries));
    tampered.records[0].scientific.capture.segment.model.parameters.couplings[
      'pair:v0:v2'
    ] = 0;
    expect(() => importBundle([], JSON.stringify(tampered))).toThrow();
    expect(() =>
      run.changeSettings({
        model: customIsingModel(4, []),
        sampler: configuration.sampler,
      }),
    ).toThrow(/Topology/);
    const restarted = new SimulationRun(2, {
      ...configuration,
      model: customIsingModel(4, []),
    });
    expect(restarted.snapshot().updates).toBe(0);
    expect(restarted.snapshot().activeSegmentId).toBe(1);
  });
});
