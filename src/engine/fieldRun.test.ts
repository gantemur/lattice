import { expect, it } from 'vitest';
import { FieldEngine, FieldRun } from './fieldRun';
import type { FieldConfiguration } from './fieldRun';
import { createFourierBasis, forwardRealFourier } from '../models/fieldFourier';
import { sampledModePower } from '../observables/fieldSpectrum';

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

it('spectral Step and unequal batches replay with bounded segment measurements', () => {
  const configuration: FieldConfiguration = {
    parameters: { ...local.parameters, measure: 'mean-zero', r: 0, source: 0 },
    sampler: { kind: 'spectral' },
    warmupSweeps: 0,
    strideSweeps: 1,
    seed: 417,
  };
  const batched = new FieldRun(1, configuration);
  const stepped = new FieldRun(1, configuration);
  batched.advance(300);
  for (let i = 0; i < 300; i++) {
    stepped.advance(1);
    stepped.snapshot();
  }
  expect(batched.snapshot()).toEqual(stepped.snapshot());
  const segment = batched.snapshot().segments[0]!;
  expect(segment.reference!.method).toBe('spectral');
  expect(segment.measurements).toBe(300);
  expect(segment.recent).toHaveLength(256);
  expect(segment.discardedMeasurements).toBe(44);
  expect(
    batched.snapshot().field!.reduce((sum, value) => sum + value, 0),
  ).toBeCloseTo(0, 12);
});

it('backend rejects support changes without changing the field or RNG session', () => {
  const run = new FieldRun(1, {
    ...local,
    sampler: { kind: 'direct' },
    warmupSweeps: 0,
    strideSweeps: 1,
  });
  const same = new FieldRun(1, {
    ...local,
    sampler: { kind: 'direct' },
    warmupSweeps: 0,
    strideSweeps: 1,
  });
  run.advance(2);
  same.advance(2);
  expect(() =>
    run.changeSettings({
      ...local,
      parameters: { ...local.parameters, measure: 'mean-zero', r: 0 },
      sampler: { kind: 'spectral' },
      warmupSweeps: 0,
      strideSweeps: 1,
    }),
  ).toThrow(/seeded Reset/);
  run.advance(3);
  same.advance(3);
  expect(run.snapshot()).toEqual(same.snapshot());
  const fresh = new FieldRun(2, {
    ...local,
    parameters: { ...local.parameters, measure: 'mean-zero', r: 0 },
    sampler: { kind: 'spectral' },
    warmupSweeps: 0,
    strideSweeps: 1,
  });
  expect(fresh.snapshot().segments[0]!.measurements).toBe(0);
});

it('full-segment spectral power survives recent-vector eviction', () => {
  const configuration: FieldConfiguration = {
    parameters: { ...local.parameters, measure: 'mean-zero', r: 0, source: 0 },
    sampler: { kind: 'spectral' },
    warmupSweeps: 0,
    strideSweeps: 1,
    seed: 7,
  };
  const run = new FieldRun(1, configuration);
  const basis = createFourierBasis(configuration.parameters.shape);
  let directPower = 0;
  for (let sample = 0; sample < 300; sample++) {
    run.advance(1);
    const transformed = forwardRealFourier(run.snapshot().field!, basis)[1]!;
    directPower += (transformed.re ** 2 + transformed.im ** 2) / basis.size;
  }
  const segment = run.snapshot().segments[0]!;
  expect(segment.discardedMeasurements).toBe(44);
  expect(
    sampledModePower(
      basis,
      1,
      segment.pairProducts,
      segment.sites.map((site) => site.mean!),
      segment.reference!.mean,
    ),
  ).toBeCloseTo(directPower / 300, 10);
});
