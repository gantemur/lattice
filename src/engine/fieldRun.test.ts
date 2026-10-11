import { expect, it } from 'vitest';
import { FieldEngine, FieldRun } from './fieldRun';
import type { FieldConfiguration } from './fieldRun';

const local: FieldConfiguration = {
  parameters: {
    shape: { kind: 'chain', length: 2, periodic: true },
    r: 2,
    kappaX: 3,
    kappaY: 0,
    source: 0,
  },
  sampler: { kind: 'metropolis', width: 1 },
  warmupSweeps: 1,
  strideSweeps: 2,
  seed: 417,
};

it('Step and unequal batch sizes replay the identical numerical sequence', () => {
  const batched = new FieldRun(1, local);
  const stepped = new FieldRun(1, local);
  batched.advance(12);
  for (let i = 0; i < 12; i++) {
    stepped.advance(1);
    stepped.snapshot(); // display polling must not consume randomness
  }
  expect(batched.snapshot()).toEqual(stepped.snapshot());
});

it('warm-up and complete-sweep stride isolate measurements from initial state', () => {
  const run = new FieldRun(1, local);
  expect(run.snapshot().segments[0]!.measurements).toBe(0);
  run.advance(10);
  const segment = run.snapshot().segments[0]!;
  expect(segment.warmupUpdates).toBe(2);
  expect(segment.measurements).toBe(2); // updates 6 and 10
  expect(segment.recent.map((record) => record.update)).toEqual([6, 10]);
  expect(segment.sites.map((moments) => moments.count)).toEqual([2, 2]);
});

it('parameter changes preserve state/RNG but begin fresh segment measurements', () => {
  const first = new FieldRun(1, local);
  const second = new FieldRun(1, local);
  first.advance(10);
  second.advance(4);
  second.advance(6);
  const previous = first.snapshot();
  const settings = { ...local, parameters: { ...local.parameters, source: 1 } };
  first.changeSettings(settings);
  second.changeSettings(settings);
  const switched = first.snapshot();
  expect(switched.field).toEqual(previous.field);
  expect(switched.segments[0]!.measurements).toBe(2);
  expect(switched.segments[1]!.measurements).toBe(0);
  first.advance(10);
  second.advance(10);
  expect(first.snapshot()).toEqual(second.snapshot());
  expect(first.snapshot().segments[0]!.sites).toEqual(
    previous.segments[0]!.sites,
  );
  expect(first.snapshot().segments[1]!.measurements).toBe(2);
});

it('direct observations are independent whole-field draws with no warm-up or local sweep', () => {
  const run = new FieldRun(1, {
    ...local,
    sampler: { kind: 'direct' },
    warmupSweeps: 0,
    strideSweeps: 1,
  });
  expect(run.snapshot().field).toBeNull();
  run.advance(3);
  expect(run.snapshot().segments[0]).toMatchObject({
    measurements: 3,
    warmupUpdates: 0,
    accepted: 0,
    rejected: 0,
  });
  expect(run.snapshot().lastTrace?.accepted).toBeNull();
});

it('bounded recent vectors do not truncate full-segment moments', () => {
  const run = new FieldRun(1, {
    ...local,
    sampler: { kind: 'direct' },
    warmupSweeps: 0,
    strideSweeps: 1,
  });
  run.advance(300);
  const segment = run.snapshot().segments[0]!;
  expect(segment.measurements).toBe(300);
  expect(segment.sites[0]!.count).toBe(300);
  expect(segment.recent).toHaveLength(256);
  expect(segment.discardedMeasurements).toBe(44);
  expect(segment.recent[0]!.update).toBe(45);
});

it('rejects bad settings and stale worker commands without mutating the active run', () => {
  expect(
    () =>
      new FieldRun(1, { ...local, parameters: { ...local.parameters, r: 0 } }),
  ).toThrow();
  const engine = new FieldEngine();
  expect(
    engine.handle({ type: 'initialize', runId: 1, configuration: local }).type,
  ).toBe('snapshot');
  const stale = engine.handle({ type: 'advance', runId: 2, count: 1 });
  expect(stale.type).toBe('error');
  const current = engine.handle({ type: 'advance', runId: 1, count: 1 });
  if (current.type !== 'snapshot') throw new Error('Expected snapshot.');
  expect(current.snapshot.updates).toBe(1);
});
