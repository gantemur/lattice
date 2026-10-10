import { expect, it } from 'vitest';
import { GaussianRun } from '../engine/gaussianEngine';
import { fitSegments, expandViewport } from './viewport';
import { assignSlot, defaultSlots, swapSlots } from './slots';
it('defaults to density and convergence, with exactly four independent slots', () => {
  expect(defaultSlots).toEqual([
    { target: 'x', plot: 'density' },
    { target: 'x', plot: 'mean' },
    null,
    null,
  ]);
  const assigned = assignSlot(defaultSlots, 2, { target: 'x', plot: 'error' });
  expect(swapSlots(assigned, 0, 2)).toEqual([
    { target: 'x', plot: 'error' },
    defaultSlots[1],
    defaultSlots[0],
    null,
  ]);
  expect(defaultSlots[2]).toBeNull();
  expect(assignSlot(assigned, 0, null)).toHaveLength(4);
  expect(() => assignSlot(defaultSlots, 4, null)).toThrow();
});
it('preserves axes on switching, only expands automatically, and Fit All never changes measurements', () => {
  const run = new GaussianRun(1, { parameters: { a: 1, h: 0 }, seed: 1 });
  run.advance(1);
  const initial = fitSegments(run.snapshot().segments);
  run.changeParameters({ a: 20, h: 10 });
  run.advance(10);
  const expanded = expandViewport(
    initial,
    fitSegments(run.snapshot().segments),
  );
  expect(expanded.density.min).toBe(initial.density.min);
  expect(expanded.density.max).toBe(initial.density.max);
  expect(expanded.density.yMax).toBeGreaterThanOrEqual(initial.density.yMax);
  run.changeParameters({ a: 0.05, h: 10 });
  const wider = expandViewport(expanded, fitSegments(run.snapshot().segments));
  expect(wider.density.min).toBe(initial.density.min);
  expect(wider.density.max).toBeGreaterThan(200);
  for (let i = 0; i < 8; i++) run.changeParameters({ a: 20, h: i % 2 });
  const retained = fitSegments(run.snapshot().segments);
  expect(expandViewport(wider, retained)).toEqual(wider);
  expect(retained.density.max).toBeLessThan(wider.density.max);
  const state = run.snapshot();
  fitSegments(state.segments);
  assignSlot(defaultSlots, 3, { target: 'x', plot: 'error' });
  expect(run.snapshot()).toEqual(state);
  const reset = new GaussianRun(2, { parameters: { a: 1, h: 0 }, seed: 1 });
  expect(fitSegments(reset.snapshot().segments).density).toMatchObject({
    min: -4,
    max: 4,
  });
});
