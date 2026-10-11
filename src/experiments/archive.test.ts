import { describe, expect, it } from 'vitest';
import { SimulationRun } from '../engine/simulationEngine';
import { ScalarRun } from '../engine/scalarRun';
import { LatticeRun } from '../engine/latticeRun';
import type { LatticeConfiguration } from '../engine/latticeRun';
import { defaultModel } from '../models/singleVariable';
import { scalarPreset } from '../models/scalarField';
import { DIAGNOSTIC_CAPACITY } from '../observables/statisticalDiagnostics';
import {
  addArchiveEntries,
  createArchiveEntry,
  exportBundle,
  importBundle,
  MAX_ARCHIVE_RECORDS,
  renameEntry,
} from './archive';
import {
  exportMeasurementMetadata,
  exportMeasurementsCsv,
  exportSummaryCsv,
} from './export';
import { commonDescriptors } from './comparison';

function small(kind: 'gaussian' | 'spin' | 'binomial' | 'ising' | 'scalar') {
  const configuration = {
    model: kind === 'scalar' ? scalarPreset('baseline') : defaultModel(kind),
    sampler: { kind: 'direct' as const },
    seed: 1234,
  };
  const run =
    kind === 'scalar'
      ? new ScalarRun(1, configuration)
      : new SimulationRun(1, configuration);
  run.advance(80);
  return run;
}
function lattice() {
  const configuration: LatticeConfiguration = {
    parameters: {
      lx: 2,
      ly: 2,
      periodicX: true,
      periodicY: false,
      jx: -0.8,
      jy: 0.6,
      field: 0.2,
      temperature: 2.5,
    },
    sampler: 'heat-bath',
    warmupSweeps: 2,
    strideSweeps: 3,
    initialization: 'minus',
    seed: 5678,
  };
  return new LatticeRun(1, configuration);
}
describe('M3b1 immutable experiment archive', () => {
  it.each(['gaussian', 'spin', 'binomial', 'ising', 'scalar'] as const)(
    'captures %s without changing its worker state or subsequent seeded updates',
    (kind) => {
      const run = small(kind);
      const control = small(kind);
      const before = run.snapshot();
      const capture = run.capture(1);
      expect(run.snapshot()).toEqual(before);
      const entry = createArchiveEntry(capture, 'test-group', `${kind} sample`);
      expect(entry.scientific.capture.segment.id).toBe(1);
      expect(entry.scientific.source.seed).toBe(1234);
      expect(entry.scientific.source.replayability).toBe('fresh-seeded');
      expect(Object.isFrozen(entry.scientific.capture.segment)).toBe(true);
      expect(capture.diagnosticRecord?.count ?? null).toBe(
        kind === 'ising' ? 80 : null,
      );
      expect(importBundle([], exportBundle([entry]))[0]!.scientific).toEqual(
        entry.scientific,
      );
      run.advance(1);
      control.advance(1);
      expect(run.snapshot()).toEqual(control.snapshot());
      expect(entry.scientific.capture.segment).toEqual(capture.segment);
    },
  );
  it('preserves historical Small Systems parameters without claiming their final state is known', () => {
    const run = small('gaussian') as SimulationRun;
    run.changeSettings({
      model: { kind: 'gaussian', parameters: { a: 3, h: 1 } },
      sampler: { kind: 'direct' },
    });
    run.advance(20);
    const old = run.capture(1),
      current = run.capture(2);
    expect(old.segment.model).toEqual(defaultModel('gaussian'));
    expect(old.currentState).toBeNull();
    expect(current.currentState?.update).toBe(100);
    expect(
      createArchiveEntry(current, 'g', 'changed').scientific.source
        .replayability,
    ).toBe('snapshot-only');
    expect(old.segment.moments.count).toBe(80);
    expect(current.segment.moments.count).toBe(20);
  });
  it('captures lattice schedule, raw ring, historical segment and typed spins faithfully', () => {
    const run = lattice();
    run.advance(4 * (2 + 3 * 80));
    const before = run.snapshot();
    const capture = run.capture(1);
    expect(run.snapshot()).toEqual(before);
    expect(capture.diagnosticRecord.count).toBe(80);
    expect(capture.segment.samples).toBe(80);
    expect(capture.segment.measurements).toHaveLength(80);
    expect(capture.currentState?.spins).toHaveLength(4);
    const entry = createArchiveEntry(capture, 'lattice-group', '2x2');
    expect(entry.scientific.capture.workspace).toBe('lattice');
    expect(entry.scientific.source.initialization).toBe('minus');
    run.changeSettings({
      ...before.configuration,
      parameters: {
        ...before.configuration.parameters,
        field: -0.3,
      },
    });
    run.advance(4 * 5);
    const old = run.capture(1);
    expect(old.currentState).toBeNull();
    expect(old.segment.settings.parameters.field).toBe(0.2);
    expect(
      createArchiveEntry(run.capture(2), 'lattice-group', 'warm start')
        .scientific.source.replayability,
    ).toBe('snapshot-only');
    expect(entry.scientific.capture).toEqual(capture);
  });
  it('retains the complete 8192 diagnostic window while disclosing 1000 plotted records', () => {
    const run = small('ising');
    for (let i = 0; i < 8; i++) run.advance(1024);
    const c = run.capture(1);
    expect(c.diagnosticRecord?.count).toBe(DIAGNOSTIC_CAPACITY);
    expect(c.diagnosticRecord?.firstMeasurement).toBe(81);
    expect(c.segment.trajectory).toHaveLength(1000);
    expect(c.segment.ising?.diagnostics.m.used).toBe(DIAGNOSTIC_CAPACITY);
    expect('records' in run.snapshot().segments[0]!.ising!.diagnostics.m).toBe(
      false,
    );
    const box = lattice();
    box.advance(8192);
    box.advance(4 * (2 + 3 * 1002) - 8192);
    const latticeCapture = box.capture(1);
    expect(latticeCapture.segment.measurements).toHaveLength(1000);
    expect(latticeCapture.segment.discardedMeasurements).toBe(2);
    expect(latticeCapture.diagnosticRecord.count).toBe(1002);
    expect(
      createArchiveEntry(latticeCapture, 'l', 'evicted').scientific.capture,
    ).toEqual(latticeCapture);
  });
  it('round trips numerical values, IDs, annotations and duplicate scientific identities', () => {
    const entry = createArchiveEntry(
      lattice().capture(1),
      'group-a',
      'Temperature "scan", first',
    );
    const annotated = renameEntry(entry, {
      name: entry.annotation.name,
      notes: 'line 1\nline 2',
    });
    const portable = exportBundle([annotated]);
    const imported = importBundle([], portable);
    expect(imported[0]!.scientific).toEqual(annotated.scientific);
    expect(imported[0]!.annotation).toEqual(annotated.annotation);
    expect(imported[0]!.libraryId).not.toBe(entry.libraryId);
    const duplicate = importBundle(imported, portable);
    expect(duplicate).toHaveLength(2);
    expect(duplicate[0]!.scientific.datasetId).toBe(
      duplicate[1]!.scientific.datasetId,
    );
    expect(duplicate[0]!.libraryId).not.toBe(duplicate[1]!.libraryId);
  });
  it('rejects malformed versions, physical geometry, inconsistent counts and nonfinite data atomically', () => {
    const entry = createArchiveEntry(lattice().capture(1), 'group-a', 'valid');
    const base = JSON.parse(exportBundle([entry]));
    const badVersion = structuredClone(base);
    badVersion.schemaVersion = 2;
    expect(() => importBundle([entry], JSON.stringify(badVersion))).toThrow(
      /version/,
    );
    const badGeometry = structuredClone(base);
    badGeometry.records[0].scientific.capture.segment.settings.parameters.lx = 1;
    expect(() => importBundle([entry], JSON.stringify(badGeometry))).toThrow();
    const badSampler = structuredClone(base);
    badSampler.records[0].scientific.capture.segment.settings.sampler =
      'direct';
    expect(() => importBundle([entry], JSON.stringify(badSampler))).toThrow();
    const missing = structuredClone(base);
    delete missing.records[0].scientific.source;
    expect(() => importBundle([entry], JSON.stringify(missing))).toThrow();
    const badCount = structuredClone(base);
    badCount.records[0].scientific.capture.segment.samples = 99;
    expect(() => importBundle([entry], JSON.stringify(badCount))).toThrow();
    const badCoverage = structuredClone(base);
    badCoverage.records[0].scientific.capture.diagnosticRecord.firstMeasurement = 2;
    expect(() => importBundle([entry], JSON.stringify(badCoverage))).toThrow();
    const scalarState = JSON.parse(
      exportBundle([
        createArchiveEntry(small('scalar').capture(1), 'g', 'scalar'),
      ]),
    );
    scalarState.records[0].scientific.capture.currentState.value = [1, 2];
    expect(() => importBundle([entry], JSON.stringify(scalarState))).toThrow(
      /scalar configuration.*geometry/,
    );
    const badNumber = JSON.parse(
      exportBundle([
        createArchiveEntry(small('ising').capture(1), 'g', 'observed'),
      ]),
    );
    badNumber.records[0].scientific.capture.segment.moments.mean = Infinity;
    expect(() => importBundle([entry], JSON.stringify(badNumber))).toThrow();
    expect(entry.scientific.capture.segment).toEqual(
      lattice().capture(1).segment,
    );
    expect(() => importBundle([entry], '{bad')).toThrow(/JSON/);
    expect(() => importBundle([entry], 'x'.repeat(17 * 1024 * 1024))).toThrow(
      /16 MiB/,
    );
  });
  it('caps record count and never compares dimensionless graph E with physical lattice e', () => {
    const graph = createArchiveEntry(small('ising').capture(1), 'g', 'graph');
    const box = createArchiveEntry(lattice().capture(1), 'l', 'box');
    expect(commonDescriptors([graph, box])).toEqual([]);
    expect(() =>
      addArchiveEntries(Array(MAX_ARCHIVE_RECORDS).fill(graph), [box]),
    ).toThrow(/limit/);
  });
  it('exports numeric observations with indices, precision, provenance and escaped CSV', () => {
    const run = lattice();
    run.advance(4 * (2 + 3 * 3));
    const entry = createArchiveEntry(run.capture(1), 'group', 'quoted, "name"');
    const csv = exportMeasurementsCsv([entry]);
    expect(csv).toContain('observation_index,update,nominal_sweep,value');
    expect(csv).toContain(',1,20,5,');
    expect(csv).toContain(',3,44,11,');
    expect(csv).toContain(String(run.capture(1).diagnosticRecord.m[0]));
    const metadata = JSON.parse(exportMeasurementMetadata([entry]));
    expect(metadata.datasets[0].datasetId).toBe(entry.scientific.datasetId);
    expect(metadata.datasets[0].rawCoverage.count).toBe(3);
    expect(exportSummaryCsv([entry])).toContain('"quoted, ""name"""');
  });
});
