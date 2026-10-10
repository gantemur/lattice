import { expect, it } from 'vitest';
import { SimulationRun } from './simulationEngine';
import { createRng } from '../algorithms/rng';
import { transition } from '../algorithms/transitions';
import type { Settings } from '../algorithms/transitions';
import { defaultModel, initialState } from '../models/singleVariable';
import { MAX_TRANSITIONS } from '../observables/trajectory';
import { MAX_SEGMENTS } from './protocol';

const configurations: Settings[] = [
  {
    model: defaultModel('gaussian'),
    sampler: { kind: 'metropolis', width: 2, warmup: 200 },
  },
  {
    model: defaultModel('spin'),
    sampler: { kind: 'metropolis', width: 1, warmup: 20 },
  },
  { model: defaultModel('spin'), sampler: { kind: 'heat-bath' } },
  {
    model: defaultModel('binomial'),
    sampler: { kind: 'metropolis', width: 1, warmup: 100 },
  },
  { model: defaultModel('binomial'), sampler: { kind: 'direct' } },
];
it.each(configurations)(
  'Step/Run/snapshots share the exact transition and RNG sequence: %j',
  (settings) => {
    const run = new SimulationRun(1, { ...settings, seed: 97 }),
      steps = new SimulationRun(1, { ...settings, seed: 97 });
    const rng = createRng(97);
    let value: number | null =
      settings.sampler.kind === 'direct' ? null : initialState(settings.model);
    for (let i = 0; i < 2500; i++) {
      const t = transition(settings, value, rng);
      value = t.result;
      steps.advance(1);
      if (i % 23 === 0) {
        const s = steps.snapshot(),
          last = s.segments[0]!.trajectory.at(-1)!;
        expect(last).toMatchObject(t);
        expect(last.update).toBe(i + 1);
        expect(last.result).toBe(s.currentValue);
      }
    }
    run.advance(1000);
    run.advance(1000);
    run.advance(500);
    expect(run.snapshot()).toEqual(steps.snapshot());
    expect(run.snapshot().currentValue).toBe(value);
    const segment = run.snapshot().segments[0]!;
    expect(segment.trajectory).toHaveLength(MAX_TRANSITIONS);
    expect(segment.trajectory[0]!.update).toBe(1501);
    expect(segment.updates).toBe(segment.moments.count + segment.warmupUpdates);
    expect(segment.convergence.at(-1)!.mean).toBe(segment.moments.mean);
    expect(segment.convergence.at(-1)!.count).toBe(segment.moments.count);
    expect(
      segment.histogram.bins.reduce(
        (a, b) => a + b,
        segment.histogram.above + segment.histogram.below,
      ),
    ).toBe(segment.moments.count);
    if (settings.sampler.kind === 'metropolis')
      expect(segment.accepted + segment.rejected + segment.self).toBe(
        segment.updates,
      );
  },
);
it('excludes every warm-up sample while keeping exact inspection records and counts', () => {
  const settings: Settings = {
    model: defaultModel('spin'),
    sampler: { kind: 'metropolis', width: 1, warmup: 10 },
  };
  const run = new SimulationRun(1, { ...settings, seed: 3 });
  run.advance(10);
  let s = run.snapshot(),
    segment = s.segments[0]!;
  expect(s.moments.count).toBe(0);
  expect(s.warmupUpdates).toBe(10);
  expect(segment.convergence).toEqual([]);
  expect(segment.trajectory.every((t) => t.warmup)).toBe(true);
  run.advance(30);
  s = run.snapshot();
  segment = s.segments[0]!;
  const retained = segment.trajectory
    .filter((t) => !t.warmup)
    .map((t) => t.result);
  expect(retained).toHaveLength(30);
  expect(segment.moments.mean).toBeCloseTo(
    retained.reduce((a, b) => a + b, 0) / 30,
    14,
  );
  expect(segment.histogram.bins).toEqual([
    retained.filter((s) => s === -1).length,
    retained.filter((s) => s === 1).length,
  ]);
  for (const outcome of ['accepted', 'rejected', 'self'] as const)
    expect(segment[outcome]).toBe(
      segment.trajectory.filter((t) => t.outcome === outcome).length,
    );
});
it('algorithm/width/warm-up/target changes isolate segments, carry state and preserve RNG', () => {
  const model = defaultModel('gaussian'),
    run = new SimulationRun(1, {
      model,
      sampler: { kind: 'direct' },
      seed: 44,
    }),
    rng = createRng(44);
  run.advance(1);
  let value = transition(
    { model, sampler: { kind: 'direct' } },
    null,
    rng,
  ).result;
  for (const settings of [
    { model, sampler: { kind: 'metropolis' as const, width: 2, warmup: 3 } },
    { model, sampler: { kind: 'metropolis' as const, width: 0.3, warmup: 4 } },
    {
      model: { kind: 'gaussian' as const, parameters: { a: 4, h: 2 } },
      sampler: { kind: 'metropolis' as const, width: 0.3, warmup: 0 },
    },
    { model, sampler: { kind: 'direct' as const } },
  ]) {
    const old = run.snapshot();
    run.changeSettings(settings);
    expect(run.snapshot().segments.slice(0, -1)).toEqual(old.segments);
    expect(run.snapshot().currentValue).toBe(value);
    expect(run.snapshot().moments.count).toBe(0);
    run.advance(10);
    for (let i = 0; i < 10; i++)
      value = transition(settings, value, rng).result;
    expect(run.snapshot().currentValue).toBe(value);
    expect(run.snapshot().moments.count).toBe(
      10 -
        (settings.sampler.kind === 'metropolis' ? settings.sampler.warmup : 0),
    );
  }
  const before = run.snapshot();
  expect(() =>
    run.changeSettings({
      model: defaultModel('spin'),
      sampler: { kind: 'direct' },
    }),
  ).toThrow(/session/);
  expect(run.snapshot()).toEqual(before);
});
it('clamps an excluded binomial configuration explicitly and initializes Reset deterministically', () => {
  const settings: Settings = {
    model: { kind: 'binomial', parameters: { n: 100, p: 0.999 } },
    sampler: { kind: 'metropolis', width: 1, warmup: 2 },
  };
  const run = new SimulationRun(1, { ...settings, seed: 0 });
  expect(run.snapshot().currentValue).toBe(100);
  run.changeSettings({
    ...settings,
    model: { kind: 'binomial', parameters: { n: 3, p: 0.5 } },
  });
  expect(run.snapshot().currentValue).toBe(3);
  expect(run.snapshot().segments[1]!.initialization).toContain('clamped');
  run.advance(30);
  const reset = new SimulationRun(2, run.snapshot().configuration);
  expect(reset.snapshot()).toMatchObject({
    currentValue: 2,
    updates: 0,
    warmupUpdates: 0,
    droppedSegments: 0,
  });
  expect(reset.snapshot().segments).toHaveLength(1);
  expect(reset.snapshot().segments[0]!.trajectory).toEqual([]);
});
it('bounds retained transitions over many segments and protects snapshots from mutation', () => {
  const run = new SimulationRun(1, { ...configurations[0]!, seed: 4 });
  for (let h = 0; h < 10; h++) {
    run.changeSettings({
      ...configurations[0]!,
      model: { kind: 'gaussian', parameters: { a: 1, h } },
    });
    run.advance(1024);
  }
  const copy = run.snapshot();
  expect(copy.segments).toHaveLength(MAX_SEGMENTS);
  expect(
    copy.segments.every((s) => s.trajectory.length <= MAX_TRANSITIONS),
  ).toBe(true);
  copy.segments[0]!.trajectory[0]!.result = 123456;
  expect(run.snapshot().segments[0]!.trajectory[0]!.result).not.toBe(123456);
});
