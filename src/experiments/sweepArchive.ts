import {
  ARCHIVE_FORMAT,
  MAX_ARCHIVE_BYTES,
  MAX_IMPORT_BYTES,
  MAX_ARCHIVE_RECORDS,
  archiveBytes,
  exportBundle,
  importBundle,
} from './archive';
import type { ArchiveEntry } from './archive';
import { pointConfiguration, validateSweepPlan } from './sweepPlan';
import type { SweepPlan } from './sweepPlan';

export const SWEEP_BUNDLE_VERSION = 2;
export const SWEEP_MANIFEST_VERSION = 1;
export type SweepPointStatus =
  'completed' | 'discarded-partial' | 'not-started';
export type SweepPointManifest = {
  index: number;
  value: number;
  seed: number;
  parameters: ReturnType<typeof pointConfiguration>['parameters'];
  requestedUpdates: number;
  actualUpdates: number;
  measurements: number;
  status: SweepPointStatus;
  datasetId: string | null;
};
export type SweepManifest = {
  manifestVersion: typeof SWEEP_MANIFEST_VERSION;
  sweepId: string;
  name: string;
  description: string;
  question: string;
  plan: SweepPlan;
  status: 'completed' | 'cancelled' | 'error';
  finishedAt: string;
  points: SweepPointManifest[];
};
export type SavedSweep = {
  localId: string;
  scientific: SweepManifest;
  /** Browser-local pairing disambiguates repeated imports of one scientific ID. */
  sourceRecordIds: { datasetId: string; libraryId: string }[];
};

export function sweepCapacity(
  entries: readonly ArchiveEntry[],
  sweeps: readonly SavedSweep[],
  plan: SweepPlan,
): { available: boolean; recordsRemaining: number; bytesRemaining: number } {
  const budget = validateSweepPlan(plan);
  const recordsRemaining = MAX_ARCHIVE_RECORDS - entries.length;
  const bytesRemaining = MAX_ARCHIVE_BYTES - archiveBytes({ entries, sweeps });
  return {
    available:
      recordsRemaining >= plan.values.length &&
      bytesRemaining >= budget.estimatedArchiveBytes,
    recordsRemaining,
    bytesRemaining,
  };
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function validTime(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const millis = Date.parse(value);
  return Number.isFinite(millis) && new Date(millis).toISOString() === value;
}
export function validateSweepManifest(
  value: unknown,
  entries: readonly ArchiveEntry[],
): SweepManifest {
  // Cross-check each point against the immutable plan and saved capture IDs;
  // cancellation may leave a suffix of incomplete points, never a gap.
  const m = object(value, 'Sweep manifest');
  if (m.manifestVersion !== SWEEP_MANIFEST_VERSION)
    throw new Error('Unsupported sweep manifest version.');
  if (typeof m.sweepId !== 'string' || !m.sweepId || m.sweepId.length > 128)
    throw new Error('Invalid sweep ID.');
  if (!validTime(m.finishedAt))
    throw new Error('Invalid sweep completion time.');
  if (!['completed', 'cancelled', 'error'].includes(String(m.status)))
    throw new Error('Invalid sweep completion status.');
  const plan = m.plan as SweepPlan;
  const budget = validateSweepPlan(plan);
  if (
    m.name !== plan.name ||
    m.description !== plan.description ||
    m.question !== plan.question
  )
    throw new Error('Sweep description disagrees with its plan.');
  if (!Array.isArray(m.points) || m.points.length !== plan.values.length)
    throw new Error('Sweep point count disagrees with its plan.');
  let incompleteSeen = false;
  for (let i = 0; i < m.points.length; i++) {
    const point = object(m.points[i], `Sweep point ${i + 1}`);
    const configuration = pointConfiguration(plan, i);
    if (
      point.index !== i ||
      point.value !== plan.values[i] ||
      point.seed !== configuration.seed ||
      JSON.stringify(point.parameters) !==
        JSON.stringify(configuration.parameters) ||
      point.requestedUpdates !== budget.pointUpdates[i]
    )
      throw new Error(`Sweep point ${i + 1} conflicts with its plan or seed.`);
    if (
      !Number.isSafeInteger(point.actualUpdates) ||
      (point.actualUpdates as number) < 0 ||
      (point.actualUpdates as number) > budget.pointUpdates[i]! ||
      !Number.isSafeInteger(point.measurements) ||
      (point.measurements as number) < 0 ||
      (point.measurements as number) > plan.measurementsPerPoint
    )
      throw new Error(`Sweep point ${i + 1} has invalid work counts.`);
    const status = point.status;
    if (status === 'completed') {
      if (incompleteSeen)
        throw new Error('Completed points must be sequential.');
      if (
        point.actualUpdates !== point.requestedUpdates ||
        point.measurements !== plan.measurementsPerPoint ||
        typeof point.datasetId !== 'string'
      )
        throw new Error('Completed sweep point has missing measurements.');
      const matches = entries.filter(
        (entry) => entry.scientific.datasetId === point.datasetId,
      );
      if (matches.length !== 1)
        throw new Error('Sweep point dataset is missing or ambiguous.');
      const scientific = matches[0]!.scientific;
      const capture = scientific.capture;
      if (
        scientific.groupId !== m.sweepId ||
        scientific.source.workspace !== 'lattice' ||
        capture.runId !== i + 1 ||
        scientific.source.replayability !== 'fresh-seeded' ||
        scientific.source.seed !== point.seed ||
        capture.workspace !== 'lattice' ||
        capture.segment.id !== 1 ||
        capture.segment.startUpdate !== 0 ||
        capture.segment.updates !== point.actualUpdates ||
        capture.segment.samples !== point.measurements ||
        capture.diagnosticRecord.count !== point.measurements ||
        capture.diagnosticRecord.firstMeasurement !== 1 ||
        capture.initialization !== configuration.initialization ||
        capture.segment.settings.sampler !== configuration.sampler ||
        capture.segment.settings.warmupSweeps !== configuration.warmupSweeps ||
        capture.segment.settings.strideSweeps !== configuration.strideSweeps ||
        JSON.stringify(capture.segment.settings.parameters) !==
          JSON.stringify(configuration.parameters)
      )
        throw new Error('Sweep point dataset conflicts with its provenance.');
    } else if (status === 'discarded-partial') {
      if (
        incompleteSeen ||
        point.datasetId !== null ||
        point.actualUpdates === 0 ||
        point.actualUpdates === point.requestedUpdates
      )
        throw new Error('Invalid discarded partial sweep point.');
      incompleteSeen = true;
      const { lx, ly } = configuration.parameters;
      const sweeps = Math.floor((point.actualUpdates as number) / (lx * ly));
      const count = Math.max(
        0,
        Math.floor(
          (sweeps - configuration.warmupSweeps) / configuration.strideSweeps,
        ),
      );
      if (point.measurements !== count)
        throw new Error('Partial point measurement count is inconsistent.');
    } else if (status === 'not-started') {
      if (
        point.datasetId !== null ||
        point.actualUpdates !== 0 ||
        point.measurements !== 0
      )
        throw new Error('Not-started point has numerical data.');
      incompleteSeen = true;
    } else throw new Error('Unknown sweep point status.');
  }
  if (m.status === 'completed' && incompleteSeen)
    throw new Error('Completed sweep has incomplete points.');
  if (m.status !== 'completed' && !incompleteSeen)
    throw new Error('Interrupted sweep cannot claim all points completed.');
  return value as SweepManifest;
}

export function saveSweep(
  manifest: SweepManifest,
  entries: readonly ArchiveEntry[],
): SavedSweep {
  validateSweepManifest(manifest, entries);
  return {
    localId: crypto.randomUUID(),
    scientific: freeze(structuredClone(manifest)),
    sourceRecordIds: freeze(
      manifest.points.flatMap((point) => {
        if (!point.datasetId) return [];
        const entry = entries.find(
          (record) => record.scientific.datasetId === point.datasetId,
        )!;
        return [{ datasetId: point.datasetId, libraryId: entry.libraryId }];
      }),
    ),
  };
}

export function createSweepManifest(
  plan: SweepPlan,
  sweepId: string,
  status: SweepManifest['status'],
  completed: readonly {
    index: number;
    datasetId: string;
    updates: number;
    measurements: number;
  }[],
  partial: { index: number; updates: number; measurements: number } | null,
  entries: readonly ArchiveEntry[],
): SavedSweep {
  const budget = validateSweepPlan(plan);
  const byIndex = new Map(completed.map((point) => [point.index, point]));
  const manifest: SweepManifest = {
    manifestVersion: SWEEP_MANIFEST_VERSION,
    sweepId,
    name: plan.name,
    description: plan.description,
    question: plan.question,
    plan: structuredClone(plan),
    status,
    finishedAt: new Date().toISOString(),
    points: plan.values.map((value, index) => {
      const configuration = pointConfiguration(plan, index);
      const done = byIndex.get(index);
      return {
        index,
        value,
        seed: configuration.seed,
        parameters: configuration.parameters,
        requestedUpdates: budget.pointUpdates[index]!,
        actualUpdates:
          done?.updates ?? (partial?.index === index ? partial.updates : 0),
        measurements:
          done?.measurements ??
          (partial?.index === index ? partial.measurements : 0),
        status: done
          ? 'completed'
          : partial?.index === index && partial.updates > 0
            ? 'discarded-partial'
            : 'not-started',
        datasetId: done?.datasetId ?? null,
      };
    }),
  };
  return saveSweep(manifest, entries);
}

export function exportSweepBundle(
  sweep: SavedSweep,
  entries: readonly ArchiveEntry[],
): string {
  const sourceIds = new Set(
    sweep.sourceRecordIds.map((source) => source.libraryId),
  );
  const records = entries.filter((entry) => sourceIds.has(entry.libraryId));
  validateSweepManifest(sweep.scientific, records);
  const v1 = JSON.parse(exportBundle(records));
  return JSON.stringify({
    ...v1,
    schemaVersion: SWEEP_BUNDLE_VERSION,
    sweeps: [sweep.scientific],
  });
}

export function importPortableBundle(
  existingEntries: readonly ArchiveEntry[],
  existingSweeps: readonly SavedSweep[],
  input: string,
): { entries: ArchiveEntry[]; sweeps: SavedSweep[] } {
  if (new TextEncoder().encode(input).length > MAX_IMPORT_BYTES)
    throw new Error('Import exceeds the 16 MiB file limit.');
  let value: unknown;
  try {
    value = JSON.parse(input);
  } catch {
    throw new Error('File is not valid JSON.');
  }
  const bundle = object(value, 'Experiment bundle');
  if (bundle.format !== ARCHIVE_FORMAT)
    throw new Error('Not a Lattice Lab experiment bundle.');
  if (bundle.schemaVersion === 1)
    return {
      entries: importBundle(existingEntries, input),
      sweeps: [...existingSweeps],
    };
  if (bundle.schemaVersion !== SWEEP_BUNDLE_VERSION)
    throw new Error('Unsupported experiment schema version.');
  if (!Array.isArray(bundle.sweeps) || bundle.sweeps.length > 16)
    throw new Error('Sweep manifest collection is invalid.');
  const v1 = JSON.stringify({ ...bundle, schemaVersion: 1, sweeps: undefined });
  const entries = importBundle(existingEntries, v1);
  const imported = entries.slice(existingEntries.length);
  const seen = new Set<string>();
  const sweeps = bundle.sweeps.map((raw) => {
    const manifest = validateSweepManifest(raw, imported);
    if (seen.has(manifest.sweepId))
      throw new Error('Duplicate sweep IDs in one bundle.');
    seen.add(manifest.sweepId);
    return saveSweep(manifest, imported);
  });
  const allSweeps = [...existingSweeps, ...sweeps];
  if (archiveBytes({ entries, sweeps: allSweeps }) > MAX_ARCHIVE_BYTES)
    throw new Error('Archive limit is 12 MiB. Export or remove records first.');
  return { entries, sweeps: allSweeps };
}
