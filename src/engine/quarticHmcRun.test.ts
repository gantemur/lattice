import { describe, expect, it } from 'vitest';
import { pathCorrelator } from '../observables/oscillatorCorrelator';
import { quarticQuadraticPart } from '../models/quarticOscillator';
import type { QuarticOscillatorParameters } from '../models/quarticOscillator';
import { FieldEngine, FieldRun, defaultQuarticConfiguration } from './fieldRun';
import type { QuarticConfiguration, QuarticFieldSettings } from './fieldRun';

const p: QuarticOscillatorParameters = {
  sites: 4,
  beta: 4,
  r: -2,
  lambda: 1,
  h: 0,
};
function settings(
  parameters = p,
  overrides: Partial<{
    stepSize: number;
    leapfrogSteps: number;
    warmupTrajectories: number;
    strideTrajectories: number;
  }> = {},
): QuarticFieldSettings {
  return {
    model: 'quartic-oscillator',
    quartic: parameters,
    parameters: quarticQuadraticPart(parameters),
    sampler: {
      kind: 'hmc',
      stepSize: overrides.stepSize ?? 0.1,
      leapfrogSteps: overrides.leapfrogSteps ?? 12,
    },
    warmupTrajectories: overrides.warmupTrajectories ?? 0,
    strideTrajectories: overrides.strideTrajectories ?? 1,
  };
}
function config(
  parameters = p,
  overrides: Parameters<typeof settings>[1] = {},
  seed = 12345,
): QuarticConfiguration {
  return { ...settings(parameters, overrides), seed };
}

describe('HMC worker state, segments and cadence', () => {
  it('pins the unchanged M4c1 local Metropolis seeded sequence and summaries', () => {
    const run = new FieldRun(1, {
      ...defaultQuarticConfiguration,
      quartic: p,
      parameters: quarticQuadraticPart(p),
      warmupSweeps: 0,
    });
    run.advance(12);
    const snapshot = run.snapshot();
    expect(snapshot.field).toEqual([
      0.45115561969578266, -0.853259937139228, 0, 0.7611058973707259,
    ]);
    expect(snapshot.action).toBeCloseTo(0.2683401687400177, 12);
    expect(snapshot.segments[0]?.accepted).toBe(9);
    expect(snapshot.segments[0]?.rejected).toBe(3);
    expect(snapshot.segments[0]?.measurements).toBe(3);
    expect(snapshot.segments[0]?.average.mean).toBeCloseTo(
      0.07695637239764135,
      12,
    );
    expect(snapshot.segments[0]?.pairProducts[0]?.[0]).toBeCloseTo(
      0.06879460335128712,
      12,
    );
  });
  it('treats Step and advance as whole trajectories with trajectory warm-up and stride', () => {
    const run = new FieldRun(
      1,
      config(p, {
        warmupTrajectories: 2,
        strideTrajectories: 3,
      }),
    );
    run.advance(2);
    let segment = run.snapshot().segments[0]!;
    expect(segment.warmupUpdates).toBe(2);
    expect(segment.measurements).toBe(0);
    expect(segment.hmc?.gradientEvaluations).toBe(2 * 13);
    run.advance(2);
    expect(run.snapshot().segments[0]?.measurements).toBe(0);
    run.advance(1);
    segment = run.snapshot().segments[0]!;
    expect(segment.measurements).toBe(1);
    expect(segment.recent[0]?.update).toBe(5);
    expect(segment.hmc?.finiteDeltaCount).toBe(5);
    expect(segment.accepted + segment.rejected).toBe(5);
    expect(run.snapshot().lastTrace?.warmup).toBe(false);
    expect(segment.reference).toBeNull();
  });

  it('replays Step, unequal batches and Reset with identical HMC diagnostics', () => {
    const stepped = new FieldRun(1, config());
    const batched = new FieldRun(1, config());
    for (let i = 0; i < 47; i++) stepped.advance(1);
    batched.advance(16);
    batched.advance(11);
    batched.advance(20);
    expect(batched.snapshot()).toEqual(stepped.snapshot());
    const reset = new FieldRun(1, config());
    reset.advance(32);
    reset.advance(15);
    expect(reset.snapshot()).toEqual(stepped.snapshot());
    const trace = stepped.snapshot().lastTrace;
    expect(trace?.kind).toBe('hmc');
    if (trace?.kind === 'hmc') {
      expect(trace.update).toBe(47);
      expect(trace.gradientEvaluations).toBe(13);
      expect(trace.energyErrors).toHaveLength(12);
    }
  });

  it('preserves path and RNG but isolates changed physics and HMC tuning', () => {
    const run = new FieldRun(1, config());
    run.advance(9);
    const old = run.snapshot();
    const tilted = { ...p, h: 0.4 };
    run.changeSettings(settings(tilted, { warmupTrajectories: 2 }));
    const changed = run.snapshot();
    expect(changed.field).toEqual(old.field);
    expect(changed.updates).toBe(9);
    expect(changed.segments[0]?.measurements).toBe(9);
    expect(changed.segments[1]?.measurements).toBe(0);
    expect(changed.segments[1]?.seed).toBe(12345);
    run.advance(3);
    expect(run.snapshot().segments[1]?.warmupUpdates).toBe(2);
    expect(run.snapshot().segments[1]?.measurements).toBe(1);
    const beforeTuning = run.snapshot();
    run.changeSettings(
      settings(tilted, { stepSize: 0.05, warmupTrajectories: 2 }),
    );
    expect(run.snapshot().field).toEqual(beforeTuning.field);
    expect(run.snapshot().segments[2]?.measurements).toBe(0);
    const replay = new FieldRun(1, config());
    replay.advance(9);
    replay.changeSettings(settings(tilted, { warmupTrajectories: 2 }));
    replay.advance(3);
    replay.changeSettings(
      settings(tilted, { stepSize: 0.05, warmupTrajectories: 2 }),
    );
    run.advance(7);
    for (let i = 0; i < 7; i++) replay.advance(1);
    expect(run.snapshot()).toEqual(replay.snapshot());
  });

  it('does not pool local and whole-path algorithm measurements', () => {
    const run = new FieldRun(1, {
      ...defaultQuarticConfiguration,
      quartic: p,
      parameters: quarticQuadraticPart(p),
      warmupSweeps: 0,
    });
    run.advance(8);
    run.changeSettings(settings());
    run.advance(5);
    run.changeSettings({
      model: 'quartic-oscillator',
      quartic: p,
      parameters: quarticQuadraticPart(p),
      sampler: { kind: 'metropolis', width: 1 },
      warmupSweeps: 0,
      strideSweeps: 1,
    });
    run.advance(4);
    const segments = run.snapshot().segments;
    expect(segments.map((segment) => segment.measurements)).toEqual([2, 5, 1]);
    expect(segments.map((segment) => segment.hmc !== null)).toEqual([
      false,
      true,
      false,
    ]);
    expect(segments.map((segment) => segment.startUpdate)).toEqual([0, 8, 13]);
    expect(segments.map((segment) => segment.settings.sampler.kind)).toEqual([
      'metropolis',
      'hmc',
      'metropolis',
    ]);
  });

  it('keeps full pair products after HMC recent vectors are evicted', () => {
    const run = new FieldRun(1, config());
    const sums = [0, 0, 0];
    for (let i = 0; i < 270; i++) {
      run.advance(1);
      pathCorrelator(run.snapshot().field!).forEach(
        (value, lag) => (sums[lag]! += value),
      );
    }
    const segment = run.snapshot().segments[0]!;
    expect(segment.measurements).toBe(270);
    expect(segment.recent).toHaveLength(256);
    expect(segment.discardedMeasurements).toBe(14);
    expect(segment.hmc?.recent).toHaveLength(256);
    for (let lag = 0; lag < sums.length; lag++) {
      const projected =
        Array.from(
          { length: p.sites },
          (_, site) => segment.pairProducts[site]![(site + lag) % p.sites]!,
        ).reduce((sum, value) => sum + value, 0) / p.sites;
      expect(projected).toBeCloseTo(sums[lag]! / 270, 10);
    }
  });

  it('retains repeated rejected configurations as distinct trajectory measurements', () => {
    const stiff = { sites: 4, beta: 2, r: 16, lambda: 4, h: 0 };
    const run = new FieldRun(
      1,
      config(stiff, { stepSize: 0.25, leapfrogSteps: 32 }),
    );
    const initial = run.snapshot().field;
    run.advance(1);
    const first = run.snapshot();
    expect(first.lastTrace?.kind).toBe('hmc');
    if (first.lastTrace?.kind === 'hmc')
      expect(first.lastTrace.outcome).not.toBe('accepted');
    expect(first.field).toEqual(initial);
    expect(first.segments[0]?.recent[0]?.field).toEqual(initial);
    run.advance(1);
    const second = run.snapshot();
    expect(second.segments[0]?.measurements).toBe(2);
    expect(second.segments[0]?.recent[0]?.field).toEqual(initial);
    expect(second.segments[0]!.accepted + second.segments[0]!.rejected).toBe(2);
  });

  it('rejects invalid HMC settings and oversized direct worker requests atomically', () => {
    const engine = new FieldEngine();
    expect(
      engine.handle({
        type: 'initialize',
        runId: 1,
        configuration: { ...settings(p, { stepSize: 0.3 }), seed: 1 },
      }).type,
    ).toBe('error');
    const initial = engine.handle({
      type: 'initialize',
      runId: 1,
      configuration: config(),
    });
    expect(initial.type).toBe('snapshot');
    const oversized = engine.handle({ type: 'advance', runId: 1, count: 33 });
    expect(oversized.type).toBe('error');
    const next = engine.handle({ type: 'advance', runId: 1, count: 1 });
    const reference = new FieldRun(1, config());
    reference.advance(1);
    if (next.type === 'snapshot')
      expect(next.snapshot).toEqual(reference.snapshot());
  });
});
