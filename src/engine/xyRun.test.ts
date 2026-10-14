import { expect, it, vi } from 'vitest';
import * as samplerModule from '../algorithms/xySampler';
import { XYRun, XYEngine, defaultSmallXY, defaultLatticeXY } from './xyRun';
import { xyGraph } from '../domain/xyDomain';
import { createRng } from '../algorithms/rng';
import { xyTransition } from '../algorithms/xySampler';
import { xyModel, wrapXY, xyObservables } from '../models/xy';
for (const sampler of ['metropolis', 'heat-bath'] as const)
  it(`${sampler}: initialization, unequal batches, reset, sweep cadence and full-segment aggregates`, () => {
    const c = {
      ...defaultSmallXY,
      parameters: { h: 0, geometry: xyGraph('torus') },
      sampler,
      initialization: 'random' as const,
      warmup: 2,
      stride: 3,
    };
    const run = new XYRun(c),
      other = new XYRun(c),
      initial = run.snapshot();
    expect(initial.draws).toBe(4);
    expect(initial.segments[0]!.samples).toBe(0);
    const rng = createRng(c.seed),
      angles = Float64Array.from(
        { length: 4 },
        () => 2 * Math.PI * rng.uniform() - Math.PI,
      ),
      model = xyModel(c.parameters);
    expect(initial.angles).toEqual(angles);
    let sum = 0,
      measurements = 0,
      draws = 4;
    for (let i = 1; i <= 4000; i++) {
      const trace = xyTransition(model, angles, sampler, c.width, rng);
      draws += trace.draws;
      run.advance(1);
      if (i > 8 && (i - 8) % 12 === 0) {
        sum += xyObservables(model, angles).action!;
        measurements++;
      }
    }
    for (const n of [17, 2, 2048, 1933]) other.advance(n);
    const s = run.snapshot(),
      t = other.snapshot();
    expect({ ...s, version: 0 }).toEqual({ ...t, version: 0 });
    expect(s.angles).toEqual(angles);
    expect(s.draws).toBe(draws);
    const seg = s.segments[0]!;
    expect(seg.samples).toBe(measurements);
    expect(seg.warmupUpdates).toBe(8);
    expect(seg.moments.action!.mean).toBeCloseTo(sum / measurements, 12);
    expect(seg.history).toHaveLength(256);
    expect(seg.bonds.every((b) => b.count === measurements)).toBe(true);
    expect(seg.vortex!.coverage + seg.vortex!.omitted).toBe(measurements);
    seg.sites.forEach((s) =>
      expect(s.histogram.reduce((a, b) => a + b, 0)).toBe(measurements),
    );
    const reset = new XYRun(c);
    expect(reset.snapshot()).toEqual(initial);
  });
it('parameter/sampler switches preserve state and RNG, isolate segments and enforce eight-segment bound', () => {
  const c = { ...defaultSmallXY, warmup: 0 },
    run = new XYRun(c),
    reference = new XYRun(c);
  run.advance(100);
  reference.advance(100);
  for (let i = 0; i < 10; i++) {
    const next = {
      ...c,
      sampler: i % 2 ? ('heat-bath' as const) : ('metropolis' as const),
      parameters: { ...c.parameters, h: i / 10 },
    };
    const before = run.snapshot();
    run.change(next);
    reference.change(next);
    expect(run.snapshot().angles).toEqual(before.angles);
    expect(run.snapshot().draws).toBe(before.draws);
    expect(run.snapshot().segments.at(-1)!.samples).toBe(0);
    run.advance(13);
    reference.advance(13);
  }
  expect(run.snapshot()).toEqual(reference.snapshot());
  expect(run.snapshot().segments).toHaveLength(8);
  expect(run.snapshot().droppedSegments).toBe(3);
  const before = run.snapshot();
  for (const bad of [
    { ...c, width: 0 },
    { ...c, parameters: { ...c.parameters, h: 5 } },
    { ...c, parameters: { h: 0, geometry: xyGraph('torus') } },
    { ...c, initialization: 'random' as const },
  ]) {
    expect(() => run.change(bad)).toThrow();
    expect(run.snapshot()).toEqual(before);
  }
});
it('global rotation preserves history/counters/RNG; composition and subsequent coupled stream', () => {
  const c = {
      ...defaultSmallXY,
      parameters: { h: 0, geometry: xyGraph('torus') },
      warmup: 0,
    },
    run = new XYRun(c),
    other = new XYRun(c);
  run.advance(40);
  other.advance(40);
  const before = run.snapshot();
  run.rotate(0.3);
  run.rotate(0.4);
  const after = run.snapshot();
  expect(after.segments).toEqual(before.segments);
  expect(after.draws).toBe(before.draws);
  expect(after.updates).toBe(before.updates);
  expect(after.version).toBe(before.version + 2);
  expect(after.event).toEqual({
    kind: 'global-rotation',
    alpha: 0.4,
    atUpdate: 40,
  });
  expect(after.trace).toBeNull();
  run.advance(100);
  other.advance(100);
  run
    .snapshot()
    .angles.forEach((a, i) =>
      expect(
        Math.abs(wrapXY(a - other.snapshot().angles[i]! - 0.7)),
      ).toBeLessThan(1e-10),
    );
  expect(run.snapshot().draws).toBe(other.snapshot().draws);
  const biased = new XYRun(defaultSmallXY),
    previous = biased.snapshot();
  expect(() => biased.rotate(0.5)).toThrow(/h=0/);
  expect(biased.snapshot()).toEqual(previous);
});
it('large histories have no complete images/pair matrices; vortex and ordinary coverage align', () => {
  const c = {
    ...defaultLatticeXY,
    warmup: 0,
    parameters: {
      h: 0,
      geometry: {
        kind: 'lattice' as const,
        shape: { lx: 8, ly: 8, periodicX: true, periodicY: true },
        kx: 0,
        ky: 0,
      },
    },
  };
  const run = new XYRun(c);
  for (let i = 0; i < 10; i++) run.advance(2048);
  const s = run.snapshot(),
    seg = s.segments[0]!;
  expect(seg.samples).toBe(320);
  expect(seg.history).toHaveLength(256);
  expect(seg.history.every((h) => h.angles === undefined)).toBe(true);
  expect(seg.pairs).toBeNull();
  expect(seg.sites).toHaveLength(0);
  expect(seg.vortex!.coverage).toBe(320);
  expect(seg.vortex!.moments.net.mean).toBe(0);
  expect(seg.spatialX[0]!.moments.mean).toBe(1);
  expect(seg.spatialY[0]!.moments.mean).toBe(1);
});
it('actual command handler rejects stale/invalid requests atomically and handles deterministic fixtures', () => {
  const engine = new XYEngine(),
    c = {
      ...defaultSmallXY,
      initialization: 'vortex' as const,
      parameters: { h: 0, geometry: xyGraph('square') },
    };
  const init = engine.handle({
    type: 'initialize',
    runId: 1,
    configuration: c,
  });
  if (init.type !== 'snapshot') throw Error();
  expect(init.snapshot.draws).toBe(0);
  expect(init.snapshot.vortices.net).toBe(1);
  for (const request of [
    { type: 'advance' as const, count: 2049 },
    { type: 'global-rotation' as const, alpha: NaN },
    { type: 'change' as const, settings: { ...c, width: 0 } },
  ])
    expect(engine.handle({ ...request, runId: 1, version: 0 }).type).toBe(
      'error',
    );
  const rotate = engine.handle({
    type: 'global-rotation',
    alpha: 0.2,
    runId: 1,
    version: 0,
  });
  expect(rotate.type).toBe('snapshot');
  expect(
    engine.handle({ type: 'advance', count: 1, runId: 1, version: 0 }).type,
  ).toBe('error');
  expect(
    engine.handle({ type: 'initialize', runId: 1, configuration: c }).type,
  ).toBe('error');
  const next = engine.handle({
    type: 'initialize',
    runId: 2,
    configuration: { ...c, initialization: 'antivortex' },
  });
  if (next.type !== 'snapshot') throw Error();
  expect(next.snapshot.vortices.net).toBe(-1);
});

it('a scheduled rejected Metropolis state still enters ordinary measurements', () => {
  const run = new XYRun({
    ...defaultSmallXY,
    sampler: 'metropolis',
    warmup: 0,
    width: Math.PI,
    parameters: { h: 4, geometry: xyGraph('site') },
  });
  let found = false;
  for (let i = 0; i < 100; i++) {
    const before = run.snapshot();
    run.advance(1);
    const after = run.snapshot();
    if (after.trace!.outcome === 'rejected') {
      expect(after.angles).toEqual(before.angles);
      expect(after.segments[0]!.samples).toBe(i + 1);
      expect(after.segments[0]!.history.at(-1)!.values.action).toBeCloseTo(
        -4 * Math.cos(before.angles[0]!),
        13,
      );
      found = true;
      break;
    }
  }
  expect(found).toBe(true);
});
it('ambiguous vortex measurement is omitted separately, never replaced by zero', () => {
  // Controlled adversarial image tests aggregation, independently of how rarely
  // a continuous random draw lands inside the antipodal ambiguity tolerance.
  const original = samplerModule.xyTransition;
  const stub = vi
    .spyOn(samplerModule, 'xyTransition')
    .mockImplementation((...args) => {
      const trace = original(...args);
      args[1].set([0, -Math.PI, 0.3, 0.4]);
      return trace;
    });
  try {
    const run = new XYRun({
      ...defaultSmallXY,
      warmup: 0,
      parameters: { h: 0, geometry: xyGraph('torus') },
    });
    run.advance(4);
    const segment = run.snapshot().segments[0]!;
    expect(segment.samples).toBe(1);
    expect(segment.moments.action!.count).toBe(1);
    expect(segment.vortex!.coverage).toBe(0);
    expect(segment.vortex!.omitted).toBe(1);
    expect(segment.vortex!.moments.density.count).toBe(0);
    expect(segment.history[0]!.values['vortex-density']).toBeUndefined();
  } finally {
    stub.mockRestore();
  }
});
