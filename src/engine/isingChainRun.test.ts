import { describe, expect, it } from 'vitest';
import { LatticeRun } from './latticeRun';
import type { LatticeConfiguration } from './latticeRun';
import {
  createArchiveEntry,
  exportBundle,
  importBundle,
} from '../experiments/archive';
import { exportSummaryCsv, exportMeasurementsCsv } from '../experiments/export';
import { bondProducts, axialProducts } from '../observables/latticePhysics';
import { createIndexedLattice } from '../domain/indexedLattice';

const config: LatticeConfiguration = {
  parameters: {
    lx: 32,
    ly: 1,
    periodicX: true,
    periodicY: false,
    jx: 1,
    jy: 0,
    field: 0,
    temperature: 2,
  },
  sampler: 'metropolis',
  warmupSweeps: 1,
  strideSweeps: 2,
  seed: 12345,
  initialization: 'random',
};

describe('chain on the existing indexed worker', () => {
  it('has no fabricated transverse moments or spatial products', () => {
    const l = createIndexedLattice(config.parameters);
    const spins = new Int8Array(32).fill(1);
    expect(bondProducts(l, spins)).toEqual({ x: 1, y: null });
    expect(axialProducts(l, spins, 'y')).toEqual([]);
    expect(axialProducts(l, spins, 'x', 16)).toHaveLength(17);
    const run = new LatticeRun(1, config);
    run.advance(32 * 5);
    const s = run.snapshot().segments[0]!;
    expect(s.samples).toBe(2);
    expect(s.gx.count).toBe(2);
    expect(s.gy).toEqual({
      count: 0,
      mean: null,
      variance: null,
      secondMoment: null,
    });
    expect(s.spatialY).toEqual([]);
    expect(s.spatialX).toHaveLength(17);
    expect(s.spatialX.every((q) => q.moments.count === 2)).toBe(true);
  });

  it.each(['metropolis', 'heat-bath'] as const)(
    'preserves seeded %s updates across Step, batches, snapshots and segment changes',
    (sampler) => {
      const settings = { ...config, sampler };
      const a = new LatticeRun(1, settings),
        b = new LatticeRun(1, settings);
      for (let i = 0; i < 192; i++) {
        a.advance(1);
        if (i % 7 === 0) a.snapshot();
      }
      b.advance(192);
      expect(a.snapshot()).toEqual(b.snapshot());
      const changed = {
        ...settings,
        parameters: { ...settings.parameters, field: 0.7 },
      };
      const old = a.snapshot();
      a.changeSettings(changed);
      b.changeSettings(changed);
      expect([...a.snapshot().spins]).toEqual([...old.spins]);
      expect(a.snapshot().segments[0]).toEqual(old.segments[0]);
      a.advance(321);
      b.advance(321);
      expect(a.snapshot()).toEqual(b.snapshot());
      expect(a.snapshot().segments[1]!.samples).toBe(4);
    },
  );

  it('round-trips current and historical chain records without changing old formats', () => {
    const run = new LatticeRun(1, config);
    run.advance(160);
    run.changeSettings({
      ...config,
      parameters: { ...config.parameters, jx: -0.4 },
    });
    run.advance(160);
    const oldCapture = run.capture(1),
      currentCapture = run.capture(2);
    const old = createArchiveEntry(oldCapture, 'chain', 'old chain');
    const current = createArchiveEntry(currentCapture, 'chain', 'new chain');
    expect(oldCapture.currentState).toBeNull();
    expect(currentCapture.currentState?.spins).toHaveLength(32);
    const restored = importBundle([], exportBundle([old, current]));
    expect(restored.map((e) => e.scientific)).toEqual(
      [old, current].map((e) => e.scientific),
    );
    expect(exportSummaryCsv(restored)).toContain('1d-ising-chain');
    expect(exportMeasurementsCsv(restored)).toContain('1d-ising-chain');
    expect(currentCapture.segment.gy.mean).toBeNull();
  });

  it('rejects invented transverse data and changed origin counts atomically', () => {
    const run = new LatticeRun(1, config);
    run.advance(96);
    const entry = createArchiveEntry(run.capture(1), 'chain', 'valid');
    const original = exportBundle([entry]);
    for (const alter of [
      (s: Record<string, unknown>) => {
        (s.gy as Record<string, unknown>).mean = 0;
      },
      (s: Record<string, unknown>) => {
        s.spatialY = [{ r: 0, pairs: 32, moments: { count: 1, mean: 1 } }];
      },
      (s: Record<string, unknown>) => {
        (s.spatialX as Record<string, unknown>[])[1]!.pairs = 31;
      },
    ]) {
      const bundle = JSON.parse(original);
      alter(bundle.records[0].scientific.capture.segment);
      expect(() => importBundle([entry], JSON.stringify(bundle))).toThrow();
      expect(importBundle([], original)).toHaveLength(1);
    }
  });
});
