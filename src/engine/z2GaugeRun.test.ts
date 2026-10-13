import { expect, it } from 'vitest';
import { GaugeEngine, GaugeRun, defaultGauge } from './z2GaugeRun';
import type { GaugeResponse, GaugeSnapshot } from './z2GaugeRun';
import {
  gaugeModel,
  gaugeObservables,
  gaugeTransform,
} from '../models/z2Gauge';
import { createRng } from '../algorithms/rng';
import { metropolisGauge } from '../algorithms/z2GaugeSampler';
const config = {
  ...defaultGauge,
  geometry: 'torus' as const,
  sampler: 'metropolis' as const,
  warmup: 0,
};
function snapshot(reply: GaugeResponse): GaugeSnapshot {
  if (reply.type === 'error') throw new Error(reply.message);
  return reply.snapshot;
}
function numerical(run: GaugeRun) {
  const { version, ...s } = run.snapshot();
  void version;
  return s;
}

it('Step, unequal batches and Reset replay exactly', () => {
  const a = new GaugeRun(config),
    b = new GaugeRun(config);
  for (let i = 0; i < 301; i++) a.advance(1);
  for (const count of [3, 70, 1, 127, 100]) b.advance(count);
  expect(numerical(a)).toEqual(numerical(b));
  const c = new GaugeRun(config);
  c.advance(301);
  expect(numerical(c)).toEqual(numerical(a));
  expect(c.snapshot().draws).toBe(903);
});
it('initialization and direct draws use no fictitious measurements or warm-up', () => {
  const run = new GaugeRun(defaultGauge);
  expect(run.snapshot().draws).toBe(0);
  expect(run.snapshot().segments[0]!.samples).toBe(0);
  run.advance(1);
  expect(run.snapshot().segments[0]!.samples).toBe(1);
  expect(run.snapshot().draws).toBe(1);
});
it('retains scheduled unchanged states after complete warm-up and stride sweeps', () => {
  const run = new GaugeRun({ ...config, K: 4, warmup: 2, stride: 3 });
  run.advance(39);
  expect(run.snapshot().segments[0]!.samples).toBe(0);
  run.advance(1);
  const segment = run.snapshot().segments[0]!;
  expect(segment.samples).toBe(1);
  expect(segment.history.at(-1)!.update).toBe(40);
  expect(segment.accepted + segment.rejected + segment.self).toBe(40);
  // At this fixed seed/high K the all-positive configuration has not escaped.
  expect(segment.history.at(-1)!.links).toEqual(Array(8).fill(1));
});
it('full moments and sign/winding histograms survive bounded eviction', () => {
  const run = new GaugeRun({ ...config, sampler: 'direct' });
  run.advance(1000);
  const s = run.snapshot().segments[0]!;
  expect(s.samples).toBe(1000);
  expect(s.history).toHaveLength(256);
  expect(s.history[0]!.update).toBe(745);
  expect(s.winding.reduce((a, b) => a + b, 0)).toBe(1000);
  Object.entries(s.plus).forEach(([id, n]) =>
    expect(s.moments[id]!.mean).toBeCloseTo((2 * n) / 1000 - 1, 12),
  );
  expect(s.moments.meanPlaquette!.count).toBe(1000);
  expect(s.moments.action!.mean).toBeCloseTo(
    -4 * config.K * s.moments.meanPlaquette!.mean,
    12,
  );
});
it('fixed topology parameter/sampler changes preserve state and exact RNG stream', () => {
  const run = new GaugeRun(config),
    rng = createRng(config.seed);
  let links = Array(8).fill(1) as number[];
  const first = gaugeModel('torus', config.K),
    second = gaugeModel('torus', -0.3);
  for (let i = 0; i < 11; i++) links = metropolisGauge(first, links, rng).links;
  run.advance(11);
  const before = run.snapshot();
  run.change({ ...config, K: -0.3 });
  expect(run.snapshot().links).toEqual(before.links);
  expect(run.snapshot().draws).toBe(before.draws);
  expect(run.snapshot().segments[0]).toEqual(before.segments[0]);
  for (let i = 0; i < 13; i++)
    links = metropolisGauge(second, links, rng).links;
  run.advance(13);
  expect(run.snapshot().links).toEqual(links);
  run.change({ ...config, K: -0.3, sampler: 'direct' });
  const u = rng.uniform();
  void u;
  run.advance(1);
  expect(run.snapshot().draws).toBe(73);
  for (let i = 0; i < 10; i++) run.change({ ...config, K: i / 10 });
  expect(run.snapshot().segments).toHaveLength(8);
  expect(() => run.change({ ...config, geometry: 'square' })).toThrow();
});
it('worker transform preserves summaries/counters, advances version and continues gauge-covariantly', () => {
  const a = new GaugeRun(config),
    b = new GaugeRun(config);
  a.advance(80);
  b.advance(80);
  const before = b.snapshot();
  b.transform('v0');
  const after = b.snapshot();
  expect(after.version).toBe(before.version + 1);
  expect(after.event).toEqual({ kind: 'gauge-transform', vertex: 'v0' });
  for (const key of ['segments', 'updates', 'draws', 'configuration'] as const)
    expect(after[key]).toEqual(before[key]);
  b.transform('v0');
  expect(b.snapshot().links).toEqual(before.links);
  b.transform('v0');
  const model = gaugeModel('torus', config.K);
  for (let i = 0; i < 200; i++) {
    a.advance(1);
    b.advance(1);
    const x = a.snapshot(),
      y = b.snapshot();
    expect(y.links).toEqual(gaugeTransform(model, x.links, ['v0']));
    expect(gaugeObservables(model, y.links)).toEqual(
      gaugeObservables(model, x.links),
    );
    expect(y.draws).toBe(x.draws);
  }
  expect(b.snapshot().segments[0]!.moments).toEqual(
    a.snapshot().segments[0]!.moments,
  );
});
it('actual worker engine rejects stale and invalid commands atomically; initialization reseeds', () => {
  const engine = new GaugeEngine();
  let s = snapshot(
    engine.handle({ type: 'initialize', runId: 1, configuration: config }),
  );
  s = snapshot(
    engine.handle({ type: 'advance', runId: 1, version: s.version, count: 10 }),
  );
  expect(
    engine.handle({
      type: 'gauge-transform',
      runId: 1,
      version: s.version - 1,
      vertex: 'v0',
    }).type,
  ).toBe('error');
  expect(
    engine.handle({
      type: 'gauge-transform',
      runId: 2,
      version: s.version,
      vertex: 'v0',
    }).type,
  ).toBe('error');
  expect(
    engine.handle({
      type: 'gauge-transform',
      runId: 1,
      version: s.version,
      vertex: 'v9',
    }).type,
  ).toBe('error');
  expect(
    engine.handle({
      type: 'change',
      runId: 1,
      version: s.version,
      settings: { ...config, K: 5 },
    }).type,
  ).toBe('error');
  expect(
    engine.handle({ type: 'advance', runId: 1, version: s.version, count: 0 })
      .type,
  ).toBe('error');
  const next = snapshot(
    engine.handle({ type: 'advance', runId: 1, version: s.version, count: 1 }),
  );
  const control = new GaugeRun(config);
  control.advance(10);
  control.advance(1);
  expect(next).toEqual(control.snapshot());
  const reset = snapshot(
    engine.handle({
      type: 'initialize',
      runId: 2,
      configuration: { ...defaultGauge, geometry: 'square' },
    }),
  );
  expect(reset.links).toHaveLength(4);
  expect(reset.updates).toBe(0);
  expect(reset.draws).toBe(0);
  expect(
    engine.handle({ type: 'initialize', runId: 1, configuration: config }).type,
  ).toBe('error');
});

it('unchanged settings with a draft seed do not create a spurious segment', () => {
  const run = new GaugeRun(defaultGauge);
  run.change({ ...defaultGauge, seed: 99 } as typeof defaultGauge);
  expect(run.snapshot().segments).toHaveLength(1);
  expect(run.snapshot().configuration.seed).toBe(defaultGauge.seed);
});
it('bounded transition history distinguishes unretained and measured states', () => {
  const run = new GaugeRun({ ...config, warmup: 2, stride: 3 });
  run.advance(40);
  const history = run.snapshot().segments[0]!.history;
  expect(history).toHaveLength(40);
  expect(history.filter((h) => h.measured).map((h) => h.update)).toEqual([40]);
  expect(
    history.every((h) => ['self', 'accepted', 'rejected'].includes(h.kind)),
  ).toBe(true);
});
