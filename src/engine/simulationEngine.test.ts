import type { GaussianParameters } from '../models/gaussian';
const settings = (parameters: GaussianParameters) => ({
  model: { kind: 'gaussian' as const, parameters },
  sampler: { kind: 'direct' as const },
});
import { describe, expect, it } from 'vitest';
import { singleSite } from '../domain/singleSite';
import { gaussianVariable } from '../models/gaussian';
import { SimulationEngine, SimulationRun } from './simulationEngine';
import { standardGaussianPreset } from './preset';
import type { WorkerResponse } from './protocol';

const configuration = standardGaussianPreset.configuration;
function snapshot(response: WorkerResponse) {
  if (response.type !== 'snapshot') throw new Error(response.message);
  return response.snapshot;
}

describe('Gaussian run', () => {
  it('has one physical variable on one site, independently of display slots', () => {
    expect(singleSite.vertices).toEqual([{ id: 'v0' }]);
    expect(singleSite.edges).toHaveLength(0);
    expect(gaussianVariable).toEqual({
      id: 'x',
      carrier: 'vertex',
      carrierId: 'v0',
      kind: 'real',
    });
  });
  it('has no fabricated initial sample or warm-up; every independent draw is retained', () => {
    const run = new SimulationRun(1, configuration);
    expect(run.snapshot()).toMatchObject({
      currentValue: null,
      currentAction: null,
      updates: 0,
      warmupUpdates: 0,
      strideUpdates: 1,
      moments: { count: 0 },
    });
    run.advance(1);
    expect(run.snapshot()).toMatchObject({
      updates: 1,
      version: 1,
      warmupUpdates: 0,
      moments: { count: 1, variance: null },
    });
    run.advance(999);
    const state = run.snapshot();
    expect(state.moments.count).toBe(1000);
    expect(
      state.histogram.bins.reduce(
        (a, b) => a + b,
        state.histogram.below + state.histogram.above,
      ),
    ).toBe(1000);
  });
  it('makes single steps, batches and arbitrary rendering/snapshot frequency identical', () => {
    const steps = new SimulationRun(1, configuration);
    const batches = new SimulationRun(1, configuration);
    const irregular = new SimulationRun(1, configuration);
    for (let i = 0; i < 4096; i += 1) {
      steps.advance(1);
      steps.snapshot();
      steps.snapshot();
    }
    for (let i = 0; i < 4; i += 1) batches.advance(1024);
    for (const count of [1, 13, 500, 1024, 1024, 1024, 510]) {
      irregular.advance(count);
      irregular.snapshot();
    }
    expect(steps.snapshot()).toEqual(batches.snapshot());
    expect(irregular.snapshot()).toEqual(batches.snapshot());
  });
  it('does not expose mutable authoritative state through config or snapshots', () => {
    const mutable = { ...settings({ a: 1, h: 0 }), seed: 1 };
    const run = new SimulationRun(1, mutable);
    (mutable.model.parameters as { h: number }).h = 2;
    const copy = run.snapshot();
    copy.histogram.bins[0] = 100;
    (copy.configuration.model.parameters as { h: number }).h = 3;
    expect(
      (run.snapshot().configuration.model.parameters as GaussianParameters).h,
    ).toBe(0);
    expect(run.snapshot().histogram.bins[0]).toBe(0);
  });
  it.each([0, -1, 1.5, 1025, Infinity, NaN])(
    'rejects invalid batch %s before mutating state',
    (count) => {
      const run = new SimulationRun(1, configuration);
      expect(() => run.advance(count)).toThrow();
      expect(run.snapshot().updates).toBe(0);
    },
  );
});

describe('worker protocol', () => {
  it('rejects uninitialized and stale commands without losing the current run', () => {
    const engine = new SimulationEngine();
    expect(engine.handle({ type: 'advance', runId: 1, count: 1 }).type).toBe(
      'error',
    );
    engine.handle({ type: 'initialize', runId: 2, configuration });
    expect(
      engine.handle({ type: 'initialize', runId: 1, configuration }).type,
    ).toBe('error');
    expect(engine.handle({ type: 'advance', runId: 1, count: 100 }).type).toBe(
      'error',
    );
    expect(
      snapshot(engine.handle({ type: 'snapshot', runId: 2 })).updates,
    ).toBe(0);
  });
  it('resets RNG and measurements on initialization, without blending target measures', () => {
    const engine = new SimulationEngine();
    engine.handle({ type: 'initialize', runId: 1, configuration });
    const first = snapshot(
      engine.handle({ type: 'advance', runId: 1, count: 50 }),
    );
    const reset = snapshot(
      engine.handle({ type: 'initialize', runId: 2, configuration }),
    );
    expect(reset.moments.count).toBe(0);
    const replay = snapshot(
      engine.handle({ type: 'advance', runId: 2, count: 50 }),
    );
    expect(replay).toEqual({ ...first, runId: 2 });
    const changed = snapshot(
      engine.handle({
        type: 'initialize',
        runId: 3,
        configuration: { ...configuration, ...settings({ a: 4, h: 2 }) },
      }),
    );
    expect(changed.moments.count).toBe(0);
    expect(changed.configuration.model.parameters).toEqual({ a: 4, h: 2 });
  });
  it('validates configuration before replacing the current state', () => {
    const engine = new SimulationEngine();
    engine.handle({ type: 'initialize', runId: 1, configuration });
    const first = snapshot(
      engine.handle({ type: 'advance', runId: 1, count: 2 }),
    );
    expect(
      engine.handle({
        type: 'initialize',
        runId: 2,
        configuration: { ...configuration, ...settings({ a: 0, h: 0 }) },
      }).type,
    ).toBe('error');
    expect(snapshot(engine.handle({ type: 'snapshot', runId: 1 }))).toEqual(
      first,
    );
  });
});
