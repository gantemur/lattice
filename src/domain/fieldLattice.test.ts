import { expect, it } from 'vitest';
import { createFieldLattice } from './fieldLattice';

it('keeps open and periodic two-site chains distinct', () => {
  const open = createFieldLattice({
    kind: 'chain',
    length: 2,
    periodic: false,
  });
  const periodic = createFieldLattice({
    kind: 'chain',
    length: 2,
    periodic: true,
  });
  expect(open.bonds.map((b) => [b.tail, b.head, b.wraps])).toEqual([
    [0, 1, false],
  ]);
  expect(periodic.bonds.map((b) => [b.tail, b.head, b.wraps])).toEqual([
    [0, 1, false],
    [1, 0, true],
  ]);
  expect(periodic.incident.map((bonds) => bonds.length)).toEqual([2, 2]);
});

it('uses row-major 2×2 sites and eight distinct positive-axis torus bonds', () => {
  const torus = createFieldLattice({
    kind: 'rectangle',
    lx: 2,
    ly: 2,
    periodicX: true,
    periodicY: true,
  });
  expect(torus.bonds).toHaveLength(8);
  expect(torus.bonds.filter((bond) => bond.axis === 'x')).toHaveLength(4);
  expect(torus.bonds.filter((bond) => bond.axis === 'y')).toHaveLength(4);
  expect(torus.incident.map((bonds) => bonds.length)).toEqual([4, 4, 4, 4]);
  const open = createFieldLattice({
    kind: 'rectangle',
    lx: 2,
    ly: 2,
    periodicX: false,
    periodicY: false,
  });
  expect(open.bonds.map((bond) => [bond.tail, bond.head])).toEqual([
    [0, 1],
    [0, 2],
    [1, 3],
    [2, 3],
  ]);
  const cylinder = createFieldLattice({
    kind: 'rectangle',
    lx: 2,
    ly: 2,
    periodicX: false,
    periodicY: true,
  });
  expect(cylinder.bonds).toHaveLength(6);
  expect(cylinder.bonds.filter((bond) => bond.wraps)).toHaveLength(2);
});

it('a 1D periodic four-site chain has four bonds and no fake vertical self-links', () => {
  const chain = createFieldLattice({
    kind: 'chain',
    length: 4,
    periodic: true,
  });
  expect(chain.bonds).toHaveLength(4);
  expect(
    chain.bonds.every((bond) => bond.tail !== bond.head && bond.axis === 'x'),
  ).toBe(true);
  expect(() =>
    createFieldLattice({
      kind: 'rectangle',
      lx: 4,
      ly: 1,
      periodicX: true,
      periodicY: true,
    }),
  ).toThrow();
});
