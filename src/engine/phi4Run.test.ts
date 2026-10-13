import { expect, it } from 'vitest';
import {
  FieldRun,
  FieldEngine,
  defaultPhi4Configuration,
  defaultFieldConfiguration,
} from './fieldRun';
import type { FieldSettings } from './fieldRun';
import { createFieldLattice } from '../domain/fieldLattice';
import { createRng } from '../algorithms/rng';
import { phi4Transition } from '../algorithms/phi4FieldSampler';
const config = {
  ...defaultPhi4Configuration,
  parameters: {
    ...defaultPhi4Configuration.parameters,
    shape: { kind: 'chain' as const, length: 2, periodic: true },
  },
  warmupSweeps: 2,
  strideSweeps: 2,
};
it('replays Step, unequal batches and Reset with exact nominal-sweep cadence', () => {
  const a = new FieldRun(1, config),
    b = new FieldRun(1, config),
    reset = new FieldRun(1, config);
  for (let i = 0; i < 103; i++) a.advance(1);
  for (const n of [1, 7, 23, 72]) b.advance(n);
  reset.advance(103);
  expect(a.snapshot()).toEqual(b.snapshot());
  expect(a.snapshot()).toEqual(reset.snapshot());
  const segment = a.snapshot().segments[0]!;
  expect(segment.warmupUpdates).toBe(4);
  expect(segment.measurements).toBe(24);
  expect(segment.reference).toBeNull();
});
it('isolates changed parameters, preserves field/RNG and restarts warm-up', () => {
  const run = new FieldRun(1, config),
    rng = createRng(config.seed),
    l = createFieldLattice(config.parameters.shape);
  let field = [0, 0];
  for (let i = 0; i < 17; i++)
    field = phi4Transition(l, config.parameters, field, 1, rng).field;
  run.advance(17);
  const before = run.snapshot();
  const changed = {
    ...config,
    parameters: { ...config.parameters, source: 0.4 },
    sampler: { kind: 'metropolis' as const, width: 0.5 },
  };
  run.changeSettings(changed);
  expect(run.snapshot().field).toEqual(before.field);
  expect(run.snapshot().segments[0]).toEqual(before.segments[0]);
  run.advance(9);
  for (let i = 0; i < 9; i++)
    field = phi4Transition(l, changed.parameters, field, 0.5, rng).field;
  expect(run.snapshot().field).toEqual(field);
  expect(run.snapshot().segments[1]!.measurements).toBe(1);
  expect(run.snapshot().segments[1]!.warmupUpdates).toBe(4);
});
it('retains full moments and pair products beyond vector eviction, including rejected states', () => {
  const run = new FieldRun(1, {
    ...config,
    warmupSweeps: 0,
    strideSweeps: 1,
    sampler: { kind: 'metropolis', width: 10 },
  });
  const fields: number[][] = [];
  for (let i = 0; i < 300; i++) {
    run.advance(2);
    fields.push(run.snapshot().field!);
  }
  const s = run.snapshot().segments[0]!,
    means = fields.map((f) => (f[0]! + f[1]!) / 2);
  expect(s.measurements).toBe(300);
  expect(s.recent.length).toBe(256);
  expect(s.discardedMeasurements).toBe(44);
  expect(s.rejected).toBeGreaterThan(0);
  expect(s.averageFourthMoment).toBeCloseTo(
    means.reduce((a, m) => a + m ** 4, 0) / 300,
    12,
  );
  expect(s.average.secondMoment).toBeCloseTo(
    means.reduce((a, m) => a + m * m, 0) / 300,
    12,
  );
  expect(s.pairProducts[0]![1]).toBeCloseTo(
    fields.reduce((a, f) => a + f[0]! * f[1]!, 0) / 300,
    12,
  );
  expect(
    fields.some(
      (f, i) => i > 0 && JSON.stringify(f) === JSON.stringify(fields[i - 1]),
    ),
  ).toBe(true);
  for (let i = 1; i < 10; i++)
    run.changeSettings({
      ...config,
      parameters: { ...config.parameters, source: i / 10 },
    });
  expect(run.snapshot().segments.length).toBe(8);
  expect(run.snapshot().droppedSegments).toBe(2);
});
it('rejects invalid worker requests atomically and resets geometry/model explicitly', () => {
  const engine = new FieldEngine();
  const first = engine.handle({
    type: 'initialize',
    runId: 1,
    configuration: config,
  });
  for (const settings of [
    { ...config, parameters: { ...config.parameters, lambda: 0 } },
    { ...config, sampler: { kind: 'heat-bath' } },
    {
      ...config,
      parameters: {
        ...config.parameters,
        shape: { kind: 'chain', length: 4, periodic: true },
      },
    },
    defaultFieldConfiguration,
  ])
    expect(
      engine.handle({
        type: 'change',
        runId: 1,
        settings: settings as FieldSettings,
      }).type,
    ).toBe('error');
  // A fresh valid initialization has exactly the untouched initial snapshot.
  expect(new FieldRun(1, config).snapshot()).toEqual(
    first.type === 'snapshot' ? first.snapshot : null,
  );
  const next = engine.handle({ type: 'advance', runId: 1, count: 1 });
  const replay = new FieldRun(1, config);
  replay.advance(1);
  expect(next.type === 'snapshot' && next.snapshot).toEqual(replay.snapshot());
  const gaussian = engine.handle({
    type: 'initialize',
    runId: 2,
    configuration: defaultFieldConfiguration,
  });
  expect(gaussian.type === 'snapshot' && gaussian.snapshot.updates).toBe(0);
  const reset = engine.handle({
    type: 'initialize',
    runId: 3,
    configuration: config,
  });
  expect(reset.type === 'snapshot' && reset.snapshot.field).toEqual([0, 0]);
  const g = new FieldRun(1, {
    ...config,
    parameters: { ...config.parameters, lambda: 0, r: 1 },
  }).snapshot();
  expect(g.segments[0]!.reference?.mean).toEqual([0, 0]);
});
