import { createRng, validateSeed } from '../algorithms/rng';
import {
  fieldTransition,
  validateFieldSampler,
} from '../algorithms/gaussianFieldSampler';
import type {
  FieldSampler,
  FieldTrace,
} from '../algorithms/gaussianFieldSampler';
import { createFieldLattice } from '../domain/fieldLattice';
import type { FieldLattice } from '../domain/fieldLattice';
import { fieldAction, validateGaussianField } from '../models/gaussianField';
import type { GaussianFieldParameters } from '../models/gaussianField';
import { exactGaussianField } from '../models/gaussianFieldReference';
import type { GaussianFieldReference } from '../models/gaussianFieldReference';
import {
  emptyMoments,
  recordMoment,
  summarizeMoments,
} from '../observables/moments';

/** The worker owns all field values, RNG draws and measurement accumulators. */
export type FieldSettings = {
  parameters: GaussianFieldParameters;
  sampler: FieldSampler;
  warmupSweeps: number;
  strideSweeps: number;
};
export type FieldConfiguration = FieldSettings & { seed: number };
export const defaultFieldConfiguration: FieldConfiguration = {
  parameters: {
    shape: { kind: 'chain', length: 8, periodic: false },
    r: 1,
    kappaX: 1,
    kappaY: 0,
    source: 0,
  },
  sampler: { kind: 'direct' },
  warmupSweeps: 0,
  strideSweeps: 1,
  seed: 12345,
};
type MomentSummary = ReturnType<typeof summarizeMoments>;
export type FieldMeasurement = {
  update: number;
  field: number[];
  average: number;
  actionDensity: number;
};
export type FieldSegmentSnapshot = {
  id: number;
  settings: FieldSettings;
  startUpdate: number;
  updates: number;
  warmupUpdates: number;
  measurements: number;
  accepted: number;
  rejected: number;
  sites: MomentSummary[];
  average: MomentSummary;
  actionDensity: MomentSummary;
  pairProducts: number[][];
  recent: FieldMeasurement[];
  discardedMeasurements: number;
  reference: Omit<GaussianFieldReference, 'cholesky'>;
};
export type FieldSnapshot = {
  runId: number;
  version: number;
  seed: number;
  field: number[] | null;
  action: number | null;
  updates: number;
  activeSegmentId: number;
  droppedSegments: number;
  segments: FieldSegmentSnapshot[];
  lastTrace:
    | (FieldTrace & { update: number; segmentId: number; warmup: boolean })
    | null;
};
export type FieldRequest =
  | { type: 'initialize'; runId: number; configuration: FieldConfiguration }
  | { type: 'change'; runId: number; settings: FieldSettings }
  | { type: 'advance'; runId: number; count: number };
export type FieldResponse =
  | { type: 'snapshot'; snapshot: FieldSnapshot }
  | { type: 'error'; runId: number; message: string };

export function validateFieldSettings(settings: FieldSettings) {
  validateGaussianField(settings.parameters);
  const size = createFieldLattice(settings.parameters.shape).size;
  validateFieldSampler(settings.sampler, size);
  if (
    !Number.isInteger(settings.warmupSweeps) ||
    settings.warmupSweeps < 0 ||
    settings.warmupSweeps > 1000
  )
    throw new Error('Warm-up must be 0–1000 nominal sweeps.');
  if (
    !Number.isInteger(settings.strideSweeps) ||
    settings.strideSweeps < 1 ||
    settings.strideSweeps > 100
  )
    throw new Error('Measurement stride must be 1–100 nominal sweeps.');
  if (
    settings.sampler.kind === 'direct' &&
    (settings.warmupSweeps !== 0 || settings.strideSweeps !== 1)
  )
    throw new Error('Independent draws use zero warm-up and unit draw stride.');
}

function newSegment(
  id: number,
  settings: FieldSettings,
  startUpdate: number,
  size: number,
) {
  const copied = structuredClone(settings);
  return {
    id,
    settings: copied,
    startUpdate,
    updates: 0,
    warmupUpdates: 0,
    accepted: 0,
    rejected: 0,
    sites: Array.from({ length: size }, emptyMoments),
    average: emptyMoments(),
    actionDensity: emptyMoments(),
    pairSums: Array.from({ length: size }, () => Array<number>(size).fill(0)),
    recent: [] as FieldMeasurement[],
    discardedMeasurements: 0,
    reference: exactGaussianField(copied.parameters),
  };
}
type Segment = ReturnType<typeof newSegment>;

export class FieldRun {
  private readonly rng;
  private readonly seed: number;
  private readonly lattice: FieldLattice;
  private field: number[] | null;
  private segments: Segment[];
  private updates = 0;
  private version = 0;
  private droppedSegments = 0;
  private lastTrace: FieldSnapshot['lastTrace'] = null;

  constructor(
    private readonly runId: number,
    configuration: FieldConfiguration,
  ) {
    validateFieldSettings(configuration);
    validateSeed(configuration.seed);
    this.seed = configuration.seed;
    this.rng = createRng(configuration.seed);
    this.lattice = createFieldLattice(configuration.parameters.shape);
    // Direct starts without a draw. Local chains start at zero, not a sample.
    this.field =
      configuration.sampler.kind === 'direct'
        ? null
        : Array<number>(this.lattice.size).fill(0);
    this.segments = [newSegment(1, configuration, 0, this.lattice.size)];
  }
  private get current() {
    return this.segments.at(-1)!;
  }

  changeSettings(settings: FieldSettings) {
    validateFieldSettings(settings);
    if (
      JSON.stringify(settings.parameters.shape) !==
      JSON.stringify(this.current.settings.parameters.shape)
    )
      throw new Error('Field geometry changes require Reset.');
    if (JSON.stringify(settings) === JSON.stringify(this.current.settings))
      return;
    if (this.field === null && settings.sampler.kind !== 'direct')
      this.field = Array<number>(this.lattice.size).fill(0);
    // Preserve the configuration and RNG but never pool different measures.
    this.segments.push(
      newSegment(
        this.current.id + 1,
        settings,
        this.updates,
        this.lattice.size,
      ),
    );
    if (this.segments.length > 8) {
      this.segments.shift();
      this.droppedSegments++;
    }
    this.lastTrace = null;
    this.version++;
  }

  advance(count: number) {
    if (!Number.isInteger(count) || count < 1 || count > 1024)
      throw new Error('Field batch must contain 1–1024 updates.');
    if (!Number.isSafeInteger(this.updates + count))
      throw new Error('Update count limit reached; Reset.');
    const segment = this.current;
    const settings = segment.settings;
    const size = this.lattice.size;
    const warmupTarget =
      settings.sampler.kind === 'direct' ? 0 : settings.warmupSweeps * size;
    const stride =
      settings.sampler.kind === 'direct' ? 1 : settings.strideSweeps * size;
    for (let n = 0; n < count; n++) {
      const result = fieldTransition(
        this.lattice,
        settings.parameters,
        settings.sampler,
        this.field ?? Array<number>(size).fill(0),
        this.rng,
        segment.reference,
      );
      this.field = result.field;
      this.updates++;
      segment.updates++;
      const warmup = segment.updates <= warmupTarget;
      if (warmup) segment.warmupUpdates++;
      if (result.trace.kind === 'metropolis')
        segment[result.trace.accepted ? 'accepted' : 'rejected']++;
      this.lastTrace = {
        ...result.trace,
        update: this.updates,
        segmentId: segment.id,
        warmup,
      };
      if (warmup || (segment.updates - warmupTarget) % stride !== 0) continue;
      // One retained field updates every site moment and pair cross-sum.
      // Only recent full vectors are evicted; summaries span the segment.
      const average = this.field.reduce((sum, value) => sum + value, 0) / size;
      const actionDensity =
        fieldAction(this.lattice, settings.parameters, this.field) / size;
      for (let i = 0; i < size; i++) {
        recordMoment(segment.sites[i]!, this.field[i]!);
        for (let j = 0; j < size; j++)
          segment.pairSums[i]![j]! += this.field[i]! * this.field[j]!;
      }
      recordMoment(segment.average, average);
      recordMoment(segment.actionDensity, actionDensity);
      segment.recent.push({
        update: this.updates,
        field: this.field.slice(),
        average,
        actionDensity,
      });
      if (segment.recent.length > 256) {
        segment.recent.shift();
        segment.discardedMeasurements++;
      }
    }
    this.version += count;
  }

  snapshot(): FieldSnapshot {
    return {
      runId: this.runId,
      version: this.version,
      seed: this.seed,
      field: this.field?.slice() ?? null,
      action: this.field
        ? fieldAction(
            this.lattice,
            this.current.settings.parameters,
            this.field,
          )
        : null,
      updates: this.updates,
      activeSegmentId: this.current.id,
      droppedSegments: this.droppedSegments,
      lastTrace: this.lastTrace ? { ...this.lastTrace } : null,
      segments: this.segments.map((segment) => {
        const count = segment.average.count;
        return {
          id: segment.id,
          settings: structuredClone(segment.settings),
          startUpdate: segment.startUpdate,
          updates: segment.updates,
          warmupUpdates: segment.warmupUpdates,
          measurements: count,
          accepted: segment.accepted,
          rejected: segment.rejected,
          sites: segment.sites.map(summarizeMoments),
          average: summarizeMoments(segment.average),
          actionDensity: summarizeMoments(segment.actionDensity),
          pairProducts: segment.pairSums.map((row) =>
            row.map((sum) => (count ? sum / count : 0)),
          ),
          recent: segment.recent.map((record) => ({
            ...record,
            field: record.field.slice(),
          })),
          discardedMeasurements: segment.discardedMeasurements,
          reference: {
            mean: segment.reference.mean.slice(),
            covariance: segment.reference.covariance.map((row) => row.slice()),
            logPartition: segment.reference.logPartition,
          },
        };
      }),
    };
  }
}

export class FieldEngine {
  private run: FieldRun | null = null;
  private runId = 0;
  handle(request: FieldRequest): FieldResponse {
    try {
      if (!Number.isSafeInteger(request.runId) || request.runId < 1)
        throw new Error('Invalid run ID.');
      if (request.type === 'initialize') {
        if (request.runId <= this.runId) throw new Error('Stale run ID.');
        const next = new FieldRun(request.runId, request.configuration);
        this.run = next;
        this.runId = request.runId;
      } else {
        if (request.runId !== this.runId || !this.run)
          throw new Error('Stale or uninitialized field run.');
        if (request.type === 'change')
          this.run.changeSettings(request.settings);
        else this.run.advance(request.count);
      }
      return { type: 'snapshot', snapshot: this.run!.snapshot() };
    } catch (cause) {
      return {
        type: 'error',
        runId: request.runId,
        message:
          cause instanceof Error ? cause.message : 'Field worker failed.',
      };
    }
  }
}
