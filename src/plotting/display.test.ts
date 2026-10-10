import { formatNumber } from './PlotFrame';
import type { GaussianParameters } from '../models/gaussian';
const settings = (parameters: GaussianParameters) => ({
  model: { kind: 'gaussian' as const, parameters },
  sampler: { kind: 'direct' as const },
});
import { expect, it } from 'vitest';
import { SimulationRun } from '../engine/simulationEngine';
import { fitSegments, expandViewport } from './viewport';
import {
  assignSlot,
  defaultSlots as makeDefaultSlots,
  swapSlots,
} from './slots';
const defaultSlots = makeDefaultSlots(settings({ a: 1, h: 0 }));
it('defaults to distribution, trajectory and convergence with exactly four independent slots', () => {
  expect(defaultSlots.map((s) => s?.plot ?? null)).toEqual([
    'density',
    'trajectory',
    'mean',
    null,
  ]);
  const assigned = assignSlot(defaultSlots, 3, { target: 'x', plot: 'error' });
  expect(swapSlots(assigned, 0, 3)).toEqual([
    { target: 'x', plot: 'error' },
    defaultSlots[1],
    defaultSlots[2],
    defaultSlots[0],
  ]);
  expect(defaultSlots[3]).toBeNull();
  expect(assignSlot(assigned, 0, null)).toHaveLength(4);
  expect(() => assignSlot(defaultSlots, 4, null)).toThrow();
  expect(
    makeDefaultSlots({
      model: { kind: 'spin', parameters: { h: 0 } },
      sampler: { kind: 'metropolis', width: 1, warmup: 10 },
    })[3],
  ).toEqual({ target: 's', plot: 'acceptance' });
});
it('preserves axes on switching, only expands automatically, and Fit All never changes measurements', () => {
  const run = new SimulationRun(1, { ...settings({ a: 1, h: 0 }), seed: 1 });
  run.advance(1);
  const initial = fitSegments(run.snapshot().segments);
  run.changeSettings(settings({ a: 20, h: 10 }));
  run.advance(10);
  const expanded = expandViewport(
    initial,
    fitSegments(run.snapshot().segments),
  );
  expect(expanded.density.min).toBe(initial.density.min);
  expect(expanded.density.max).toBe(initial.density.max);
  expect(expanded.density.yMax).toBeGreaterThanOrEqual(initial.density.yMax);
  run.changeSettings(settings({ a: 0.05, h: 10 }));
  const wider = expandViewport(expanded, fitSegments(run.snapshot().segments));
  expect(wider.density.min).toBe(initial.density.min);
  expect(wider.density.max).toBeGreaterThan(200);
  for (let i = 0; i < 8; i++) run.changeSettings(settings({ a: 20, h: i % 2 }));
  const retained = fitSegments(run.snapshot().segments);
  expect(expandViewport(wider, retained)).toEqual(wider);
  expect(retained.density.max).toBeLessThan(wider.density.max);
  const state = run.snapshot();
  fitSegments(state.segments);
  assignSlot(defaultSlots, 3, { target: 'x', plot: 'error' });
  expect(run.snapshot()).toEqual(state);
  const reset = new SimulationRun(2, { ...settings({ a: 1, h: 0 }), seed: 1 });
  expect(fitSegments(reset.snapshot().segments).density).toMatchObject({
    min: -4,
    max: 4,
  });
});

it('keeps small nonzero values visible instead of rounding them to zero', () => {
  expect(formatNumber(8.244614455767397e-9)).toBe('8.245e-9');
  expect(formatNumber(-0.000003)).toBe('-3.000e-6');
  expect(formatNumber(0)).toBe('0');
  expect(formatNumber(null)).toBe('—');
});
