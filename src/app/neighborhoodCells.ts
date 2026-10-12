import type { LatticeShape } from '../domain/indexedLattice';

export type NeighborhoodCell = {
  dx: number;
  dy: number;
  x: number | null;
  y: number | null;
  site: number | null;
  spin: number | null;
  center: boolean;
};

const wrap = (coordinate: number, length: number) =>
  ((coordinate % length) + length) % length;

/** Map displayed offsets to physical sites; repeated periodic images stay distinct tiles. */
export function latticeNeighborhood(
  shape: LatticeShape,
  spins: ArrayLike<number>,
  selected: number,
): NeighborhoodCell[] {
  const { lx, ly, periodicX, periodicY } = shape;
  if (!Number.isInteger(selected) || selected < 0 || selected >= lx * ly)
    throw new Error('Selected site is outside the lattice.');
  const centerX = selected % lx;
  const centerY = Math.floor(selected / lx);
  const cells: NeighborhoodCell[] = [];
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const rawX = centerX + dx;
      const rawY = centerY + dy;
      const inside =
        (periodicX || (rawX >= 0 && rawX < lx)) &&
        (periodicY || (rawY >= 0 && rawY < ly));
      const x = inside ? wrap(rawX, lx) : null;
      const y = inside ? wrap(rawY, ly) : null;
      const site = x === null || y === null ? null : x + lx * y;
      cells.push({
        dx,
        dy,
        x,
        y,
        site,
        spin: site === null ? null : spins[site]!,
        center: dx === 0 && dy === 0,
      });
    }
  }
  return cells;
}
