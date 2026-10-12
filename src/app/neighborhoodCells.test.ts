import { describe, expect, it } from 'vitest';
import { latticeNeighborhood } from './neighborhoodCells';
import type { LatticeShape } from '../domain/indexedLattice';

const shape = (
  lx: number,
  ly: number,
  periodicX = false,
  periodicY = false,
): LatticeShape => ({ lx, ly, periodicX, periodicY });
const spins = (lx: number, ly: number) =>
  Array.from({ length: lx * ly }, (_, site) => (site % 2 ? -1 : 1));

describe('selected-site 5×5 display mapping', () => {
  it('maps a 32×32 interior row by row and preserves center spin', () => {
    const cells = latticeNeighborhood(
      shape(32, 32),
      spins(32, 32),
      9 + 32 * 11,
    );
    expect(cells).toHaveLength(25);
    expect(cells[0]).toMatchObject({ dx: -2, dy: -2, x: 7, y: 9, site: 295 });
    expect(cells[12]).toMatchObject({
      dx: 0,
      dy: 0,
      x: 9,
      y: 11,
      site: 361,
      spin: -1,
      center: true,
    });
    expect(cells[24]).toMatchObject({ x: 11, y: 13, site: 427 });
    expect(cells.filter((cell) => cell.site === null)).toHaveLength(0);
  });

  it('marks cells outside an open corner without wrapping', () => {
    const cells = latticeNeighborhood(shape(32, 32), spins(32, 32), 0);
    expect(cells.filter((cell) => cell.site === null)).toHaveLength(16);
    expect(cells[0]).toMatchObject({ site: null, spin: null });
    expect(cells[12]).toMatchObject({
      x: 0,
      y: 0,
      site: 0,
      spin: 1,
      center: true,
    });
    expect(cells[24]).toMatchObject({ x: 2, y: 2, site: 66 });
  });

  it('wraps each periodic axis independently', () => {
    const periodic = latticeNeighborhood(
      shape(32, 32, true, true),
      spins(32, 32),
      0,
    );
    expect(periodic[0]).toMatchObject({ x: 30, y: 30, site: 990 });
    const cylinder = latticeNeighborhood(
      shape(32, 32, true, false),
      spins(32, 32),
      0,
    );
    expect(cylinder[0]).toMatchObject({ site: null });
    expect(cylinder[10]).toMatchObject({ x: 30, y: 0, site: 30 });
    expect(cylinder[2]).toMatchObject({ site: null });
    const otherCylinder = latticeNeighborhood(
      shape(32, 32, false, true),
      spins(32, 32),
      0,
    );
    expect(otherCylinder[2]).toMatchObject({ x: 0, y: 30, site: 960 });
    expect(otherCylinder[10]).toMatchObject({ site: null });
  });

  it('shows repeated physical sites on a periodic 2×2 without merging tiles', () => {
    const cells = latticeNeighborhood(
      shape(2, 2, true, true),
      [1, -1, -1, 1],
      3,
    );
    expect(cells[12]).toMatchObject({
      x: 1,
      y: 1,
      site: 3,
      spin: 1,
      center: true,
    });
    expect(cells[0]).toMatchObject({ x: 1, y: 1, site: 3, spin: 1 });
    expect(cells.filter((cell) => cell.site === 3)).toHaveLength(9);
    expect(new Set(cells.map((cell) => cell.site))).toEqual(
      new Set([0, 1, 2, 3]),
    );
  });
});
