import { topologyKey } from '../domain/graph';
import { observableValue } from '../models/ising';
import { IsingMeasurements } from '../observables/isingMeasurements';
import { createRng } from '../algorithms/rng';
import { transition, validateSettings } from '../algorithms/transitions';
import type { Settings } from '../algorithms/transitions';
import {
  initialState,
  modelAction,
  modelReference,
  modelSummary,
  validState,
} from '../models/singleVariable';
import { createHistogram, recordHistogram } from '../observables/histogram';
import {
  emptyMoments,
  recordMoment,
  summarizeMoments,
} from '../observables/moments';
import { ConvergenceHistory } from '../observables/convergence';
import { TransitionHistory } from '../observables/trajectory';
import { MAX_SEGMENTS } from './protocol';
import type {
  RunConfiguration,
  Snapshot,
  WorkerRequest,
  WorkerResponse,
  SegmentSnapshot,
} from './protocol';

function settingsKey({ model, sampler }: Settings) {
  if (model.kind === 'ising')
    return JSON.stringify([model.parameters, sampler]);
  return `${model.kind}:${modelSummary(model)}:${sampler.kind}:${sampler.kind === 'metropolis' ? `${model.kind === 'gaussian' ? sampler.width : 1}:${sampler.warmup}` : ''}`;
}
function newSegment(
  id: number,
  settings: Settings,
  startUpdate: number,
  value: number | null,
  initialization: string,
) {
  const { model, sampler } = structuredClone(settings);
  const reference = modelReference(model);
  const histogram =
    model.kind === 'gaussian'
      ? createHistogram(
          reference.mean - 4 * reference.standardDeviation,
          reference.mean + 4 * reference.standardDeviation,
        )
      : model.kind === 'ising'
        ? createHistogram(
            -model.parameters.domain.vertices.length - 1,
            model.parameters.domain.vertices.length + 1,
            model.parameters.domain.vertices.length + 1,
          )
        : model.kind === 'spin'
          ? createHistogram(-2, 2, 2)
          : createHistogram(
              -0.5,
              model.parameters.n + 0.5,
              model.parameters.n + 1,
            );
  return {
    id,
    isingMeasurements:
      model.kind === 'ising' ? new IsingMeasurements(model) : undefined,
    model,
    sampler,
    startUpdate,
    initialValue: value,
    initialization,
    updates: 0,
    warmupUpdates: 0,
    warmupTarget:
      sampler.kind === 'metropolis'
        ? sampler.warmup
        : sampler.kind === 'heat-bath' && model.kind === 'ising'
          ? (sampler.warmup ?? 200)
          : 0,
    accepted: 0,
    rejected: 0,
    self: 0,
    moments: emptyMoments(),
    histogram,
    convergence: new ConvergenceHistory(),
    trajectory: new TransitionHistory(),
  };
}
export class SimulationRun {
  private readonly seed: number;
  private readonly rng;
  private segments;
  private currentValue: number | null;
  private updates = 0;
  private warmupUpdates = 0;
  private version = 0;
  private droppedSegments = 0;

  constructor(
    private readonly runId: number,
    configuration: RunConfiguration,
  ) {
    validateSettings(configuration);
    this.rng = createRng(configuration.seed);
    this.seed = configuration.seed;
    this.currentValue =
      configuration.sampler.kind === 'direct'
        ? null
        : initialState(configuration.model);
    this.segments = [
      newSegment(
        1,
        configuration,
        0,
        this.currentValue,
        this.currentValue === null
          ? 'No sample yet.'
          : 'Deterministic initial configuration; not a measurement.',
      ),
    ];
  }
  private get current() {
    return this.segments.at(-1)!;
  }

  changeSettings(settings: Settings): void {
    validateSettings(settings);
    if (settings.model.kind !== this.current.model.kind)
      throw new Error('Changing model family requires a new session.');
    if (
      settings.model.kind === 'ising' &&
      this.current.model.kind === 'ising' &&
      topologyKey(settings.model.parameters.domain) !==
        topologyKey(this.current.model.parameters.domain)
    )
      throw new Error('Topology changes require a new session.');
    if (settingsKey(settings) === settingsKey(this.current)) return;
    let initialization = 'Configuration and RNG stream preserved.';
    if (
      this.currentValue !== null &&
      !validState(settings.model, this.currentValue)
    ) {
      this.currentValue =
        settings.model.kind === 'binomial'
          ? Math.min(
              settings.model.parameters.n,
              Math.max(0, this.currentValue),
            )
          : initialState(settings.model);
      initialization =
        'Previous configuration was outside the new support; clamped to the new support without drawing randomness.';
    } else if (
      this.currentValue === null &&
      settings.sampler.kind !== 'direct'
    ) {
      this.currentValue = initialState(settings.model);
      initialization =
        'Deterministic initial configuration; RNG stream preserved.';
    }
    this.segments.push(
      newSegment(
        this.current.id + 1,
        settings,
        this.updates,
        this.currentValue,
        initialization,
      ),
    );
    if (this.segments.length > MAX_SEGMENTS) {
      this.segments.shift();
      this.droppedSegments++;
    }
    this.version++;
  }

  advance(count: number): void {
    if (!Number.isInteger(count) || count < 1 || count > 1024)
      throw new Error('A batch must contain between 1 and 1024 updates.');
    if (!Number.isSafeInteger(this.version + count))
      throw new Error(
        'Update counter limit reached. Reset to begin a new run.',
      );
    const segment = this.current;
    for (let index = 0; index < count; index++) {
      const result = transition(segment, this.currentValue, this.rng);
      this.currentValue = result.result;
      this.updates++;
      segment.updates++;
      const warmup = segment.updates <= segment.warmupTarget;
      if (result.kind === 'metropolis') segment[result.outcome]++;
      else if (result.kind === 'heat-bath' && segment.model.kind === 'ising')
        segment[result.result === result.current ? 'self' : 'accepted']++;
      if (warmup) {
        segment.warmupUpdates++;
        this.warmupUpdates++;
      } else {
        const measured =
          segment.model.kind === 'ising'
            ? observableValue(segment.model, this.currentValue)
            : this.currentValue;
        segment.isingMeasurements?.record(this.currentValue);
        recordMoment(segment.moments, measured);
        recordHistogram(segment.histogram, measured);
        segment.convergence.record(segment.moments.count, segment.moments.mean);
      }
      segment.trajectory.record({
        ...result,
        update: this.updates,
        segmentUpdate: segment.updates,
        segmentId: segment.id,
        warmup,
      });
    }
    this.version += count;
  }

  snapshot(): Snapshot {
    const segments: SegmentSnapshot[] = this.segments.map(
      ({
        convergence,
        trajectory,
        moments,
        histogram,
        isingMeasurements,
        ...segment
      }) => ({
        ising: isingMeasurements?.snapshot(),
        ...structuredClone(segment),
        moments: summarizeMoments(moments),
        histogram: { ...histogram, bins: [...histogram.bins] },
        convergence: convergence.snapshot(),
        trajectory: trajectory.snapshot(),
      }),
    );
    const current = segments.at(-1)!;
    return {
      runId: this.runId,
      version: this.version,
      configuration: {
        model: structuredClone(current.model),
        sampler: { ...current.sampler },
        seed: this.seed,
      },
      currentValue: this.currentValue,
      currentAction:
        this.currentValue === null
          ? null
          : modelAction(current.model, this.currentValue),
      updates: this.updates,
      warmupUpdates: this.warmupUpdates,
      strideUpdates: 1,
      moments: { ...current.moments },
      histogram: { ...current.histogram, bins: [...current.histogram.bins] },
      segments,
      activeSegmentId: current.id,
      droppedSegments: this.droppedSegments,
    };
  }
}
export class SimulationEngine {
  private run: SimulationRun | null = null;
  private runId = 0;
  handle(request: WorkerRequest): WorkerResponse {
    try {
      if (!Number.isSafeInteger(request.runId) || request.runId < 1)
        throw new Error('Invalid run ID.');
      if (request.type === 'initialize') {
        if (request.runId <= this.runId) throw new Error('Stale run ID.');
        const run = new SimulationRun(request.runId, request.configuration);
        this.run = run;
        this.runId = request.runId;
      } else {
        if (request.runId !== this.runId || !this.run)
          throw new Error('Stale or uninitialized run.');
        if (request.type === 'advance') this.run.advance(request.count);
        else if (request.type === 'changeSettings')
          this.run.changeSettings(request.settings);
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
