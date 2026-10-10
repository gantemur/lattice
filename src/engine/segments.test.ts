import { expect, it } from 'vitest';
import { GaussianRun, MAX_SEGMENTS } from './gaussianEngine';
import { createHistogram, recordHistogram } from '../observables/histogram';
import { gaussianReference } from '../models/gaussian';
import { createRng } from '../algorithms/rng';
import { sampleGaussian } from '../algorithms/gaussianSampler';
import {
  recordMoment,
  emptyMoments,
  summarizeMoments,
} from '../observables/moments';
const initial = { parameters: { a: 1, h: 0 }, seed: 9 };
it('preserves configuration and RNG across switches, isolating every measurement', () => {
  const run = new GaussianRun(1, initial),
    rng = createRng(9);
  const parameters = [initial.parameters, { a: 4, h: 2 }, initial.parameters];
  parameters.forEach((p, i) => {
    const before = run.snapshot();
    run.changeParameters(p);
    expect(run.snapshot().currentValue).toBe(before.currentValue);
    expect(run.snapshot().updates).toBe(before.updates);
    if (i > 0) {
      expect(run.snapshot().moments.count).toBe(0);
      expect(run.snapshot().segments.slice(0, -1)).toEqual(before.segments);
    }
    const oracle = emptyMoments();
    const reference = gaussianReference(p);
    const histogram = createHistogram(
      reference.mean - 4 * reference.standardDeviation,
      reference.mean + 4 * reference.standardDeviation,
    );
    const means: number[] = [];
    for (let n = 0; n < 113; n++) {
      const value = sampleGaussian(p, rng);
      recordMoment(oracle, value);
      recordHistogram(histogram, value);
      means.push(oracle.mean);
    }
    run.advance(113);
    const state = run.snapshot(),
      segment = state.segments.at(-1)!;
    expect(segment.moments).toEqual(summarizeMoments(oracle));
    expect(segment.histogram).toEqual(histogram);
    for (const checkpoint of segment.convergence)
      expect(checkpoint.mean).toBe(means[checkpoint.count - 1]);
    expect(segment.convergence.at(-1)).toEqual({
      count: 113,
      mean: oracle.mean,
    });
    expect(
      segment.histogram.bins.reduce(
        (a, b) => a + b,
        segment.histogram.above + segment.histogram.below,
      ),
    ).toBe(113);
    expect(segment.startUpdate).toBe(113 * i);
    expect(state.moments).toEqual(segment.moments);
    expect(state.histogram).toEqual(segment.histogram);
  });
  expect(run.snapshot().updates).toBe(339);
});
it('replays switching schedules independently of batches and snapshot frequency', () => {
  const one = new GaussianRun(1, initial),
    batched = new GaussianRun(1, initial);
  for (const p of [
    { a: 1, h: 0 },
    { a: 2, h: 5 },
    { a: 1, h: 0 },
  ]) {
    one.changeParameters(p);
    batched.changeParameters(p);
    for (let i = 0; i < 800; i++) {
      one.advance(1);
      one.snapshot();
    }
    batched.advance(800);
    expect(one.snapshot()).toEqual(batched.snapshot());
  }
});
it('bounds old segments without pooling or changing the stream', () => {
  const run = new GaussianRun(1, initial),
    rng = createRng(initial.seed);
  let value = 0;
  for (let i = 0; i < 20; i++) {
    const p = { a: 1, h: i % 2 };
    run.changeParameters(p);
    run.advance(1);
    value = sampleGaussian(p, rng);
  }
  const s = run.snapshot();
  expect(s.segments).toHaveLength(MAX_SEGMENTS);
  expect(s.droppedSegments).toBe(20 - MAX_SEGMENTS);
  expect(s.segments.map((segment) => segment.id)).toEqual([
    13, 14, 15, 16, 17, 18, 19, 20,
  ]);
  expect(s.currentValue).toBe(value);
});
it('does not change state on invalid parameters or identical Apply', () => {
  const run = new GaussianRun(1, initial);
  run.advance(16);
  const before = run.snapshot();
  run.changeParameters(initial.parameters);
  expect(run.snapshot()).toEqual(before);
  expect(() => run.changeParameters({ a: 0, h: 0 })).toThrow();
  expect(run.snapshot()).toEqual(before);
});
it('Reset creates empty history and replays the chosen seed with current parameters', () => {
  const old = new GaussianRun(1, initial);
  old.advance(10);
  old.changeParameters({ a: 4, h: 2 });
  old.advance(8);
  const fresh = new GaussianRun(2, old.snapshot().configuration);
  expect(fresh.snapshot()).toMatchObject({
    updates: 0,
    currentValue: null,
    droppedSegments: 0,
    activeSegmentId: 1,
  });
  expect(fresh.snapshot().segments).toHaveLength(1);
  expect(fresh.snapshot().segments[0]!.convergence).toEqual([]);
  fresh.advance(1);
  expect(fresh.snapshot().currentValue).toBe(
    sampleGaussian({ a: 4, h: 2 }, createRng(initial.seed)),
  );
});
