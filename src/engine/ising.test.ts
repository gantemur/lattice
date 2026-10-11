import { createRng } from '../algorithms/rng';
import { transition } from '../algorithms/transitions';
import { expect, it } from 'vitest';
import { SimulationRun } from './simulationEngine';
import {
  isingPreset,
  exactIsing,
  observableValue,
  isingReference,
  conditionalPlus,
  flipDifference,
  spinAt,
} from '../models/ising';
import type { Sampler } from '../algorithms/transitions';
import { projectSegments } from '../plotting/isingProjection';
import { fitSegments, expandViewport } from '../plotting/viewport';
import {
  defaultSlots,
  assignSlot,
  addSlot,
  swapSlots,
} from '../plotting/slots';
const samplers: Sampler[] = [
  { kind: 'direct' },
  { kind: 'metropolis', width: 1, warmup: 11 },
  { kind: 'heat-bath', warmup: 11 },
];
it.each(samplers)(
  'replays $kind batches, steps, snapshots, warm-up and observable histories',
  (sampler) => {
    const config = { model: isingPreset('torus'), sampler, seed: 827 };
    const a = new SimulationRun(1, config),
      b = new SimulationRun(1, config);
    a.advance(256);
    for (let i = 0; i < 256; i++) {
      b.advance(1);
      b.snapshot();
    }
    expect(a.snapshot()).toEqual(b.snapshot());
    const snapshot = a.snapshot(),
      s = snapshot.segments[0]!,
      retained = s.trajectory.filter((t) => !t.warmup);
    expect(s.moments.count).toBe(sampler.kind === 'direct' ? 256 : 245);
    expect(s.ising!.counts.reduce((s, n) => s + n, 0)).toBe(retained.length);
    expect(s.ising!.diagnostics.m.cadence).toEqual(
      sampler.kind === 'direct'
        ? { kind: 'direct' }
        : { kind: 'local', sites: 4 },
    );
    for (const target of Object.keys(s.ising!.observables)) {
      const projected = projectSegments(snapshot.segments, target)[0]!,
        values = retained.map((t) =>
          observableValue(config.model, t.result, target),
        );
      expect(projected.moments.mean).toBeCloseTo(
        values.reduce((s, v) => s + v, 0) / values.length,
        12,
      );
      expect(projected.histogram.bins.reduce((s, n) => s + n, 0)).toBe(
        values.length,
      );
      expect(projected.convergence.at(-1)?.mean).toBe(projected.moments.mean);
      expect(projected.trajectory.at(-1)?.result).toBe(
        observableValue(config.model, snapshot.currentValue!, target),
      );
    }
    if (sampler.kind !== 'direct')
      expect(s.accepted + s.self + s.rejected).toBe(256);
  },
);
it('one-site graph Ising has one elementary update per nominal sweep', () => {
  const run = new SimulationRun(1, {
    model: isingPreset('site'),
    sampler: { kind: 'heat-bath', warmup: 0 },
    seed: 18,
  });
  for (let batch = 0; batch < 8; batch++) run.advance(1024);
  const diagnostic = run.snapshot().segments[0]!.ising!.diagnostics.m;
  expect(diagnostic.cadence).toEqual({ kind: 'local', sites: 1 });
  if (diagnostic.tauMeasurements !== null)
    expect(diagnostic.tauSweeps).toBeCloseTo(diagnostic.tauMeasurements, 12);
});
it('isolates compatible parameter and algorithm changes, rejects topology edits, and Reset replays', () => {
  const model = isingPreset('ring'),
    config = { model, sampler: samplers[1]!, seed: 97 },
    run = new SimulationRun(1, config);
  run.advance(100);
  const old = run.snapshot(),
    changed = structuredClone(model);
  changed.parameters.couplings.e0 = -1.1;
  changed.parameters.fields.v1 = 0.3;
  run.changeSettings({ model: changed, sampler: samplers[2]! });
  let next = run.snapshot();
  expect(next.currentValue).toBe(old.currentValue);
  expect(next.segments[0]).toEqual(old.segments[0]);
  expect(next.moments.count).toBe(0);
  run.advance(20);
  expect(run.snapshot().moments.count).toBe(9);
  expect(run.snapshot().segments[0]).toEqual(old.segments[0]);
  expect(() =>
    run.changeSettings({ model: isingPreset('square'), sampler: samplers[1]! }),
  ).toThrow('Topology');
  const reset = new SimulationRun(1, config);
  reset.advance(100);
  expect(reset.snapshot()).toEqual(old);
  const before = run.snapshot();
  run.changeSettings({ model: changed, sampler: samplers[2]! });
  expect(run.snapshot()).toEqual(before);
});
it('bounds exact configuration records and checkpoints across segments; display edits preserve the entire seeded sequence', () => {
  const config = {
      model: isingPreset('square'),
      sampler: samplers[2]!,
      seed: 91,
    },
    run = new SimulationRun(1, config),
    control = new SimulationRun(1, config);
  run.advance(1024);
  control.advance(1024);
  const snapshot = run.snapshot();
  expect(snapshot.segments[0]!.trajectory).toHaveLength(1000);
  const projected = projectSegments(snapshot.segments, 'E');
  const viewport = fitSegments(projected);
  expandViewport(
    viewport,
    fitSegments(projectSegments(snapshot.segments, 'E')),
  );
  const slots = addSlot(defaultSlots(config), { target: 'v0', plot: 'mean' });
  swapSlots(assignSlot(slots, 0, { target: 'E', plot: 'density' }), 0, 1);
  expect(run.snapshot()).toEqual(snapshot);
  run.advance(7);
  control.advance(7);
  expect(run.snapshot()).toEqual(control.snapshot());
  for (let i = 0; i < 10; i++) {
    const model = isingPreset('square');
    model.parameters.fields.v0 = i / 10;
    run.changeSettings({ model, sampler: samplers[2]! });
    run.advance(20);
  }
  expect(run.snapshot().segments).toHaveLength(8);
  expect(run.snapshot().droppedSegments).toBe(2);
  for (const segment of run.snapshot().segments)
    for (const entry of Object.values(segment.ising!.observables))
      expect(entry.convergence.length).toBeLessThanOrEqual(321);
});
it.each(['metropolis', 'heat-bath'] as const)(
  '%s ensemble mean agrees with exact finite-chain covariance tolerance',
  (kind) => {
    const model = isingPreset('ring');
    model.parameters.fields.v0 = 0.2;
    const exact = exactIsing(model),
      ref = isingReference(model),
      length = 128,
      replicas = 128,
      n = 4;
    // Independent transition-matrix oracle for stationary autocovariance.
    const P = Array.from({ length: 16 }, () => Array<number>(16).fill(0));
    for (let state = 0; state < 16; state++)
      for (let site = 0; site < n; site++) {
        const p =
          kind === 'metropolis'
            ? 0.5 * Math.min(1, Math.exp(-flipDifference(model, state, site)))
            : spinAt(state, site) === 1
              ? 1 - conditionalPlus(model, state, site)
              : conditionalPlus(model, state, site);
        P[state]![state ^ (1 << site)]! += p / n;
        P[state]![state]! += (1 - p) / n;
      }
    const centered = Array.from(
      { length: 16 },
      (_, s) => observableValue(model, s) - ref.mean,
    );
    let propagated = [...centered],
      variance = length * ref.variance;
    for (let lag = 1; lag < length; lag++) {
      propagated = P.map((row) =>
        row.reduce((sum, p, j) => sum + p * propagated[j]!, 0),
      );
      const covariance = exact.probabilities.reduce(
        (s, p, i) => s + p * centered[i]! * propagated[i]!,
        0,
      );
      variance += 2 * (length - lag) * covariance;
    }
    variance /= length ** 2;
    let average = 0;
    for (let seed = 0; seed < replicas; seed++) {
      const run = new SimulationRun(1, {
        model,
        sampler: { kind: 'direct' },
        seed: seed + 537,
      });
      run.advance(1); // exact stationary initial state
      run.changeSettings({
        model,
        sampler:
          kind === 'metropolis'
            ? { kind, width: 1, warmup: 0 }
            : { kind, warmup: 0 },
      });
      run.advance(length);
      average += run.snapshot().moments.mean!;
    }
    expect(Math.abs(average / replicas - ref.mean)).toBeLessThan(
      6 * Math.sqrt(variance / replicas),
    );
  },
);
it('graph one-site references and local differences equal the original single spin', () => {
  for (const h of [-10, -1, 0, 0.4, 10]) {
    const m = isingPreset('site');
    m.parameters.fields.v0 = h;
    expect(isingReference(m).mean).toBeCloseTo(Math.tanh(h), 12);
    expect(flipDifference(m, 1, 0)).toBeCloseTo(2 * h, 12);
  }
});

it('parameter switching keeps the exact random stream through local and direct kernels', () => {
  const rng = createRng(41),
    model = isingPreset('torus');
  let settings = { model, sampler: samplers[1]! },
    state: number | null = 15;
  const run = new SimulationRun(1, { ...settings, seed: 41 });
  for (let segment = 0; segment < 3; segment++) {
    for (let i = 0; i < 37; i++)
      state = transition(settings, state, rng).result;
    run.advance(37);
    expect(run.snapshot().currentValue).toBe(state);
    const next = structuredClone(model);
    next.parameters.fields.v0 = segment * 0.3;
    settings = { model: next, sampler: samplers[segment]! };
    run.changeSettings(settings);
  }
});
