import { describe, expect, it } from 'vitest';
import { createRng } from '../algorithms/rng';
import { quarticTransition } from '../algorithms/quarticOscillatorSampler';
import {
  pathCorrelator,
  segmentCorrelator,
} from '../observables/oscillatorCorrelator';
import {
  quarticLocalDifference,
  quarticQuadraticPart,
} from '../models/quarticOscillator';
import { quarticTransferStudy } from '../models/quarticTransfer';
import { FieldEngine, FieldRun, defaultQuarticConfiguration } from './fieldRun';

const p = { sites: 4, beta: 4, r: -2, lambda: 1, h: 0 };
const base = {
  ...defaultQuarticConfiguration,
  quartic: p,
  parameters: quarticQuadraticPart(p),
  warmupSweeps: 0,
};

describe('quartic local Metropolis and worker-owned measurements', () => {
  it('consumes exactly three uniforms on accepted, rejected and downhill moves', () => {
    const zero = [0, 0, 0, 0];
    function attempt(path: number[], uniforms: number[]) {
      let index = 0;
      const result = quarticTransition(p, path, 1, {
        uniform: () => uniforms[index++]!,
      });
      expect(index).toBe(3);
      expect(result.trace.site).toBe(0);
      expect(result.trace.decisionUniform).toBe(uniforms[2]);
      return result;
    }
    const uphill = attempt(zero, [0.1, 0.75, 0.999]);
    expect(uphill.trace.deltaAction).toBeCloseTo(
      quarticLocalDifference(p, zero, 0, 0.5),
      12,
    );
    expect(uphill.trace.accepted).toBe(false);
    expect(uphill.field).toEqual(zero);
    const accepted = attempt(zero, [0.1, 0.75, 0.001]);
    expect(accepted.trace.accepted).toBe(true);
    expect(accepted.field[0]).toBe(0.5);
    const downhill = attempt([2, 0, 0, 0], [0.1, 0.25, 0.999]);
    expect(downhill.trace.deltaAction).toBeLessThan(0);
    expect(downhill.trace.accepted).toBe(true);
    expect(downhill.trace.acceptanceProbability).toBe(1);
  });

  it('rejects arithmetic-overflow proposals without contaminating the path or draw count', () => {
    const path = [0, 0, 0, 0];
    let draws = 0;
    const result = quarticTransition(p, path, 10, {
      uniform: () => {
        draws++;
        return draws === 2 ? 0.9999999999 : 0.25;
      },
    });
    // A finite width within supported settings is safe; an enormous current
    // value is used separately to exercise the overflow guard.
    expect(draws).toBe(3);
    expect(result.field.every(Number.isFinite)).toBe(true);
    const enormous = [1e100, 0, 0, 0];
    draws = 0;
    const rejected = quarticTransition(p, enormous, 1, {
      uniform: () => {
        draws++;
        return draws === 2 ? 0.75 : 0.1;
      },
    });
    expect(draws).toBe(3);
    expect(rejected.trace.accepted).toBe(false);
    expect(rejected.field).toEqual(enormous);
    expect(rejected.trace.deltaAction).toBeNull();
  });

  it('replays Step and unequal batches; Reset replays the selected seed', () => {
    const stepped = new FieldRun(1, base);
    const batched = new FieldRun(1, base);
    for (let i = 0; i < 125; i++) stepped.advance(1);
    batched.advance(31);
    batched.advance(94);
    expect(batched.snapshot()).toEqual(stepped.snapshot());
    const reset = new FieldRun(1, base);
    reset.advance(125);
    expect(reset.snapshot()).toEqual(stepped.snapshot());
    expect(batched.snapshot().segments[0]?.reference).toBeNull();
    expect(batched.snapshot().field).not.toBeNull();
    expect(createRng(base.seed).uniform()).toBe(createRng(base.seed).uniform());
  });

  it('counts complete warm-up/stride sweeps and retained rejected states', () => {
    const settings = {
      ...base,
      sampler: { kind: 'metropolis' as const, width: 0.01 },
      warmupSweeps: 1,
      strideSweeps: 2,
    };
    const run = new FieldRun(1, settings);
    run.advance(4);
    expect(run.snapshot().segments[0]?.warmupUpdates).toBe(4);
    expect(run.snapshot().segments[0]?.measurements).toBe(0);
    run.advance(8);
    const segment = run.snapshot().segments[0]!;
    expect(segment.measurements).toBe(1);
    expect(segment.accepted + segment.rejected).toBe(12);
    expect(segment.recent[0]?.update).toBe(12);
    expect(segment.reference).toBeNull();
  });

  it('keeps independent segment actions, path and RNG across parameter changes', () => {
    const run = new FieldRun(1, base);
    run.advance(12);
    const first = run.snapshot();
    const nextP = { ...p, h: 0.4 };
    run.changeSettings({
      ...base,
      quartic: nextP,
      parameters: quarticQuadraticPart(nextP),
    });
    const changed = run.snapshot();
    expect(changed.field).toEqual(first.field);
    expect(changed.updates).toBe(first.updates);
    expect(changed.segments[0]?.measurements).toBe(3);
    expect(changed.segments[1]?.measurements).toBe(0);
    const continuation = new FieldRun(1, base);
    continuation.advance(12);
    continuation.changeSettings({
      ...base,
      quartic: nextP,
      parameters: quarticQuadraticPart(nextP),
    });
    run.advance(17);
    for (let i = 0; i < 17; i++) continuation.advance(1);
    expect(run.snapshot()).toEqual(continuation.snapshot());
  });

  it('keeps full-segment correlators after 256 display vectors are evicted', () => {
    const run = new FieldRun(1, base);
    const sums = [0, 0, 0];
    for (let i = 0; i < 1120; i++) {
      run.advance(1);
      if ((i + 1) % 4 === 0)
        pathCorrelator(run.snapshot().field!).forEach(
          (value, lag) => (sums[lag]! += value),
        );
    }
    const segment = run.snapshot().segments[0]!;
    expect(segment.recent).toHaveLength(256);
    expect(segment.discardedMeasurements).toBe(24);
    segmentCorrelator(segment.pairProducts).forEach((value, lag) =>
      expect(value).toBeCloseTo(sums[lag]! / 280, 11),
    );
    expect(
      segment.positiveAveragePaths +
        segment.negativeAveragePaths +
        segment.zeroAveragePaths,
    ).toBe(280);
  });

  it('requires initialization for model and geometry switches, and rejects fake Gaussian coefficients', () => {
    const engine = new FieldEngine();
    expect(
      engine.handle({ type: 'initialize', runId: 1, configuration: base }).type,
    ).toBe('snapshot');
    const changedN = { ...p, sites: 8 };
    expect(
      engine.handle({
        type: 'change',
        runId: 1,
        settings: {
          ...base,
          quartic: changedN,
          parameters: quarticQuadraticPart(changedN),
        },
      }).type,
    ).toBe('error');
    expect(
      engine.handle({
        type: 'change',
        runId: 1,
        settings: { ...base, parameters: { ...base.parameters, r: 1 } },
      }).type,
    ).toBe('error');
    expect(
      engine.handle({
        type: 'initialize',
        runId: 2,
        configuration: {
          ...base,
          quartic: changedN,
          parameters: quarticQuadraticPart(changedN),
        },
      }).type,
    ).toBe('snapshot');
    const coefficients = quarticQuadraticPart(changedN);
    // Object key order is serialization detail, not a physical parameter.
    expect(
      engine.handle({
        type: 'initialize',
        runId: 3,
        configuration: {
          ...base,
          quartic: changedN,
          parameters: {
            source: coefficients.source,
            kappaY: coefficients.kappaY,
            kappaX: coefficients.kappaX,
            r: coefficients.r,
            shape: coefficients.shape,
          },
        },
      }).type,
    ).toBe('snapshot');
  });

  it('gives an ensemble-level moderate-interaction check against resolved transfer C(0)', () => {
    const physical = { sites: 8, beta: 4, r: 1, lambda: 1, h: 0 };
    const settings = {
      ...base,
      quartic: physical,
      parameters: quarticQuadraticPart(physical),
      warmupSweeps: 100,
      strideSweeps: 2,
    };
    const reference = quarticTransferStudy(physical);
    expect(reference.correlatorStatus).toBe('resolved');
    const estimates = [12345, 24680].map((seed) => {
      const run = new FieldRun(seed, { ...settings, seed });
      for (let i = 0; i < 100; i++) run.advance(1000);
      const segment = run.snapshot().segments[0]!;
      expect(segment.measurements).toBeGreaterThan(6000);
      return segmentCorrelator(segment.pairProducts)[0]!;
    });
    const ensemble = (estimates[0]! + estimates[1]!) / 2;
    expect(
      Math.abs(ensemble - reference.grids[2].rawCorrelator![0]!),
    ).toBeLessThan(0.12);
  });
});
