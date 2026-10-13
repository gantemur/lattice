import { expect, it } from 'vitest';
import { createRng } from '../algorithms/rng';
import { hmcPhi4Transition } from '../algorithms/phi4Hmc';
import { phi4Transition } from '../algorithms/phi4FieldSampler';
import { createFieldLattice } from '../domain/fieldLattice';
import {
  FieldRun,
  FieldEngine,
  defaultPhi4Configuration,
  defaultFieldConfiguration,
} from './fieldRun';
import type {
  Phi4HmcSettings,
  FieldSettings,
  Phi4FieldSettings,
} from './fieldRun';

export const spatialHmc: Phi4HmcSettings = {
  model: 'phi4-field',
  parameters: {
    ...defaultPhi4Configuration.parameters,
    shape: { kind: 'chain', length: 4, periodic: true },
  },
  sampler: { kind: 'hmc', stepSize: 0.06, leapfrogSteps: 12 },
  warmupTrajectories: 2,
  strideTrajectories: 3,
};
const configuration = { ...spatialHmc, seed: 12345 };
it('counts whole trajectories and exactly replays Step, unequal batches and seeded Reset', () => {
  const step = new FieldRun(1, configuration),
    batch = new FieldRun(1, configuration),
    reset = new FieldRun(1, configuration);
  for (let i = 0; i < 47; i++) step.advance(1);
  for (const n of [1, 8, 17, 21]) batch.advance(n);
  reset.advance(32);
  reset.advance(15);
  expect(step.snapshot()).toEqual(batch.snapshot());
  expect(reset.snapshot()).toEqual(batch.snapshot());
  const s = step.snapshot().segments[0]!;
  expect(s.updates).toBe(47);
  expect(s.warmupUpdates).toBe(2);
  expect(s.measurements).toBe(15);
  expect(s.recent.map((r) => r.update)).toEqual(
    Array.from({ length: 15 }, (_, i) => 5 + 3 * i),
  );
  expect(s.hmc?.gradientEvaluations).toBe(47 * 13);
  expect(s.hmc?.leapfrogSteps).toBe(47 * 12);
  expect(s.accepted + s.rejected).toBe(47);
  expect(s.reference).toBeNull();
  const rng = createRng(configuration.seed),
    lattice = createFieldLattice(spatialHmc.parameters.shape);
  let field = Array<number>(4).fill(0);
  for (let i = 0; i < 47; i++)
    field = hmcPhi4Transition(
      lattice,
      spatialHmc.parameters,
      field,
      spatialHmc.sampler,
      rng,
    ).field;
  expect(step.snapshot().field).toEqual(field);
});
it('preserves the exact stream through changed physics, integrator, cadence and local/HMC/local segments', () => {
  const local = {
    ...defaultPhi4Configuration,
    parameters: spatialHmc.parameters,
    warmupSweeps: 0,
  };
  const run = new FieldRun(1, local),
    rng = createRng(local.seed),
    lattice = createFieldLattice(local.parameters.shape);
  let field = Array<number>(4).fill(0);
  const settings: Phi4FieldSettings[] = [
    local,
    spatialHmc,
    { ...spatialHmc, parameters: { ...spatialHmc.parameters, source: 0.2 } },
    {
      ...spatialHmc,
      sampler: { ...spatialHmc.sampler, stepSize: 0.04, leapfrogSteps: 8 },
      warmupTrajectories: 1,
      strideTrajectories: 2,
    },
    local,
  ];
  for (const [index, s] of settings.entries()) {
    if (index) {
      const old = run.snapshot();
      run.changeSettings(s);
      expect(run.snapshot().field).toEqual(old.field);
      expect(run.snapshot().segments.slice(0, -1)).toEqual(old.segments);
      expect(run.snapshot().segments.at(-1)!.measurements).toBe(0);
    }
    run.advance(9);
    for (let i = 0; i < 9; i++)
      field =
        s.sampler.kind === 'hmc'
          ? hmcPhi4Transition(lattice, s.parameters, field, s.sampler, rng)
              .field
          : phi4Transition(lattice, s.parameters, field, 1, rng).field;
    expect(run.snapshot().field).toEqual(field);
  }
  const rows = run.snapshot().segments;
  expect(rows.map((s) => s.startUpdate)).toEqual([0, 9, 18, 27, 36]);
  expect(rows.map((s) => s.measurements)).toEqual([2, 2, 2, 4, 2]);
  expect(rows.map((s) => !!s.hmc)).toEqual([false, true, true, true, false]);
});
it('keeps full moments and HMC diagnostics after bounded record eviction, including warm-up', () => {
  const run = new FieldRun(1, {
    ...configuration,
    warmupTrajectories: 2,
    strideTrajectories: 1,
  });
  const fields: number[][] = [],
    delta: number[] = [];
  let work = 0,
    steps = 0;
  for (let i = 0; i < 302; i++) {
    run.advance(1);
    const snap = run.snapshot(),
      trace = snap.lastTrace!;
    expect(trace.kind).toBe('hmc');
    if (trace.kind !== 'hmc') throw Error('Unexpected trace');
    if (i >= 2) fields.push(snap.field!);
    if (trace.deltaH !== null) delta.push(trace.deltaH);
    work += trace.gradientEvaluations;
    steps += trace.completedLeapfrogSteps;
  }
  const s = run.snapshot().segments[0]!,
    mean = (a: number[]) => a.reduce((sum, v) => sum + v, 0) / a.length;
  expect(s.recent).toHaveLength(256);
  expect(s.hmc?.recent).toHaveLength(256);
  expect(s.discardedMeasurements).toBe(44);
  expect(s.measurements).toBe(300);
  expect(s.averageFourthMoment).toBeCloseTo(
    mean(fields.map((f) => mean(f) ** 4)),
    12,
  );
  expect(s.average.secondMoment).toBeCloseTo(
    mean(fields.map((f) => mean(f) ** 2)),
    12,
  );
  expect(s.pairProducts[0]![1]).toBeCloseTo(
    mean(fields.map((f) => f[0]! * f[1]!)),
    12,
  );
  expect(s.hmc?.meanDeltaH).toBeCloseTo(mean(delta), 14);
  expect(s.hmc?.rmsDeltaH).toBeCloseTo(
    Math.sqrt(mean(delta.map((v) => v * v))),
    14,
  );
  expect(s.hmc?.maxAbsDeltaH).toBe(Math.max(...delta.map(Math.abs)));
  expect(s.hmc?.finiteDeltaCount).toBe(delta.length);
  expect(s.hmc?.gradientEvaluations).toBe(work);
  expect(s.hmc?.leapfrogSteps).toBe(steps);
  for (let i = 0; i < 9; i++)
    run.changeSettings({
      ...spatialHmc,
      parameters: { ...spatialHmc.parameters, source: (i + 1) / 10 },
    });
  expect(run.snapshot().segments).toHaveLength(8);
  expect(run.snapshot().droppedSegments).toBe(2);
});
it('retains rejected trajectories as repeated eligible measurements', () => {
  const run = new FieldRun(1, {
    ...configuration,
    parameters: { ...spatialHmc.parameters, r: 20, lambda: 4, kappaX: 10 },
    sampler: { kind: 'hmc', stepSize: 0.25, leapfrogSteps: 32 },
    warmupTrajectories: 0,
    strideTrajectories: 1,
  });
  const old = run.snapshot().field;
  run.advance(1);
  const snap = run.snapshot();
  expect(snap.lastTrace?.kind).toBe('hmc');
  if (snap.lastTrace?.kind !== 'hmc') return;
  expect(snap.lastTrace.accepted).toBe(false);
  expect(snap.field).toEqual(old);
  expect(snap.segments[0]!.recent[0]!.field).toEqual(old);
  expect(snap.segments[0]!.measurements).toBe(1);
});
it('rejects invalid cadence and oversized requests atomically; geometry and family need seeded initialization', () => {
  const engine = new FieldEngine();
  engine.handle({ type: 'initialize', runId: 1, configuration });
  for (const settings of [
    { ...spatialHmc, warmupSweeps: 1 },
    { ...spatialHmc, strideTrajectories: 0 },
    { ...spatialHmc, warmupTrajectories: 1001 },
    {
      ...spatialHmc,
      sampler: { kind: 'hmc', stepSize: 0.3, leapfrogSteps: 12 },
    },
    {
      ...spatialHmc,
      sampler: { kind: 'hmc', stepSize: 0.1, leapfrogSteps: 33 },
    },
    { ...spatialHmc, parameters: { ...spatialHmc.parameters, lambda: 0 } },
    {
      ...spatialHmc,
      parameters: {
        ...spatialHmc.parameters,
        shape: { kind: 'chain', length: 8, periodic: true },
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
  for (const count of [0, 33, 1024, 1.5])
    expect(engine.handle({ type: 'advance', runId: 1, count }).type).toBe(
      'error',
    );
  const next = engine.handle({ type: 'advance', runId: 1, count: 1 }),
    reference = new FieldRun(1, configuration);
  reference.advance(1);
  expect(next.type === 'snapshot' && next.snapshot).toEqual(
    reference.snapshot(),
  );
  const gaussian = new FieldRun(1, {
    ...configuration,
    parameters: { ...spatialHmc.parameters, r: 1, lambda: 0 },
  });
  expect(gaussian.snapshot().segments[0]!.reference?.method).toBe('dense');
  const reset = engine.handle({ type: 'initialize', runId: 2, configuration });
  expect(reset.type === 'snapshot' && reset.snapshot.field).toEqual([
    0, 0, 0, 0,
  ]);
  const family = engine.handle({
    type: 'initialize',
    runId: 3,
    configuration: defaultFieldConfiguration,
  });
  expect(family.type === 'snapshot' && family.snapshot.updates).toBe(0);
});
