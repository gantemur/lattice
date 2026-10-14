import { expect, it } from 'vitest';
import {
  PottsRun,
  PottsEngine,
  defaultSmallPotts,
  defaultLatticePotts,
} from './pottsRun';
import type {
  PottsConfiguration,
  PottsSnapshot,
  PottsRequest,
} from './pottsRun';
import { pottsGraph } from '../domain/pottsDomain';
import { pottsModel, pottsObservables } from '../models/potts';
import { exactPotts } from '../models/pottsExact';
import { createRng } from '../algorithms/rng';
import { pottsTransition } from '../algorithms/pottsSampler';
function science(s: PottsSnapshot) {
  const { version, ...rest } = s;
  void version;
  return rest;
}
for (const sampler of ['direct', 'metropolis', 'heat-bath'] as const)
  it(`${sampler}: unequal batches, exact draw budget and Reset replay`, () => {
    const config = { ...defaultSmallPotts, sampler, warmup: 2, stride: 3 },
      a = new PottsRun(config),
      b = new PottsRun(config);
    for (let i = 0; i < 97; i++) a.advance(1);
    for (const n of [2, 7, 13, 31, 44]) b.advance(n);
    expect(science(a.snapshot())).toEqual(science(b.snapshot()));
    expect(a.snapshot().draws).toBe(
      97 * (sampler === 'direct' ? 1 : sampler === 'heat-bath' ? 2 : 3),
    );
    expect(a.snapshot().segments[0]!.samples).toBe(
      sampler === 'direct' ? 97 : 15,
    );
    expect(a.snapshot().segments[0]!.warmupUpdates).toBe(
      sampler === 'direct' ? 0 : 4,
    );
    const reset = new PottsRun(config);
    reset.advance(97);
    expect(science(reset.snapshot())).toEqual(science(a.snapshot()));
  });
it('full moments, occupancy, bonds and pair counts share one measured sequence past eviction', () => {
  const config = {
      ...defaultSmallPotts,
      sampler: 'metropolis' as const,
      warmup: 2,
      stride: 2,
    },
    run = new PottsRun(config),
    model = pottsModel(config.parameters),
    rng = createRng(config.seed),
    state = new Uint8Array(2);
  const retained: { colors: Uint8Array; values: Record<string, number> }[] = [];
  for (let i = 1; i <= 1604; i++) {
    pottsTransition(model, 'metropolis', state, rng);
    if (i > 4 && (i - 4) % 4 === 0)
      retained.push({
        colors: state.slice(),
        values: pottsObservables(model, state),
      });
  }
  run.advance(1604);
  const snapshot = run.snapshot(),
    segment = snapshot.segments[0]!;
  expect(segment.samples).toBe(400);
  expect(segment.history).toHaveLength(256);
  expect(segment.history.map((r) => r.colors)).toEqual(
    retained.slice(-256).map((r) => r.colors),
  );
  expect(snapshot.colors).toEqual(state);
  for (const key of Object.keys(segment.moments))
    expect(segment.moments[key]!.mean).toBeCloseTo(
      retained.reduce((s, r) => s + r.values[key]!, 0) / 400,
      12,
    );
  for (let i = 0; i < 2; i++)
    for (let c = 0; c < 3; c++)
      expect(segment.occupancy[i]![c]).toBe(
        retained.filter((r) => r.colors[i] === c).length,
      );
  const equal = retained.filter((r) => r.colors[0] === r.colors[1]).length;
  expect(segment.bondCounts[0]).toBe(equal);
  expect(segment.pairCounts![0]![1]).toBe(equal);
  expect(segment.outcomes.self).toBeGreaterThan(0);
  expect(segment.outcomes.rejected).toBeGreaterThan(0);
});
it('heat-bath unchanged and lazy/rejected configurations remain scheduled measurements', () => {
  for (const sampler of ['metropolis', 'heat-bath'] as const) {
    const config = {
      ...defaultSmallPotts,
      parameters: { q: 2 as const, h: 4, geometry: pottsGraph('site') },
      sampler,
      warmup: 0,
      stride: 1,
    };
    const run = new PottsRun(config);
    run.advance(200);
    const s = run.snapshot().segments[0]!;
    expect(s.samples).toBe(200);
    expect(s.occupancy[0]!.reduce((a, b) => a + b, 0)).toBe(200);
    expect(
      sampler === 'heat-bath'
        ? s.outcomes.unchanged
        : s.outcomes.self + s.outcomes.rejected,
    ).toBeGreaterThan(100);
  }
});
it('parameter and sampler changes preserve colors/RNG, isolate segments, bound eight segments', () => {
  const config = {
      ...defaultSmallPotts,
      sampler: 'metropolis' as const,
      warmup: 0,
      stride: 1,
    },
    run = new PottsRun(config);
  run.advance(37);
  const before = run.snapshot();
  const next = {
    ...config,
    parameters: { ...config.parameters, h: -0.7 },
    sampler: 'heat-bath' as const,
    stride: 2,
  };
  run.change(next);
  const changed = run.snapshot();
  expect(changed.colors).toEqual(before.colors);
  expect(changed.draws).toBe(before.draws);
  expect(changed.updates).toBe(37);
  expect(changed.segments[0]).toEqual(before.segments[0]);
  expect(changed.segments[1]!.samples).toBe(0);
  const rng = createRng(config.seed);
  for (let i = 0; i < 37 * 3; i++) rng.uniform();
  const state = before.colors.slice(),
    model = pottsModel(next.parameters);
  for (let i = 0; i < 43; i++) pottsTransition(model, 'heat-bath', state, rng);
  run.advance(43);
  expect(run.snapshot().colors).toEqual(state);
  for (let i = 0; i < 10; i++)
    run.change({ ...next, parameters: { ...next.parameters, h: i / 10 } });
  expect(run.snapshot().segments).toHaveLength(8);
  expect(run.snapshot().droppedSegments).toBe(4);
});
it('geometry/q require new sessions; display references consume no random numbers', () => {
  const run = new PottsRun(defaultSmallPotts);
  run.advance(11);
  const before = run.snapshot();
  expect(() =>
    run.change({
      ...defaultSmallPotts,
      parameters: { ...defaultSmallPotts.parameters, q: 4 },
    }),
  ).toThrow();
  expect(() =>
    run.change({
      ...defaultSmallPotts,
      parameters: {
        ...defaultSmallPotts.parameters,
        geometry: pottsGraph('triangle'),
      },
    }),
  ).toThrow();
  for (let i = 0; i < 10; i++)
    exactPotts(pottsModel(defaultSmallPotts.parameters));
  expect(run.snapshot()).toEqual(before);
});
it('large rectangles retain scalar history and bounded axial aggregates, no images or pair matrix', () => {
  const config: PottsConfiguration = {
    ...defaultLatticePotts,
    parameters: {
      q: 4,
      h: 0,
      geometry: {
        kind: 'lattice',
        shape: { lx: 8, ly: 8, periodicX: true, periodicY: false },
        kx: 0,
        ky: 0,
      },
    },
    sampler: 'heat-bath',
    warmup: 0,
    stride: 1,
  };
  const run = new PottsRun(config);
  for (let i = 0; i < 5; i++) run.advance(4096);
  const s = run.snapshot().segments[0]!;
  expect(s.samples).toBe(320);
  expect(s.history).toHaveLength(256);
  expect(s.history.every((r) => r.colors === undefined)).toBe(true);
  expect(s.pairCounts).toBeNull();
  expect(s.spatialX).toHaveLength(8);
  expect(s.spatialY).toHaveLength(8);
  expect(s.spatialX[1]!.pairs).toBe(64);
  expect(s.spatialY[1]!.pairs).toBe(56);
  expect(s.spatialX[0]!.moments.mean).toBe(1);
  expect(
    s.occupancy.every((row) => row.reduce((a, b) => a + b, 0) === 320),
  ).toBe(true);
});
it('actual worker protocol rejects stale, invalid and oversized requests atomically', () => {
  const engine = new PottsEngine();
  let reply = engine.handle({
    type: 'initialize',
    runId: 1,
    configuration: defaultSmallPotts,
  });
  expect(reply.type).toBe('snapshot');
  if (reply.type !== 'snapshot') throw new Error();
  const initial = reply.snapshot;
  const invalid: PottsRequest[] = [
    {
      type: 'initialize',
      runId: 2,
      configuration: { ...defaultLatticePotts, sampler: 'direct' },
    },
    {
      type: 'change',
      runId: 1,
      version: 0,
      settings: { ...defaultSmallPotts, sampler: 'invalid' as 'direct' },
    },
    { type: 'advance', runId: 2, version: 0, count: 1 },
    { type: 'advance', runId: 1, version: 1, count: 1 },
    { type: 'advance', runId: 1, version: 0, count: 4097 },
    {
      type: 'change',
      runId: 1,
      version: 0,
      settings: { ...defaultSmallPotts, stride: 0 },
    },
    { type: 'initialize', runId: 1, configuration: defaultSmallPotts },
    {
      type: 'initialize',
      runId: 2,
      configuration: { ...defaultSmallPotts, seed: -1 },
    },
    {
      type: 'change',
      runId: 1,
      version: 0,
      settings: {
        ...defaultSmallPotts,
        parameters: { ...defaultSmallPotts.parameters, q: 4 },
      },
    },
  ];
  for (const request of invalid)
    expect(engine.handle(request).type).toBe('error');
  reply = engine.handle({ type: 'advance', runId: 1, version: 0, count: 1 });
  const expected = new PottsRun(defaultSmallPotts);
  expected.advance(1);
  expect(reply).toEqual({ type: 'snapshot', snapshot: expected.snapshot() });
  expect(initial.updates).toBe(0);
  expect(
    engine.handle({
      type: 'initialize',
      runId: 2,
      configuration: {
        ...defaultSmallPotts,
        parameters: { ...defaultSmallPotts.parameters, q: 4 },
      },
    }).type,
  ).toBe('snapshot');
});
