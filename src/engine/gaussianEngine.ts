import { sampleGaussian } from '../algorithms/gaussianSampler';
import { createRng } from '../algorithms/rng';
import { gaussianAction, gaussianReference } from '../models/gaussian';
import type { GaussianParameters } from '../models/gaussian';
import { createHistogram, recordHistogram } from '../observables/histogram';
import {
  emptyMoments,
  recordMoment,
  summarizeMoments,
} from '../observables/moments';
import { ConvergenceHistory } from '../observables/convergence';
import type {
  RunConfiguration,
  Snapshot,
  WorkerRequest,
  WorkerResponse,
  SegmentSnapshot,
} from './protocol';

export const MAX_SEGMENTS = 8;
function newSegment(
  id: number,
  parameters: GaussianParameters,
  startUpdate: number,
) {
  const reference = gaussianReference(parameters);
  return {
    id,
    parameters: { ...parameters },
    startUpdate,
    moments: emptyMoments(),
    histogram: createHistogram(
      reference.mean - 4 * reference.standardDeviation,
      reference.mean + 4 * reference.standardDeviation,
    ),
    convergence: new ConvergenceHistory(),
  };
}

export class GaussianRun {
  private readonly seed: number;
  private readonly rng;
  private segments;
  private currentValue: number | null = null;
  private updates = 0;
  private version = 0;
  private droppedSegments = 0;

  constructor(
    private readonly runId: number,
    configuration: RunConfiguration,
  ) {
    this.segments = [newSegment(1, configuration.parameters, 0)];
    this.rng = createRng(configuration.seed);
    this.seed = configuration.seed;
  }
  private get current() {
    return this.segments.at(-1)!;
  }

  changeParameters(parameters: GaussianParameters): void {
    // Validate before mutation, even for a no-op. No RNG consumption or reseeding.
    gaussianReference(parameters);
    if (
      parameters.a === this.current.parameters.a &&
      parameters.h === this.current.parameters.h
    )
      return;
    this.segments.push(
      newSegment(this.current.id + 1, parameters, this.updates),
    );
    if (this.segments.length > MAX_SEGMENTS) {
      this.segments.shift();
      this.droppedSegments += 1;
    }
    this.version += 1;
  }

  advance(count: number): void {
    if (!Number.isInteger(count) || count < 1 || count > 1024)
      throw new Error('A batch must contain between 1 and 1024 updates.');
    if (!Number.isSafeInteger(this.updates + count + this.version))
      throw new Error(
        'Update counter limit reached. Reset to begin a new run.',
      );
    const segment = this.current;
    for (let index = 0; index < count; index += 1) {
      this.currentValue = sampleGaussian(segment.parameters, this.rng);
      recordMoment(segment.moments, this.currentValue);
      recordHistogram(segment.histogram, this.currentValue);
      segment.convergence.record(segment.moments.count, segment.moments.mean);
    }
    this.updates += count;
    this.version += count;
  }

  snapshot(): Snapshot {
    const segments: SegmentSnapshot[] = this.segments.map((segment) => ({
      id: segment.id,
      parameters: { ...segment.parameters },
      startUpdate: segment.startUpdate,
      moments: summarizeMoments(segment.moments),
      histogram: { ...segment.histogram, bins: [...segment.histogram.bins] },
      convergence: segment.convergence.snapshot(),
    }));
    const current = segments.at(-1)!;
    return {
      runId: this.runId,
      version: this.version,
      configuration: { parameters: { ...current.parameters }, seed: this.seed },
      currentValue: this.currentValue,
      currentAction:
        this.currentValue === null
          ? null
          : gaussianAction(this.currentValue, current.parameters),
      updates: this.updates,
      warmupUpdates: 0,
      strideUpdates: 1,
      moments: { ...current.moments },
      histogram: { ...current.histogram, bins: [...current.histogram.bins] },
      segments,
      activeSegmentId: current.id,
      droppedSegments: this.droppedSegments,
    };
  }
}

export class GaussianEngine {
  private run: GaussianRun | null = null;
  private runId = 0;
  handle(request: WorkerRequest): WorkerResponse {
    try {
      if (!Number.isSafeInteger(request.runId) || request.runId < 1)
        throw new Error('Invalid run ID.');
      if (request.type === 'initialize') {
        if (request.runId <= this.runId) throw new Error('Stale run ID.');
        const run = new GaussianRun(request.runId, request.configuration);
        this.run = run;
        this.runId = request.runId;
      } else {
        if (request.runId !== this.runId || !this.run)
          throw new Error('Stale or uninitialized run.');
        if (request.type === 'advance') this.run.advance(request.count);
        else if (request.type === 'changeParameters')
          this.run.changeParameters(request.parameters);
        else if (request.type !== 'snapshot')
          throw new Error('Unknown worker command.');
      }
      return { type: 'snapshot', snapshot: this.run!.snapshot() };
    } catch (error) {
      return {
        type: 'error',
        runId: request.runId,
        message:
          error instanceof Error ? error.message : 'Worker command failed.',
      };
    }
  }
}
