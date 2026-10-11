import { createIndexedLattice } from '../domain/indexedLattice';
import type { IndexedLattice } from '../domain/indexedLattice';
import { createRng, validateSeed } from '../algorithms/rng';
import { latticeTransition } from '../algorithms/latticeTransition';
import type {
  LatticeSampler,
  LatticeTrace,
} from '../algorithms/latticeTransition';
import {
  defaultLatticeParameters,
  magnetization,
  totalEnergy,
  validateLatticeParameters,
} from '../models/latticeIsing';
import type { LatticeParameters } from '../models/latticeIsing';
import {
  emptyMoments,
  recordMoment,
  summarizeMoments,
} from '../observables/moments';
import { createHistogram, recordHistogram } from '../observables/histogram';
import { ConvergenceHistory } from '../observables/convergence';
import { DiagnosticHistory } from '../observables/statisticalDiagnostics';
import type { DiagnosticRecord } from '../observables/statisticalDiagnostics';
import {
  axialProducts,
  bondProducts,
  equilibriumFluctuations,
} from '../observables/latticePhysics';

export type LatticeSettings = {
  parameters: LatticeParameters;
  sampler: LatticeSampler;
  warmupSweeps: number;
  strideSweeps: number;
};
export type LatticeConfiguration = LatticeSettings & {
  seed: number;
  initialization: 'plus' | 'minus' | 'random';
};
export const defaultLatticeConfiguration: LatticeConfiguration = {
  parameters: defaultLatticeParameters,
  sampler: 'metropolis',
  warmupSweeps: 20,
  strideSweeps: 1,
  seed: 12345,
  initialization: 'random',
};
export type Measurement = {
  sweep: number;
  update: number;
  m: number;
  absM: number;
  e: number;
};
type Summary = ReturnType<typeof summarizeMoments>;
export type LatticeSegmentSnapshot = {
  id: number;
  settings: LatticeSettings;
  startUpdate: number;
  updates: number;
  warmupUpdates: number;
  samples: number;
  accepted: number;
  rejected: number;
  self: number;
  changed: number;
  unchanged: number;
  m: Summary;
  absM: Summary;
  e: Summary;
  m2: Summary;
  m4: Summary;
  e2: Summary;
  gx: Summary;
  gy: Summary;
  spatialX: { r: number; pairs: number; moments: Summary }[];
  spatialY: { r: number; pairs: number; moments: Summary }[];
  fluctuations: ReturnType<typeof equilibriumFluctuations> | null;
  diagnostics: ReturnType<DiagnosticHistory['snapshot']>;
  mHistogram: ReturnType<typeof createHistogram>;
  eHistogram: ReturnType<typeof createHistogram>;
  measurements: Measurement[];
  meanCheckpoints: ReturnType<ConvergenceHistory['snapshot']>;
  absMeanCheckpoints: ReturnType<ConvergenceHistory['snapshot']>;
  eMeanCheckpoints: ReturnType<ConvergenceHistory['snapshot']>;
  discardedMeasurements: number;
};
export type LatticeSnapshot = {
  runId: number;
  version: number;
  configuration: LatticeConfiguration;
  spins: Int8Array;
  magnetization: number;
  energy: number;
  updates: number;
  sweeps: number;
  activeSegmentId: number;
  droppedSegments: number;
  segments: LatticeSegmentSnapshot[];
  lastTrace: LatticeTrace | null;
};
export type LatticeCapture = {
  workspace: 'lattice';
  runId: number;
  version: number;
  seed: number;
  initialization: LatticeConfiguration['initialization'];
  captureUpdate: number;
  segment: LatticeSegmentSnapshot;
  diagnosticRecord: DiagnosticRecord;
  currentState: { update: number; spins: number[] } | null;
};
export type LatticeRequest =
  | { type: 'initialize'; runId: number; configuration: LatticeConfiguration }
  | { type: 'change'; runId: number; settings: LatticeSettings }
  | { type: 'advance'; runId: number; count: number }
  | { type: 'capture'; runId: number; requestId: number; segmentId: number };
export type LatticeResponse =
  | { type: 'snapshot'; snapshot: LatticeSnapshot }
  | {
      type: 'capture';
      runId: number;
      requestId: number;
      capture: LatticeCapture;
    }
  | { type: 'error'; runId: number; message: string };

export function validateLatticeSettings(settings: LatticeSettings): void {
  validateLatticeParameters(settings.parameters);
  if (settings.sampler !== 'metropolis' && settings.sampler !== 'heat-bath')
    throw new Error('Unknown lattice sampler.');
  if (
    !Number.isInteger(settings.warmupSweeps) ||
    settings.warmupSweeps < 0 ||
    settings.warmupSweeps > 10000
  )
    throw new Error('Warm-up must be 0–10000 sweeps.');
  if (
    !Number.isInteger(settings.strideSweeps) ||
    settings.strideSweeps < 1 ||
    settings.strideSweeps > 100
  )
    throw new Error('Measurement stride must be 1–100 sweeps.');
}
type Segment = ReturnType<typeof newSegment>;
function newSegment(
  id: number,
  settings: LatticeSettings,
  startUpdate: number,
  lattice: IndexedLattice,
) {
  const { parameters } = settings;
  const eLimit =
    (Math.abs(parameters.jx) * lattice.horizontalBonds) / lattice.size +
    (Math.abs(parameters.jy) * lattice.verticalBonds) / lattice.size +
    Math.abs(parameters.field) +
    0.001;
  const referenceSpins = new Int8Array(lattice.size).fill(1);
  const spatial = (axis: 'x' | 'y') =>
    axialProducts(lattice, referenceSpins, axis).map(({ r, pairs }) => ({
      r,
      pairs,
      moments: emptyMoments(),
    }));
  return {
    id,
    settings: {
      parameters: { ...settings.parameters },
      sampler: settings.sampler,
      warmupSweeps: settings.warmupSweeps,
      strideSweeps: settings.strideSweeps,
    },
    startUpdate,
    updates: 0,
    warmupUpdates: 0,
    accepted: 0,
    rejected: 0,
    self: 0,
    changed: 0,
    unchanged: 0,
    m: emptyMoments(),
    absM: emptyMoments(),
    e: emptyMoments(),
    m2: emptyMoments(),
    m4: emptyMoments(),
    e2: emptyMoments(),
    gx: emptyMoments(),
    gy: emptyMoments(),
    spatialX: spatial('x'),
    spatialY: spatial('y'),
    diagnostics: new DiagnosticHistory({
      kind: 'lattice',
      sweepsPerObservation: settings.strideSweeps,
    }),
    mHistogram: createHistogram(-1.001, 1.001, 41),
    eHistogram: createHistogram(-eLimit, eLimit, 41),
    measurements: [] as Measurement[],
    discardedMeasurements: 0,
    meanCheckpoints: new ConvergenceHistory(),
    absMeanCheckpoints: new ConvergenceHistory(),
    eMeanCheckpoints: new ConvergenceHistory(),
  };
}
function segmentSnapshot(segment: Segment): LatticeSegmentSnapshot {
  return {
    id: segment.id,
    settings: structuredClone(segment.settings),
    startUpdate: segment.startUpdate,
    updates: segment.updates,
    warmupUpdates: segment.warmupUpdates,
    samples: segment.m.count,
    accepted: segment.accepted,
    rejected: segment.rejected,
    self: segment.self,
    changed: segment.changed,
    unchanged: segment.unchanged,
    m: summarizeMoments(segment.m),
    absM: summarizeMoments(segment.absM),
    e: summarizeMoments(segment.e),
    m2: summarizeMoments(segment.m2),
    m4: summarizeMoments(segment.m4),
    e2: summarizeMoments(segment.e2),
    gx: summarizeMoments(segment.gx),
    gy: summarizeMoments(segment.gy),
    spatialX: segment.spatialX.map(({ r, pairs, moments }) => ({
      r,
      pairs,
      moments: summarizeMoments(moments),
    })),
    spatialY: segment.spatialY.map(({ r, pairs, moments }) => ({
      r,
      pairs,
      moments: summarizeMoments(moments),
    })),
    fluctuations:
      segment.m.count > 0
        ? equilibriumFluctuations(
            segment.settings.parameters.lx * segment.settings.parameters.ly,
            segment.settings.parameters.temperature,
            segment.m2.mean,
            segment.m4.mean,
            segment.m.m2 / segment.m.count,
            segment.e.m2 / segment.e.count,
          )
        : null,
    diagnostics: segment.diagnostics.snapshot(),
    mHistogram: { ...segment.mHistogram, bins: [...segment.mHistogram.bins] },
    eHistogram: { ...segment.eHistogram, bins: [...segment.eHistogram.bins] },
    measurements: segment.measurements.map((m) => ({ ...m })),
    discardedMeasurements: segment.discardedMeasurements,
    meanCheckpoints: segment.meanCheckpoints.snapshot(),
    absMeanCheckpoints: segment.absMeanCheckpoints.snapshot(),
    eMeanCheckpoints: segment.eMeanCheckpoints.snapshot(),
  };
}
export class LatticeRun {
  // Spins and RNG are continuous across parameter segments; each segment has
  // its own physical parameters, warm-up, and equilibrium measurements.
  private readonly lattice: IndexedLattice;
  private readonly rng;
  private readonly spins: Int8Array;
  private readonly initial: LatticeConfiguration;
  private segments: Segment[];
  private M: number;
  private H: number;
  private updates = 0;
  private version = 0;
  private droppedSegments = 0;
  private lastTrace: LatticeTrace | null = null;
  constructor(
    private readonly runId: number,
    configuration: LatticeConfiguration,
  ) {
    validateLatticeSettings(configuration);
    validateSeed(configuration.seed);
    if (!['plus', 'minus', 'random'].includes(configuration.initialization))
      throw new Error('Unknown initialization.');
    this.initial = structuredClone(configuration);
    this.lattice = createIndexedLattice(configuration.parameters);
    this.rng = createRng(configuration.seed);
    this.spins = new Int8Array(this.lattice.size);
    for (let i = 0; i < this.spins.length; i++)
      this.spins[i] =
        configuration.initialization === 'random'
          ? this.rng.uniform() < 0.5
            ? 1
            : -1
          : configuration.initialization === 'plus'
            ? 1
            : -1;
    this.M = magnetization(this.spins);
    this.H = totalEnergy(this.lattice, configuration.parameters, this.spins);
    this.segments = [newSegment(1, configuration, 0, this.lattice)];
  }
  private get current() {
    return this.segments.at(-1)!;
  }
  changeSettings(settings: LatticeSettings): void {
    validateLatticeSettings(settings);
    const previous = this.current.settings.parameters,
      next = settings.parameters;
    if (
      previous.lx !== next.lx ||
      previous.ly !== next.ly ||
      previous.periodicX !== next.periodicX ||
      previous.periodicY !== next.periodicY
    )
      throw new Error('Lattice dimensions/boundaries require a new session.');
    if (JSON.stringify(settings) === JSON.stringify(this.current.settings))
      return;
    // The same spin configuration has a different H under new couplings.
    // Recompute it once without touching the configuration or RNG stream.
    this.H = totalEnergy(this.lattice, next, this.spins);
    this.segments.push(
      newSegment(this.current.id + 1, settings, this.updates, this.lattice),
    );
    if (this.segments.length > 8) {
      this.segments.shift();
      this.droppedSegments++;
    }
    this.lastTrace = null;
    this.version++;
  }
  advance(count: number): void {
    if (!Number.isInteger(count) || count < 1 || count > 8192)
      throw new Error('Advance count must be 1–8192.');
    if (!Number.isSafeInteger(this.updates + count))
      throw new Error('Update counter limit reached; Reset.');
    const segment = this.current,
      p = segment.settings.parameters,
      size = this.lattice.size;
    for (let n = 0; n < count; n++) {
      const global = ++this.updates;
      const trace = latticeTransition(
        this.lattice,
        p,
        segment.settings.sampler,
        this.spins,
        this.rng,
        global,
        n === count - 1,
      );
      this.lastTrace = trace;
      segment.updates++;
      segment[trace.outcome]++;
      if (trace.newSpin !== trace.oldSpin) {
        // Accepted transitions permit O(1) aggregate updates; rejected or
        // unchanged transitions leave both physical observables untouched.
        this.M += -2 * trace.oldSpin;
        this.H += trace.deltaH;
      }
      if (segment.updates <= segment.settings.warmupSweeps * size)
        segment.warmupUpdates++;
      if (
        segment.updates % size === 0 &&
        segment.updates > segment.settings.warmupSweeps * size &&
        (segment.updates / size - segment.settings.warmupSweeps) %
          segment.settings.strideSweeps ===
          0
      ) {
        // One measurement follows each requested whole-sweep stride. Online
        // moments span the segment; only rendered measurement points are cut.
        const m = this.M / size,
          e = this.H / size;
        recordMoment(segment.m, m);
        recordMoment(segment.absM, Math.abs(m));
        recordMoment(segment.e, e);
        recordMoment(segment.m2, m * m);
        recordMoment(segment.m4, m ** 4);
        recordMoment(segment.e2, e * e);
        segment.diagnostics.record(m, Math.abs(m), e);
        const bonds = bondProducts(this.lattice, this.spins);
        recordMoment(segment.gx, bonds.x);
        recordMoment(segment.gy, bonds.y);
        for (const [axis, entries] of [
          ['x', segment.spatialX],
          ['y', segment.spatialY],
        ] as const)
          axialProducts(this.lattice, this.spins, axis).forEach((point, i) =>
            recordMoment(entries[i]!.moments, point.value),
          );
        recordHistogram(segment.mHistogram, m);
        recordHistogram(segment.eHistogram, e);
        segment.meanCheckpoints.record(segment.m.count, segment.m.mean);
        segment.absMeanCheckpoints.record(
          segment.absM.count,
          segment.absM.mean,
        );
        segment.eMeanCheckpoints.record(segment.e.count, segment.e.mean);
        segment.measurements.push({
          sweep: this.updates / size,
          update: this.updates,
          m,
          absM: Math.abs(m),
          e,
        });
        if (segment.measurements.length > 1000) {
          segment.measurements.shift();
          segment.discardedMeasurements++;
        }
      }
    }
    this.version += count;
  }
  snapshot(): LatticeSnapshot {
    return {
      runId: this.runId,
      version: this.version,
      configuration: {
        ...this.initial,
        ...this.current.settings,
        parameters: { ...this.current.settings.parameters },
      },
      spins: this.spins.slice(),
      magnetization: this.M,
      energy: this.H,
      updates: this.updates,
      sweeps: Math.floor(this.updates / this.lattice.size),
      activeSegmentId: this.current.id,
      droppedSegments: this.droppedSegments,
      segments: this.segments.map(segmentSnapshot),
      lastTrace: this.lastTrace
        ? {
            ...this.lastTrace,
            terms: this.lastTrace.terms.map((t) => ({ ...t })),
          }
        : null,
    };
  }
  capture(segmentId: number, finalAnalysis = false): LatticeCapture {
    // A historical segment has no saved final spin configuration. Captures
    // include current spins only when the requested segment is still active.
    const internal = this.segments.find((s) => s.id === segmentId);
    if (!internal) throw new Error('Segment is no longer available.');
    const segment = segmentSnapshot(internal);
    if (finalAnalysis)
      segment.diagnostics = internal.diagnostics.analyzeCurrent();
    return {
      workspace: 'lattice',
      runId: this.runId,
      version: this.version,
      seed: this.initial.seed,
      initialization: this.initial.initialization,
      captureUpdate: this.updates,
      segment,
      diagnosticRecord: internal.diagnostics.capture(),
      currentState:
        segmentId === this.current.id
          ? { update: this.updates, spins: Array.from(this.spins) }
          : null,
    };
  }
}
export class LatticeEngine {
  // Worker command boundary: stale run IDs cannot mutate a newer session.
  private run: LatticeRun | null = null;
  private runId = 0;
  handle(request: LatticeRequest): LatticeResponse {
    try {
      if (!Number.isSafeInteger(request.runId) || request.runId < 1)
        throw new Error('Invalid run ID.');
      if (request.type === 'initialize') {
        if (request.runId <= this.runId) throw new Error('Stale run ID.');
        this.run = new LatticeRun(request.runId, request.configuration);
        this.runId = request.runId;
      } else {
        if (request.runId !== this.runId || !this.run)
          throw new Error('Stale or uninitialized run.');
        if (request.type === 'capture')
          return {
            type: 'capture',
            runId: this.runId,
            requestId: request.requestId,
            capture: this.run.capture(request.segmentId),
          };
        if (request.type === 'change')
          this.run.changeSettings(request.settings);
        else this.run.advance(request.count);
      }
      return { type: 'snapshot', snapshot: this.run!.snapshot() };
    } catch (error) {
      return {
        type: 'error',
        runId: request.runId,
        message:
          error instanceof Error ? error.message : 'Lattice worker failed.',
      };
    }
  }
}
