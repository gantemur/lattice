import { topologyKey } from '../domain/graph';
import type { Settings } from '../algorithms/transitions';
import { validateSettings } from '../algorithms/transitions';
import { createRng } from '../algorithms/rng';
import type { Rng } from '../algorithms/rng';
import {
  scalarTargets,
  scalarObservable,
  scalarAction,
  localDifference,
  gaussianScalar,
  gaussianConditional,
  scalarReference,
  quarticReference,
} from '../models/scalarField';
import type { ScalarModel, RealVector } from '../models/scalarField';
import { createHistogram, recordHistogram } from '../observables/histogram';
import type { Histogram } from '../observables/histogram';
import {
  emptyMoments,
  recordMoment,
  summarizeMoments,
} from '../observables/moments';
import type { Moments } from '../observables/moments';
import { ConvergenceHistory } from '../observables/convergence';
import { MAX_SEGMENTS } from './protocol';
import type {
  RunConfiguration,
  Snapshot,
  SegmentSnapshot,
  SmallCapture,
} from './protocol';

export type ScalarTrace = {
  kind: 'direct' | 'heat-bath' | 'metropolis';
  update: number;
  segmentUpdate: number;
  warmup: boolean;
  site: string | null;
  before: RealVector | null;
  proposed: RealVector;
  result: RealVector;
  onsite: number;
  edges: {
    edgeId: string;
    neighbor: string;
    value: number;
    coupling: number;
    delta: number;
  }[];
  delta: number | null;
  alpha: number | null;
  uniform: number | null;
  siteUniform: number | null;
  proposalUniform: number | null;
  accepted: boolean | null;
  outcome: 'draw' | 'resampled' | 'accepted' | 'rejected';
};
export type ScalarTargetSnapshot = {
  moments: ReturnType<typeof summarizeMoments>;
  histogram: Histogram;
  convergence: { count: number; mean: number }[];
};
export type ScalarSegmentSnapshot = {
  targets: Record<string, ScalarTargetSnapshot>;
  cross: number[][];
  scatter: [number, number][];
  trajectory: ScalarTrace[];
  initialState: RealVector | null;
};
type TargetState = {
  moments: Moments;
  histogram: Histogram;
  convergence: ConvergenceHistory;
};
type Segment = {
  id: number;
  model: ScalarModel;
  sampler: Settings['sampler'];
  startUpdate: number;
  initialState: RealVector | null;
  updates: number;
  warmupUpdates: number;
  warmupTarget: number;
  accepted: number;
  rejected: number;
  self: number;
  targets: Record<string, TargetState>;
  cross: number[][];
  scatter: [number, number][];
  trajectory: ScalarTrace[];
};
function bounds(model: ScalarModel, target: string): [number, number] {
  const ref = scalarReference(model, target);
  if (ref) {
    const span = Math.max(1, 4 * Math.sqrt(Math.max(0, ref.variance)));
    return [ref.mean - span, ref.mean + span];
  }
  const id = target.replace('²', ''),
    i = model.parameters.domain.vertices.findIndex((v) => v.id === id);
  if (i >= 0) {
    const v = model.parameters.domain.vertices[i]!,
      { a, lambda, h } = model.parameters;
    const q = quarticReference(a[v.id]!, lambda[v.id]!, h[v.id]!);
    const span = Math.max(2, 4 * Math.sqrt(q.variance));
    return target.endsWith('²')
      ? [0, Math.max(1, (Math.abs(q.mean) + span) ** 2)]
      : [q.mean - span, q.mean + span];
  }
  return target === 'S' ? [-20, 40] : [-20, 20];
}
function newSegment(
  id: number,
  settings: Settings,
  startUpdate: number,
  state: RealVector | null,
): Segment {
  if (settings.model.kind !== 'scalar')
    throw new Error('Expected scalar field.');
  const model = structuredClone(settings.model),
    sampler = { ...settings.sampler },
    targets: Record<string, TargetState> = {};
  for (const target of scalarTargets(model)) {
    const [min, max] = bounds(model, target);
    targets[target] = {
      moments: emptyMoments(),
      histogram: createHistogram(min, max),
      convergence: new ConvergenceHistory(),
    };
  }
  const n = model.parameters.domain.vertices.length;
  return {
    id,
    model,
    sampler,
    startUpdate,
    initialState: state?.slice() ?? null,
    updates: 0,
    warmupUpdates: 0,
    warmupTarget: sampler.kind === 'direct' ? 0 : (sampler.warmup ?? 200),
    accepted: 0,
    rejected: 0,
    self: 0,
    targets,
    cross: Array.from({ length: n }, () => Array<number>(n).fill(0)),
    scatter: [],
    trajectory: [],
  };
}
function gaussianDraw(rng: Rng): number {
  return (
    Math.sqrt(-2 * Math.log(rng.uniform())) *
    Math.cos(2 * Math.PI * rng.uniform())
  );
}
function transition(
  s: Segment,
  current: RealVector | null,
  rng: Rng,
): Omit<ScalarTrace, 'update' | 'segmentUpdate' | 'warmup'> {
  const model = s.model,
    n = model.parameters.domain.vertices.length;
  if (s.sampler.kind === 'direct') {
    const { L, mean } = gaussianScalar(model),
      z = mean.map(() => gaussianDraw(rng)),
      noise = Array<number>(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let v = z[i]!;
      for (let j = i + 1; j < n; j++) v -= L[j]![i]! * noise[j]!;
      noise[i] = v / L[i]![i]!;
    }
    return {
      kind: 'direct',
      site: null,
      before: current?.slice() ?? null,
      proposed: mean.map((v, i) => v + noise[i]!),
      result: mean.map((v, i) => v + noise[i]!),
      onsite: 0,
      edges: [],
      delta: null,
      alpha: null,
      uniform: null,
      siteUniform: null,
      proposalUniform: null,
      accepted: null,
      outcome: 'draw',
    };
  }
  if (!current) throw new Error('Local sampler needs a vector configuration.');
  const siteUniform = rng.uniform(),
    i = Math.min(n - 1, Math.floor(siteUniform * n)),
    site = model.parameters.domain.vertices[i]!.id;
  if (s.sampler.kind === 'heat-bath') {
    const c = gaussianConditional(model, current, i),
      next = current.slice();
    next[i] = c.mean + Math.sqrt(c.variance) * gaussianDraw(rng);
    const delta = localDifference(model, current, i, next[i]!);
    return {
      kind: 'heat-bath',
      site,
      before: current.slice(),
      proposed: next.slice(),
      result: next,
      onsite: delta.onsite,
      edges: delta.edges,
      delta: delta.total,
      alpha: null,
      uniform: null,
      siteUniform,
      proposalUniform: null,
      accepted: null,
      outcome: 'resampled',
    };
  }
  const proposalUniform = rng.uniform(),
    next = current.slice();
  next[i] = next[i]! + s.sampler.width * (2 * proposalUniform - 1);
  const difference = localDifference(model, current, i, next[i]!),
    alpha = Math.exp(Math.min(0, -difference.total)),
    uniform = rng.uniform(),
    accepted = uniform < alpha;
  return {
    kind: 'metropolis',
    site,
    before: current.slice(),
    proposed: next,
    result: accepted ? next : current.slice(),
    onsite: difference.onsite,
    edges: difference.edges,
    delta: difference.total,
    alpha,
    uniform,
    siteUniform,
    proposalUniform,
    accepted,
    outcome: accepted ? 'accepted' : 'rejected',
  };
}
export class ScalarRun {
  private readonly rng: Rng;
  private readonly seed: number;
  private segments: Segment[];
  private state: RealVector | null;
  private updates = 0;
  private warmupUpdates = 0;
  private version = 0;
  private droppedSegments = 0;
  constructor(
    private readonly runId: number,
    configuration: RunConfiguration,
  ) {
    validateSettings(configuration);
    if (configuration.model.kind !== 'scalar')
      throw new Error('Expected scalar field.');
    this.seed = configuration.seed;
    this.rng = createRng(this.seed);
    this.state =
      configuration.sampler.kind === 'direct'
        ? null
        : configuration.model.parameters.domain.vertices.map(() => 0);
    this.segments = [newSegment(1, configuration, 0, this.state)];
  }
  private get current() {
    return this.segments.at(-1)!;
  }
  changeSettings(settings: Settings) {
    validateSettings(settings);
    if (settings.model.kind !== 'scalar')
      throw new Error('Model family change requires a new session.');
    if (
      topologyKey(settings.model.parameters.domain) !==
      topologyKey(this.current.model.parameters.domain)
    )
      throw new Error('Topology change requires a new session.');
    if (
      JSON.stringify([settings.model.parameters, settings.sampler]) ===
      JSON.stringify([this.current.model.parameters, this.current.sampler])
    )
      return;
    if (this.state === null && settings.sampler.kind !== 'direct')
      this.state = settings.model.parameters.domain.vertices.map(() => 0);
    this.segments.push(
      newSegment(this.current.id + 1, settings, this.updates, this.state),
    );
    if (this.segments.length > MAX_SEGMENTS) {
      this.segments.shift();
      this.droppedSegments++;
    }
    this.version++;
  }
  advance(count: number) {
    if (!Number.isInteger(count) || count < 1 || count > 1024)
      throw new Error('A batch must contain between 1 and 1024 updates.');
    if (!Number.isSafeInteger(this.version + count))
      throw new Error('Update counter limit reached.');
    const s = this.current;
    for (let k = 0; k < count; k++) {
      const t = transition(s, this.state, this.rng);
      this.state = t.result.slice();
      this.updates++;
      s.updates++;
      const warmup = s.updates <= s.warmupTarget;
      if (t.kind === 'metropolis') s[t.accepted ? 'accepted' : 'rejected']++;
      if (warmup) {
        s.warmupUpdates++;
        this.warmupUpdates++;
      } else {
        for (const [target, data] of Object.entries(s.targets)) {
          const v = scalarObservable(s.model, this.state, target);
          recordMoment(data.moments, v);
          recordHistogram(data.histogram, v);
          data.convergence.record(data.moments.count, data.moments.mean);
        }
        for (let i = 0; i < this.state.length; i++)
          for (let j = 0; j < this.state.length; j++)
            s.cross[i]![j]! += this.state[i]! * this.state[j]!;
        if (this.state.length >= 2) {
          s.scatter.push([this.state[0]!, this.state[1]!]);
          if (s.scatter.length > 1000) s.scatter.shift();
        }
      }
      s.trajectory.push({
        ...t,
        update: this.updates,
        segmentUpdate: s.updates,
        warmup,
      });
      if (s.trajectory.length > 1000) s.trajectory.shift();
    }
    this.version += count;
  }
  snapshot(): Snapshot {
    const segments: SegmentSnapshot[] = this.segments.map((s) => {
      const targets = Object.fromEntries(
        Object.entries(s.targets).map(([key, value]) => [
          key,
          {
            moments: summarizeMoments(value.moments),
            histogram: { ...value.histogram, bins: [...value.histogram.bins] },
            convergence: value.convergence.snapshot(),
          },
        ]),
      );
      const first = s.model.parameters.domain.vertices[0]!.id,
        d = targets[first]!;
      return {
        id: s.id,
        model: structuredClone(s.model),
        sampler: { ...s.sampler },
        startUpdate: s.startUpdate,
        initialValue: s.initialState?.[0] ?? null,
        initialization: s.initialState
          ? 'Deterministic initial real vector; not a measurement.'
          : 'No sample yet.',
        updates: s.updates,
        warmupUpdates: s.warmupUpdates,
        warmupTarget: s.warmupTarget,
        accepted: s.accepted,
        rejected: s.rejected,
        self: s.self,
        moments: d.moments,
        histogram: d.histogram,
        convergence: d.convergence,
        trajectory: [],
        scalar: {
          targets,
          cross: s.cross.map((r) => r.slice()),
          scatter: s.scatter.map((p) => [...p] as [number, number]),
          trajectory: s.trajectory.map((t) => ({
            ...t,
            before: t.before?.slice() ?? null,
            proposed: t.proposed.slice(),
            result: t.result.slice(),
            edges: t.edges.map((e) => ({ ...e })),
          })),
          initialState: s.initialState?.slice() ?? null,
        },
      };
    });
    const current = segments.at(-1)!;
    return {
      runId: this.runId,
      version: this.version,
      configuration: {
        model: structuredClone(this.current.model),
        sampler: { ...this.current.sampler },
        seed: this.seed,
      },
      currentValue: this.state?.[0] ?? null,
      scalarState: this.state?.slice(),
      currentAction: this.state
        ? scalarAction(this.current.model, this.state)
        : null,
      updates: this.updates,
      warmupUpdates: this.warmupUpdates,
      strideUpdates: 1,
      moments: current.moments,
      histogram: current.histogram,
      segments,
      activeSegmentId: current.id,
      droppedSegments: this.droppedSegments,
    };
  }
  capture(segmentId: number): SmallCapture {
    const segment = this.snapshot().segments.find((s) => s.id === segmentId);
    if (!segment) throw new Error('Segment is no longer available.');
    return {
      workspace: 'small',
      runId: this.runId,
      version: this.version,
      seed: this.seed,
      captureUpdate: this.updates,
      segment,
      diagnosticRecord: null,
      currentState:
        segmentId === this.current.id
          ? { update: this.updates, value: this.state?.slice() ?? null }
          : null,
    };
  }
}
