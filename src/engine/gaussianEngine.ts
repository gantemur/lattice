import { sampleGaussian } from '../algorithms/gaussianSampler';
import { createRng } from '../algorithms/rng';
import { gaussianAction, gaussianReference } from '../models/gaussian';
import { createHistogram, recordHistogram } from '../observables/histogram';
import {
  emptyMoments,
  recordMoment,
  summarizeMoments,
} from '../observables/moments';
import type {
  RunConfiguration,
  Snapshot,
  WorkerRequest,
  WorkerResponse,
} from './protocol';

export class GaussianRun {
  private readonly configuration: RunConfiguration;
  private readonly rng;
  private readonly moments = emptyMoments();
  private readonly histogram;
  private currentValue: number | null = null;

  constructor(
    private readonly runId: number,
    configuration: RunConfiguration,
  ) {
    const reference = gaussianReference(configuration.parameters);
    this.rng = createRng(configuration.seed);
    this.configuration = {
      ...configuration,
      parameters: { ...configuration.parameters },
    };
    this.histogram = createHistogram(
      reference.mean - 4 * reference.standardDeviation,
      reference.mean + 4 * reference.standardDeviation,
    );
  }

  advance(count: number): void {
    if (!Number.isInteger(count) || count < 1 || count > 1024) {
      throw new Error('A batch must contain between 1 and 1024 updates.');
    }
    for (let index = 0; index < count; index += 1) {
      this.currentValue = sampleGaussian(
        this.configuration.parameters,
        this.rng,
      );
      recordMoment(this.moments, this.currentValue);
      recordHistogram(this.histogram, this.currentValue);
    }
  }

  snapshot(): Snapshot {
    return {
      runId: this.runId,
      version: this.moments.count,
      configuration: {
        ...this.configuration,
        parameters: { ...this.configuration.parameters },
      },
      currentValue: this.currentValue,
      currentAction:
        this.currentValue === null
          ? null
          : gaussianAction(this.currentValue, this.configuration.parameters),
      updates: this.moments.count,
      warmupUpdates: 0,
      strideUpdates: 1,
      moments: summarizeMoments(this.moments),
      histogram: { ...this.histogram, bins: [...this.histogram.bins] },
    };
  }
}

/** Same command handler is used by the actual browser worker and unit tests. */
export class GaussianEngine {
  private run: GaussianRun | null = null;
  private runId = 0;

  handle(request: WorkerRequest): WorkerResponse {
    try {
      if (!Number.isSafeInteger(request.runId) || request.runId < 1)
        throw new Error('Invalid run ID.');
      if (request.type === 'initialize') {
        if (request.runId <= this.runId) throw new Error('Stale run ID.');
        // Validate before replacing the authoritative state.
        const run = new GaussianRun(request.runId, request.configuration);
        this.run = run;
        this.runId = request.runId;
      } else {
        if (request.runId !== this.runId || !this.run)
          throw new Error('Stale or uninitialized run.');
        if (request.type === 'advance') this.run.advance(request.count);
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
