import { validateSeed } from '../algorithms/rng';
import { validateSettings } from '../algorithms/transitions';
import { validState } from '../models/singleVariable';
import type {
  LatticeCapture,
  LatticeSegmentSnapshot,
} from '../engine/latticeRun';
import { validateLatticeSettings } from '../engine/latticeRun';
import type { SegmentSnapshot, SmallCapture } from '../engine/protocol';
import { DIAGNOSTIC_CAPACITY } from '../observables/statisticalDiagnostics';

export const ARCHIVE_FORMAT = 'lattice-lab-experiments';
export const ARCHIVE_VERSION = 1;
export const MAX_ARCHIVE_RECORDS = 16;
export const MAX_ARCHIVE_BYTES = 12 * 1024 * 1024;
export const MAX_IMPORT_BYTES = 16 * 1024 * 1024;
export type Capture = SmallCapture | LatticeCapture;
export type ScientificDataset = {
  datasetId: string;
  groupId: string;
  source: {
    workspace: Capture['workspace'];
    runId: number;
    segmentId: number;
    workerVersion: number;
    captureUpdate: number;
    capturedAt: string;
    sourceRevision: string;
    rngAlgorithm: 'mulberry32-v1';
    seed: number;
    initialization: string;
    replayability: 'fresh-seeded' | 'snapshot-only';
  };
  capture: Capture;
};
export type Annotation = { name: string; notes: string };
export type ArchiveEntry = {
  /** Browser-local identity; never replaces the scientific provenance ID. */
  libraryId: string;
  scientific: ScientificDataset;
  annotation: Annotation;
};
export type PortableBundle = {
  format: typeof ARCHIVE_FORMAT;
  schemaVersion: typeof ARCHIVE_VERSION;
  exportedAt: string;
  records: { scientific: ScientificDataset; annotation: Annotation }[];
};

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}
function integer(value: unknown, label: string, min = 0): number {
  if (!Number.isSafeInteger(value) || (value as number) < min)
    throw new Error(`${label} must be a safe integer at least ${min}.`);
  return value as number;
}
function string(value: unknown, label: string, max = 512): string {
  if (typeof value !== 'string' || value.length > max)
    throw new Error(`${label} must be text of at most ${max} characters.`);
  return value;
}
function isoTimestamp(value: unknown, label: string): string {
  const timestamp = string(value, label, 64);
  const millis = Date.parse(timestamp);
  if (!Number.isFinite(millis) || new Date(millis).toISOString() !== timestamp)
    throw new Error(`${label} must be a valid ISO UTC timestamp.`);
  return timestamp;
}
function array(value: unknown, label: string, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max)
    throw new Error(`${label} must be an array of at most ${max} items.`);
  return value;
}
function finiteTree(value: unknown, depth = 0, budget = { nodes: 0 }): void {
  if (++budget.nodes > 400_000 || depth > 40)
    throw new Error('Dataset structure is too large or too deeply nested.');
  if (typeof value === 'number' && !Number.isFinite(value))
    throw new Error('Dataset contains a non-finite number.');
  if (
    value === undefined ||
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    typeof value === 'number'
  )
    return;
  if (Array.isArray(value)) {
    if (value.length > DIAGNOSTIC_CAPACITY)
      throw new Error('Dataset array exceeds the supported record capacity.');
    for (const item of value) finiteTree(item, depth + 1, budget);
    return;
  }
  if (
    typeof value !== 'object' ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    throw new Error('Dataset must contain plain JSON values.');
  for (const [key, item] of Object.entries(value)) {
    if (['__proto__', 'prototype', 'constructor'].includes(key))
      throw new Error('Dataset contains an unsafe property name.');
    finiteTree(item, depth + 1, budget);
  }
}
function histogram(value: unknown, count: number, label: string): void {
  const h = object(value, label);
  if (typeof h.min !== 'number' || typeof h.max !== 'number' || h.min >= h.max)
    throw new Error(`${label} has invalid bounds.`);
  const bins = array(h.bins, `${label}.bins`, 256);
  const sum = bins.reduce<number>(
    (n, bin) => n + integer(bin, `${label} bin`),
    0,
  );
  if (
    sum +
      integer(h.below, `${label}.below`) +
      integer(h.above, `${label}.above`) !==
    count
  )
    throw new Error(`${label} count does not match retained measurements.`);
}
function moments(value: unknown, count: number, label: string): void {
  const m = object(value, label);
  if (integer(m.count, `${label}.count`) !== count)
    throw new Error(`${label} count does not match its segment.`);
  for (const key of ['mean', 'variance', 'secondMoment'])
    if (m[key] !== null && typeof m[key] !== 'number')
      throw new Error(`${label}.${key} must be numeric or null.`);
  if (count === 0 && m.mean !== null)
    throw new Error(`${label} has a mean without measurements.`);
  if (count > 0 && (m.mean === null || m.secondMoment === null))
    throw new Error(`${label} is missing measured numeric moments.`);
}
function diagnosticRecord(value: unknown, count: number): void {
  const r = object(value, 'Diagnostic record');
  const n = integer(r.count, 'Diagnostic record count');
  if (
    n !== Math.min(count, DIAGNOSTIC_CAPACITY) ||
    integer(r.firstMeasurement, 'First diagnostic observation') !==
      (n ? count - n + 1 : 0)
  )
    throw new Error(
      'Diagnostic coverage does not match the segment sample count.',
    );
  for (const key of ['m', 'absM', 'e']) {
    const values = array(r[key], `Diagnostic ${key}`, DIAGNOSTIC_CAPACITY);
    if (values.length !== n || values.some((v) => typeof v !== 'number'))
      throw new Error(`Diagnostic ${key} values do not match coverage.`);
  }
  const m = r.m as number[],
    absM = r.absM as number[];
  for (let i = 0; i < n; i++)
    if (Math.abs(absM[i]! - Math.abs(m[i]!)) > 1e-12)
      throw new Error('Diagnostic |m| does not match signed m.');
}
function diagnosticSummaries(
  value: unknown,
  count: number,
  cadence: unknown,
): void {
  const summaries = object(value, 'Diagnostic summaries');
  for (const key of ['m', 'absM', 'e']) {
    const d = object(summaries[key], `Diagnostic ${key}`);
    if (
      ![
        'insufficient',
        'constant',
        'unresolved',
        'drift',
        'window-sensitive',
        'ok',
      ].includes(String(d.status))
    )
      throw new Error(`Diagnostic ${key} has an unknown status.`);
    const total = integer(d.total, `Diagnostic ${key} total`);
    const used = integer(d.used, `Diagnostic ${key} used`);
    if (
      total > count ||
      used > Math.min(total, DIAGNOSTIC_CAPACITY) ||
      integer(d.evicted, `Diagnostic ${key} evicted`) !== total - used ||
      JSON.stringify(d.cadence) !== JSON.stringify(cadence)
    )
      throw new Error(`Diagnostic ${key} coverage or cadence is inconsistent.`);
    array(d.acf, `Diagnostic ${key} ACF`, 129);
    array(d.blocking, `Diagnostic ${key} blocking`, 16);
    if (
      (d.status === 'unresolved' ||
        d.status === 'drift' ||
        d.status === 'constant' ||
        d.status === 'insufficient') &&
      (d.tauMeasurements !== null || d.standardError !== null)
    )
      throw new Error(`Diagnostic ${key} quotes unsupported uncertainty.`);
  }
}
function validateSmall(c: SmallCapture): void {
  const s = object(c.segment, 'Small segment') as unknown as SegmentSnapshot;
  validateSettings({ model: s.model, sampler: s.sampler });
  if (c.currentState !== null) {
    const value = c.currentState.value;
    if (s.model.kind === 'scalar') {
      if (
        value !== null &&
        (!Array.isArray(value) ||
          value.length !== s.model.parameters.domain.vertices.length ||
          value.some((component) => typeof component !== 'number'))
      )
        throw new Error('Current scalar configuration has invalid geometry.');
    } else if (value !== null && !validState(s.model, value as number))
      throw new Error('Current configuration is invalid for the model.');
    if (value === null && s.updates > 0)
      throw new Error('Current configuration is missing after updates.');
  }
  const count = integer(s.moments?.count, 'Small measurement count');
  const updates = integer(s.updates, 'Small segment updates');
  if (
    integer(s.warmupUpdates, 'Small warm-up updates') > updates ||
    count !== updates - s.warmupUpdates
  )
    throw new Error('Small segment measurement bookkeeping is inconsistent.');
  if (integer(s.startUpdate, 'Small start update') + updates > c.captureUpdate)
    throw new Error('Small segment extends beyond capture update.');
  moments(s.moments, count, 'Small moments');
  histogram(s.histogram, count, 'Small histogram');
  const transitions = array(s.trajectory, 'Small transitions', 1000);
  for (let i = 0; i < transitions.length; i++) {
    const t = object(transitions[i], 'Small transition');
    const local = integer(t.segmentUpdate, 'Transition segment update', 1);
    if (
      integer(t.update, 'Transition update', 1) !== s.startUpdate + local ||
      local > updates ||
      (i > 0 &&
        local <=
          integer(
            object(transitions[i - 1], 'Previous transition').segmentUpdate,
            'Previous segment update',
          ))
    )
      throw new Error('Small transition indices are inconsistent.');
  }
  if (s.model.kind === 'ising') {
    diagnosticRecord(c.diagnosticRecord, count);
    const ising = object(s.ising, 'Graph Ising aggregates');
    diagnosticSummaries(
      ising.diagnostics,
      count,
      s.sampler.kind === 'direct'
        ? { kind: 'direct' }
        : { kind: 'local', sites: s.model.parameters.domain.vertices.length },
    );
    const counts = array(ising.counts, 'Configuration counts', 16);
    if (
      counts.reduce<number>(
        (n, x) => n + integer(x, 'Configuration count'),
        0,
      ) !== count
    )
      throw new Error('Graph configuration counts do not match measurements.');
    for (const [key, observable] of Object.entries(
      object(ising.observables, 'Graph observables'),
    ))
      moments(
        object(observable, `Graph ${key}`).moments,
        count,
        `Graph ${key}`,
      );
  } else if (c.diagnosticRecord !== null)
    throw new Error('Non-Ising segment has an Ising diagnostic ring.');
  if (s.model.kind === 'scalar') {
    const scalar = object(s.scalar, 'Scalar aggregates');
    const targets = object(scalar.targets, 'Scalar targets');
    for (const [key, target] of Object.entries(targets)) {
      const t = object(target, `Scalar target ${key}`);
      moments(t.moments, count, `Scalar target ${key}`);
      histogram(t.histogram, count, `Scalar target ${key}`);
    }
    const scalarTransitions = array(
      scalar.trajectory,
      'Scalar transitions',
      1000,
    );
    for (let i = 0; i < scalarTransitions.length; i++) {
      const t = object(scalarTransitions[i], 'Scalar transition');
      const local = integer(t.segmentUpdate, 'Scalar segment update', 1);
      if (
        integer(t.update, 'Scalar update', 1) !== s.startUpdate + local ||
        local > updates ||
        (i > 0 &&
          local <=
            integer(
              object(scalarTransitions[i - 1], 'Previous transition')
                .segmentUpdate,
              'Previous segment update',
            ))
      )
        throw new Error('Scalar transition indices are inconsistent.');
    }
  }
}
function validateLattice(c: LatticeCapture): void {
  const s = object(
    c.segment,
    'Lattice segment',
  ) as unknown as LatticeSegmentSnapshot;
  validateLatticeSettings(s.settings);
  const count = integer(s.samples, 'Lattice sample count');
  const updates = integer(s.updates, 'Lattice segment updates');
  const { lx, ly } = s.settings.parameters;
  const expected = Math.max(
    0,
    Math.floor(
      (Math.floor(updates / (lx * ly)) - s.settings.warmupSweeps) /
        s.settings.strideSweeps,
    ),
  );
  if (
    count !== expected ||
    integer(s.warmupUpdates, 'Lattice warm-up') !==
      Math.min(updates, s.settings.warmupSweeps * lx * ly)
  )
    throw new Error('Lattice sample schedule does not match updates.');
  if (
    integer(s.startUpdate, 'Lattice start update') + updates >
    c.captureUpdate
  )
    throw new Error('Lattice segment extends beyond capture update.');
  for (const key of ['m', 'absM', 'e', 'm2', 'm4', 'e2', 'gx', 'gy'] as const)
    moments(s[key], count, `Lattice ${key}`);
  histogram(s.mHistogram, count, 'Lattice m histogram');
  histogram(s.eHistogram, count, 'Lattice e histogram');
  diagnosticRecord(c.diagnosticRecord, count);
  diagnosticSummaries(s.diagnostics, count, {
    kind: 'lattice',
    sweepsPerObservation: s.settings.strideSweeps,
  });
  const measurements = array(s.measurements, 'Lattice plot measurements', 1000);
  if (
    integer(s.discardedMeasurements, 'Discarded plot measurements') +
      measurements.length !==
    count
  )
    throw new Error('Lattice plot-series coverage is inconsistent.');
  for (let i = 0; i < measurements.length; i++) {
    const row = object(measurements[i], 'Lattice plot measurement');
    const index = s.discardedMeasurements + i + 1;
    const update =
      s.startUpdate +
      lx * ly * (s.settings.warmupSweeps + index * s.settings.strideSweeps);
    if (
      row.update !== update ||
      row.sweep !== update / (lx * ly) ||
      row.absM !== Math.abs(row.m as number)
    )
      throw new Error(
        'Lattice plot-series coordinates or values are inconsistent.',
      );
    const rawIndex = index - c.diagnosticRecord.firstMeasurement;
    if (
      rawIndex >= 0 &&
      rawIndex < c.diagnosticRecord.count &&
      (row.m !== c.diagnosticRecord.m[rawIndex] ||
        row.absM !== c.diagnosticRecord.absM[rawIndex] ||
        row.e !== c.diagnosticRecord.e[rawIndex])
    )
      throw new Error('Lattice plot series and diagnostic ring disagree.');
  }
  if (c.currentState !== null) {
    const state = object(c.currentState, 'Current lattice state');
    const spins = array(state.spins, 'Current spins', lx * ly);
    if (
      spins.length !== lx * ly ||
      spins.some((spin) => spin !== 1 && spin !== -1)
    )
      throw new Error(
        'Current lattice spin array has invalid geometry or values.',
      );
  }
}
export function validateScientific(value: unknown): ScientificDataset {
  finiteTree(value);
  const data = object(value, 'Scientific dataset');
  if (
    !string(data.datasetId, 'Dataset ID', 128) ||
    !string(data.groupId, 'Group ID', 128)
  )
    throw new Error('Dataset and group IDs cannot be empty.');
  const source = object(data.source, 'Source');
  if (source.workspace !== 'small' && source.workspace !== 'lattice')
    throw new Error('Unknown source workspace.');
  integer(source.runId, 'Source run ID', 1);
  integer(source.segmentId, 'Source segment ID', 1);
  integer(source.workerVersion, 'Worker version');
  integer(source.captureUpdate, 'Capture update');
  isoTimestamp(source.capturedAt, 'Capture time');
  string(source.sourceRevision, 'Source revision', 128);
  if (source.rngAlgorithm !== 'mulberry32-v1')
    throw new Error('Unsupported RNG convention.');
  validateSeed(source.seed as number);
  string(source.initialization, 'Initialization', 256);
  if (
    source.replayability !== 'fresh-seeded' &&
    source.replayability !== 'snapshot-only'
  )
    throw new Error('Unknown replayability status.');
  const capture = object(data.capture, 'Worker capture') as unknown as Capture;
  if (
    capture.workspace !== source.workspace ||
    capture.runId !== source.runId ||
    capture.version !== source.workerVersion ||
    capture.captureUpdate !== source.captureUpdate ||
    capture.segment?.id !== source.segmentId ||
    capture.seed !== source.seed
  )
    throw new Error('Source provenance disagrees with worker capture.');
  if (
    source.initialization !==
    (capture.workspace === 'lattice'
      ? capture.initialization
      : capture.segment.initialization)
  )
    throw new Error('Source initialization disagrees with worker capture.');
  integer(capture.runId, 'Capture run ID', 1);
  integer(capture.version, 'Capture version');
  integer(capture.captureUpdate, 'Capture update');
  if (
    capture.currentState !== null &&
    capture.currentState?.update !== capture.captureUpdate
  )
    throw new Error('Current configuration has the wrong capture update.');
  if (
    capture.currentState !== null &&
    capture.segment.startUpdate + capture.segment.updates !==
      capture.captureUpdate
  )
    throw new Error('Historical segment cannot carry a current configuration.');
  if (capture.workspace === 'small') validateSmall(capture);
  else if (capture.workspace === 'lattice') validateLattice(capture);
  else throw new Error('Unsupported capture workspace.');
  if (
    source.replayability === 'fresh-seeded' &&
    (capture.segment.id !== 1 || capture.segment.startUpdate !== 0)
  )
    throw new Error('Warm-start segment cannot be labeled fresh-seeded.');
  return value as ScientificDataset;
}
function validateAnnotation(value: unknown): Annotation {
  const a = object(value, 'Annotation');
  const name = string(a.name, 'Name', 120).trim();
  if (!name) throw new Error('Record name cannot be empty.');
  return { name, notes: string(a.notes, 'Notes', 2000) };
}
function bytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}
function plainCopy<T>(value: T): T {
  finiteTree(value);
  return JSON.parse(JSON.stringify(value)) as T;
}
function freezeTree<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezeTree(child);
    Object.freeze(value);
  }
  return value;
}
export function createArchiveEntry(
  capture: Capture,
  groupId: string,
  name: string,
): ArchiveEntry {
  const scientific: ScientificDataset = plainCopy({
    datasetId: crypto.randomUUID(),
    groupId,
    source: {
      workspace: capture.workspace,
      runId: capture.runId,
      segmentId: capture.segment.id,
      workerVersion: capture.version,
      captureUpdate: capture.captureUpdate,
      capturedAt: new Date().toISOString(),
      sourceRevision: import.meta.env.VITE_GIT_SHA || 'unknown',
      rngAlgorithm: 'mulberry32-v1',
      seed: capture.seed,
      initialization:
        capture.workspace === 'lattice'
          ? capture.initialization
          : capture.segment.initialization,
      replayability:
        capture.segment.id === 1 && capture.segment.startUpdate === 0
          ? 'fresh-seeded'
          : 'snapshot-only',
    },
    capture,
  });
  validateScientific(scientific);
  return {
    libraryId: crypto.randomUUID(),
    scientific: freezeTree(scientific),
    annotation: validateAnnotation({ name, notes: '' }),
  };
}
export function addArchiveEntries(
  existing: readonly ArchiveEntry[],
  additions: readonly ArchiveEntry[],
): ArchiveEntry[] {
  const next = [...existing, ...additions];
  if (next.length > MAX_ARCHIVE_RECORDS)
    throw new Error(
      `Archive limit is ${MAX_ARCHIVE_RECORDS} records. Export or remove records before saving more.`,
    );
  if (bytes(next) > MAX_ARCHIVE_BYTES)
    throw new Error(
      'Archive limit is 12 MiB. Export or remove records before saving more.',
    );
  return next;
}
export function exportBundle(records: readonly ArchiveEntry[]): string {
  const bundle: PortableBundle = {
    format: ARCHIVE_FORMAT,
    schemaVersion: ARCHIVE_VERSION,
    exportedAt: new Date().toISOString(),
    records: records.map(({ scientific, annotation }) => ({
      scientific,
      annotation,
    })),
  };
  return JSON.stringify(bundle);
}
export function importBundle(
  existing: readonly ArchiveEntry[],
  input: string,
): ArchiveEntry[] {
  if (new TextEncoder().encode(input).length > MAX_IMPORT_BYTES)
    throw new Error('Import exceeds the 16 MiB file limit.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    throw new Error('File is not valid JSON.');
  }
  const bundle = object(parsed, 'Experiment bundle');
  if (bundle.format !== ARCHIVE_FORMAT)
    throw new Error('Not a Lattice Lab experiment bundle.');
  if (bundle.schemaVersion !== ARCHIVE_VERSION)
    throw new Error('Unsupported experiment schema version.');
  isoTimestamp(bundle.exportedAt, 'Export time');
  const rows = array(bundle.records, 'Bundle records', MAX_ARCHIVE_RECORDS);
  const additions = rows.map((row) => {
    const record = object(row, 'Bundle record');
    const scientific = validateScientific(record.scientific);
    const annotation = validateAnnotation(record.annotation);
    return {
      libraryId: crypto.randomUUID(),
      scientific: freezeTree(plainCopy(scientific)),
      annotation,
    };
  });
  return addArchiveEntries(existing, additions);
}
export function renameEntry(
  entry: ArchiveEntry,
  annotation: Annotation,
): ArchiveEntry {
  return { ...entry, annotation: validateAnnotation(annotation) };
}
