import { expect, it } from 'vitest';
import { PottsRun, PottsEngine, defaultSmallPotts } from './pottsRun';
import type { PottsConfiguration } from './pottsRun';
import { pottsGraph } from '../domain/pottsDomain';
const sw: PottsConfiguration = {
  parameters: { q: 3, h: 0, geometry: pottsGraph('torus', 0.7) },
  sampler: 'sw',
  warmupTrajectories: 7,
  strideTrajectories: 3,
  seed: 12345,
};
function advance(run: PottsRun, n: number, batch = 32) {
  while (n) {
    const count = Math.min(n, batch);
    run.advance(count);
    n -= count;
  }
}
it('SW cadence, unequal batches, Reset and unchanged retained states', () => {
  const a = new PottsRun(sw),
    b = new PottsRun(sw);
  advance(a, 901);
  advance(b, 901, 7);
  const strip = (run: PottsRun) => {
    const { version, ...rest } = run.snapshot();
    void version;
    return rest;
  };
  expect(strip(a)).toEqual(strip(b));
  const s = a.snapshot(),
    segment = s.segments[0]!;
  expect(segment.samples).toBe(298);
  expect(segment.warmupUpdates).toBe(7);
  expect(segment.history).toHaveLength(256);
  expect(segment.fk!.moments.clusters.count).toBe(298);
  expect(segment.fk!.work.uniforms).toBe(s.draws);
  expect(segment.fk!.clusterCounts.reduce((a, b) => a + b, 0)).toBe(298);
  expect(segment.moments.m0!.count).toBe(298);
  const reset = new PottsRun(sw);
  advance(reset, 901);
  expect(reset.snapshot()).toEqual(s);
  const site = new PottsRun({
    ...sw,
    parameters: { q: 2, h: 0, geometry: pottsGraph('site') },
    warmupTrajectories: 0,
    strideTrajectories: 1,
  });
  advance(site, 40);
  expect(site.snapshot().segments[0]!.samples).toBe(40);
});
it('fixed-support sampler/cadence/physics switches preserve RNG, isolate measurements and clear auxiliary image', () => {
  const a = new PottsRun({
    ...defaultSmallPotts,
    sampler: 'metropolis',
    warmup: 0,
  });
  a.advance(10);
  const old = a.snapshot();
  a.change({ ...sw, parameters: defaultSmallPotts.parameters });
  expect(a.snapshot().colors).toEqual(old.colors);
  expect(a.snapshot().draws).toBe(old.draws);
  a.advance(10);
  expect(a.snapshot().cluster).toBeDefined();
  a.change({ ...defaultSmallPotts, sampler: 'fk-direct' });
  expect(a.snapshot().cluster).toBeUndefined();
  a.advance(4);
  expect(a.snapshot().segments.at(-1)!.samples).toBe(4);
  a.change({ ...defaultSmallPotts, sampler: 'heat-bath' });
  expect(a.snapshot().cluster).toBeUndefined();
  expect(a.snapshot().segments.at(-1)!.fk).toBeUndefined();
  a.advance(3);
  expect(a.snapshot().trace!.uniforms).toHaveLength(2);
  expect(a.snapshot().segments[0]).toEqual(old.segments[0]);
  for (let i = 0; i < 10; i++)
    a.change({
      ...defaultSmallPotts,
      parameters: { ...defaultSmallPotts.parameters, h: i / 10 },
    });
  expect(a.snapshot().segments).toHaveLength(8);
  expect(a.snapshot().droppedSegments).toBeGreaterThan(0);
});
it('actual versioned worker rejects unsupported settings atomically and stale commands cannot sample', () => {
  const engine = new PottsEngine();
  let reply = engine.handle({
    type: 'initialize',
    runId: 1,
    configuration: sw,
  });
  expect(reply.type).toBe('snapshot');
  if (reply.type !== 'snapshot') throw Error();
  const before = reply.snapshot;
  for (const parameters of [
    { ...sw.parameters, h: 1 },
    { ...sw.parameters, geometry: pottsGraph('torus', -1) },
  ])
    expect(
      engine.handle({
        type: 'change',
        runId: 1,
        version: 0,
        settings: { ...sw, parameters },
      }).type,
    ).toBe('error');
  expect(
    engine.handle({ type: 'advance', runId: 1, version: 0, count: 33 }).type,
  ).toBe('error');
  reply = engine.handle({ type: 'advance', runId: 1, version: 0, count: 1 });
  if (reply.type !== 'snapshot') throw Error();
  const independent = new PottsRun(sw);
  independent.advance(1);
  expect(reply.snapshot).toEqual(independent.snapshot());
  expect(before.draws).toBe(0);
  expect(
    engine.handle({ type: 'advance', runId: 1, version: 0, count: 1 }).type,
  ).toBe('error');
  const reset = engine.handle({
    type: 'initialize',
    runId: 2,
    configuration: sw,
  });
  if (reset.type !== 'snapshot') throw Error();
  expect(reset.snapshot.draws).toBe(0);
  expect(
    engine.handle({ type: 'advance', runId: 1, version: 1, count: 1 }).type,
  ).toBe('error');
});
it('large FK histories retain scalars, full counts and only one auxiliary image', () => {
  const run = new PottsRun({
    ...sw,
    parameters: {
      q: 3,
      h: 0,
      geometry: {
        kind: 'lattice',
        shape: { lx: 8, ly: 8, periodicX: true, periodicY: true },
        kx: 0.7,
        ky: 0.7,
      },
    },
    warmupTrajectories: 0,
    strideTrajectories: 1,
  });
  advance(run, 280);
  const s = run.snapshot(),
    segment = s.segments[0]!;
  expect(segment.history).toHaveLength(256);
  expect(segment.samples).toBe(280);
  expect(segment.history.every((h) => !h.colors && !('flags' in h))).toBe(true);
  expect(segment.fk!.pairCounts).toBeNull();
  expect(segment.fk!.bondCounts).toHaveLength(128);
  expect(s.cluster!.flags).toHaveLength(128);
});

import { pottsClusterTransition } from '../algorithms/pottsClusterSampler';
import { createRng } from '../algorithms/rng';
import { pottsModel } from '../models/potts';
import { bfsComponents } from '../test/fkOracle';
it('spin and FK full aggregates come from precisely the same scheduled transitions', () => {
  const run = new PottsRun(sw),
    model = pottsModel(sw.parameters),
    colors = new Uint8Array(model.size),
    rng = createRng(sw.seed);
  let samples = 0,
    action = 0,
    clusters = 0,
    occupied = 0;
  const bonds = model.bonds.map(() => 0),
    occupancy = Array.from({ length: model.size }, () =>
      Array<number>(model.q).fill(0),
    );
  for (let update = 1; update <= 1000; update++) {
    const trace = pottsClusterTransition(model, 'sw', colors, rng);
    if (update <= 7 || (update - 7) % 3 !== 0) continue;
    samples++;
    clusters += bfsComponents(model, trace.flags).count;
    occupied += Array.from(trace.flags).reduce((a, b) => a + b, 0);
    model.bonds.forEach((b, e) => {
      bonds[e]! += trace.flags[e]!;
      action -= b.K * Number(colors[b.tail] === colors[b.head]);
    });
    colors.forEach((c, i) => {
      occupancy[i]![c]!++;
    });
  }
  advance(run, 1000);
  const segment = run.snapshot().segments[0]!;
  expect(segment.samples).toBe(samples);
  expect(segment.occupancy).toEqual(occupancy);
  expect(segment.fk!.bondCounts).toEqual(bonds);
  expect(segment.moments.action!.mean).toBeCloseTo(action / samples, 12);
  expect(segment.fk!.moments.clusters.mean).toBeCloseTo(clusters / samples, 12);
  expect(segment.fk!.moments.occupied.mean).toBeCloseTo(occupied / samples, 12);
  expect(run.snapshot().colors).toEqual(colors);
});
it('unchanged whole configurations are retained and fixed-support FK-direct ↔ SW never reseeds', () => {
  const c: PottsConfiguration = {
    ...sw,
    parameters: { q: 2, h: 0, geometry: pottsGraph('site') },
    warmupTrajectories: 0,
    strideTrajectories: 1,
  };
  const run = new PottsRun(c);
  let unchanged = 0;
  for (let n = 1; n <= 40; n++) {
    run.advance(1);
    const s = run.snapshot();
    if (s.cluster!.changedSites === 0) unchanged++;
    expect(s.segments[0]!.samples).toBe(n);
  }
  expect(unchanged).toBeGreaterThan(0);
  for (const settings of [
    {
      parameters: c.parameters,
      sampler: 'fk-direct' as const,
      warmup: 100,
      stride: 100,
    },
    c,
  ]) {
    const before = run.snapshot();
    run.change(settings);
    const after = run.snapshot();
    expect(after.colors).toEqual(before.colors);
    expect(after.draws).toBe(before.draws);
    expect(after.cluster).toBeUndefined();
    run.advance(1);
    expect(run.snapshot().segments.at(-1)!.samples).toBe(1);
  }
});
it('SW support and cadence validation failures preserve the full seeded session', () => {
  const run = new PottsRun(sw);
  run.advance(3);
  const before = run.snapshot();
  for (const settings of [
    { ...sw, parameters: { ...sw.parameters, q: 4 as const } },
    { ...sw, parameters: { ...sw.parameters, geometry: pottsGraph('dimer') } },
    { ...sw, warmupTrajectories: -1 },
    { ...sw, strideTrajectories: 0 },
  ])
    expect(() => run.change(settings)).toThrow();
  expect(run.snapshot()).toEqual(before);
});
