import { createRng, validateSeed } from '../algorithms/rng';
import { pottsTransition } from '../algorithms/pottsSampler';
import type { PottsSampler, PottsTrace } from '../algorithms/pottsSampler';
import {
  pottsModel,
  pottsObservables,
  pottsSpatial,
  validatePottsState,
} from '../models/potts';
import type { PottsParameters, PottsModel } from '../models/potts';
import { pottsStateCount, exactPotts } from '../models/pottsExact';
import { pottsGraph, pottsTopology } from '../domain/pottsDomain';
import { emptyMoments, recordMoment } from '../observables/moments';
import type { Moments } from '../observables/moments';

export type PottsSettings = {
  parameters: PottsParameters;
  sampler: PottsSampler;
  warmup: number;
  stride: number;
};
export type PottsConfiguration = PottsSettings & { seed: number };
export const defaultSmallPotts: PottsConfiguration = {
  parameters: { q: 3, h: 0, geometry: pottsGraph('dimer') },
  sampler: 'direct',
  warmup: 100,
  stride: 1,
  seed: 12345,
};
export const defaultLatticePotts: PottsConfiguration = {
  parameters: {
    q: 3,
    h: 0,
    geometry: {
      kind: 'lattice',
      shape: { lx: 16, ly: 16, periodicX: true, periodicY: true },
      kx: 0.7,
      ky: 0.7,
    },
  },
  sampler: 'metropolis',
  warmup: 100,
  stride: 1,
  seed: 12345,
};
export const POTTS_ADVANCE_LIMIT = 4096;
export type PottsMeasurement = {
  update: number;
  values: Record<string, number>;
  colors?: Uint8Array;
};
export type PottsSegment = {
  id: number;
  settings: PottsSettings;
  startUpdate: number;
  updates: number;
  warmupUpdates: number;
  samples: number;
  outcomes: Record<PottsTrace['outcome'], number>;
  moments: Record<string, Moments>;
  occupancy: number[][];
  bondCounts: number[];
  pairCounts: number[][] | null;
  spatialX: { r: number; pairs: number; moments: Moments }[];
  spatialY: { r: number; pairs: number; moments: Moments }[];
  history: PottsMeasurement[];
};
export type PottsSnapshot = {
  runId: number;
  version: number;
  configuration: PottsConfiguration;
  colors: Uint8Array;
  updates: number;
  draws: number;
  trace: PottsTrace | null;
  segments: PottsSegment[];
  droppedSegments: number;
};
export type PottsRequest =
  | { type: 'initialize'; runId: number; configuration: PottsConfiguration }
  | ({ runId: number; version: number } & (
      | { type: 'advance'; count: number }
      | { type: 'change'; settings: PottsSettings }
    ));
export type PottsResponse =
  | { type: 'snapshot'; snapshot: PottsSnapshot }
  | { type: 'error'; runId: number; message: string };
export function validatePottsSettings(s: PottsSettings): PottsModel {
  const model = pottsModel(s.parameters);
  if (
    !['direct', 'metropolis', 'heat-bath'].includes(s.sampler) ||
    !Number.isInteger(s.warmup) ||
    s.warmup < 0 ||
    s.warmup > 10000 ||
    !Number.isInteger(s.stride) ||
    s.stride < 1 ||
    s.stride > 1000
  )
    throw new Error(
      'Choose a Potts sampler, 0–10000 warm-up sweeps and stride 1–1000.',
    );
  if (s.sampler === 'direct' && pottsStateCount(model) === null)
    throw new Error('Direct sampling requires q^V≤256.');
  return model;
}
export function samePottsSupport(
  a: PottsParameters,
  b: PottsParameters,
): boolean {
  return (
    a.q === b.q &&
    a.geometry.kind === b.geometry.kind &&
    pottsTopology(a.geometry) === pottsTopology(b.geometry)
  );
}
function settingsOnly(c: PottsSettings): PottsSettings {
  return structuredClone({
    parameters: c.parameters,
    sampler: c.sampler,
    warmup: c.warmup,
    stride: c.stride,
  });
}
/** One run implementation for graph and rectangular sessions. All-zero colors
 * initialize without RNG or measurement. Only scheduled post-transition states
 * enter BOTH full aggregates and the recent ring, including stays/rejections. */
export class PottsRun {
  private model: PottsModel;
  private configuration: PottsConfiguration;
  private colors: Uint8Array;
  private updates = 0;
  private draws = 0;
  private version = 0;
  private droppedSegments = 0;
  private trace: PottsTrace | null = null;
  private segments: PottsSegment[] = [];
  private rng;
  constructor(
    configuration: PottsConfiguration,
    private readonly runId = 1,
  ) {
    this.model = validatePottsSettings(configuration);
    validateSeed(configuration.seed);
    this.configuration = {
      ...settingsOnly(configuration),
      seed: configuration.seed,
    };
    this.colors = new Uint8Array(this.model.size);
    validatePottsState(this.model, this.colors);
    const stream = createRng(configuration.seed);
    this.rng = {
      uniform: () => {
        this.draws++;
        return stream.uniform();
      },
    };
    // Resolve eligible direct CDF before any RNG consumption, never while drawing.
    if (configuration.sampler === 'direct') exactPotts(this.model);
    this.newSegment();
  }
  private newSegment() {
    const model = this.model;
    const spatial = (axis: 0 | 1) =>
      pottsSpatial(model, this.colors, axis).map(({ r, pairs }) => ({
        r,
        pairs,
        moments: emptyMoments(),
      }));
    this.segments.push({
      id: (this.segments.at(-1)?.id ?? 0) + 1,
      settings: settingsOnly(this.configuration),
      startUpdate: this.updates,
      updates: 0,
      warmupUpdates: 0,
      samples: 0,
      outcomes: {
        draw: 0,
        self: 0,
        accepted: 0,
        rejected: 0,
        changed: 0,
        unchanged: 0,
      },
      moments: Object.fromEntries(
        Object.keys(pottsObservables(model, this.colors)).map((key) => [
          key,
          emptyMoments(),
        ]),
      ),
      occupancy: Array.from({ length: model.size }, () =>
        Array<number>(model.q).fill(0),
      ),
      bondCounts: model.bonds.map(() => 0),
      pairCounts:
        pottsStateCount(model) !== null
          ? Array.from({ length: model.size }, () =>
              Array<number>(model.size).fill(0),
            )
          : null,
      spatialX: spatial(0),
      spatialY: spatial(1),
      history: [],
    });
    if (this.segments.length > 8) {
      this.segments.shift();
      this.droppedSegments++;
    }
  }
  change(settings: PottsSettings) {
    const nextModel = validatePottsSettings(settings);
    if (!samePottsSupport(this.configuration.parameters, settings.parameters))
      throw new Error(
        'Geometry, boundaries or q changes require a new seeded session.',
      );
    if (settings.sampler === 'direct') exactPotts(nextModel);
    const next = settingsOnly(settings);
    if (
      JSON.stringify(next) !== JSON.stringify(settingsOnly(this.configuration))
    ) {
      this.configuration = { ...next, seed: this.configuration.seed };
      this.model = nextModel;
      this.newSegment();
      this.trace = null;
    }
    this.version++;
  }
  private measure(segment: PottsSegment) {
    const model = this.model,
      values = pottsObservables(model, this.colors);
    segment.samples++;
    for (const [key, value] of Object.entries(values))
      recordMoment(segment.moments[key]!, value);
    for (let i = 0; i < model.size; i++)
      segment.occupancy[i]![this.colors[i]!]!++;
    model.bonds.forEach((b, i) => {
      if (this.colors[b.tail] === this.colors[b.head]) segment.bondCounts[i]!++;
    });
    if (segment.pairCounts)
      for (let i = 0; i < model.size; i++)
        for (let j = 0; j < model.size; j++)
          if (this.colors[i] === this.colors[j]) segment.pairCounts[i]![j]!++;
    for (const axis of [0, 1] as const) {
      const target = axis === 0 ? segment.spatialX : segment.spatialY;
      pottsSpatial(model, this.colors, axis).forEach((value, i) =>
        recordMoment(target[i]!.moments, value.same),
      );
    }
    segment.history.push({
      update: this.updates,
      values,
      ...(model.size <= 8 ? { colors: this.colors.slice() } : {}),
    });
    if (segment.history.length > 256) segment.history.shift();
  }
  advance(count: number) {
    if (
      !Number.isInteger(count) ||
      count < 1 ||
      count > POTTS_ADVANCE_LIMIT ||
      !Number.isSafeInteger(this.updates + count)
    )
      throw new Error('Advance 1–4096 updates within the safe counter range.');
    const segment = this.segments.at(-1)!,
      { sampler, warmup, stride } = segment.settings,
      size = this.model.size;
    for (let i = 0; i < count; i++) {
      this.trace = pottsTransition(this.model, sampler, this.colors, this.rng);
      this.updates++;
      segment.updates++;
      segment.outcomes[this.trace.outcome]++;
      if (sampler === 'direct') this.measure(segment);
      else {
        if (segment.updates <= warmup * size) segment.warmupUpdates++;
        const afterWarmup = segment.updates - warmup * size;
        if (afterWarmup > 0 && afterWarmup % (stride * size) === 0)
          this.measure(segment);
      }
    }
    this.version++;
  }
  snapshot(): PottsSnapshot {
    return structuredClone({
      runId: this.runId,
      version: this.version,
      configuration: this.configuration,
      colors: this.colors,
      updates: this.updates,
      draws: this.draws,
      trace: this.trace,
      segments: this.segments,
      droppedSegments: this.droppedSegments,
    });
  }
}
/** Versioned commands are validated before mutation. One worker message runs to
 * completion; the client owns scheduling, so errors cannot leave a hidden loop. */
export class PottsEngine {
  private run: PottsRun | null = null;
  handle(request: PottsRequest): PottsResponse {
    try {
      if (request.type === 'initialize') {
        if (
          !Number.isSafeInteger(request.runId) ||
          request.runId < 1 ||
          (this.run && request.runId <= this.run.snapshot().runId)
        )
          throw new Error('Stale run identity.');
        this.run = new PottsRun(request.configuration, request.runId);
      } else {
        const current = this.run?.snapshot();
        if (
          !current ||
          current.runId !== request.runId ||
          current.version !== request.version
        )
          throw new Error('Stale run or version.');
        if (request.type === 'advance') this.run!.advance(request.count);
        else if (request.type === 'change') this.run!.change(request.settings);
        else throw new Error('Unknown Potts command.');
      }
      return { type: 'snapshot', snapshot: this.run!.snapshot() };
    } catch (error) {
      return {
        type: 'error',
        runId: request.runId,
        message:
          error instanceof Error ? error.message : 'Invalid Potts command.',
      };
    }
  }
}
