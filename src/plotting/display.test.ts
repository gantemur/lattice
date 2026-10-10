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
  addSlot,
  defaultSlots as makeDefaultSlots,
  swapSlots,
} from './slots';
const defaultSlots = makeDefaultSlots(settings({ a: 1, h: 0 }));
it('defaults to two views and supports zero to six independent plots', () => {
  expect(defaultSlots.map((s) => s.plot)).toEqual(['density', 'trajectory']);
  const assigned = assignSlot(defaultSlots, 1, { target: 'x', plot: 'error' });
  expect(swapSlots(assigned, 0, 1)[0]).toEqual({ target: 'x', plot: 'error' });
  expect(defaultSlots[1]!.plot).toBe('trajectory');
  expect(assignSlot(assignSlot(defaultSlots, 0, null), 0, null)).toEqual([]);
  let six = defaultSlots;
  for (let i = 0; i < 4; i++) six = addSlot(six, { target: 'x', plot: 'mean' });
  expect(six).toHaveLength(6);
  expect(() => addSlot(six, { target: 'x', plot: 'mean' })).toThrow();
  expect(() => assignSlot(defaultSlots, 4, null)).toThrow();
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
  assignSlot(defaultSlots, 1, { target: 'x', plot: 'error' });
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
