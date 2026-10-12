import { expect, it } from 'vitest';
import { createRng } from '../algorithms/rng';
import { isingTransition } from '../algorithms/isingTransition';
import {
  drawingPositions,
  isingGraphPreset,
  topologyKey,
  validateDomain,
} from '../domain/graph';
import {
  conditionalPlus,
  exactIsing,
  flipDifference,
  isingAction,
  spinAt,
} from '../models/ising';
import { scalarPreset } from '../models/scalarField';
import {
  catalogGroups,
  exampleConfiguration,
  examples,
  matchingExample,
} from './smallCatalog';

const graphExamples = [
  'ising-dimer',
  'ising-chain3',
  'ising-triangle',
  'ising-antiferro-triangle',
] as const;

it('keeps catalog identity outside the numerical model and exposes every recipe', () => {
  expect(catalogGroups.map((group) => group.label)).toEqual([
    'Elementary probability',
    'Small Ising graphs',
    'Continuous small systems',
    'Advanced examples',
  ]);
  expect(new Set(examples.map(([id]) => id)).size).toBe(examples.length);
  for (const [id] of examples) {
    const { model, sampler } = exampleConfiguration(id);
    expect('exampleId' in model).toBe(false);
    if (
      model.kind === 'scalar' &&
      model.parameters.domain.vertices.some(
        (v) => model.parameters.lambda[v.id]! > 0,
      )
    )
      expect(sampler.kind).toBe('metropolis');
    expect(matchingExample(model)).toBe(id);
  }
  expect(exampleConfiguration('ising-triangle').model.kind).toBe('ising');
  expect(exampleConfiguration('ising-antiferro-triangle').model.kind).toBe(
    'ising',
  );
  expect(exampleConfiguration('scalar').model).toEqual(scalarPreset('pair'));
  expect(exampleConfiguration('scalar-double-well').model).toEqual(
    scalarPreset('double-well'),
  );
});

it('constructs small graph topologies and deliberately readable coordinates', () => {
  for (const [id, vertices, bonds] of [
    ['dimer', 2, 1],
    ['chain3', 3, 2],
    ['triangle', 3, 3],
  ] as const) {
    const domain = isingGraphPreset(id);
    validateDomain(domain);
    expect(domain.vertices.map((v) => v.id)).toEqual(
      Array.from({ length: vertices }, (_, i) => `v${i}`),
    );
    expect(domain.edges.map((e) => e.id)).toEqual(
      Array.from({ length: bonds }, (_, i) => `e${i}`),
    );
    expect(domain.faces).toEqual([]);
    expect(
      new Set(
        Object.values(drawingPositions(domain)).map(([x, y]) => `${x},${y}`),
      ).size,
    ).toBe(vertices);
  }
  expect(drawingPositions(isingGraphPreset('dimer')).v0![0]).toBeLessThan(100);
  expect(drawingPositions(isingGraphPreset('triangle')).v0![1]).toBeLessThan(
    50,
  );
  const frustrated = exampleConfiguration('ising-antiferro-triangle').model;
  if (frustrated.kind !== 'ising') throw new Error('Expected Ising.');
  expect(topologyKey(isingGraphPreset('triangle'))).toBe(
    topologyKey(frustrated.parameters.domain),
  );
  expect(isingGraphPreset('torus').edges).toHaveLength(8);
  expect(isingGraphPreset('torus').faces).toHaveLength(4);
});

it.each(graphExamples)(
  'checks independent actions, flip costs, conditional and balance for %s',
  (id) => {
    const { model } = exampleConfiguration(id);
    if (model.kind !== 'ising') throw new Error('Expected Ising recipe.');
    const { domain, couplings, fields } = model.parameters;
    const n = domain.vertices.length;
    const actions = Array.from({ length: 2 ** n }, (_, state) => {
      const spins = Array.from({ length: n }, (_, i) =>
        state & (1 << i) ? 1 : -1,
      );
      return (
        -domain.edges.reduce(
          (sum, e) =>
            sum +
            couplings[e.id]! *
              spins[Number(e.tail.slice(1))]! *
              spins[Number(e.head.slice(1))]!,
          0,
        ) - spins.reduce((sum, s, i) => sum + s * fields[`v${i}`]!, 0)
      );
    });
    const weights = actions.map((action) => Math.exp(-action));
    const partition = weights.reduce((sum, weight) => sum + weight, 0);
    const exact = exactIsing(model);
    expect(exact.logPartition).toBeCloseTo(Math.log(partition), 12);
    for (let state = 0; state < weights.length; state++) {
      expect(isingAction(model, state)).toBeCloseTo(actions[state]!, 12);
      expect(exact.probabilities[state]).toBeCloseTo(
        weights[state]! / partition,
        12,
      );
      for (let site = 0; site < n; site++) {
        const other = state ^ (1 << site);
        const delta = actions[other]! - actions[state]!;
        expect(flipDifference(model, state, site)).toBeCloseTo(delta, 12);
        const plus = spinAt(state, site) === 1 ? state : other;
        const minus = spinAt(state, site) === -1 ? state : other;
        const expectedPlus =
          weights[plus]! / (weights[plus]! + weights[minus]!);
        expect(conditionalPlus(model, state, site)).toBeCloseTo(
          expectedPlus,
          12,
        );
        const metropolisForward = 0.5 * Math.min(1, Math.exp(-delta));
        const metropolisReverse = 0.5 * Math.min(1, Math.exp(delta));
        expect(weights[state]! * metropolisForward).toBeCloseTo(
          weights[other]! * metropolisReverse,
          12,
        );
        const heatForward =
          spinAt(state, site) === 1 ? 1 - expectedPlus : expectedPlus;
        const heatReverse =
          spinAt(other, site) === 1 ? 1 - expectedPlus : expectedPlus;
        expect(weights[state]! * heatForward).toBeCloseTo(
          weights[other]! * heatReverse,
          12,
        );
      }
    }
    expect(exact.probabilities.reduce((sum, p) => sum + p, 0)).toBeCloseTo(
      1,
      14,
    );
    for (const sampler of [
      { kind: 'direct' } as const,
      { kind: 'heat-bath', warmup: 0 } as const,
      { kind: 'metropolis', width: 1, warmup: 0 } as const,
    ]) {
      const replay = () => {
        const rng = createRng(415);
        let state: number | null = sampler.kind === 'direct' ? null : 0;
        return Array.from({ length: 32 }, () => {
          const move = isingTransition(model, sampler, state, rng);
          state = move.result;
          return move;
        });
      };
      expect(replay()).toEqual(replay());
    }
  },
);

it('agrees with closed-form dimer, chain and triangle references', () => {
  const k = 0.5;
  const dimer = exampleConfiguration('ising-dimer').model;
  const chain = exampleConfiguration('ising-chain3').model;
  if (dimer.kind !== 'ising' || chain.kind !== 'ising')
    throw new Error('Expected Ising.');
  expect(exactIsing(dimer).logPartition).toBeCloseTo(
    Math.log(4 * Math.cosh(k)),
    13,
  );
  expect(exactIsing(dimer).correlations[0]![1]).toBeCloseTo(Math.tanh(k), 13);
  expect(exactIsing(chain).logPartition).toBeCloseTo(
    Math.log(8 * Math.cosh(k) ** 2),
    13,
  );
  expect(exactIsing(chain).correlations[0]![2]).toBeCloseTo(
    Math.tanh(k) ** 2,
    13,
  );
  for (const [id, coupling] of [
    ['ising-triangle', 0.5],
    ['ising-antiferro-triangle', -1],
  ] as const) {
    const model = exampleConfiguration(id).model;
    if (model.kind !== 'ising') throw new Error('Expected Ising.');
    expect(exactIsing(model).logPartition).toBeCloseTo(
      Math.log(2 * Math.exp(3 * coupling) + 6 * Math.exp(-coupling)),
      13,
    );
  }
  const frustrated = exampleConfiguration('ising-antiferro-triangle').model;
  if (frustrated.kind !== 'ising') throw new Error('Expected Ising.');
  const exact = exactIsing(frustrated);
  expect(
    exact.actions.filter((action) => action === Math.min(...exact.actions)),
  ).toHaveLength(6);
  expect(exact.correlations[0]![1]).toBeCloseTo(
    (Math.exp(-3) - Math.exp(1)) / (Math.exp(-3) + 3 * Math.exp(1)),
    13,
  );
  const magnetizationMass = new Map<number, number>();
  exact.probabilities.forEach((p, state) => {
    const m = [0, 1, 2].reduce((sum, i) => sum + spinAt(state, i), 0);
    magnetizationMass.set(m, (magnetizationMass.get(m) ?? 0) + p);
  });
  expect(magnetizationMass.get(-1)).toBeCloseTo(
    (3 * Math.exp(1)) / (2 * Math.exp(-3) + 6 * Math.exp(1)),
    13,
  );
  expect(magnetizationMass.get(1)).toBeCloseTo(magnetizationMass.get(-1)!, 13);
});
