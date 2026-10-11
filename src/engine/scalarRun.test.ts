import { expect, it } from 'vitest';
import { gaussianScalar, scalarPreset } from '../models/scalarField';
import { ScalarRun } from './scalarRun';
const config = () => ({
  model: scalarPreset('pair'),
  sampler: { kind: 'metropolis' as const, width: 1, warmup: 10 },
  seed: 27,
});
it('keeps vector traces, moments, histograms, convergence and seeded batches synchronized', () => {
  const a = new ScalarRun(1, config()),
    b = new ScalarRun(1, config());
  a.advance(40);
  for (let i = 0; i < 40; i++) b.advance(1);
  expect(a.snapshot()).toEqual(b.snapshot());
  const s = a.snapshot(),
    seg = s.segments[0]!,
    records = seg.scalar!.trajectory;
  expect(seg.moments.count).toBe(30);
  expect(
    seg.histogram.bins.reduce((x, y) => x + y, 0) +
      seg.histogram.below +
      seg.histogram.above,
  ).toBe(30);
  expect(seg.convergence.at(-1)).toMatchObject({
    count: 30,
    mean: seg.moments.mean,
  });
  expect(records.at(-1)!.result).toEqual(s.scalarState);
  expect(records.filter((r) => !r.warmup)).toHaveLength(30);
  for (const r of records.filter((r) => r.kind === 'metropolis'))
    expect(r.delta).toBeCloseTo(
      r.onsite + r.edges.reduce((x, e) => x + e.delta, 0),
      12,
    );
});
it('isolates parameter segments, retains vector/RNG and resets reproducibly', () => {
  const run = new ScalarRun(1, config()),
    control = new ScalarRun(1, config());
  run.advance(30);
  control.advance(30);
  const before = run.snapshot(),
    changed = scalarPreset('pair');
  changed.parameters.h.v0 = 1;
  run.changeSettings({ model: changed, sampler: config().sampler });
  expect(run.snapshot().scalarState).toEqual(before.scalarState);
  expect(run.snapshot().segments[0]).toEqual(before.segments[0]);
  expect(run.snapshot().segments[1]!.moments.count).toBe(0);
  control.changeSettings({ model: changed, sampler: config().sampler });
  run.advance(100);
  control.advance(50);
  control.advance(50);
  expect(run.snapshot()).toEqual(control.snapshot());
  const reset = new ScalarRun(2, config());
  reset.advance(30);
  expect(reset.snapshot().scalarState).toEqual(before.scalarState);
});
it('coupled Gaussian local Metropolis ensemble agrees with exact means and covariance under between-chain uncertainty', () => {
  const model = scalarPreset('pair'),
    config = {
      model,
      sampler: { kind: 'metropolis' as const, width: 1.5, warmup: 500 },
    },
    trials = 48;
  const means: number[] = [],
    crosses: number[] = [];
  for (let seed = 1; seed <= trials; seed++) {
    const run = new ScalarRun(seed, { ...config, seed });
    for (let k = 0; k < 4; k++) run.advance(1024);
    const s = run.snapshot().segments[0]!,
      d = s.scalar!,
      n = s.moments.count;
    means.push(d.targets.v0!.moments.mean!);
    crosses.push(d.cross[0]![1]! / n);
  }
  const average = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;
  const standardError = (v: number[]) =>
    Math.sqrt(
      v.reduce((s, x) => s + (x - average(v)) ** 2, 0) /
        (v.length - 1) /
        v.length,
    );
  const exact = gaussianScalar(model);
  expect(Math.abs(average(means) - exact.mean[0]!)).toBeLessThan(
    4 * standardError(means) + 0.01,
  );
  expect(Math.abs(average(crosses) - exact.correlations[0]![1]!)).toBeLessThan(
    4 * standardError(crosses) + 0.01,
  );
});
it('coordinate Gaussian heat bath uses exact local conditional with seeded site and normal draws', () => {
  const model = scalarPreset('pair'),
    c = { model, sampler: { kind: 'heat-bath' as const, warmup: 0 }, seed: 99 };
  const a = new ScalarRun(1, c),
    b = new ScalarRun(1, c);
  a.advance(25);
  for (let i = 0; i < 25; i++) b.advance(1);
  expect(a.snapshot()).toEqual(b.snapshot());
  const trace = a.snapshot().segments[0]!.scalar!.trajectory;
  for (const t of trace) {
    expect(t.kind).toBe('heat-bath');
    expect(t.site).toMatch(/^v[01]$/);
    expect(t.result.length).toBe(2);
    expect(t.delta).toBeCloseTo(
      t.onsite + t.edges.reduce((s, e) => s + e.delta, 0),
      12,
    );
    const other = t.site === 'v0' ? 1 : 0;
    expect(t.result[other]).toBe(t.before![other]);
  }
});
