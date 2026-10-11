import { describe, expect, it } from 'vitest';
import { LatticeRun } from './latticeRun';
import type { LatticeConfiguration } from './latticeRun';
import { DIAGNOSTIC_CAPACITY } from '../observables/statisticalDiagnostics';

const configuration: LatticeConfiguration = {
  parameters: {
    lx: 2,
    ly: 2,
    periodicX: true,
    periodicY: false,
    jx: 1,
    jy: -0.5,
    field: 0.2,
    temperature: 2,
  },
  sampler: 'metropolis',
  warmupSweeps: 1,
  strideSweeps: 2,
  seed: 774,
  initialization: 'random',
};

describe('M3a worker diagnostic provenance', () => {
  it('preserves seed replay and full measurements across batching and display snapshots', () => {
    const batched = new LatticeRun(1, configuration),
      stepped = new LatticeRun(1, configuration);
    batched.advance(4000);
    for (let i = 0; i < 4000; i++) {
      stepped.advance(1);
      if (i % 37 === 0) stepped.snapshot();
    }
    const a = batched.snapshot(),
      b = stepped.snapshot();
    expect(a.spins).toEqual(b.spins);
    expect(a.energy).toBe(b.energy);
    expect(a.magnetization).toBe(b.magnetization);
    expect(a.segments[0]!.m).toEqual(b.segments[0]!.m);
    expect(a.segments[0]!.m4).toEqual(b.segments[0]!.m4);
    expect(a.segments[0]!.gx).toEqual(b.segments[0]!.gx);
    expect(a.segments[0]!.diagnostics).toEqual(b.segments[0]!.diagnostics);
    expect(a.segments[0]!.samples).toBe(499);
    expect(a.segments[0]!.measurements).toHaveLength(499);
    expect(a.segments[0]!.diagnostics.m.cadence).toEqual({
      kind: 'lattice',
      sweepsPerObservation: 2,
    });
  });
  it('separates temperature/sampler segments and bounds old diagnostic records', () => {
    const run = new LatticeRun(1, {
      ...configuration,
      warmupSweeps: 0,
      strideSweeps: 1,
    });
    for (let i = 0; i < 5; i++) run.advance(8192);
    const first = run.snapshot().segments[0]!;
    expect(first.samples).toBe(10240);
    expect(
      first.mHistogram.bins.reduce((a, b) => a + b, 0) +
        first.mHistogram.below +
        first.mHistogram.above,
    ).toBe(first.samples);
    expect(first.measurements).toHaveLength(1000);
    expect(first.diagnostics.m.used).toBe(DIAGNOSTIC_CAPACITY);
    expect(first.diagnostics.m.evicted).toBe(2048);
    expect(first.diagnostics.m.firstMeasurement).toBe(2049);
    const settings = {
      ...configuration,
      parameters: { ...configuration.parameters, temperature: 4 },
      sampler: 'heat-bath' as const,
      warmupSweeps: 1,
      strideSweeps: 3,
    };
    run.changeSettings(settings);
    const after = run.snapshot().segments;
    expect(after).toHaveLength(2);
    expect(after[0]!.diagnostics).toEqual(first.diagnostics);
    expect(after[1]!.samples).toBe(0);
    expect(after[1]!.diagnostics.m.used).toBe(0);
    expect(after[1]!.diagnostics.m.cadence).toEqual({
      kind: 'lattice',
      sweepsPerObservation: 3,
    });
    run.advance(12);
    expect(run.snapshot().segments[1]!.samples).toBe(0);
    run.advance(4);
    expect(run.snapshot().segments[1]!.samples).toBe(1);
  });
});
