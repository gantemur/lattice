import { createRng, validateSeed } from '../algorithms/rng';
import type { Rng } from '../algorithms/rng';
import { directGauge, metropolisGauge } from '../algorithms/z2GaugeSampler';
import type { GaugeTransition } from '../algorithms/z2GaugeSampler';
import {
  gaugeModel,
  gaugeObservables,
  gaugeState,
  gaugeTransform,
} from '../models/z2Gauge';
import type { GaugeGeometry } from '../models/z2Gauge';
import { exactGauge } from '../models/z2GaugeExact';
import { emptyMoments, recordMoment } from '../observables/moments';
import type { Moments } from '../observables/moments';

export type GaugeSettings = {
  geometry: GaugeGeometry;
  K: number;
  sampler: 'direct' | 'metropolis';
  warmup: number;
  stride: number;
};
export type GaugeConfiguration = GaugeSettings & { seed: number };
export const defaultGauge: GaugeConfiguration = {
  geometry: 'square',
  K: 0.7,
  sampler: 'direct',
  warmup: 10,
  stride: 1,
  seed: 12345,
};
export type GaugeEvent =
  GaugeTransition | { kind: 'gauge-transform'; vertex: string };
export type GaugeSegment = {
  id: number;
  settings: GaugeSettings;
  updates: number;
  samples: number;
  accepted: number;
  rejected: number;
  self: number;
  moments: Record<string, Moments>;
  plus: Record<string, number>;
  winding: number[];
  history: {
    update: number;
    links: number[];
    values: Record<string, number>;
    kind: GaugeTransition['kind'];
    measured: boolean;
  }[];
};
export type GaugeSnapshot = {
  runId: number;
  version: number;
  configuration: GaugeConfiguration;
  links: number[];
  updates: number;
  draws: number;
  event: GaugeEvent | null;
  segments: GaugeSegment[];
};
export type GaugeRequest =
  | { type: 'initialize'; runId: number; configuration: GaugeConfiguration }
  | ({ runId: number; version: number } & (
      | { type: 'advance'; count: number }
      | { type: 'change'; settings: GaugeSettings }
      | { type: 'gauge-transform'; vertex: string }
    ));
export type GaugeResponse =
  | { type: 'snapshot'; snapshot: GaugeSnapshot }
  | { type: 'error'; runId: number; message: string };

export function validateGaugeSettings(s: GaugeSettings): void {
  gaugeModel(s.geometry, s.K);
  if (
    !['direct', 'metropolis'].includes(s.sampler) ||
    !Number.isInteger(s.warmup) ||
    s.warmup < 0 ||
    s.warmup > 10000 ||
    !Number.isInteger(s.stride) ||
    s.stride < 1 ||
    s.stride > 1000
  )
    throw new Error(
      'Use a supported sampler, 0–10000 warm-up sweeps and stride 1–1000.',
    );
}
/** A tiny link-specific run. Full moments outlive the bounded plotting ring.
 * No React state or tool selection participates in retention or randomness. */
export class GaugeRun {
  private model;
  private reference;
  private rng: Rng;
  private configuration: GaugeConfiguration;
  private links: number[];
  private updates = 0;
  private draws = 0;
  private version = 0;
  private event: GaugeEvent | null = null;
  private segments: GaugeSegment[] = [];
  constructor(
    configuration: GaugeConfiguration,
    private readonly runId = 1,
  ) {
    validateGaugeSettings(configuration);
    validateSeed(configuration.seed);
    this.configuration = { ...configuration };
    this.model = gaugeModel(configuration.geometry, configuration.K);
    this.reference = exactGauge(this.model);
    const stream = createRng(configuration.seed);
    this.rng = {
      uniform: () => {
        this.draws++;
        return stream.uniform();
      },
    };
    this.links = gaugeState(this.model, 0); // Explicit unmeasured all-positive initialization.
    this.newSegment(configuration);
  }
  private newSegment(settings: GaugeSettings) {
    const { geometry, K, sampler, warmup, stride } = settings;
    const ids = Object.keys(gaugeObservables(this.model, this.links));
    this.segments.push({
      id: (this.segments.at(-1)?.id ?? 0) + 1,
      settings: { geometry, K, sampler, warmup, stride },
      updates: 0,
      samples: 0,
      accepted: 0,
      rejected: 0,
      self: 0,
      moments: Object.fromEntries(ids.map((id) => [id, emptyMoments()])),
      plus: Object.fromEntries(this.model.domain.faces.map((f) => [f.id, 0])),
      winding: [0, 0, 0, 0],
      history: [],
    });
    if (this.segments.length > 8) this.segments.shift();
  }
  change(settings: GaugeSettings) {
    validateGaugeSettings(settings);
    if (settings.geometry !== this.configuration.geometry)
      throw new Error('Geometry changes require a new seeded session.');
    const previous = this.segments.at(-1)!.settings;
    if (
      (['geometry', 'K', 'sampler', 'warmup', 'stride'] as const).some(
        (key) => settings[key] !== previous[key],
      )
    ) {
      this.model = gaugeModel(settings.geometry, settings.K);
      this.reference = exactGauge(this.model);
      this.configuration = { ...settings, seed: this.configuration.seed };
      this.newSegment(settings);
      this.event = null;
    }
    this.version++;
  }
  transform(vertex: string) {
    const transformed = gaugeTransform(this.model, this.links, [vertex]);
    this.links = transformed;
    this.event = { kind: 'gauge-transform', vertex };
    this.version++;
  }
  advance(count: number) {
    if (!Number.isInteger(count) || count < 1 || count > 100000)
      throw new Error('Advance 1–100000 updates.');
    const segment = this.segments.at(-1)!;
    const { sampler, warmup, stride } = segment.settings;
    const edges = this.links.length;
    for (let i = 0; i < count; i++) {
      const event =
        sampler === 'direct'
          ? directGauge(this.reference, this.rng, this.model, this.links)
          : metropolisGauge(this.model, this.links, this.rng);
      this.links = event.links;
      this.event = event;
      this.updates++;
      segment.updates++;
      if (event.kind !== 'direct') segment[event.kind]++;
      const afterWarmup = segment.updates - warmup * edges;
      const measured =
        sampler === 'direct' ||
        (afterWarmup > 0 && afterWarmup % (stride * edges) === 0);
      const values = gaugeObservables(this.model, this.links);
      if (measured) {
        segment.samples++;
        for (const [id, value] of Object.entries(values))
          recordMoment(segment.moments[id]!, value);
        for (const id of Object.keys(segment.plus))
          if (values[id] === 1) segment.plus[id]!++;
        if (this.model.geometry === 'torus')
          segment.winding[
            (values.wx === 1 ? 2 : 0) + (values.wy === 1 ? 1 : 0)
          ]!++;
      }
      // One bounded transition ring, including warm-up and unmeasured attempts.
      // The measured flag prevents plots from treating these as extra samples.
      segment.history.push({
        update: this.updates,
        links: [...this.links],
        values,
        kind: event.kind,
        measured,
      });
      if (segment.history.length > 256) segment.history.shift();
    }
    this.version++;
  }
  snapshot(): GaugeSnapshot {
    return structuredClone({
      runId: this.runId,
      version: this.version,
      configuration: this.configuration,
      links: this.links,
      updates: this.updates,
      draws: this.draws,
      event: this.event,
      segments: this.segments,
    });
  }
}
/** Worker command boundary. Validation precedes mutation; stale commands return
 * a recoverable error. JavaScript batches are atomic, with one request in flight
 * enforced by GaugeClient. A transform carries the acknowledged version. */
export class GaugeEngine {
  private run: GaugeRun | null = null;
  handle(request: GaugeRequest): GaugeResponse {
    try {
      if (request.type === 'initialize') {
        if (
          !Number.isSafeInteger(request.runId) ||
          request.runId < 1 ||
          (this.run && request.runId <= this.run.snapshot().runId)
        )
          throw new Error('Stale run identity.');
        this.run = new GaugeRun(request.configuration, request.runId);
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
        else this.run!.transform(request.vertex);
      }
      return { type: 'snapshot', snapshot: this.run!.snapshot() };
    } catch (error) {
      return {
        type: 'error',
        runId: request.runId,
        message:
          error instanceof Error ? error.message : 'Invalid gauge command.',
      };
    }
  }
}
