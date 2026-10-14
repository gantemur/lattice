import { createRng, validateSeed } from '../algorithms/rng';
import { validateXYWidth, xyTransition } from '../algorithms/xySampler';
import type { XYSampler, XYTrace } from '../algorithms/xySampler';
import { xyGraph, xyTopology } from '../domain/xyDomain';
import { TAU, rotateXY, xyModel, xyObservables, xySpatial } from '../models/xy';
import type { XYParameters, XYModel } from '../models/xy';
import { xyVortices } from '../models/xyVortices';
import { emptyMoments, recordMoment } from '../observables/moments';
import type { Moments } from '../observables/moments';
export type XYInitialization = 'aligned' | 'random' | 'vortex' | 'antivortex';
export type XYSettings = {
  parameters: XYParameters;
  sampler: XYSampler;
  width: number;
  warmup: number;
  stride: number;
  initialization: XYInitialization;
};
export type XYConfiguration = XYSettings & { seed: number };
export const defaultSmallXY: XYConfiguration = {
  parameters: { h: 0.7, geometry: xyGraph('site') },
  sampler: 'heat-bath',
  width: 0.8,
  warmup: 100,
  stride: 1,
  initialization: 'aligned',
  seed: 12345,
};
export const defaultLatticeXY: XYConfiguration = {
  ...defaultSmallXY,
  parameters: {
    h: 0,
    geometry: {
      kind: 'lattice',
      shape: { lx: 16, ly: 16, periodicX: true, periodicY: true },
      kx: 0.7,
      ky: 0.7,
    },
  },
  initialization: 'random',
};
export const XY_ADVANCE_LIMIT = 2048;
export type XYMeasurement = {
  update: number;
  values: Record<string, number>;
  angles?: Float64Array;
};
export type XYSegment = {
  id: number;
  settings: XYSettings;
  startUpdate: number;
  updates: number;
  warmupUpdates: number;
  samples: number;
  draws: number;
  trials: number;
  accepted: number;
  rejected: number;
  resampled: number;
  moments: Record<string, Moments>;
  bonds: Moments[];
  sites: { cosine: Moments; sine: Moments; histogram: number[] }[];
  pairs: Moments[][] | null;
  spatialX: { r: number; pairs: number; moments: Moments }[];
  spatialY: { r: number; pairs: number; moments: Moments }[];
  vortex: {
    coverage: number;
    omitted: number;
    moments: Record<
      'density' | 'positive' | 'negative' | 'net' | 'absolute',
      Moments
    >;
  } | null;
  history: XYMeasurement[];
};
export type XYEvent = {
  kind: 'global-rotation';
  alpha: number;
  atUpdate: number;
};
export type XYSnapshot = {
  runId: number;
  version: number;
  configuration: XYConfiguration;
  angles: Float64Array;
  updates: number;
  draws: number;
  trace: XYTrace | null;
  event: XYEvent | null;
  vortices: ReturnType<typeof xyVortices>;
  segments: XYSegment[];
  droppedSegments: number;
};
export type XYRequest =
  | { type: 'initialize'; runId: number; configuration: XYConfiguration }
  | ({ runId: number; version: number } & (
      | { type: 'advance'; count: number }
      | { type: 'change'; settings: XYSettings }
      | { type: 'global-rotation'; alpha: number }
    ));
export type XYResponse =
  | { type: 'snapshot'; snapshot: XYSnapshot }
  | { type: 'error'; runId: number; message: string };
export function validateXYSettings(settings: XYSettings): XYModel {
  const model = xyModel(settings.parameters);
  validateXYWidth(settings.width);
  if (
    !['metropolis', 'heat-bath'].includes(settings.sampler) ||
    !Number.isInteger(settings.warmup) ||
    settings.warmup < 0 ||
    settings.warmup > 10000 ||
    !Number.isInteger(settings.stride) ||
    settings.stride < 1 ||
    settings.stride > 1000 ||
    !['aligned', 'random', 'vortex', 'antivortex'].includes(
      settings.initialization,
    )
  )
    throw new Error(
      'Choose an XY sampler/initialization, 0–10000 warm-up sweeps and stride 1–1000.',
    );
  if (
    ['vortex', 'antivortex'].includes(settings.initialization) &&
    !(model.size === 4 && model.faces.length > 0)
  )
    throw new Error('Vortex fixtures require an open/periodic 2×2 square.');
  return model;
}
export function sameXYSupport(a: XYParameters, b: XYParameters) {
  return (
    a.geometry.kind === b.geometry.kind &&
    xyTopology(a.geometry) === xyTopology(b.geometry)
  );
}
function settingsOnly(c: XYSettings): XYSettings {
  const { parameters, sampler, width, warmup, stride, initialization } = c;
  return structuredClone({
    parameters,
    sampler,
    width,
    warmup,
    stride,
    initialization,
  });
}
/** One seeded session; no reference or renderer owns stochastic state. Ordinary
 * and vortex summaries use the same scheduled configurations, but vortex
 * coverage excludes any ambiguous/noninteger face image, never fills it by 0. */
export class XYRun {
  private model: XYModel;
  private configuration: XYConfiguration;
  private angles: Float64Array;
  private updates = 0;
  private draws = 0;
  private version = 0;
  private droppedSegments = 0;
  private trace: XYTrace | null = null;
  private event: XYEvent | null = null;
  private segments: XYSegment[] = [];
  private rng;
  constructor(
    configuration: XYConfiguration,
    private readonly runId = 1,
  ) {
    this.model = validateXYSettings(configuration);
    validateSeed(configuration.seed);
    this.configuration = {
      ...settingsOnly(configuration),
      seed: configuration.seed,
    };
    const stream = createRng(configuration.seed);
    this.rng = {
      uniform: () => {
        this.draws++;
        return stream.uniform();
      },
    };
    this.angles = new Float64Array(this.model.size);
    if (configuration.initialization === 'random')
      this.angles = Float64Array.from(
        this.angles,
        () => TAU * this.rng.uniform() - Math.PI,
      );
    if (configuration.initialization === 'vortex')
      this.angles = new Float64Array([0, Math.PI / 2, -Math.PI / 2, -Math.PI]);
    if (configuration.initialization === 'antivortex')
      this.angles = new Float64Array([0, -Math.PI / 2, Math.PI / 2, -Math.PI]);
    this.newSegment(); // Initialization is not a measurement or a Markov update.
  }
  private newSegment() {
    const spatial = (axis: 0 | 1) =>
      xySpatial(this.model, this.angles, axis).map(({ r, pairs }) => ({
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
      draws: 0,
      trials: 0,
      accepted: 0,
      rejected: 0,
      resampled: 0,
      moments: Object.fromEntries(
        Object.keys(xyObservables(this.model, this.angles)).map((key) => [
          key,
          emptyMoments(),
        ]),
      ),
      bonds: this.model.bonds.map(emptyMoments),
      sites:
        this.model.size <= 4
          ? Array.from(this.angles, () => ({
              cosine: emptyMoments(),
              sine: emptyMoments(),
              histogram: Array<number>(24).fill(0),
            }))
          : [],
      pairs:
        this.model.size <= 4
          ? Array.from(this.angles, () => Array.from(this.angles, emptyMoments))
          : null,
      spatialX: spatial(0),
      spatialY: spatial(1),
      vortex: this.model.faces.length
        ? {
            coverage: 0,
            omitted: 0,
            moments: {
              density: emptyMoments(),
              positive: emptyMoments(),
              negative: emptyMoments(),
              net: emptyMoments(),
              absolute: emptyMoments(),
            },
          }
        : null,
      history: [],
    });
    if (this.segments.length > 8) {
      this.segments.shift();
      this.droppedSegments++;
    }
  }
  change(settings: XYSettings) {
    const model = validateXYSettings(settings);
    if (
      !sameXYSupport(settings.parameters, this.configuration.parameters) ||
      settings.initialization !== this.configuration.initialization
    )
      throw new Error(
        'Geometry, boundaries or initialization changes require a new seeded session.',
      );
    const next = settingsOnly(settings);
    if (
      JSON.stringify(next) !== JSON.stringify(settingsOnly(this.configuration))
    ) {
      this.configuration = { ...next, seed: this.configuration.seed };
      this.model = model;
      this.newSegment();
      this.trace = null;
      this.event = null;
    }
    this.version++;
  }
  rotate(alpha: number) {
    if (this.model.h !== 0)
      throw new Error('Global rotation is an action symmetry only at h=0.');
    const next = rotateXY(this.angles, alpha);
    this.angles = next;
    this.version++;
    this.trace = null;
    this.event = { kind: 'global-rotation', alpha, atUpdate: this.updates };
  }
  private measure(segment: XYSegment) {
    const values = xyObservables(this.model, this.angles);
    segment.samples++;
    Object.entries(values).forEach(([key, value]) =>
      recordMoment(segment.moments[key]!, value),
    );
    this.model.bonds.forEach((b, i) =>
      recordMoment(
        segment.bonds[i]!,
        Math.cos(this.angles[b.head]! - this.angles[b.tail]!),
      ),
    );
    segment.sites.forEach((s, i) => {
      const a = this.angles[i]!;
      recordMoment(s.cosine, Math.cos(a));
      recordMoment(s.sine, Math.sin(a));
      s.histogram[Math.min(23, Math.floor(((a + Math.PI) / TAU) * 24))]!++;
    });
    segment.pairs?.forEach((row, i) =>
      row.forEach((m, j) =>
        recordMoment(m, Math.cos(this.angles[j]! - this.angles[i]!)),
      ),
    );
    for (const axis of [0, 1] as const)
      xySpatial(this.model, this.angles, axis).forEach((p, i) =>
        recordMoment(
          (axis === 0 ? segment.spatialX : segment.spatialY)[i]!.moments,
          p.cosine,
        ),
      );
    if (segment.vortex) {
      const v = xyVortices(this.model, this.angles);
      if (v.density === null) segment.vortex.omitted++;
      else {
        segment.vortex.coverage++;
        for (const key of [
          'density',
          'positive',
          'negative',
          'net',
          'absolute',
        ] as const) {
          recordMoment(segment.vortex.moments[key], v[key]!);
          values[`vortex-${key}`] = v[key]!;
        }
      }
    }
    segment.history.push({
      update: this.updates,
      values,
      ...(this.model.size <= 4 ? { angles: this.angles.slice() } : {}),
    });
    if (segment.history.length > 256) segment.history.shift();
  }
  advance(count: number) {
    if (
      !Number.isInteger(count) ||
      count < 1 ||
      count > XY_ADVANCE_LIMIT ||
      !Number.isSafeInteger(this.updates + count)
    )
      throw new Error(
        'XY advances require 1–2048 updates within safe counter range.',
      );
    const segment = this.segments.at(-1)!,
      { sampler, width, warmup, stride } = segment.settings;
    this.event = null;
    for (let i = 0; i < count; i++) {
      this.trace = xyTransition(
        this.model,
        this.angles,
        sampler,
        width,
        this.rng,
      );
      this.updates++;
      segment.updates++;
      segment.draws += this.trace.draws;
      segment.trials += this.trace.trials;
      segment[this.trace.outcome]++;
      const afterWarmup = segment.updates - warmup * this.model.size;
      if (afterWarmup <= 0) segment.warmupUpdates++;
      else if (afterWarmup % (stride * this.model.size) === 0)
        this.measure(segment);
    }
    this.version++;
  }
  snapshot(): XYSnapshot {
    return structuredClone({
      runId: this.runId,
      version: this.version,
      configuration: this.configuration,
      angles: this.angles,
      updates: this.updates,
      draws: this.draws,
      trace: this.trace,
      event: this.event,
      vortices: xyVortices(this.model, this.angles),
      segments: this.segments,
      droppedSegments: this.droppedSegments,
    });
  }
}
/** Messages run to completion; the client alone schedules batches. Validation
 * precedes mutation. A kernel failure stops client scheduling; Reset creates a
 * fresh seeded session rather than pretending a failed batch was acknowledged. */
export class XYEngine {
  private run: XYRun | null = null;
  handle(request: XYRequest): XYResponse {
    try {
      if (request.type === 'initialize') {
        if (
          !Number.isSafeInteger(request.runId) ||
          request.runId < 1 ||
          (this.run && request.runId <= this.run.snapshot().runId)
        )
          throw new Error('Stale XY run identity.');
        this.run = new XYRun(request.configuration, request.runId);
      } else {
        const current = this.run?.snapshot();
        if (
          !current ||
          current.runId !== request.runId ||
          current.version !== request.version
        )
          throw new Error('Stale XY run or version.');
        if (request.type === 'advance') this.run!.advance(request.count);
        else if (request.type === 'change') this.run!.change(request.settings);
        else if (request.type === 'global-rotation')
          this.run!.rotate(request.alpha);
        else throw new Error('Unknown XY command.');
      }
      return { type: 'snapshot', snapshot: this.run!.snapshot() };
    } catch (error) {
      return {
        type: 'error',
        runId: request.runId,
        message: error instanceof Error ? error.message : 'Invalid XY command.',
      };
    }
  }
}
