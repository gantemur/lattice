import { describe, expect, it } from 'vitest';
import { defaultLatticeConfiguration, LatticeRun } from './latticeRun';
import type { LatticeConfiguration } from './latticeRun';
import { createIndexedLattice } from '../domain/indexedLattice';
import { magnetization, totalEnergy } from '../models/latticeIsing';
const base: LatticeConfiguration = {
  ...defaultLatticeConfiguration,
  parameters: {
    ...defaultLatticeConfiguration.parameters,
    lx: 2,
    ly: 2,
    temperature: 2,
    field: 0,
  },
  warmupSweeps: 1,
  strideSweeps: 2,
  seed: 11,
  initialization: 'random',
};
describe('large-lattice run', () => {
  it('separates initialization, partial sweeps, warm-up and stride', () => {
    const run = new LatticeRun(1, base);
    expect(run.snapshot().segments[0]!.samples).toBe(0);
    run.advance(3);
    expect(run.snapshot().segments[0]!.samples).toBe(0);
    run.advance(1);
    expect(run.snapshot().segments[0]!.warmupUpdates).toBe(4);
    run.advance(7);
    expect(run.snapshot().segments[0]!.samples).toBe(0);
    run.advance(1);
    expect(run.snapshot().segments[0]!.samples).toBe(1);
    expect(run.snapshot().segments[0]!.measurements[0]!.update).toBe(12);
  });
  it('replays initialization and updates across Step, batches and snapshot cadence', () => {
    const a = new LatticeRun(1, base),
      b = new LatticeRun(1, base);
    for (let i = 0; i < 77; i++) {
      a.advance(1);
      if (i % 3 === 0) a.snapshot();
    }
    b.advance(77);
    const x = a.snapshot(),
      y = b.snapshot();
    expect([...x.spins]).toEqual([...y.spins]);
    expect([x.energy, x.magnetization, x.updates]).toEqual([
      y.energy,
      y.magnetization,
      y.updates,
    ]);
    expect(x.segments).toEqual(y.segments);
  });
  it('isolates temperature quenches while preserving configuration and random stream', () => {
    const a = new LatticeRun(1, base),
      b = new LatticeRun(1, base);
    a.advance(32);
    b.advance(32);
    const old = a.snapshot();
    const changed = {
      ...base,
      parameters: { ...base.parameters, temperature: 4 },
    };
    a.changeSettings(changed);
    b.changeSettings(changed);
    expect([...a.snapshot().spins]).toEqual([...old.spins]);
    expect(a.snapshot().segments[0]).toEqual(old.segments[0]);
    a.advance(17);
    b.advance(17);
    expect(a.snapshot().segments).toEqual(b.snapshot().segments);
    expect(a.snapshot().segments[1]!.samples).toBe(1);
    const l = createIndexedLattice(base.parameters),
      s = a.snapshot();
    expect(s.energy).toBeCloseTo(
      totalEnergy(l, changed.parameters, s.spins),
      12,
    );
  });
  it('keeps exact incremental observables and bounded measurements after 1m updates', () => {
    const settings = {
      ...base,
      parameters: { ...base.parameters, lx: 16, ly: 16 },
      warmupSweeps: 0,
      strideSweeps: 1,
    };
    const run = new LatticeRun(1, settings);
    for (let i = 0; i < 125; i++) run.advance(8000);
    const s = run.snapshot(),
      segment = s.segments[0]!,
      lattice = createIndexedLattice(settings.parameters);
    expect(s.updates).toBe(1_000_000);
    expect(segment.samples).toBe(Math.floor(1_000_000 / 256));
    expect(segment.measurements.length).toBe(1000);
    expect(segment.discardedMeasurements).toBe(segment.samples - 1000);
    expect(segment.meanCheckpoints.length).toBeLessThanOrEqual(321);
    expect(s.magnetization).toBe(magnetization(s.spins));
    expect(s.energy).toBeCloseTo(
      totalEnergy(lattice, settings.parameters, s.spins),
      6,
    );
  });
  it('rejects incompatible geometry and invalid settings', () => {
    const run = new LatticeRun(1, base);
    run.changeSettings({
      parameters: base.parameters,
      sampler: base.sampler,
      warmupSweeps: base.warmupSweeps,
      strideSweeps: base.strideSweeps,
    });
    expect(run.snapshot().segments).toHaveLength(1);
    expect(() =>
      run.changeSettings({
        ...base,
        parameters: { ...base.parameters, lx: 3 },
      }),
    ).toThrow(/new session/);
    expect(
      () =>
        new LatticeRun(2, {
          ...base,
          parameters: { ...base.parameters, temperature: 0 },
        }),
    ).toThrow(/Temperature/);
  });
});
