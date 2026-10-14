import { createRng, validateSeed } from '../algorithms/rng';
import type { Rng } from '../algorithms/rng';
import { metropolisU1, validateU1Width } from '../algorithms/u1GaugeSampler';
import type { U1Transition } from '../algorithms/u1GaugeSampler';
import {
  u1GaugeModel,
  u1GaugeTransform,
  u1Observables,
  wilsonAngle,
} from '../models/u1Gauge';
import type { GaugeGeometry } from '../domain/gaugeGeometry';
import { emptyMoments, recordMoment } from '../observables/moments';
import type { Moments } from '../observables/moments';

export type U1Settings = {
  geometry: GaugeGeometry;
  K: number;
  sampler: 'metropolis';
  width: number;
  warmup: number;
  stride: number;
};
export type U1Configuration = U1Settings & { seed: number };
export const defaultU1: U1Configuration = {
  geometry: 'square',
  K: 0.7,
  sampler: 'metropolis',
  width: 0.8,
  warmup: 200,
  stride: 2,
  seed: 12345,
};
export const U1_BINS = 24;
export const U1_ADVANCE_LIMIT = 10000;
export type U1Event =
  U1Transition | { kind: 'gauge-transform'; vertex: string; alpha: number };
export type U1Segment = {
  id: number;
  settings: U1Settings;
  updates: number;
  samples: number;
  accepted: number;
  rejected: number;
  moments: Record<string, Moments>;
  /** Fixed [-π,π) bins for invariant face/loop angles, never raw link means. */
  histograms: Record<string, number[]>;
  history: {
    update: number;
    angles: number[];
    values: Record<string, number>;
  }[];
};
export type U1Snapshot = {
  runId: number;
  version: number;
  configuration: U1Configuration;
  angles: number[];
  updates: number;
  draws: number;
  event: U1Event | null;
  segments: U1Segment[];
};
export type U1Request =
  | { type: 'initialize'; runId: number; configuration: U1Configuration }
  | ({ runId: number; version: number } & (
      | { type: 'advance'; count: number }
      | { type: 'change'; settings: U1Settings }
      | { type: 'gauge-transform'; vertex: string; alpha: number }
    ));
export type U1Response =
  | { type: 'snapshot'; snapshot: U1Snapshot }
  | { type: 'error'; runId: number; message: string };
export function validateU1Settings(settings: U1Settings): void {
  u1GaugeModel(settings.geometry, settings.K);
  validateU1Width(settings.width);
  if (
    settings.sampler !== 'metropolis' ||
    !Number.isInteger(settings.warmup) ||
    settings.warmup < 0 ||
    settings.warmup > 10000 ||
    !Number.isInteger(settings.stride) ||
    settings.stride < 1 ||
    settings.stride > 1000
  )
    throw new Error(
      'Use angular Metropolis, 0–10000 warm-up sweeps and stride 1–1000.',
    );
}
/** One authoritative circle-valued state. Bessel references do not enter this
 * engine. Full moments/histograms and the bounded measured-vector ring use the
 * SAME scheduled states; no rendering or tool choice controls measurements. */
export class U1GaugeRun {
  private model;
  private rng: Rng;
  private configuration: U1Configuration;
  private angles: number[];
  private updates = 0;
  private draws = 0;
  private version = 0;
  private event: U1Event | null = null;
  private segments: U1Segment[] = [];
  constructor(
    configuration: U1Configuration,
    private readonly runId = 1,
  ) {
    validateU1Settings(configuration);
    validateSeed(configuration.seed);
    this.configuration = { ...configuration };
    this.model = u1GaugeModel(configuration.geometry, configuration.K);
    const stream = createRng(configuration.seed);
    this.rng = {
      uniform: () => {
        this.draws++;
        return stream.uniform();
      },
    };
    this.angles = this.model.domain.edges.map(() => 0); // Unmeasured, not an equilibrium draw.
    this.newSegment(configuration);
  }
  private newSegment(settings: U1Settings) {
    const { geometry, K, sampler, width, warmup, stride } = settings;
    this.segments.push({
      id: (this.segments.at(-1)?.id ?? 0) + 1,
      settings: { geometry, K, sampler, width, warmup, stride },
      updates: 0,
      samples: 0,
      accepted: 0,
      rejected: 0,
      moments: Object.fromEntries(
        Object.keys(u1Observables(this.model, this.angles)).map((id) => [
          id,
          emptyMoments(),
        ]),
      ),
      histograms: Object.fromEntries(
        this.model.loops.map((l) => [l.id, Array<number>(U1_BINS).fill(0)]),
      ),
      history: [],
    });
    if (this.segments.length > 8) this.segments.shift();
  }
  change(settings: U1Settings) {
    validateU1Settings(settings);
    if (settings.geometry !== this.configuration.geometry)
      throw new Error('Geometry changes require a new seeded session.');
    const previous = this.segments.at(-1)!.settings;
    if (
      (['geometry', 'K', 'sampler', 'width', 'warmup', 'stride'] as const).some(
        (key) => settings[key] !== previous[key],
      )
    ) {
      this.model = u1GaugeModel(settings.geometry, settings.K);
      this.configuration = { ...settings, seed: this.configuration.seed };
      this.newSegment(settings);
      this.event = null;
    }
    this.version++;
  }
  transform(vertex: string, alpha: number) {
    if (!Number.isFinite(alpha) || Math.abs(alpha) > Math.PI)
      throw new Error('Use a vertex phase α in [−π,π].');
    const transformed = u1GaugeTransform(this.model, this.angles, {
      [vertex]: alpha,
    });
    // Validate the complete command before changing any field or metadata.
    this.angles = transformed;
    this.event = { kind: 'gauge-transform', vertex, alpha };
    this.version++;
  }
  advance(count: number) {
    if (!Number.isInteger(count) || count < 1 || count > U1_ADVANCE_LIMIT)
      throw new Error(`Advance 1–${U1_ADVANCE_LIMIT} updates.`);
    const segment = this.segments.at(-1)!;
    const { width, warmup, stride } = segment.settings;
    const edges = this.angles.length;
    for (let i = 0; i < count; i++) {
      const event = metropolisU1(this.model, this.angles, width, this.rng);
      this.angles = event.angles;
      this.event = event;
      this.updates++;
      segment.updates++;
      segment[event.kind]++;
      const afterWarmup = segment.updates - warmup * edges;
      if (afterWarmup > 0 && afterWarmup % (stride * edges) === 0) {
        const values = u1Observables(this.model, this.angles);
        segment.samples++;
        for (const [id, value] of Object.entries(values))
          recordMoment(segment.moments[id]!, value);
        for (const loop of this.model.loops) {
          const angle = wilsonAngle(this.model, this.angles, loop.boundary);
          const bin = Math.min(
            U1_BINS - 1,
            Math.floor(((angle + Math.PI) * U1_BINS) / (2 * Math.PI)),
          );
          segment.histograms[loop.id]![bin]!++;
        }
        segment.history.push({
          update: this.updates,
          angles: [...this.angles],
          values,
        });
        if (segment.history.length > 256) segment.history.shift();
      }
    }
    this.version++;
  }
  snapshot(): U1Snapshot {
    return structuredClone({
      runId: this.runId,
      version: this.version,
      configuration: this.configuration,
      angles: this.angles,
      updates: this.updates,
      draws: this.draws,
      event: this.event,
      segments: this.segments,
    });
  }
}
/** Commands carry the last acknowledged run/version. No autonomous worker loop:
 * one bounded batch finishes before another command can run. Errors are atomic
 * and recoverable; the client stops scheduling until explicit Reset. */
export class U1GaugeEngine {
  private run: U1GaugeRun | null = null;
  handle(request: U1Request): U1Response {
    try {
      if (request.type === 'initialize') {
        if (
          !Number.isSafeInteger(request.runId) ||
          request.runId < 1 ||
          (this.run && request.runId <= this.run.snapshot().runId)
        )
          throw new Error('Stale run identity.');
        this.run = new U1GaugeRun(request.configuration, request.runId);
      } else {
        const current = this.run?.snapshot();
        if (
          !current ||
          current.runId !== request.runId ||
          current.version !== request.version
        )
          throw new Error('Stale run or snapshot version.');
        if (request.type === 'advance') this.run!.advance(request.count);
        else if (request.type === 'change') this.run!.change(request.settings);
        else if (request.type === 'gauge-transform')
          this.run!.transform(request.vertex, request.alpha);
        else throw new Error('Unknown U(1) command.');
      }
      return { type: 'snapshot', snapshot: this.run!.snapshot() };
    } catch (error) {
      return {
        type: 'error',
        runId: request.runId,
        message:
          error instanceof Error ? error.message : 'Invalid U(1) command.',
      };
    }
  }
}
