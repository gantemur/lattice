import { describe, expect, it } from 'vitest';
import { createFieldLattice } from '../domain/fieldLattice';
import { drawSpectralField } from '../algorithms/spectralFieldSampler';
import { fieldTransition } from '../algorithms/gaussianFieldSampler';
import { fieldAction, fieldLocalDifference } from '../models/gaussianField';
import { oscillatorField } from '../models/oscillator';
import { latticeCorrelator } from '../models/oscillatorReference';
import { spectralQuadraticField } from '../models/gaussianFieldSpectral';
import {
  pathCorrelator,
  segmentCorrelator,
} from '../observables/oscillatorCorrelator';
import { FieldEngine, FieldRun, defaultFieldConfiguration } from './fieldRun';

const physical = { sites: 8, beta: 4, omega: 1 };
const mapped = oscillatorField(physical);
const base = {
  model: 'oscillator' as const,
  oscillator: physical,
  parameters: mapped,
  sampler: { kind: 'spectral' as const },
  warmupSweeps: 0,
  strideSweeps: 1,
  seed: 12345,
};

describe('oscillator field-worker integration', () => {
  it('uses exactly 2N seeded uniforms for each independent path', () => {
    let draws = 0;
    const rng = {
      uniform: () => {
        draws++;
        return 0.375;
      },
    };
    drawSpectralField(spectralQuadraticField(mapped), rng);
    expect(draws).toBe(2 * physical.sites);
  });
  it('replays seeded Step and unequal batch sizes identically', () => {
    const stepped = new FieldRun(1, base);
    const batched = new FieldRun(1, base);
    for (let i = 0; i < 25; i++) stepped.advance(1);
    batched.advance(7);
    batched.advance(18);
    expect(stepped.snapshot()).toEqual(batched.snapshot());
  });

  it('keeps full-segment correlator after the 256-vector display limit', () => {
    const run = new FieldRun(1, {
      ...base,
      oscillator: { ...physical, sites: 4 },
      parameters: oscillatorField({ ...physical, sites: 4 }),
    });
    const sums = [0, 0, 0];
    for (let i = 0; i < 280; i++) {
      run.advance(1);
      const values = pathCorrelator(run.snapshot().field!);
      values.forEach((value, lag) => {
        sums[lag]! += value;
      });
    }
    const segment = run.snapshot().segments[0]!;
    expect(segment.recent).toHaveLength(256);
    expect(segment.discardedMeasurements).toBe(24);
    segmentCorrelator(segment.pairProducts).forEach((value, lag) =>
      expect(value).toBeCloseTo(sums[lag]! / 280, 11),
    );
  });

  it('separates changed physical measures while preserving path and RNG', () => {
    const run = new FieldRun(1, base);
    run.advance(5);
    const before = run.snapshot();
    const nextPhysical = { ...physical, omega: 2 };
    run.changeSettings({
      ...base,
      oscillator: nextPhysical,
      parameters: oscillatorField(nextPhysical),
    });
    const changed = run.snapshot();
    expect(changed.field).toEqual(before.field);
    expect(changed.updates).toBe(5);
    expect(changed.segments[0]?.measurements).toBe(5);
    expect(changed.segments[1]?.measurements).toBe(0);
    expect(changed.segments[0]?.settings.oscillator?.omega).toBe(1);
    expect(changed.segments[1]?.settings.oscillator?.omega).toBe(2);
    run.advance(1);
    expect(run.snapshot().segments[1]?.measurements).toBe(1);
    expect(() =>
      run.changeSettings({
        ...base,
        oscillator: { ...physical, sites: 4 },
        parameters: oscillatorField({ ...physical, sites: 4 }),
      }),
    ).toThrow(/geometry/i);
  });

  it('counts local warm-up and measurement stride in N-site sweeps', () => {
    const run = new FieldRun(1, {
      ...base,
      sampler: { kind: 'heat-bath' },
      warmupSweeps: 1,
      strideSweeps: 2,
    });
    run.advance(8);
    expect(run.snapshot().segments[0]?.warmupUpdates).toBe(8);
    expect(run.snapshot().segments[0]?.measurements).toBe(0);
    run.advance(16);
    expect(run.snapshot().segments[0]?.measurements).toBe(1);
  });

  it('local action difference equals a full-action recomputation', () => {
    const lattice = createFieldLattice(mapped.shape);
    const path = [1, -0.5, 0.25, 0, 2, -1, 0.3, -0.2];
    const proposed = [...path];
    proposed[3] = 1.75;
    expect(fieldLocalDifference(lattice, mapped, path, 3, 1.75)).toBeCloseTo(
      fieldAction(lattice, mapped, proposed) -
        fieldAction(lattice, mapped, path),
      12,
    );
  });

  it('Metropolis accepts or rejects using the unchanged full-action cost', () => {
    const lattice = createFieldLattice(mapped.shape);
    const zero = Array<number>(physical.sites).fill(0);
    const selected = (decision: number) => {
      const draws = [0.01, 0.75, decision];
      let index = 0;
      return fieldTransition(
        lattice,
        mapped,
        { kind: 'metropolis', width: 1 },
        zero,
        { uniform: () => draws[index++]! },
        null,
      );
    };
    const accepted = selected(0.001);
    expect(accepted.trace.accepted).toBe(true);
    expect(accepted.trace.deltaAction).toBeCloseTo(
      fieldAction(lattice, mapped, accepted.field) -
        fieldAction(lattice, mapped, zero),
      12,
    );
    const rejected = selected(0.999);
    expect(rejected.trace.accepted).toBe(false);
    expect(rejected.field).toEqual(zero);
    expect(rejected.trace.deltaAction).toBeGreaterThan(0);
  });

  it('requires a seeded session when switching between Gaussian and oscillator models', () => {
    const engine = new FieldEngine();
    expect(
      engine.handle({
        type: 'initialize',
        runId: 1,
        configuration: defaultFieldConfiguration,
      }).type,
    ).toBe('snapshot');
    const rejection = engine.handle({
      type: 'change',
      runId: 1,
      settings: base,
    });
    expect(rejection.type).toBe('error');
    const switched = engine.handle({
      type: 'initialize',
      runId: 2,
      configuration: base,
    });
    expect(switched.type).toBe('snapshot');
    if (switched.type === 'snapshot') {
      expect(switched.snapshot.updates).toBe(0);
      expect(switched.snapshot.segments).toHaveLength(1);
    }
  });

  it('independent draws approach exact two-point expectation without path demeaning', () => {
    const run = new FieldRun(1, base);
    for (let i = 0; i < 20; i++) run.advance(100);
    const segment = run.snapshot().segments[0]!;
    const estimate = segmentCorrelator(segment.pairProducts);
    for (let lag = 0; lag < 3; lag++)
      expect(
        Math.abs(estimate[lag]! - latticeCorrelator(physical, lag)),
      ).toBeLessThan(0.07);
    expect(segment.measurements).toBe(2000);
  });
});
