import { describe, expect, it } from 'vitest';
import { LatticeRun } from '../engine/latticeRun';
import { exactLatticeTwoByTwo } from '../models/latticeExact';
import { addArchiveEntries, createArchiveEntry, exportBundle } from './archive';
import {
  exportSweepMeasurementsCsv,
  exportSweepSummaryCsv,
} from './sweepExport';
import {
  createSweepManifest,
  exportSweepBundle,
  importPortableBundle,
  sweepCapacity,
  validateSweepManifest,
} from './sweepArchive';
import {
  pointConfiguration,
  pointSeed,
  sweepPresets,
  validateSweepPlan,
} from './sweepPlan';
import type { SweepPlan } from './sweepPlan';
import { SweepRun } from './sweepRun';

function plan(): SweepPlan {
  const p = structuredClone(sweepPresets.temperature);
  p.base.parameters.lx = p.base.parameters.ly = 2;
  p.base.parameters.periodicY = false;
  p.base.parameters.jx = -0.8;
  p.base.parameters.jy = 0.6;
  p.base.parameters.field = 0.2;
  p.base.sampler = 'heat-bath';
  p.base.warmupSweeps = 2;
  p.base.strideSweeps = 3;
  p.values = [1.5, 3];
  p.measurementsPerPoint = 257;
  return p;
}
function finish(p: SweepPlan, batch: number, pause = false) {
  const run = new SweepRun(p);
  run.start();
  const points = [];
  while (run.progress().status !== 'completed') {
    if (pause && run.progress().totalUpdates === batch) {
      run.pause();
      expect(run.advance(99)).toBeNull();
      run.resume();
    }
    const point = run.advance(batch);
    if (point) points.push(point);
  }
  return points;
}
function archive(
  p: SweepPlan,
  status: 'completed' | 'cancelled' = 'completed',
) {
  const points = finish(p, 37);
  const id = 'sweep-test';
  const entries = points.map((point) =>
    createArchiveEntry(point.capture, id, `Point ${point.index}`),
  );
  const completed = points.map((point, i) => ({
    index: i,
    datasetId: entries[i]!.scientific.datasetId,
    updates: point.updates,
    measurements: point.capture.segment.samples,
  }));
  return {
    points,
    entries,
    manifest: createSweepManifest(p, id, status, completed, null, entries),
  };
}

describe('independent sweep execution', () => {
  it('validates finite work, unique values, physical assignments and distinct reproducible seeds', () => {
    const p = plan();
    expect(Object.isFrozen(new SweepRun(p).plan.values)).toBe(true);
    expect(validateSweepPlan(p).pointUpdates).toEqual([
      4 * (2 + 3 * 257),
      4 * (2 + 3 * 257),
    ]);
    expect(pointConfiguration(p, 0).parameters.temperature).toBe(1.5);
    expect(pointConfiguration(p, 1).parameters.temperature).toBe(3);
    expect(pointSeed(p.baseSeed, 0)).not.toBe(pointSeed(p.baseSeed, 1));
    expect(pointSeed(p.baseSeed, 0)).toBe(pointSeed(p.baseSeed, 0));
    expect(() => validateSweepPlan({ ...p, values: [1, 1] })).toThrow(
      /distinct/,
    );
    expect(() =>
      validateSweepPlan({ ...p, measurementsPerPoint: 8193 }),
    ).toThrow(/8192/);
    expect(() =>
      validateSweepPlan({ ...p, values: [...Array(13)].map((_, i) => i + 1) }),
    ).toThrow(/2–12/);
    const sizes = structuredClone(sweepPresets.size);
    sizes.values = [2, 4];
    expect(pointConfiguration(sizes, 0).parameters.lx).toBe(2);
    expect(pointConfiguration(sizes, 1).parameters.ly).toBe(4);
  });
  it('matches ordinary fresh LatticeRun instances, including final raw and diagnostic records', () => {
    const p = plan();
    const points = finish(p, 37, true);
    for (const point of points) {
      const control = new LatticeRun(
        point.index + 1,
        pointConfiguration(p, point.index),
      );
      control.advance(point.updates);
      expect(point.capture).toEqual(control.capture(1, true));
      expect(point.capture.diagnosticRecord.count).toBe(257);
      expect(point.capture.segment.diagnostics.m.total).toBe(257);
      expect(point.capture.segment.diagnostics.m.used).toBe(257);
      expect(point.capture.segment.samples).toBe(257);
      expect(point.capture.segment.settings.parameters.periodicY).toBe(false);
      const exact = exactLatticeTwoByTwo(
        point.capture.segment.settings.parameters,
      );
      expect(exact).toBeDefined();
    }
    const oneBatch = finish(p, 8192);
    expect(oneBatch.map((point) => point.capture)).toEqual(
      points.map((point) => point.capture),
    );
  });
  it('cancel discards only the partial point and retains prior completed point', () => {
    const p = plan(),
      run = new SweepRun(p);
    run.start();
    let first;
    while (!first) first = run.advance(13);
    run.advance(17);
    const partial = run.cancel();
    expect(first.capture.segment.samples).toBe(257);
    expect(partial).toEqual({ index: 1, updates: 17, measurements: 0 });
    expect(run.advance()).toBeNull();
    const entry = createArchiveEntry(first.capture, 'cancelled-sweep', 'First');
    const saved = createSweepManifest(
      p,
      'cancelled-sweep',
      'cancelled',
      [
        {
          index: 0,
          datasetId: entry.scientific.datasetId,
          updates: first.updates,
          measurements: 257,
        },
      ],
      partial,
      [entry],
    );
    expect(saved.scientific.points.map((point) => point.status)).toEqual([
      'completed',
      'discarded-partial',
    ]);
    expect(() => run.cancel()).toThrow(/ended/);
  });
  it('retains the permitted complete 8192 m, |m| and e sequences', () => {
    const p = plan();
    p.values = [1.5, 2];
    p.base.warmupSweeps = 0;
    p.base.strideSweeps = 1;
    p.measurementsPerPoint = 8192;
    const [point] = finish(p, 8192);
    expect(point!.capture.diagnosticRecord.count).toBe(8192);
    expect(point!.capture.diagnosticRecord.firstMeasurement).toBe(1);
    expect(point!.capture.segment.measurements).toHaveLength(1000);
    expect(point!.capture.segment.discardedMeasurements).toBe(7192);
  });
  it('marks two completed points, one discarded partial and later points not started', () => {
    const p = plan();
    p.values = [1.5, 2, 3, 4];
    p.measurementsPerPoint = 3;
    const run = new SweepRun(p);
    run.start();
    const points = [];
    while (points.length < 2) {
      const done = run.advance(7);
      if (done) points.push(done);
    }
    run.advance(5);
    const partial = run.cancel();
    const entries = points.map((point) =>
      createArchiveEntry(point.capture, 'four-point', 'Point'),
    );
    const saved = createSweepManifest(
      p,
      'four-point',
      'cancelled',
      points.map((point, i) => ({
        index: i,
        datasetId: entries[i]!.scientific.datasetId,
        updates: point.updates,
        measurements: 3,
      })),
      partial,
      entries,
    );
    expect(saved.scientific.points.map((point) => point.status)).toEqual([
      'completed',
      'completed',
      'discarded-partial',
      'not-started',
    ]);
    expect(saved.scientific.points[2]!.datasetId).toBeNull();
  });
  it('tracks the independent 2×2 exact finite-volume reference in a rapidly mixing field scan', () => {
    const p = plan();
    p.varying = 'field';
    p.values = [-0.5, 0.5];
    p.base.parameters.jx = 0;
    p.base.parameters.jy = 0;
    p.base.parameters.temperature = 2;
    p.base.warmupSweeps = 10;
    p.base.strideSweeps = 1;
    p.measurementsPerPoint = 2048;
    const points = finish(p, 17);
    for (const point of points) {
      const exact = exactLatticeTwoByTwo(
        point.capture.segment.settings.parameters,
      );
      expect(
        Math.abs(point.capture.segment.m.mean! - exact.meanM),
      ).toBeLessThan(0.1);
      expect(
        Math.abs(point.capture.segment.e.mean! - exact.meanE),
      ).toBeLessThan(0.1);
    }
  });
});

describe('versioned portable sweep archive', () => {
  it('round trips manifest, point provenance and CSV without Monte Carlo rerun', () => {
    const { entries, manifest } = archive(plan());
    const imported = importPortableBundle(
      [],
      [],
      exportSweepBundle(manifest, entries),
    );
    expect(imported.entries.map((e) => e.scientific)).toEqual(
      entries.map((e) => e.scientific),
    );
    expect(imported.sweeps[0]!.scientific).toEqual(manifest.scientific);
    expect(
      exportSweepSummaryCsv(imported.sweeps[0]!, imported.entries),
    ).toContain('physical_per_site');
    expect(
      exportSweepSummaryCsv(imported.sweeps[0]!, imported.entries),
    ).toContain(
      String(
        imported.entries[0]!.scientific.capture.workspace === 'lattice'
          ? imported.entries[0]!.scientific.capture.segment.m.mean
          : '',
      ),
    );
    expect(
      exportSweepMeasurementsCsv(imported.sweeps[0]!, imported.entries).split(
        '\r\n',
      ).length,
    ).toBe(2 * 257 * 3 + 2);
    expect(importPortableBundle([], [], exportBundle(entries)).sweeps).toEqual(
      [],
    );
    const twice = importPortableBundle(
      imported.entries,
      imported.sweeps,
      exportSweepBundle(manifest, entries),
    );
    expect(twice.entries).toHaveLength(4);
    expect(twice.sweeps).toHaveLength(2);
    expect(
      JSON.parse(exportSweepBundle(twice.sweeps[1]!, twice.entries)).records,
    ).toHaveLength(2);
  });
  it('checks capacity against pre-existing records and preserves zero-point cancellation', () => {
    const p = plan();
    const { entries } = archive(p);
    expect(sweepCapacity(Array(15).fill(entries[0]!), [], p).available).toBe(
      false,
    );
    expect(sweepCapacity([], [], p).available).toBe(true);
    const empty = createSweepManifest(
      p,
      'empty-sweep',
      'cancelled',
      [],
      { index: 0, updates: 0, measurements: 0 },
      [],
    );
    expect(empty.scientific.points.map((point) => point.status)).toEqual([
      'not-started',
      'not-started',
    ]);
  });
  it('protects formula-like sweep names in CSV while leaving negative numeric fields numeric', () => {
    const p = plan();
    p.name = '  =HYPERLINK("unsafe")';
    p.values = [-1, 1];
    p.varying = 'field';
    const { entries, manifest } = archive(p);
    const csv = exportSweepSummaryCsv(manifest, entries);
    expect(csv).toContain("'  =HYPERLINK");
    expect(csv).toContain(',-1,');
  });
  it('rejects inconsistent point reference, index, seed, settings and status atomically', () => {
    const { entries, manifest } = archive(plan());
    const text = exportSweepBundle(manifest, entries);
    const existing = addArchiveEntries([], entries);
    for (const change of [
      (b: any) => {
        b.sweeps[0].points[0].datasetId = 'missing';
      },
      (b: any) => {
        b.sweeps[0].points[1].index = 0;
      },
      (b: any) => {
        b.sweeps[0].points[0].seed++;
      },
      (b: any) => {
        b.sweeps[0].points[0].parameters.temperature = 9;
      },
      (b: any) => {
        b.sweeps[0].points[0].status = 'not-started';
      },
      (b: any) => {
        b.records[0].scientific.source.seed++;
      },
    ]) {
      const bundle = JSON.parse(text);
      change(bundle);
      expect(() =>
        importPortableBundle(existing, [], JSON.stringify(bundle)),
      ).toThrow();
      expect(existing).toHaveLength(2);
    }
    const duplicate = JSON.parse(text);
    duplicate.sweeps.push(structuredClone(duplicate.sweeps[0]));
    expect(() =>
      importPortableBundle([], [], JSON.stringify(duplicate)),
    ).toThrow(/Duplicate sweep IDs/);
    expect(() =>
      validateSweepManifest(
        { ...manifest.scientific, status: 'cancelled' },
        entries,
      ),
    ).toThrow(/Interrupted/);
  });
});
