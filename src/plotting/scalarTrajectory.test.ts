import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import type { SegmentSnapshot } from '../engine/protocol';
import type { ScalarTrace } from '../engine/scalarRun';
import { ScalarRun } from '../engine/scalarRun';
import { scalarPreset } from '../models/scalarField';
import { ScalarAcceptancePlot } from './ScalarAcceptancePlot';
import { ScalarTrajectoryPlot } from './ScalarTrajectoryPlot';
import { scalarTrajectoryWindow } from './scalarTrajectory';

const model = scalarPreset('pair');
function trace(
  update: number,
  kind: ScalarTrace['kind'] = 'direct',
  before: number[] | null = null,
  result = [update % 7, 0],
  outcome: ScalarTrace['outcome'] = 'draw',
): ScalarTrace {
  return {
    update,
    kind,
    before,
    result,
    outcome,
    warmup: false,
  } as ScalarTrace;
}
function segment(
  id: number,
  startUpdate: number,
  updates: number,
  records: ScalarTrace[],
): SegmentSnapshot {
  return {
    id,
    startUpdate,
    updates,
    model,
    scalar: { trajectory: records },
  } as SegmentSnapshot;
}

it('spreads the last 100 of 100,000 updates over the window and browses retained history only', () => {
  const records = Array.from({ length: 1000 }, (_, i) => trace(99_001 + i));
  const segments = [segment(1, 0, 100_000, records)];
  const latest = scalarTrajectoryWindow(segments, 'v0', 100, null);
  expect([latest.firstShown, latest.lastShown, latest.retained]).toEqual([
    99_900, 100_000, 100,
  ]);
  expect(latest.visible[0]!.records[0]!.xResult).toBeCloseTo(0.01);
  expect(latest.visible[0]!.records.at(-1)!.xResult).toBe(1);
  const older = scalarTrajectoryWindow(segments, 'v0', 500, 99_500);
  expect([older.firstShown, older.lastShown, older.retained]).toEqual([
    99_000, 99_500, 500,
  ]);
  const oldest = scalarTrajectoryWindow(segments, 'v0', 1000, 1);
  expect(oldest.lastShown).toBe(99_001);
  expect(oldest.retained).toBe(1);
  expect(oldest.visible[0]!.records[0]!.trace.update).toBe(99_001);
});

it('keeps disconnected segments separate and projects rejected or unchanged states as horizontal holds', () => {
  const old = segment(1, 0, 2, [trace(1), trace(2)]);
  const local = segment(2, 50, 2, [
    trace(51, 'heat-bath', [2, 0], [2, 1], 'resampled'),
    trace(52, 'metropolis', [2, 1], [2, 1], 'rejected'),
  ]);
  const projection = scalarTrajectoryWindow([old, local], 'v0', 100, null);
  expect(projection.visible.map((s) => s.records.length)).toEqual([2, 2]);
  expect(
    projection.visible[1]!.records.map((r) => [r.before, r.result]),
  ).toEqual([
    [2, 2],
    [2, 2],
  ]);
  const html = renderToStaticMarkup(
    createElement(ScalarTrajectoryPlot, {
      segments: [old, local],
      target: 'v0',
      bounds: { min: -4, max: 4 },
      runId: 1,
      fitVersion: 0,
    }),
  );
  expect(html).toContain('data-testid="scalar-step"');
  expect(html).toContain('data-testid="scalar-rejection"');
  expect(html.match(/data-testid="scalar-step"/g)).toHaveLength(2);
  expect(html).toContain('aria-label="Segment 1"');
  expect(html).toContain('aria-label="Segment 2"');
  expect(html).toContain('&quot;firstShown&quot;:0');
  const directOnly = renderToStaticMarkup(
    createElement(ScalarTrajectoryPlot, {
      segments: [old],
      target: 'v0',
      bounds: { min: -4, max: 4 },
      runId: 1,
      fitVersion: 0,
    }),
  );
  expect(directOnly).not.toContain('data-testid="scalar-step"');
  expect(directOnly.match(/data-testid="scalar-point"/g)).toHaveLength(2);
});

it('retains only the last 1000 real worker transitions after a six-figure run', () => {
  const run = new ScalarRun(1, {
    model,
    sampler: { kind: 'direct' },
    seed: 73,
  });
  for (let i = 0; i < 100; i++) run.advance(1024);
  const snap = run.snapshot();
  expect(snap.updates).toBe(102_400);
  const view = scalarTrajectoryWindow(snap.segments, 'v0', 100, null);
  expect(view.visible[0]!.records).toHaveLength(100);
  expect(view.visible[0]!.records[0]!.trace.update).toBe(102_301);
  expect(view.visible[0]!.records.at(-1)!.trace.update).toBe(102_400);
  expect(view.earliestRetained).toBe(101_401);
});

it('shows graphical Metropolis counts and N/A for direct and heat bath', () => {
  const base = {
    id: 1,
    sampler: { kind: 'metropolis' },
    updates: 20,
    accepted: 12,
    rejected: 8,
    warmupUpdates: 5,
  } as SegmentSnapshot;
  const direct = {
    ...base,
    id: 2,
    sampler: { kind: 'direct' },
    accepted: 0,
    rejected: 0,
    warmupUpdates: 0,
  } as SegmentSnapshot;
  const heatBath = {
    ...base,
    id: 3,
    sampler: { kind: 'heat-bath' },
    accepted: 0,
    rejected: 0,
  } as SegmentSnapshot;
  const html = renderToStaticMarkup(
    createElement(ScalarAcceptancePlot, { segments: [base, direct, heatBath] }),
  );
  expect(html).toContain('60.0% accepted');
  expect(html).toContain('12 accepted moves · 8 rejected proposals');
  expect(html).toContain('20 attempts including 5 warm-up');
  expect(html).toContain('width:60%');
  expect(html).toContain('width:40%');
  expect(html.match(/Acceptance N\/A/g)).toHaveLength(2);
  expect(html).toContain('independent whole-vector Gaussian draws');
  expect(html).toContain('coordinate Gaussian heat-bath resamplings');
  expect(html.match(/class="acceptance-bar"/g)).toHaveLength(1);
});
