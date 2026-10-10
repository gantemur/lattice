import { expect, it } from 'vitest';
import { createRng } from './rng';
import { transition, validateSettings } from './transitions';
import type { Settings } from './transitions';
import { modelReference, probability, support } from '../models/singleVariable';
import type { Model } from '../models/singleVariable';
const metropolis = { kind: 'metropolis' as const, width: 2, warmup: 200 };
function draws(...values: number[]) {
  let i = 0;
  return {
    uniform: () => {
      if (i === values.length) throw new Error('Unexpected RNG draw');
      return values[i++]!;
    },
  };
}
function matrix(model: Model) {
  const states = support(model);
  return states.map((current) => {
    const row = states.map(() => 0);
    for (const u of [0.25, 0.75]) {
      const t = transition(
        { model, sampler: metropolis },
        current,
        draws(u, 0.3),
      );
      if (t.kind !== 'metropolis') throw new Error('Wrong transition');
      row[states.indexOf(t.proposed)]! += 0.5 * t.alpha;
      row[states.indexOf(current)]! += 0.5 * (1 - t.alpha);
    }
    return row;
  });
}
it.each<Model>([
  { kind: 'spin', parameters: { h: 0 } },
  { kind: 'spin', parameters: { h: 2 } },
  { kind: 'binomial', parameters: { n: 1, p: 0.5 } },
  { kind: 'binomial', parameters: { n: 4, p: 0.2 } },
  { kind: 'binomial', parameters: { n: 6, p: 0.8 } },
])(
  'exact transition matrix preserves equilibrium, detailed balance and aperiodicity: %j',
  (model) => {
    const states = support(model),
      p = matrix(model),
      pi = states.map((s) => probability(model, s));
    p.forEach((row, i) => {
      expect(row.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 15);
      row.forEach((q, j) =>
        expect(pi[i]! * q).toBeCloseTo(pi[j]! * p[j]![i]!, 14),
      );
      expect(p.reduce((sum, row, j) => sum + pi[j]! * row[i]!, 0)).toBeCloseTo(
        pi[i]!,
        14,
      );
      if (i + 1 < states.length) {
        expect(row[i + 1]).toBeGreaterThan(0);
        expect(p[i + 1]![i]).toBeGreaterThan(0);
      }
    });
    // Connected finite chain plus a nonzero diagonal entry implies aperiodicity.
    expect(p.some((row, i) => row[i]! > 0)).toBe(true);
    if (model.kind === 'spin' && model.parameters.h === 0)
      expect(p).toEqual([
        [0.5, 0.5],
        [0.5, 0.5],
      ]);
  },
);
it('records boundary self-proposals, lazy self-proposals, rejection and accepted moves exactly', () => {
  const model: Model = { kind: 'binomial', parameters: { n: 4, p: 0.5 } };
  expect(
    transition({ model, sampler: metropolis }, 0, draws(0.2, 0.9)),
  ).toMatchObject({
    attempted: -1,
    proposed: 0,
    result: 0,
    delta: 0,
    alpha: 1,
    accepted: true,
    outcome: 'self',
    selfReason: 'boundary',
  });
  expect(
    transition({ model, sampler: metropolis }, 4, draws(0.8, 0.9)),
  ).toMatchObject({ attempted: 5, proposed: 4, result: 4, outcome: 'self' });
  const spin: Model = { kind: 'spin', parameters: { h: 2 } };
  expect(
    transition({ model: spin, sampler: metropolis }, 1, draws(0.2, 0.8)),
  ).toMatchObject({ outcome: 'self', selfReason: 'lazy', alpha: 1 });
  expect(
    transition({ model: spin, sampler: metropolis }, 1, draws(0.8, 0.9)),
  ).toMatchObject({
    proposed: -1,
    delta: 4,
    alpha: Math.exp(-4),
    accepted: false,
    result: 1,
    outcome: 'rejected',
  });
  expect(
    transition({ model: spin, sampler: metropolis }, -1, draws(0.8, 0.9)),
  ).toMatchObject({
    delta: -4,
    accepted: true,
    result: 1,
    outcome: 'accepted',
  });
  expect(
    transition(
      {
        model: { kind: 'gaussian', parameters: { a: 1, h: 0 } },
        sampler: metropolis,
      },
      0,
      draws(0.75, 0.9),
    ),
  ).toMatchObject({
    proposed: 1,
    delta: 0.5,
    alpha: Math.exp(-0.5),
    outcome: 'rejected',
    result: 0,
  });
});
it('direct and heat-bath draws have no fictitious acceptance calculation', () => {
  for (const kind of ['direct', 'heat-bath'] as const) {
    const t = transition(
      { model: { kind: 'spin', parameters: { h: 0 } }, sampler: { kind } },
      1,
      draws(0.75),
    );
    expect(t.result).toBe(-1);
    expect(t).not.toHaveProperty('alpha');
    expect(t).not.toHaveProperty('accepted');
  }
  expect(() =>
    validateSettings({
      model: { kind: 'gaussian', parameters: { a: 1, h: 0 } },
      sampler: { kind: 'heat-bath' },
    }),
  ).toThrow();
  expect(() =>
    validateSettings({
      model: { kind: 'spin', parameters: { h: 0 } },
      sampler: { ...metropolis, warmup: -1 },
    }),
  ).toThrow();
});
it.each<Model>([
  { kind: 'gaussian', parameters: { a: 2, h: 1 } },
  { kind: 'spin', parameters: { h: -0.7 } },
  { kind: 'binomial', parameters: { n: 20, p: 0.3 } },
])(
  'independent sampler moments agree with exact variance-based tolerances: %j',
  (model) => {
    const rng = createRng(651),
      ref = modelReference(model),
      n = 100000;
    let sum = 0,
      squares = 0;
    for (let i = 0; i < n; i++) {
      const x = transition(
        { model, sampler: { kind: 'direct' } },
        null,
        rng,
      ).result;
      sum += x;
      squares += x * x;
    }
    const fourth =
      model.kind === 'gaussian'
        ? ref.mean ** 4 +
          6 * ref.mean ** 2 * ref.variance +
          3 * ref.variance ** 2
        : support(model).reduce(
            (s, x) => s + x ** 4 * probability(model, x),
            0,
          );
    expect(Math.abs(sum / n - ref.mean)).toBeLessThan(
      6 * Math.sqrt(ref.variance / n),
    );
    expect(Math.abs(squares / n - ref.secondMoment)).toBeLessThan(
      6 * Math.sqrt(Math.max(0, fourth - ref.secondMoment ** 2) / n) + 1e-10,
    );
  },
);
it.each<Model>([
  { kind: 'spin', parameters: { h: 0.7 } },
  { kind: 'binomial', parameters: { n: 6, p: 0.35 } },
])(
  'post-warm-up Metropolis frequencies match exact matrix covariance bounds: %j',
  (model) => {
    const p = matrix(model),
      states = support(model),
      pi = states.map((s) => probability(model, s));
    const rng = createRng(99),
      n = 100000,
      counts = states.map(() => 0);
    let current = states[0]!;
    for (let i = -2000; i < n; i++) {
      current = transition({ model, sampler: metropolis }, current, rng).result;
      if (i >= 0) counts[states.indexOf(current)]!++;
    }
    for (let k = 0; k < states.length; k++) {
      let row: number[] = states.map((_, j) => (j === k ? 1 : 0));
      let variance = pi[k]! * (1 - pi[k]!);
      for (let lag = 1; lag <= 2000; lag++) {
        row = states.map((_, j) =>
          row.reduce((sum, q, i) => sum + q * p[i]![j]!, 0),
        );
        variance += 2 * (1 - lag / n) * pi[k]! * (row[k]! - pi[k]!);
      }
      expect(Math.abs(counts[k]! / n - pi[k]!)).toBeLessThan(
        6 * Math.sqrt(variance / n),
      );
    }
  },
);
it('Gaussian Metropolis ensemble moments approach exact equilibrium after burn-in', () => {
  const settings: Settings = {
    model: { kind: 'gaussian', parameters: { a: 1, h: 0 } },
    sampler: metropolis,
  };
  const replicas = 100,
    means: number[] = [],
    seconds: number[] = [];
  for (let r = 0; r < replicas; r++) {
    const rng = createRng(r);
    let x = 10,
      sum = 0,
      square = 0;
    for (let i = -1000; i < 4096; i++) {
      x = transition(settings, x, rng).result;
      if (i >= 0) {
        sum += x;
        square += x * x;
      }
    }
    means.push(sum / 4096);
    seconds.push(square / 4096);
  }
  for (const [values, truth] of [
    [means, 0],
    [seconds, 1],
  ] as const) {
    const mean = values.reduce((a, b) => a + b, 0) / replicas;
    const variance =
      values.reduce((a, b) => a + (b - mean) ** 2, 0) / (replicas - 1);
    expect(Math.abs(mean - truth)).toBeLessThan(
      6 * Math.sqrt(variance / replicas),
    );
  }
});

it('single-spin heat bath is independent of the previous state and replays direct sampling', () => {
  const model: Model = { kind: 'spin', parameters: { h: -1.3 } };
  const first = createRng(88),
    second = createRng(88),
    direct = createRng(88);
  for (let i = 0; i < 1000; i++) {
    const a = transition({ model, sampler: { kind: 'heat-bath' } }, -1, first);
    const b = transition({ model, sampler: { kind: 'heat-bath' } }, 1, second);
    expect(a.result).toBe(b.result);
    expect(a.result).toBe(
      transition({ model, sampler: { kind: 'direct' } }, null, direct).result,
    );
    if (a.kind === 'heat-bath')
      expect(a.result).toBe(a.uniform < a.probabilityPlus ? 1 : -1);
  }
});
