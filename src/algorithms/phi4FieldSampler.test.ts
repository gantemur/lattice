import { expect, it } from 'vitest';
import { createFieldLattice } from '../domain/fieldLattice';
import { defaultPhi4Field, phi4Action } from '../models/phi4Field';
import { phi4Transition } from './phi4FieldSampler';

it('uses complete periodic-bond ΔS, exactly three uniforms and preserves rejected states', () => {
  const p = {
      ...defaultPhi4Field,
      shape: { kind: 'chain' as const, length: 2, periodic: true },
    },
    l = createFieldLattice(p.shape);
  for (const [field, draws, outcome] of [
    [[0, 0], [0.1, 0.9, 0.99], 'rejected'],
    [[0, 0], [0.1, 0.9, 0.001], 'accepted'],
    [[1, -1], [0.1, 0.1, 0.99], 'accepted'],
  ] as const) {
    let count = 0;
    const result = phi4Transition(l, p, field, 1, {
      uniform: () => draws[count++]!,
    });
    expect(count).toBe(3);
    expect(result.trace.outcome).toBe(outcome);
    const proposed = [...field] as number[];
    proposed[0] = result.trace.proposed!;
    expect(result.trace.deltaAction).toBeCloseTo(
      phi4Action(l, p, proposed) - phi4Action(l, p, field),
      12,
    );
    if (outcome === 'rejected') expect(result.field).toEqual(field);
    else expect(result.field[1]).toBe(field[1]);
  }
});
it('rejects overflow without spending extra draws or replacing the old field', () => {
  const p = {
      ...defaultPhi4Field,
      shape: { kind: 'chain' as const, length: 2, periodic: true },
    },
    l = createFieldLattice(p.shape);
  let count = 0;
  const field = [1e100, 0];
  const result = phi4Transition(l, p, field, 10, {
    uniform: () => {
      count++;
      return 0.1;
    },
  });
  expect(count).toBe(3);
  expect(result.field).toEqual(field);
  expect(result.trace.deltaAction).toBeNull();
  expect(result.trace.accepted).toBe(false);
  expect(() =>
    phi4Transition(l, p, [0, 0], 0, { uniform: () => 0.2 }),
  ).toThrow();
});
