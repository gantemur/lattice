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
import {
  fieldAction,
  fieldMeasure,
  validateGaussianField,
} from '../models/gaussianField';
import type { GaussianFieldParameters } from '../models/gaussianField';
import { exactGaussianField } from '../models/gaussianFieldReference';
import {
  spectralGaussianField,
  spectralQuadraticField,
} from '../models/gaussianFieldSpectral';
import {
  defaultOscillator,
  oscillatorField,
  validateOscillator,
} from '../models/oscillator';
import type { OscillatorParameters } from '../models/oscillator';
import { isFullyPeriodic } from '../models/fieldFourier';
import { quarticTransition } from '../algorithms/quarticOscillatorSampler';
import {
  defaultQuarticOscillator,
  quarticPathAction,
  quarticQuadraticPart,
  validateQuarticOscillator,
} from '../models/quarticOscillator';
import type { QuarticOscillatorParameters } from '../models/quarticOscillator';
import {
  emptyMoments,
  recordMoment,
  summarizeMoments,
} from '../observables/moments';

/** The worker owns all field values, RNG draws and measurement accumulators. */
type CommonFieldSettings = {
  parameters: GaussianFieldParameters;
  sampler: FieldSampler;
  warmupSweeps: number;
  strideSweeps: number;
};
export type GaussianFieldSettings = CommonFieldSettings & {
  /** Omitted means the original Gaussian model for backwards compatibility. */
  model?: 'gaussian';
  oscillator?: never;
};
export type OscillatorFieldSettings = CommonFieldSettings & {
  model: 'oscillator';
  oscillator: OscillatorParameters;
};
export type QuarticFieldSettings = CommonFieldSettings & {
  model: 'quartic-oscillator';
  quartic: QuarticOscillatorParameters;
  oscillator?: never;
};
export type FieldSettings =
  GaussianFieldSettings | OscillatorFieldSettings | QuarticFieldSettings;
export type FieldConfiguration = FieldSettings & { seed: number };
export type OscillatorConfiguration = OscillatorFieldSettings & {
  seed: number;
};
export type QuarticConfiguration = QuarticFieldSettings & { seed: number };
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
export const defaultOscillatorConfiguration: OscillatorConfiguration = {
  model: 'oscillator',
  oscillator: defaultOscillator,
  parameters: oscillatorField(defaultOscillator),
  sampler: { kind: 'spectral' },
  warmupSweeps: 0,
  strideSweeps: 1,
  seed: 12345,
};
export const defaultQuarticConfiguration: QuarticConfiguration = {
  model: 'quartic-oscillator',
  quartic: defaultQuarticOscillator,
  parameters: quarticQuadraticPart(defaultQuarticOscillator),
  sampler: { kind: 'metropolis', width: 1 },
  warmupSweeps: 20,
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
  positiveAveragePaths: number;
  negativeAveragePaths: number;
  zeroAveragePaths: number;
  observedSignChanges: number;
  reference: {
    method: 'dense' | 'spectral';
    measure: 'ordinary' | 'mean-zero';
    mean: number[];
    covariance: number[][];
    logPartition: number;
    eigenvalues?: number[];
  } | null;
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
  if (settings.model === 'quartic-oscillator') {
    validateQuarticOscillator(settings.quartic);
    const expected = quarticQuadraticPart(settings.quartic);
    const actual = settings.parameters;
    const shape = actual.shape;
    if (
      shape.kind !== 'chain' ||
      shape.length !== settings.quartic.sites ||
      !shape.periodic ||
      fieldMeasure(actual) !== 'ordinary' ||
      actual.r !== expected.r ||
      actual.kappaX !== expected.kappaX ||
      actual.kappaY !== 0 ||
      actual.source !== expected.source
    )
      throw new Error(
        'Quartic quadratic coefficients disagree with physical parameters.',
      );
    if (settings.sampler.kind !== 'metropolis')
      throw new Error('Quartic paths require local Metropolis sampling.');
  } else if (settings.model === 'oscillator') {
    if (!settings.oscillator)
      throw new Error('Oscillator physical parameters are required.');
    validateOscillator(settings.oscillator);
    const expected = oscillatorField(settings.oscillator);
    const actual = settings.parameters;
    const shape = actual.shape;
    if (
      shape.kind !== 'chain' ||
      shape.length !== settings.oscillator.sites ||
      !shape.periodic ||
      fieldMeasure(actual) !== 'ordinary' ||
      actual.r !== expected.r ||
      actual.kappaX !== expected.kappaX ||
      actual.kappaY !== 0 ||
      actual.source !== 0
    )
      throw new Error(
        'Oscillator quadratic coefficients disagree with physical parameters.',
      );
    if (settings.sampler.kind === 'direct')
      throw new Error('Oscillator independent paths use the spectral sampler.');
  } else if (settings.model === undefined || settings.model === 'gaussian') {
    if (settings.oscillator)
      throw new Error(
        'Gaussian settings cannot contain oscillator parameters.',
      );
    validateGaussianField(settings.parameters);
  } else throw new Error('Unknown field model.');
  const size = createFieldLattice(settings.parameters.shape).size;
  validateFieldSampler(settings.sampler, size);
  const measure =
    settings.model === 'quartic-oscillator'
      ? 'ordinary'
      : fieldMeasure(settings.parameters);
  if (measure === 'mean-zero' && settings.sampler.kind !== 'spectral')
    throw new Error('Mean-zero fields require spectral independent sampling.');
  if (
    settings.sampler.kind === 'spectral' &&
    !isFullyPeriodic(settings.parameters.shape)
  )
    throw new Error('Spectral sampling requires full periodicity.');
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
    (settings.sampler.kind === 'direct' ||
      settings.sampler.kind === 'spectral') &&
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
    positiveAveragePaths: 0,
    negativeAveragePaths: 0,
    zeroAveragePaths: 0,
    observedSignChanges: 0,
    previousAverageSign: 0,
    reference:
      copied.model === 'quartic-oscillator'
        ? null
        : copied.model === 'oscillator'
          ? spectralQuadraticField(copied.parameters)
          : copied.sampler.kind === 'spectral'
            ? spectralGaussianField(copied.parameters)
            : exactGaussianField(copied.parameters),
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
      configuration.sampler.kind === 'direct' ||
      configuration.sampler.kind === 'spectral'
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
      (settings.model ?? 'gaussian') !==
      (this.current.settings.model ?? 'gaussian')
    )
      throw new Error('Changing field model requires a seeded Reset.');
    if (
      JSON.stringify(settings.parameters.shape) !==
      JSON.stringify(this.current.settings.parameters.shape)
    )
      throw new Error('Field geometry changes require Reset.');
    if (
      settings.model !== 'quartic-oscillator' &&
      fieldMeasure(settings.parameters) !==
        fieldMeasure(this.current.settings.parameters)
    )
      throw new Error('Changing field measure requires a seeded Reset.');
    if (JSON.stringify(settings) === JSON.stringify(this.current.settings))
      return;
    if (
      this.field === null &&
      settings.sampler.kind !== 'direct' &&
      settings.sampler.kind !== 'spectral'
    )
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
      settings.sampler.kind === 'direct' || settings.sampler.kind === 'spectral'
        ? 0
        : settings.warmupSweeps * size;
    const stride =
      settings.sampler.kind === 'direct' || settings.sampler.kind === 'spectral'
        ? 1
        : settings.strideSweeps * size;
    for (let n = 0; n < count; n++) {
      const result =
        settings.model === 'quartic-oscillator' &&
        settings.sampler.kind === 'metropolis'
          ? quarticTransition(
              settings.quartic,
              this.field ?? Array<number>(size).fill(0),
              settings.sampler.width,
              this.rng,
            )
          : fieldTransition(
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
      const actionDensity = this.action(settings, this.field) / size;
      const sign = Math.sign(average);
      if (sign > 0) segment.positiveAveragePaths++;
      else if (sign < 0) segment.negativeAveragePaths++;
      else segment.zeroAveragePaths++;
      if (
        sign !== 0 &&
        segment.previousAverageSign !== 0 &&
        sign !== segment.previousAverageSign
      )
        segment.observedSignChanges++;
      if (sign !== 0) segment.previousAverageSign = sign;
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

  private action(settings: FieldSettings, path: readonly number[]) {
    return settings.model === 'quartic-oscillator'
      ? quarticPathAction(settings.quartic, path)
      : fieldAction(this.lattice, settings.parameters, path);
  }

  snapshot(): FieldSnapshot {
    return {
      runId: this.runId,
      version: this.version,
      seed: this.seed,
      field: this.field?.slice() ?? null,
      action: this.field
        ? this.action(this.current.settings, this.field)
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
          positiveAveragePaths: segment.positiveAveragePaths,
          negativeAveragePaths: segment.negativeAveragePaths,
          zeroAveragePaths: segment.zeroAveragePaths,
          observedSignChanges: segment.observedSignChanges,
          reference:
            segment.reference === null
              ? null
              : {
                  method:
                    'method' in segment.reference
                      ? ('spectral' as const)
                      : ('dense' as const),
                  measure: fieldMeasure(segment.settings.parameters),
                  mean: segment.reference.mean.slice(),
                  covariance: segment.reference.covariance.map((row) =>
                    row.slice(),
                  ),
                  logPartition: segment.reference.logPartition,
                  ...('method' in segment.reference
                    ? { eigenvalues: segment.reference.eigenvalues.slice() }
                    : {}),
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
