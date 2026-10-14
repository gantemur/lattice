import { expect, it } from 'vitest';
import { U1GaugeEngine, U1GaugeRun, defaultU1 } from './u1GaugeRun';
import type { U1Response } from './u1GaugeRun';
import { createRng } from '../algorithms/rng';
import { metropolisU1 } from '../algorithms/u1GaugeSampler';
import {
  circularDifference,
  u1GaugeModel,
  u1GaugeTransform,
  u1Observables,
} from '../models/u1Gauge';
import { u1Reference } from '../models/u1GaugeReference';
const config = {
  ...defaultU1,
  geometry: 'torus' as const,
  warmup: 2,
  stride: 3,
};
const reply = (r: U1Response) => {
  if (r.type === 'error') throw new Error(r.message);
  return r.snapshot;
};
const numerical = (r: U1GaugeRun) => {
  const { version, ...s } = r.snapshot();
  void version;
  return s;
};
it('Step/unequal batches/Reset and pure references preserve exact seeded state', () => {
  const a = new U1GaugeRun(config),
    b = new U1GaugeRun(config),
    c = new U1GaugeRun(config);
  for (let i = 0; i < 301; i++) {
    a.advance(1);
    if (i % 30 === 0) u1Reference('torus', config.K);
  }
  for (const n of [3, 70, 1, 127, 100]) b.advance(n);
  c.advance(301);
  expect(numerical(a)).toEqual(numerical(b));
  expect(numerical(c)).toEqual(numerical(b));
  expect(a.snapshot().draws).toBe(903);
});
it('measurement cadence includes scheduled rejections and excludes unmeasured start/warm-up', () => {
  const run = new U1GaugeRun({ ...config, K: 4 });
  expect(run.snapshot().segments[0]!.samples).toBe(0);
  run.advance(39);
  expect(run.snapshot().segments[0]!.samples).toBe(0);
  run.advance(1);
  expect(run.snapshot().segments[0]!.history[0]!.update).toBe(40);
  let scheduledRejections = 0;
  for (let i = 0; i < 400; i++) {
    run.advance(1);
    const s = run.snapshot();
    if (
      s.segments[0]!.history.at(-1)!.update === s.updates &&
      s.event!.kind === 'rejected'
    )
      scheduledRejections++;
  }
  expect(scheduledRejections).toBeGreaterThan(0);
  expect(run.snapshot().segments[0]!.samples).toBe(Math.floor((440 - 16) / 24));
});
it('full moments, histograms and ring share all scheduled samples, surviving eviction', () => {
  const settings = { ...config, warmup: 0, stride: 1 },
    run = new U1GaugeRun(settings);
  const rng = createRng(settings.seed),
    m = u1GaugeModel('torus', settings.K);
  let angles = Array<number>(8).fill(0);
  const sums: Record<string, number> = {};
  for (let i = 1; i <= 3200; i++) {
    angles = metropolisU1(m, angles, settings.width, rng).angles;
    if (i % 8 === 0)
      for (const [id, x] of Object.entries(u1Observables(m, angles)))
        sums[id] = (sums[id] ?? 0) + x;
  }
  run.advance(3200);
  const s = run.snapshot().segments[0]!;
  expect(s.samples).toBe(400);
  expect(s.history).toHaveLength(256);
  expect(s.history[0]!.update).toBe(145 * 8);
  for (const [id, sum] of Object.entries(sums)) {
    expect(s.moments[id]!.count).toBe(400);
    expect(s.moments[id]!.mean).toBeCloseTo(sum / 400, 12);
  }
  for (const bins of Object.values(s.histograms))
    expect(bins.reduce((a, b) => a + b, 0)).toBe(400);
  expect(s.history.at(-1)!.angles).toEqual(angles);
  expect(run.snapshot().angles).toEqual(angles);
});
it('settings isolate segments while keeping angles, RNG and previous aggregates', () => {
  const run = new U1GaugeRun(config);
  run.advance(80);
  const before = run.snapshot();
  run.change({ ...config, K: -0.7, width: 1.1, warmup: 0, stride: 2 });
  const changed = run.snapshot();
  expect(changed.angles).toEqual(before.angles);
  expect(changed.draws).toBe(before.draws);
  expect(changed.segments[0]).toEqual(before.segments[0]);
  expect(changed.segments[1]!.samples).toBe(0);
  const rng = createRng(config.seed);
  for (let i = 0; i < before.draws; i++) rng.uniform();
  const next = metropolisU1(
    u1GaugeModel('torus', -0.7),
    before.angles,
    1.1,
    rng,
  );
  run.advance(1);
  expect(run.snapshot().angles).toEqual(next.angles);
  run.change({
    ...changed.configuration,
    seed: 99,
  } as typeof changed.configuration);
  expect(run.snapshot().segments).toHaveLength(2);
  expect(run.snapshot().configuration.seed).toBe(config.seed);
  for (let i = 0; i < 10; i++) run.change({ ...config, K: i / 10 });
  expect(run.snapshot().segments).toHaveLength(8);
  const stable = run.snapshot();
  expect(() => run.change({ ...config, geometry: 'square' })).toThrow();
  expect(run.snapshot()).toEqual(stable);
});
it('deterministic transformation preserves counts and summaries; coupled chains remain gauge-related', () => {
  const a = new U1GaugeRun(config),
    b = new U1GaugeRun(config);
  a.advance(80);
  b.advance(80);
  const before = b.snapshot();
  b.transform('v0', 1.23);
  const after = b.snapshot();
  expect(after.version).toBe(before.version + 1);
  expect(after.event).toEqual({
    kind: 'gauge-transform',
    vertex: 'v0',
    alpha: 1.23,
  });
  for (const key of ['segments', 'updates', 'draws', 'configuration'] as const)
    expect(after[key]).toEqual(before[key]);
  const m = u1GaugeModel('torus', config.K);
  for (let i = 0; i < 300; i++) {
    a.advance(1);
    b.advance(1);
    const x = a.snapshot(),
      y = b.snapshot();
    const transformed = u1GaugeTransform(m, x.angles, { v0: 1.23 });
    transformed.forEach((angle, e) =>
      expect(circularDifference(y.angles[e]!, angle)).toBeCloseTo(0, 11),
    );
    expect(y.event!.kind).toBe(x.event!.kind);
    expect(y.draws).toBe(x.draws);
    const xv = u1Observables(m, x.angles),
      yv = u1Observables(m, y.angles);
    for (const id of Object.keys(xv)) expect(yv[id]).toBeCloseTo(xv[id]!, 11);
  }
});
it('actual worker boundary rejects stale, oversized and invalid commands atomically', () => {
  const engine = new U1GaugeEngine();
  let s = reply(
    engine.handle({ type: 'initialize', runId: 1, configuration: config }),
  );
  s = reply(
    engine.handle({ type: 'advance', runId: 1, version: s.version, count: 10 }),
  );
  for (const command of [
    { type: 'gauge-transform' as const, vertex: 'v0', alpha: 1, version: -1 },
    { type: 'gauge-transform' as const, vertex: 'missing', alpha: 1 },
    { type: 'gauge-transform' as const, vertex: 'v0', alpha: NaN },
    { type: 'gauge-transform' as const, vertex: 'v0', alpha: 4 },
    { type: 'advance' as const, count: 10001 },
    { type: 'advance' as const, count: 0 },
    { type: 'change' as const, settings: { ...config, width: -1 } },
    { type: 'change' as const, settings: { ...config, K: 5 } },
  ])
    expect(
      engine.handle({ runId: 1, version: s.version, ...command }).type,
    ).toBe('error');
  const next = reply(
    engine.handle({ type: 'advance', runId: 1, version: s.version, count: 1 }),
  );
  const control = new U1GaugeRun(config);
  control.advance(10);
  control.advance(1);
  expect(next).toEqual(control.snapshot());
  const reset = reply(
    engine.handle({ type: 'initialize', runId: 2, configuration: defaultU1 }),
  );
  expect(reset.angles).toEqual([0, 0, 0, 0]);
  expect(reset.draws).toBe(0);
  expect(
    engine.handle({ type: 'initialize', runId: 1, configuration: config }).type,
  ).toBe('error');
});
