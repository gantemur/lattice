import { expect, it } from 'vitest';
import {
  bondInspection,
  conditionalPlus,
  exactIsing,
  flipDifference,
  isingAction,
  isingPreset,
  neighborhood,
  spinAt,
} from './ising';
it('inspects every parallel bond and self-link without changing the model', () => {
  const model = isingPreset('torus');
  model.parameters.domain.edges.push({ id: 'self', tail: 'v0', head: 'v0' });
  model.parameters.couplings.self = -1.7;
  model.parameters.fields.v0 = 0.2;
  const before = structuredClone(model);
  const exact = exactIsing(model);
  for (let state = 0; state < 16; state++) {
    const bonds = model.parameters.domain.edges.map((e) =>
      bondInspection(model, state, e.id),
    );
    expect(
      bonds.reduce((s, b) => s + b.action, 0) - 0.2 * spinAt(state, 0),
    ).toBeCloseTo(isingAction(model, state), 14);
    expect(bonds.at(-1)).toMatchObject({
      kind: 'Self-link',
      product: 1,
      action: 1.7,
    });
    const local = neighborhood(model, state, 0);
    expect(local.contributions).toHaveLength(4);
    expect(new Set(local.contributions.map((c) => c.edgeId)).size).toBe(4);
    expect(2 * spinAt(state, 0) * local.localField).toBeCloseTo(
      isingAction(model, state ^ 1) - isingAction(model, state),
      13,
    );
    expect(flipDifference(model, state, 0)).toBeCloseTo(
      2 * spinAt(state, 0) * local.localField,
      14,
    );
    expect(conditionalPlus(model, state, 0)).toBeCloseTo(
      exact.probabilities[state | 1]! /
        (exact.probabilities[state | 1]! + exact.probabilities[state & ~1]!),
      14,
    );
  }
  expect(model).toEqual(before);
});
